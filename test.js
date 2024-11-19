var config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 500,
    backgroundColor: 'white',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 350 },
            debug: true // Enable debug mode to visualize hitboxes and physics
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
var timer = 30; // Timer in seconds
var timerText;
var gameOverText;
var currentLevel = 0;
var cactusBaseSpeed = -200; // Base speed for level 0
var cactusSpeedIncrement = -50; // Speed increment per 10 levels
var levelDialog; // Dialog box for level options
var cactusSpeed = cactusBaseSpeed; // Initial speed of cactus
var lastObstacleX = 1250; // Start placement after visible canvas
var obstaclePositions = []; // Array for preplanned positions

function preload() {
    this.load.spritesheet('dino', 'assets/dino1.png', {
        frameWidth: 70,
        frameHeight: 70
    });
    this.load.image('ground', 'assets/ground.png');
    this.load.image('obstacle', 'assets/obstacle1.png');
}

function create() {
    this.cameras.main.setBackgroundColor('#FFFFFF');
    this.cursors = this.input.keyboard.createCursorKeys();

    // Ground setup
    this.ground = this.physics.add.staticSprite(400, 462.5, 'ground');
    this.ground.displayWidth = 800;
    this.ground.refreshBody();

    this.additionalGround = this.physics.add.staticSprite(1000, 462.5, 'ground');
    this.additionalGround.displayWidth = 800;
    this.additionalGround.refreshBody();

    // Player Dino setup
    this.dino = this.physics.add.sprite(200, 0, 'dino');
    this.dino.setCollideWorldBounds(true);
    this.dino.setCircle(35);

    this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('dino', { start: 0, end: 7 }),
        frameRate: 5,
        repeat: -1
    });
    this.dino.anims.play('run');
    this.physics.add.collider(this.dino, this.ground);
    this.physics.add.collider(this.dino, this.additionalGround);

    // AI Dino setup
    this.aiDino = this.physics.add.sprite(400, 0, 'dino');
    this.aiDino.setCollideWorldBounds(true);
    this.aiDino.setCircle(35);
    this.aiDino.setAlpha(0.5);
    this.aiDino.anims.play('run');
    this.physics.add.collider(this.aiDino, this.ground);
    this.physics.add.collider(this.aiDino, this.additionalGround);

    // Preplan obstacle placements
    planObstacles();

    // Spawn obstacles dynamically
    this.obstacles = this.physics.add.group();
    obstaclePositions.forEach(position => {
        spawnObstacle(position, this);
    });

    // Collision between Player Dino and obstacles
    this.physics.add.collider(this.dino, this.obstacles, hitObstacle, null, this);

    // Collision between AI Dino and obstacles
    this.physics.add.collider(this.aiDino, this.obstacles, aiHitObstacle, null, this);

    // Timer setup
    timerText = this.add.text(16, 16, 'Time: 30', { fontSize: '20px', fill: '#000' });
    gameOverText = this.add.text(400, 250, '', { fontSize: '40px', fill: '#ff0000' });

    this.time.addEvent({
        delay: 1000,
        callback: updateTimer,
        callbackScope: this,
        loop: true
    });

    this.add.text(16, 50, 'Level: ' + currentLevel, { fontSize: '20px', fill: '#000' });

    // Initialize the level dialog as invisible
    levelDialog = this.add.text(300, 200, '', { fontSize: '20px', fill: '#000' });
    levelDialog.setVisible(false);
}

function update() {
if (timer === 0 && !gameOver) {
    endGame(this, "Level Cleared! What do you want to do?", true);
}

    // Player Dino jump
    if (this.cursors.space.isDown && this.dino.body.touching.down) {
        this.dino.setVelocityY(-250);
    }

    // AI Dino jump
    const aiNextObstacle = findNextObstacle(this.aiDino.x, this);
    if (aiNextObstacle && shouldJump(aiNextObstacle.x, this.aiDino.x)) {
        if (this.aiDino.body.touching.down) {
            this.aiDino.setVelocityY(-250);
        }
    }
}

function planObstacles() {
    const { D_optimal } = calculateJumpParameters(cactusSpeed, 56); 
    let nextPosition = lastObstacleX;

    // Maximum x-coordinate the AI should reach
    const maxDistance = 1200 + Math.abs(cactusSpeed) * timer;

    // Reduce the distance range progressively with each level
    const rangeModifier = Math.max(0,currentLevel*0.5); // Make the range smaller with each level, but not less than 0
    while (nextPosition < maxDistance) {
        const distance = (2 * D_optimal + Phaser.Math.Between(70, 140)) - rangeModifier; // Narrow the distance
        nextPosition += distance;
        obstaclePositions.push(nextPosition);
    }
    console.log(obstaclePositions);
}




