var config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 500,
    backgroundColor: 'white',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 350 },
            debug: false  // This will show hitboxes
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);
var score = 0;
var gameOver = false;
var timer = 30;
var timerText;
let totalTime = 0; // Total time spent playing (in seconds)
let gameplayTimer; // Timer to track gameplay time
var gameOverText;
var currentLevel = 95;
var cactusBaseSpeed = -200;
var cactusSpeedIncrement = -50;
var cactusSpeed = cactusBaseSpeed;
var obstaclePositions = [];
var lastObstacleX = 1250;
var aiEnabled = false;
let gameStarted = false;
var startMenu, levelDialog;
var aiFadeTimer;
let jumpData = [];
let coverageData = [];
let triesCount = 0;

function preload() {
    this.load.spritesheet('dino', 'assets/dino1.png', {
        frameWidth: 70,
        frameHeight: 70
    });
    this.load.image('ground', 'assets/ground.png');
    this.load.image('obstacle1', 'assets/obstacle1.png');
    this.load.image('big_cactus', 'assets/big_cactus.png');
    this.load.image('spikes', 'assets/spikes.png');
}

function create() {
    // Set up the scene and call the start menu display function
    this.cameras.main.setBackgroundColor('#FFFFFF');
    this.cursors = this.input.keyboard.createCursorKeys();

    // Show the start menu
    showStartMenu(this);
}

function showStartMenu(scene) {
    // Start menu
    startMenu = scene.add.text(400, 200, 'Start Menu\nPress S to Start Game\nPress A to Toggle AI: OFF', {
        fontSize: '24px',
        fill: '#000',
        align: 'center',
        backgroundColor: '#ddd',
        padding: { x: 20, y: 10 }
    });

   const startKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    startKey.on('down', () => {
        startMenu.destroy(); // Remove the start menu
        startGame(scene); // Start the game
        startKey.removeListener('down'); // Remove the listener for the 'S' key
    });

    // Listen for 'A' key to toggle AI
    scene.input.keyboard.on('keydown-A', () => {
        aiEnabled = !aiEnabled;
        const aiStatus = aiEnabled ? 'ON' : 'OFF';
        startMenu.setText(`Start Menu\nPress S to Start Game\nPress A to Toggle AI: ${aiStatus}`);
    });
}


function startGame(scene) {
    // Ground setup
    triesCount = 1; 
    scene.ground = scene.physics.add.staticSprite(200, 462.5, 'ground');
    scene.ground.displayWidth = 800;
    scene.ground.refreshBody();

    scene.additionalGround = scene.physics.add.staticSprite(1000, 462.5, 'ground');
    scene.additionalGround.displayWidth = 800;
    scene.additionalGround.refreshBody();

    // Player Dino setup
    scene.dino = scene.physics.add.sprite(200, 0, 'dino');
    scene.dino.setCollideWorldBounds(true);
    scene.dino.setCircle(35);

    scene.anims.create({
        key: 'run',
        frames: scene.anims.generateFrameNumbers('dino', { start: 0, end: 7 }),
        frameRate: 5,
        repeat: -1
    });

    gameplayTimer = scene.time.addEvent({
        delay: 1000, // Update every second
        callback: () => { totalTime++; },
        callbackScope: scene,
        loop: true
    });
    scene.dino.anims.play('run');
    scene.physics.add.collider(scene.dino, scene.ground);
    scene.physics.add.collider(scene.dino, scene.additionalGround);

    // AI Dino setup if enabled
    if (aiEnabled) spawnAIDino(scene);

    // Preplan obstacle placements
    planObstacles();
    scene.obstacles = scene.physics.add.group();
    obstaclePositions.forEach(position => {
        spawnObstacle(position, scene);
    });

    // Collision between Player Dino and obstacles
    scene.physics.add.collider(scene.dino, scene.obstacles, hitObstacle, null, scene);

    // Timer setup
    timerText = scene.add.text(16, 16, 'Time: 30', { fontSize: '20px', fill: '#000' });
    levelText = scene.add.text(16, 40, `Level: ${currentLevel}`, { fontSize: '20px', fill: '#000' }); // Add level text
    gameOverText = scene.add.text(400, 250, '', { fontSize: '40px', fill: '#ff0000' });

    scene.time.addEvent({
        delay: 1000,
        callback: updateTimer,
        callbackScope: scene,
        loop: true
    });
}

