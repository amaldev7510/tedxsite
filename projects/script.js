const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const winScreen = document.getElementById('win-screen');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const finalScoreEl = document.getElementById('final-score');
const winScoreEl = document.getElementById('win-score');
const gravityIndicator = document.getElementById('gravity-indicator');

// Buttons
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const nextLevelBtn = document.getElementById('next-level-btn');

// Game State Enum
const GAME_STATE = {
    START: 0,
    PLAYING: 1,
    GAME_OVER: 2,
    WIN: 3
};
let currentState = GAME_STATE.START;

// Game Variables
let score = 0;
let lives = 3;
let level = 1;
let lastTime = 0;
let animationId;

// Mechanics
let gravityInverted = false;
const GRAVITY_INTERVAL_MS = 15000; // 15 seconds
let gravityTimer = 0;

// Inputs
let rightPressed = false;
let leftPressed = false;
let mouseX = canvas.width / 2;

// Paddle
const PADDLE_WIDTH_DEFAULT = 120;
const paddle = {
    height: 15,
    width: PADDLE_WIDTH_DEFAULT,
    x: (canvas.width - PADDLE_WIDTH_DEFAULT) / 2,
    y: canvas.height - 30,
    speed: 12,
    color: '#66fcf1'
};

// Balls
const BALL_RADIUS = 8;
const BALL_SPEED_DEFAULT = 10;
let balls = [];

// Blocks
const blockRowCount = 5;
const blockColumnCount = 9;
const blockWidth = 75;
const blockHeight = 25;
const blockPadding = 10;
const blockOffsetTop = 60;
const blockOffsetLeft = 20;

let blocks = [];

// Power-ups
let powerUps = [];
const POWERUP_TYPES = {
    MULTIBALL: 1,
    BIG_PADDLE: 2,
    SLOW_MO: 3
};
const POWERUP_COLORS = {
    1: '#66fcf1', // Cyan for Multiball
    2: '#fcd028', // Yellow for Bigger Paddle
    3: '#20c20e'  // Green for Slow-mo
};

// Event Listeners
document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);
document.addEventListener('mousemove', mouseMoveHandler, false);

startBtn.addEventListener('click', initGame);
restartBtn.addEventListener('click', initGame);
nextLevelBtn.addEventListener('click', loadNextLevel);

function keyDownHandler(e) {
    if (e.key == "Right" || e.key == "ArrowRight") rightPressed = true;
    else if (e.key == "Left" || e.key == "ArrowLeft") leftPressed = true;
}

function keyUpHandler(e) {
    if (e.key == "Right" || e.key == "ArrowRight") rightPressed = false;
    else if (e.key == "Left" || e.key == "ArrowLeft") leftPressed = false;
}

function mouseMoveHandler(e) {
    const relativeX = e.clientX - canvas.getBoundingClientRect().left;
    if (relativeX > 0 && relativeX < canvas.width) {
        mouseX = relativeX;
        // In Game, tie paddle to mouse
        if (currentState === GAME_STATE.PLAYING) {
            paddle.x = relativeX - paddle.width / 2;
        }
    }
}

// Init functions
function createBall() {
    let initialAngle = (Math.random() - 0.5) * (Math.PI / 2); // -45 to 45 deg
    let direction = gravityInverted ? 1 : -1;
    return {
        x: paddle.x + paddle.width / 2,
        y: gravityInverted ? paddle.y + paddle.height + BALL_RADIUS : paddle.y - BALL_RADIUS,
        dx: BALL_SPEED_DEFAULT * Math.sin(initialAngle),
        dy: direction * BALL_SPEED_DEFAULT * Math.cos(initialAngle),
        radius: BALL_RADIUS,
        speed: BALL_SPEED_DEFAULT,
        color: '#fff'
    };
}

function initBlocks() {
    blocks = [];
    for (let c = 0; c < blockColumnCount; c++) {
        blocks[c] = [];
        for (let r = 0; r < blockRowCount + level - 1; r++) { // Add rows for higher levels
            // Skip some blocks to make a pattern
            if ((r + c) % 8 === 0) continue; 
            
            // Randomize Block Types
            let blockType = 1; // Normal
            let rand = Math.random();
            if (rand < 0.15) blockType = 2; // Strong
            else if (rand < 0.25) blockType = 3; // Exploding
            
            blocks[c][r] = { 
                x: 0, 
                y: 0, 
                status: blockType,
                initialStatus: blockType // to calculate opacity based on damage
            };
        }
    }
}

