var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 300,
    backgroundColor: 'white',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 350 },
            debug: false // Set to true for debugging collision boxes
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
var lastObstacleX = 800; // Track the x position of the last obstacle

function preload() {
    this.load.spritesheet('dino', 'assets/dino1.png', {
        frameWidth: 96,
        frameHeight: 96
    });
    this.load.image('ground', 'assets/ground.png');
    this.load.image('obstacle', 'assets/obstacle1.png');
}

function create() {
    this.cameras.main.setBackgroundColor('#FFFFFF');

    // Ground setup
    this.ground = this.physics.add.staticSprite(400, 262.5, 'ground');
    this.ground.displayWidth = 1000; // Ensure ground width is set correctly
    this.ground.refreshBody(); // Refresh physics body after display changes

    // Dino setup
    this.dino = this.physics.add.sprite(150, 0, 'dino');
    this.dino.setCollideWorldBounds(true);
    
    // Set circular hitbox for the dino
    this.dino.setCircle(43);  // Radius of 30 for the dino's hitbox
    
    this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('dino', { start: 0, end: 7 }),
        frameRate: 5,
        repeat: -1
    });
    this.dino.anims.play('run');

    // Dino positioning slightly above the ground
    this.dino.setY(this.ground.y - (this.ground.displayHeight / 2) - (this.dino.height / 2));

    this.physics.add.collider(this.dino, this.ground);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Obstacle group
    this.obstacles = this.physics.add.group();

    // Create obstacles without gravity and make them immovable
    this.time.addEvent({
        delay: 1666, // Increased delay for better gameplay
        callback: spawnObstacle,
        callbackScope: this,
        loop: true
    });

    // Score text
    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '20px', fill: '#000' });
    gameOverText = this.add.text(300, 150, '', { fontSize: '40px', fill: '#ff0000' });

    // Collision between Dino and obstacles
    this.physics.add.collider(this.dino, this.obstacles, hitObstacle, null, this);
}

function update() {
    if (!gameOver) {
        score += 0.05;  // Update score only if game is not over
        scoreText.setText('Score: ' + Math.floor(score));
    }

    if (this.cursors.space.isDown && this.dino.body.touching.down) {
        this.dino.setVelocityY(-250); // Jump
    }
}

function spawnObstacle() {
    if (gameOver) return;

    // Minimum and maximum distances between obstacles
    const minDistance = 30; // Minimum distance that guarantees a jump is possible
    const maxDistance = 40; // Maximum distance for variety

    // Calculate the x position for the new obstacle
    const distance = Phaser.Math.Between(minDistance, maxDistance);
    const obstacleX = lastObstacleX + distance;

    // Create obstacle at ground level
    var obstacle = this.obstacles.create(obstacleX, this.ground.y - (this.ground.displayHeight / 2) - 28, 'obstacle'); // 28 is half of obstacle height (56/2)
    
    // Set circular hitbox for the obstacle (cactus)
    obstacle.setCircle(28);  // Use 28 as the radius for the cactus' hitbox

    // Disable gravity for obstacle
    obstacle.body.allowGravity = false;

    // Make obstacle immovable so it doesn't get affected by collisions
    obstacle.setImmovable(true);

    // Set horizontal velocity
    obstacle.setVelocityX(-200);

    // Update lastObstacleX for the next spawn
    lastObstacleX = obstacleX;

    // Remove obstacles out of bounds
    obstacle.setCollideWorldBounds(false);
    obstacle.checkWorldBounds = true;
    obstacle.outOfBoundsKill = true;
}

function hitObstacle(dino, obstacle) {
    this.physics.pause();
    dino.setTint(0xff0000);
    dino.anims.stop();
    gameOver = true;
    gameOverText.setText('Game Over');
}