function spawnAIDino(scene) {
    scene.aiDino = scene.physics.add.sprite(400, 0, 'dino');
    scene.aiDino.setCollideWorldBounds(true);
    scene.aiDino.setCircle(35);
    scene.aiDino.setAlpha(0.5);
    scene.aiDino.anims.play('run');
    scene.physics.add.collider(scene.aiDino, scene.ground);
    scene.physics.add.collider(scene.aiDino, scene.additionalGround);
    scene.physics.add.collider(scene.aiDino, scene.obstacles, aiHitObstacle, null, scene);
    // Start fading out the AI Dino after 10 seconds
    aiFadeTimer = scene.time.delayedCall(10000, () => {
        scene.tweens.add({
            targets: scene.aiDino,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
                if (scene.aiDino) {
                    scene.aiDino.destroy();
                    scene.aiDino = null;
                }
            }
        });
    });
}

function cleanupAIDino(scene) {
    if (aiFadeTimer) {
        aiFadeTimer.remove(); // Stop the fade timer
        aiFadeTimer = null;
    }
    
    if (scene.aiDino) {
        scene.aiDino.destroy();
        scene.aiDino = null;
    }
}


function update() {
    if (timer === 0 && !gameOver) {
        // Record coverage for level completion
        coverageData.push(100); // 100% coverage when timer reaches 0
        
        // Calculate average performance before ending game
        calculatePerformance(this);
        endGame(this, "Level Cleared! What do you want to do?", true);
    }

    if (this.cursors.space.isDown && this.dino.body.touching.down) {
        // Record jump position relative to next obstacle
        const nextObstacle = findNextObstacle(this.dino.x, this);
        if (nextObstacle) {
            const { D_optimal } = calculateJumpParameters(cactusSpeed, 56);
            const actualJumpDistance = nextObstacle.x - this.dino.x;
            jumpData.push({
                optimalDistance: D_optimal,
                actualDistance: actualJumpDistance,
                deviation: Math.abs(D_optimal - actualJumpDistance)
            });
        }
        this.dino.setVelocityY(-250);
    }

    if (this.aiDino) {
        const aiNextObstacle = findNextObstacle(this.aiDino.x, this);
        if (aiNextObstacle && shouldJump(aiNextObstacle.x, this.aiDino.x)) {
            if (this.aiDino.body.touching.down) {
                this.aiDino.setVelocityY(-250);
            }
        }
    }
}

function calculatePerformance(scene) {
    // Calculate average deviation from optimal jump distance
    const averageDeviation = jumpData.length > 0 
        ? jumpData.reduce((sum, jump) => sum + jump.deviation, 0) / jumpData.length 
        : 0;

    // Calculate average coverage from all attempts
    const averageCoverage = coverageData.length > 0
        ? coverageData.reduce((sum, coverage) => sum + coverage, 0) / coverageData.length
        : 0;

    const performanceMetrics = {
        currentLevel,
        triesCount,
        averageDeviation,
        averageCoverage
    };

    // Calculate level advancement
    const levelsToAdvance = calculateLevelAdvancement(performanceMetrics);

    // Log performance metrics
    console.log('Level Performance Metrics:');
    console.log('Current Level:', currentLevel);
    console.log('Tries taken:', triesCount);
    console.log('Average deviation from optimal jump distance:', averageDeviation.toFixed(2));
    console.log('Average level coverage percentage:', averageCoverage.toFixed(2) + '%');
    console.log('Levels to advance:', levelsToAdvance);
    console.log('Coverage data:', coverageData);
    console.log('Jump data:', jumpData);

    return { performanceMetrics, levelsToAdvance };
}

function planObstacles() {
    // Use the width of the widest obstacle (spikes = 90) for calculations
    const { D_optimal } = calculateJumpParameters(cactusSpeed, 90); 
    let nextPosition = lastObstacleX;

    // Maximum x-coordinate the AI should reach
    const maxDistance = 1200 + Math.abs(cactusSpeed) * timer;

    // Reduce the distance range progressively with each level
    const rangeModifier = Math.max(0, currentLevel * 0.5);
    while (nextPosition < maxDistance) {
        const distance = (2 * D_optimal + Phaser.Math.Between(30, 140)) - rangeModifier;
        nextPosition += distance;
        obstaclePositions.push(nextPosition);
    }
}