function resetLevelVariables() {
    paddle.width = PADDLE_WIDTH_DEFAULT;
    paddle.x = (canvas.width - paddle.width) / 2;
    balls = [createBall()];
    powerUps = [];
    gravityInverted = false;
    paddle.y = canvas.height - 30;
    gravityTimer = 0;
    updateGravityIndicator();
}

function initGame() {
    score = 0;
    lives = 3;
    level = 1;
    loadLevel();
}

function loadNextLevel() {
    level++;
    loadLevel();
}

function loadLevel() {
    resetLevelVariables();
    initBlocks();
    
    currentState = GAME_STATE.PLAYING;
    lastTime = performance.now();
    
    // Hide UI
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    uiLayer.style.pointerEvents = 'none'; // allow mouse to canvas
    
    updateHUD();
    
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
}

function loseLife() {
    lives--;
    updateHUD();
    if (lives <= 0) {
        currentState = GAME_STATE.GAME_OVER;
        finalScoreEl.innerText = score;
        gameOverScreen.classList.remove('hidden');
        hud.classList.add('hidden');
        uiLayer.style.pointerEvents = 'auto';
    } else {
        resetLevelVariables();
    }
}

function checkWinCondition() {
    let activeBlocks = 0;
    for (let c = 0; c < blockColumnCount; c++) {
        for (let r = 0; r < blocks[c].length; r++) {
            if (blocks[c][r] && blocks[c][r].status > 0) {
                activeBlocks++;
            }
        }
    }
    if (activeBlocks === 0) {
        currentState = GAME_STATE.WIN;
        score += lives * 500; // Bonus
        winScoreEl.innerText = score;
        winScreen.classList.remove('hidden');
        hud.classList.add('hidden');
        uiLayer.style.pointerEvents = 'auto';
    }
}

// Logic updates
function updateGravity(deltaTime) {
    gravityTimer += deltaTime;
    if (gravityTimer >= GRAVITY_INTERVAL_MS) {
        gravityTimer = 0;
        gravityInverted = !gravityInverted;
        
        // Reverse all active balls' dy
        balls.forEach(b => b.dy = -b.dy);
        
        // Setup new Paddle position
        if (gravityInverted) {
            paddle.y = 15; // Move to top
        } else {
            paddle.y = canvas.height - 30; // Move to bottom
        }
        
        // Visual updates
        updateGravityIndicator();
    }
}

function updateGravityIndicator() {
    if (gravityInverted) {
        gravityIndicator.className = 'direction-up';
        gravityIndicator.innerHTML = '<div class="arrow"></div>ANTI-GRAVITY ACTIVATED';
        document.getElementById('game-container').style.boxShadow = '0 0 40px rgba(255, 51, 102, 0.4)';
    } else {
        gravityIndicator.className = 'direction-down';
        gravityIndicator.innerHTML = '<div class="arrow"></div>GRAVITY NORMAL';
        document.getElementById('game-container').style.boxShadow = '0 0 40px rgba(102, 252, 241, 0.2)';
    }
}

function updateHUD() {
    scoreEl.innerText = score;
    livesEl.innerText = lives;
    levelEl.innerText = level;
}

function spawnPowerUp(x, y) {
    if (Math.random() > 0.8) { // 20% chance
        const types = Object.values(POWERUP_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];
        powerUps.push({
            x: x,
            y: y,
            width: 20,
            height: 20,
            type: type,
            dy: (gravityInverted ? -1 : 1) * 2 // Falls according to gravity
        });
    }
}

function triggerExplosion(c_idx, r_idx) {
    const explosionRadius = 1; 
    let explodedScore = 0;
    
    for (let c = Math.max(0, c_idx - explosionRadius); c <= Math.min(blockColumnCount - 1, c_idx + explosionRadius); c++) {
        for (let r = Math.max(0, r_idx - explosionRadius); r <= Math.min(blocks[c].length - 1, r_idx + explosionRadius); r++) {
            let ab = blocks[c][r];
            if (ab && ab.status > 0) {
                ab.status = 0;
                explodedScore += 10;
            }
        }
    }
    score += explodedScore;
}

