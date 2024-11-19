var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 300,
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
var scoreText;
var gameOverText;
var lastObstacleX = 800;
var cactusSpeed = -300; // Initial speed of cactus
var helperGraphics;

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

    // Ground setup
    this.ground = this.physics.add.staticSprite(400, 262.5, 'ground');
    this.ground.displayWidth = 1000;
    this.ground.refreshBody();

    // Dino setup
    this.dino = this.physics.add.sprite(150, 0, 'dino');
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

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Obstacle group
    this.obstacles = this.physics.add.group();

    // Spawn obstacles
    this.time.addEvent({
        delay: 2000,
        callback: spawnObstacle,
        callbackScope: this,
        loop: true
    });

    // Score text
    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '20px', fill: '#000' });
    gameOverText = this.add.text(300, 150, '', { fontSize: '40px', fill: '#ff0000' });

    // Collision between Dino and obstacles
    this.physics.add.collider(this.dino, this.obstacles, hitObstacle, null, this);

    // Debugging graphics
    helperGraphics = this.add.graphics({ lineStyle: { width: 2, color: 0x00ff00 } });
}

function update(time, delta) {
    if (!gameOver) {
        score += 0.05;
        scoreText.setText('Score: ' + Math.floor(score));
    }

    if (this.cursors.space.isDown && this.dino.body.touching.down) {
        this.dino.setVelocityY(-250);
    }

    // Call optimal jump logic
    if (!gameOver) {
        optimalJump.call(this);
    }
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

    return { D_min, D_optimal, D_max };
}

function spawnObstacle() {
    const params = calculateJumpParameters(cactusSpeed, 56);
    const { D_min, D_max } = params;

    const distance = Phaser.Math.Between(D_min, D_max);
    const obstacleX = lastObstacleX + distance;
const groundTop = this.ground.y - this.ground.displayHeight / 2; // Top edge of the ground
const cactusY = groundTop - 28; // Subtract half the cactus height (28)
var obstacle = this.obstacles.create(obstacleX, cactusY, 'obstacle');

    obstacle.setCircle(28);
    obstacle.body.allowGravity = false;
    obstacle.setImmovable(true);
    obstacle.setVelocityX(cactusSpeed);

    lastObstacleX = obstacleX;

    obstacle.setCollideWorldBounds(false);
    obstacle.checkWorldBounds = true;
    obstacle.outOfBoundsKill = true;
}

function optimalJump() {
    const { D_optimal } = calculateJumpParameters(cactusSpeed, 56);

    this.obstacles.getChildren().forEach(obstacle => {
        const distanceToObstacle = obstacle.x - this.dino.x;

        // Visualize the optimal jump point
        helperGraphics.clear();
        helperGraphics.lineBetween(
            this.dino.x,
            this.dino.y,
            this.dino.x + D_optimal,
            this.dino.y
        );

        if (distanceToObstacle <= D_optimal && distanceToObstacle >= 0 && this.dino.body.touching.down) {
            this.dino.setVelocityY(-250);
        }
    });
}

function hitObstacle(dino, obstacle) {
    this.physics.pause();
    dino.setTint(0xff0000);
    dino.anims.stop();
    gameOver = true;
    gameOverText.setText('Game Over');
}