function spawnObstacle(x, scene) {
    const groundTop = scene.ground.y - scene.ground.displayHeight / 2;
    const cactusY = groundTop - 28;
    const obstacles = [
        { 
            key: 'obstacle1', 
            width: 56, 
            height: 56,
            hitboxRadius: 28,
            yOffset: 28,
            useCircle: true
        },
        { 
            key: 'big_cactus', 
            width: 56, 
            height: 72,
            hitboxRadius: 32,
            yOffset: 36,
            useCircle: true
        },
        { 
            key: 'spikes', 
            key: 'spikes', 
            width: 90,  // Full width for rectangle
            height: 40, // Slightly shorter than sprite height for better collision
            yOffset: 28,
            useCircle: false
        }
    ];
    
    const selectedObstacle = Phaser.Math.RND.pick(obstacles);
    const obstacleY = groundTop - selectedObstacle.yOffset;
    const obstacle = scene.obstacles.create(x, obstacleY, selectedObstacle.key);
    
    // Apply different hitbox shapes based on obstacle type
    if (selectedObstacle.useCircle) {
        obstacle.setCircle(selectedObstacle.hitboxRadius);
    } else {
        // For spikes: create rectangular hitbox
        obstacle.setSize(selectedObstacle.width, selectedObstacle.height);
        // Center the hitbox (if needed)
        obstacle.setOffset(0, (56 - selectedObstacle.height) / 2); // (sprite height - hitbox height) / 2
    }
    
    obstacle.obstacleType = selectedObstacle.key;
    obstacle.body.allowGravity = false;
    obstacle.setImmovable(true);
    obstacle.setVelocityX(cactusSpeed);
    obstacle.setCollideWorldBounds(false);
}

function calculateJumpParameters(cactusSpeed, cactusWidth) {
    const g = 350;
    const Vy = 250;
    const t_peak = Vy / g;
    const Vx = Math.abs(cactusSpeed);
    const R = 2 * t_peak * Vx;

    const D_min = cactusWidth + t_peak * Vx;
    const D_optimal = t_peak * Vx;
    const D_max = R;
    return { D_min, D_optimal, D_max };
}

function updateTimer() {
    if (timer > 0) {
        timer--;
        timerText.setText('Time: ' + timer);
    }
}

function hitObstacle(dino, obstacle) {
    this.physics.pause();
    dino.setTint(0xff0000);
    dino.anims.stop();
    gameOver = true;
    
    // Record coverage for this attempt
    const coveragePercent = ((30 - timer) / 30) * 100;
    coverageData.push(coveragePercent);
    triesCount++;
    cleanupAIDino(this);
    
    endGame(this, "You hit an obstacle! What do you want to do?");
}

function aiHitObstacle(aiDino, obstacle) {
    aiDino.setTint(0x0000ff);
    // Destroy the AI Dino when it hits an obstacle
    if (aiDino) {
        aiDino.destroy();
    }
}

function aiHitObstacle(aiDino, obstacle) {
    aiDino.setTint(0x0000ff);
}

function findNextObstacle(aiDinoX, scene) {
    return scene.obstacles.getChildren().find(obstacle => obstacle.x > aiDinoX);
}

function shouldJump(obstacleX, aiDinoX) {
    const { D_optimal } = calculateJumpParameters(cactusSpeed, 56);
    return obstacleX - aiDinoX <= D_optimal;
}

function handleAIToggle(scene, message, isLevelCleared) {
    aiEnabled = !aiEnabled; // Toggle AI
    const updatedAIStatus = aiEnabled ? 'ON' : 'OFF';

    // Update the dialog box text dynamically
    dialogBox.setText(
        `${message}\nPress R to Retry${isLevelCleared ? '\nPress N for Next Level' : ''}\nPress A to Toggle AI: ${updatedAIStatus}`
    );
}


function createDialog(scene, message, isLevelCleared = false, performance = null) {
    const aiStatus = aiEnabled ? 'ON' : 'OFF';
    let dialogMessage = `${message}\n`;
     if (gameplayTimer) {
        gameplayTimer.paused = true;
    }


    // Add performance metrics if available
    if (performance) {
        const { performanceMetrics, levelsToAdvance } = performance;
        dialogMessage += `\nPerformance Summary:\n`;
        dialogMessage += `Tries: ${performanceMetrics.triesCount}\n`;
        dialogMessage += `Average Coverage: ${performanceMetrics.averageCoverage.toFixed(1)}%\n`;
        dialogMessage += `Level Advancement: +${levelsToAdvance} levels\n\n`;
    }
   if (currentLevel === 100) {
        dialogMessage += `\nCongratulations! You've completed the game in ${totalTime} seconds.\n`;
    }
    dialogMessage += `Press R to Retry${isLevelCleared ? '\nPress N for Next Level' : ''}\nPress A to Toggle AI: ${aiStatus}`;
    
    // Create the dialog text
    dialogBox = scene.add.text(
        300,
        200,
        dialogMessage,
        {
            fontSize: '20px',
            fill: '#000',
            align: 'center',
            backgroundColor: '#ddd',
            padding: { x: 20, y: 10 }
        }
    );

    // Clear any existing 'keydown-A' listener to avoid duplicates
    scene.input.keyboard.removeListener('keydown-A');

    // Handle Retry (R)
    scene.input.keyboard.once('keydown-R', () => {
        dialogBox.destroy();
        retryLevel(scene);
    });

    // Handle Next Level (N) if level is cleared
    if (isLevelCleared) {
        scene.input.keyboard.once('keydown-N', () => {
            dialogBox.destroy();
            // Store the levels to advance before resetting metrics
            const levelsToAdd = performance ? performance.levelsToAdvance : 1;
            nextLevel(scene, levelsToAdd);
        });
    }

    // Attach AI Toggle (A) listener
    scene.input.keyboard.on('keydown-A', () => {
        aiEnabled = !aiEnabled;
        const updatedAIStatus = aiEnabled ? 'ON' : 'OFF';
        dialogBox.setText(dialogMessage.replace(`AI: ${aiStatus}`, `AI: ${updatedAIStatus}`));
    });
}