function handleBallCollisions() {
    for (let i = 0; i < balls.length; i++) {
        let b = balls[i];
        
        // Wall collisions
        if (b.x + b.dx > canvas.width - b.radius || b.x + b.dx < b.radius) {
            b.dx = -b.dx;
        }
        
        // Ceiling / Floor based on gravity
        let hitDeathZone = false;
        
        if (gravityInverted) {
            if (b.y + b.dy > canvas.height - b.radius) {
                b.dy = -b.dy; // Bounce off bottom
            } else if (b.y + b.dy < b.radius) {
                hitDeathZone = true; // Off top
            }
        } else {
            if (b.y + b.dy < b.radius) {
                b.dy = -b.dy; // Bounce off top
            } else if (b.y + b.dy > canvas.height - b.radius) {
                hitDeathZone = true; // Off bottom
            }
        }
        
        // Paddle Collision
        if (
            b.x > paddle.x && 
            b.x < paddle.x + paddle.width && 
            b.y > paddle.y && 
            b.y < paddle.y + paddle.height
        ) {
            // Calculate hit point normalized between -1 to 1
            let hitPoint = b.x - (paddle.x + paddle.width/2);
            let normalizedHit = hitPoint / (paddle.width/2);
            
            // Calculate bounce angle (max 60 degrees from vertical)
            let bounceAngle = normalizedHit * (Math.PI / 3);
            
            // Keep speed constant but change dx and dy according to angle
            let direction = gravityInverted ? 1 : -1;
            b.dx = b.speed * Math.sin(bounceAngle);
            b.dy = direction * b.speed * Math.cos(bounceAngle);
            
            // Push ball slightly out of paddle to prevent getting stuck
            if (gravityInverted) {
                b.y = paddle.y + paddle.height + b.radius;
            } else {
                b.y = paddle.y - b.radius;
            }
        }
        
        // Block Collisions
        for (let c = 0; c < blockColumnCount; c++) {
            for (let r = 0; r < blocks[c].length; r++) {
                let bl = blocks[c][r];
                if (bl && bl.status > 0) {
                    if (
                        b.x > bl.x && 
                        b.x < bl.x + blockWidth && 
                        b.y > bl.y && 
                        b.y < bl.y + blockHeight
                    ) {
                        b.dy = -b.dy;
                        
                        if (bl.status === 2) {
                            bl.status = 1; // degrades strong block
                            score += 5;
                        } else if (bl.initialStatus === 3) {
                            bl.status = 0;
                            spawnPowerUp(bl.x + blockWidth/2, bl.y + blockHeight/2);
                            triggerExplosion(c, r); // explode
                        } else {
                            bl.status = 0;
                            score += 10;
                            spawnPowerUp(bl.x + blockWidth/2, bl.y + blockHeight/2);
                        }
                        
                        updateHUD();
                        checkWinCondition();
                    }
                }
            }
        }

        if (hitDeathZone) {
            balls.splice(i, 1);
            i--;
            if (balls.length === 0) {
                loseLife();
            }
        } else {
            b.x += b.dx;
            b.y += b.dy;
        }
    }
}

function handlePowerUps() {
    for (let i = 0; i < powerUps.length; i++) {
        let p = powerUps[i];
        p.y += p.dy;
        
        // Check out of bounds
        if (p.y > canvas.height || p.y < 0) {
            powerUps.splice(i, 1);
            i--;
            continue;
        }

        // Paddle collision
        if (
            p.x > paddle.x && 
            p.x < paddle.x + paddle.width && 
            p.y > paddle.y && 
            p.y < paddle.y + paddle.height
        ) {
            activatePowerUp(p.type);
            powerUps.splice(i, 1);
            i--;
            score += 25;
            updateHUD();
        }
    }
}