function spawnObstacle(x, scene) {
    const groundTop = scene.ground.y - scene.ground.displayHeight / 2; // Top edge of the ground
    const cactusY = groundTop - 28; // Subtract half the cactus height (28)
    const obstacle = scene.obstacles.create(x, cactusY, 'obstacle');

    obstacle.setCircle(28);
    obstacle.body.allowGravity = false;
    obstacle.setImmovable(true);
    obstacle.setVelocityX(cactusSpeed);
    obstacle.setCollideWorldBounds(false);
}

function calculateJumpParameters(cactusSpeed, cactusWidth) {
    const g = 350; // Gravity
    const Vy = 250; // Initial jump velocity
    const t_peak = Vy / g;
    const Vx = Math.abs(cactusSpeed); // Horizontal speed
    const R = 2 * t_peak * Vx;

    const D_min = cactusWidth + t_peak * Vx; // Min distance
    const D_optimal = t_peak * Vx; // Optimal distance
    const D_max = R; // Max distance
    console.log(D_optimal);
    return { D_min, D_optimal, D_max };
}

function updateTimer() {
    if (timer > 0) {
        timer--;
        timerText.setText('Time: ' + timer);
    }
}

function gameWin() {
    gameOver = true;
    gameOverText.setText('You Win!');
    endGame(this, "Level Cleared! What do you want to do?", true); // Pass true to indicate level cleared
}

function hitObstacle(dino, obstacle) {
    this.physics.pause();
    dino.setTint(0xff0000);
    dino.anims.stop();
    gameOver = true;
    endGame(this, "You hit an obstacle! What do you want to do?");
}

function aiHitObstacle(aiDino, obstacle) {
    aiDino.setTint(0x0000ff); // AI Dino gets a blue tint on collision
}

function findNextObstacle(aiDinoX, scene) {
    return scene.obstacles.getChildren().find(obstacle => obstacle.x > aiDinoX);
}


function shouldJump(obstacleX, aiDinoX) {
    const { D_optimal } = calculateJumpParameters(cactusSpeed, 56);
    return obstacleX - aiDinoX <= D_optimal;
}


function endGame(scene, message, isLevelCleared = false) {
    // Pause physics and set gameOver flag
    gameOver = true;
    scene.physics.pause(); // Pause all physics objects

    // Stop dino animations and velocities
    scene.dino.setVelocity(0);
    scene.dino.anims.stop();
    scene.aiDino.setVelocity(0);
    scene.aiDino.anims.stop();

    // Stop all obstacles
    scene.obstacles.setVelocityX(0); // Stops all obstacles from moving
    scene.obstacles.children.iterate((obstacle) => {
        obstacle.setVelocityX(0);
    });

    // Display end-game message and options
    levelDialog.setText(message + '\nPress R to Retry');
    levelDialog.setVisible(true);

    if (isLevelCleared) {
        levelDialog.setText(message + '\nPress R to Retry or N for Next Level');
    }

    // Wait for input
    scene.input.keyboard.once('keydown-R', () => {
        retryLevel(scene);
    });
    if (isLevelCleared) {
        scene.input.keyboard.once('keydown-N', () => {
            nextLevel(scene);
        });
    }
}


function retryLevel(scene) {
    resetGame(scene, currentLevel);
}

function nextLevel(scene) {
    currentLevel += 10;
    resetGame(scene, currentLevel);
}

function resetGame(scene, level) {
    gameOver = false;
    timer = 30;

    // Resume physics in case it was paused
    scene.physics.resume();

    // Calculate new cactus speed
    cactusSpeed = cactusBaseSpeed + (Math.floor(level / 10) * cactusSpeedIncrement);
    scene.obstacles.setVelocityX(cactusSpeed);


    // Reset obstacles and positions
    scene.obstacles.clear(true, true); // Clear all previous obstacles
    obstaclePositions = []; // Clear previous obstacle positions
    planObstacles(); // Plan new obstacle positions
    obstaclePositions.forEach(position => {
        spawnObstacle(position, scene); // Spawn new obstacles
    });

    // Reset dino properties
    scene.dino.clearTint();
    scene.dino.x = 200;
    scene.dino.setVelocity(0);
    scene.dino.anims.play('run');

    // Reset AI dino properties
    scene.aiDino.clearTint();
    scene.aiDino.x = 400;
    scene.aiDino.setVelocity(0);
    scene.aiDino.anims.play('run');

    // Reset timer and level dialog
    timerText.setText('Time: ' + timer);
    levelDialog.setVisible(false);

    // Update the level display on screen
    const levelText = scene.children.list.find(child => child.text?.startsWith('Level:'));
    if (levelText) {
        levelText.setText('Level: ' + level);
    }
}