function endGame(scene, message, isLevelCleared = false) {
    scene.physics.pause();
    gameOver = true;
    // Stop gameplay timer when the game ends
    if (gameplayTimer) {
        gameplayTimer.paused = true;
    }
    let performance = null;
    if (isLevelCleared) {
        performance = calculatePerformance(scene);
    }

    // Call the dialog creation function with performance metrics
    createDialog(scene, message, isLevelCleared, performance);
}

function retryLevel(scene) {
    resetGame(scene, currentLevel); // Restart the current level
}

function nextLevel(scene, levelsToAdvance = 1) {
    coverageData = [];
    jumpData = [];
    triesCount = 1;
    currentLevel += levelsToAdvance; // Add the calculated level advancement
    currentLevel = Math.min(100,currentLevel);
    resetGame(scene, currentLevel);
}

function resetGame(scene, level) {
    // Reset only jump data, keeping coverage data for averaging
    jumpData = [];

    gameOver = false;
    timer = 30;
    scene.physics.resume();
    // Resume gameplay timer when game restarts
    if (gameplayTimer) {
        gameplayTimer.paused = false;
    }

    cactusSpeed = cactusBaseSpeed + (Math.floor(level / 10) * cactusSpeedIncrement);

    scene.obstacles.clear(true, true);
    obstaclePositions = [];
    lastObstacleX = 1200;

    planObstacles(scene);
    obstaclePositions.forEach(position => spawnObstacle(position, scene));

    scene.dino.clearTint();
    scene.dino.anims.play('run');
    scene.dino.setPosition(200, 0);

    cleanupAIDino(scene);
    
    if (aiEnabled) {
        spawnAIDino(scene);
    }
    
    levelText.setText(`Level: ${level}`);
}

function calculateLevelAdvancement(performanceMetrics) {
    const {
        triesCount,
        averageCoverage,
        averageDeviation,
        currentLevel
    } = performanceMetrics;

    // Normalize metrics to 0-1 scale
    const triesScore = calculateTriesScore(triesCount);
    const coverageScore = averageCoverage / 100;
    const deviationScore = calculateDeviationScore(averageDeviation);
    console.log(triesScore);
    console.log(coverageScore);
    console.log(deviationScore);
    // Weights for each metric (total = 1)
    const weights = {
        tries: 0.3,      // How many attempts they needed
        coverage: 0.4,   // How far they got in the level
        deviation: 0.3   // How accurate their jumps were
    };

    // Calculate weighted score (0-1)
    const totalScore = (
        triesScore * weights.tries +
        coverageScore * weights.coverage +
        deviationScore * weights.deviation
    );

    // Convert score to level advancement (1-10)
    return calculateLevelsToAdvance(totalScore, currentLevel);
}

function calculateTriesScore(tries) {
    // Convert tries to a 0-1 score (fewer tries = better score)
    // 1 try = 1.0, 2 tries = 0.8, 3 tries = 0.6, 4 tries = 0.4, 5+ tries = 0.2
    const triesMap = {
        1: 1.0,
        2: 0.8,
        3: 0.6,
        4: 0.4
    };
    return triesMap[tries] || 0.2;
}

function calculateDeviationScore(averageDeviation) {
    // Convert deviation to a 0-1 score (lower deviation = better score)
    // Assuming optimal jump distance is around 200-300 pixels
    const maxAcceptableDeviation = 100;
    const score = 1 - (averageDeviation / maxAcceptableDeviation);
    return Math.max(0, Math.min(1, score));
}

function calculateLevelsToAdvance(score, currentlevel = 0) {
    // Apply quadratic scaling for fairness and smooth progression
    const scaledScore = Math.pow(score, 0.75); // Adjust exponent for fine-tuning
    const levelsToAdvance = Math.round(scaledScore * 10); // Map scaled score to 1–10
    return Math.max(1, Math.min(10, levelsToAdvance)); // Clamp between 1 and 10
}