function activatePowerUp(type) {
    if (type === POWERUP_TYPES.MULTIBALL) {
        if (balls.length > 0) {
            let b = balls[0];
            let ball2 = createBall();
            ball2.x = b.x; ball2.y = b.y; ball2.dx = -b.dx + 1;
            let ball3 = createBall();
            ball3.x = b.x; ball3.y = b.y; ball3.dx = -b.dx - 1;
            balls.push(ball2, ball3);
        }
    } else if (type === POWERUP_TYPES.BIG_PADDLE) {
        paddle.width = Math.min(canvas.width, paddle.width + 40);
        setTimeout(() => { paddle.width = PADDLE_WIDTH_DEFAULT; }, 10000); // 10 seconds
    } else if (type === POWERUP_TYPES.SLOW_MO) {
        balls.forEach(b => {
             b.dx *= 0.5; b.dy *= 0.5; b.speed *= 0.5;
        });
        setTimeout(() => { 
            balls.forEach(b => {
                // Restore speed safely
                let len = Math.sqrt(b.dx*b.dx + b.dy*b.dy);
                if(len > 0) {
                    b.dx = (b.dx / len) * BALL_SPEED_DEFAULT;
                    b.dy = (b.dy / len) * BALL_SPEED_DEFAULT;
                }
            });
        }, 8000); // 8 seconds
    }
}

// Drawing Functions
function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = paddle.color;
    ctx.fill();
    ctx.shadowBlur = 15;
    ctx.shadowColor = paddle.color;
    ctx.closePath();
    ctx.shadowBlur = 0; // reset
}

function drawBalls() {
    balls.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        ctx.closePath();
        ctx.shadowBlur = 0;
    });
}

function drawBlocks() {
    // Dynamic offset based on gravity
    let currOffsetTop = gravityInverted ? canvas.height - blockOffsetTop - ((blockRowCount + level) * (blockHeight + blockPadding)) : blockOffsetTop;
    
    for (let c = 0; c < blockColumnCount; c++) {
        for (let r = 0; r < blocks[c].length; r++) {
            let bl = blocks[c][r];
            if (!bl) continue;
            
            if (bl.status > 0) {
                let blockX = (c * (blockWidth + blockPadding)) + blockOffsetLeft;
                let blockY = (r * (blockHeight + blockPadding)) + currOffsetTop;
                bl.x = blockX;
                bl.y = blockY;
                
                ctx.beginPath();
                ctx.rect(blockX, blockY, blockWidth, blockHeight);
                
                if (bl.initialStatus === 1) {
                    ctx.fillStyle = "#45a29e"; // Normal
                } else if (bl.initialStatus === 2) {
                    ctx.fillStyle = bl.status === 2 ? "#c5c6c7" : "#888888"; // Strong
                } else if (bl.initialStatus === 3) {
                    ctx.fillStyle = "#ff3366"; // Exploding
                }
                
                ctx.fill();
                
                // Add border or glow effects
                ctx.strokeStyle = "rgba(0,0,0,0.5)";
                ctx.strokeRect(blockX, blockY, blockWidth, blockHeight);
                ctx.closePath();
            }
        }
    }
}

function drawPowerUps() {
    powerUps.forEach(p => {
        ctx.beginPath();
        ctx.rect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = POWERUP_COLORS[p.type];
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = POWERUP_COLORS[p.type];
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#000";
        if(p.type===1) ctx.fillText("M", p.x+5, p.y+15);
        if(p.type===2) ctx.fillText("P", p.x+6, p.y+15);
        if(p.type===3) ctx.fillText("S", p.x+6, p.y+15);
        ctx.closePath();
        ctx.shadowBlur = 0;
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBlocks();
    drawPaddle();
    drawBalls();
    drawPowerUps();
}

function update(deltaTime) {
    if (currentState !== GAME_STATE.PLAYING) return;
    
    updateGravity(deltaTime);

    // Paddle movement with keys
    if (rightPressed && paddle.x < canvas.width - paddle.width) {
        paddle.x += paddle.speed;
    } else if (leftPressed && paddle.x > 0) {
        paddle.x -= paddle.speed;
    }
    
    // Boundary check for paddle
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;

    handleBallCollisions();
    handlePowerUps();
}

function gameLoop(timestamp) {
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    update(deltaTime);
    draw();
    
    if (currentState === GAME_STATE.PLAYING) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// Initial draw (just background)
ctx.fillStyle = "rgba(0,0,0,0)";
ctx.fillRect(0,0, canvas.width, canvas.height);
