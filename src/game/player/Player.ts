import Phaser from 'phaser';

type Direction = 'up' | 'down' | 'left' | 'right';

export class Player {
  sprite: Phaser.Physics.Arcade.Sprite;
  facing: Direction = 'down';

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<string, Phaser.Input.Keyboard.Key>;
  private speed = 115;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.createAnimations(scene);

    this.sprite = scene.physics.add.sprite(x, y, 'player', 0);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setSize(18, 22);
    this.sprite.setOffset(7, 8);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = scene.input.keyboard!.addKeys('W,A,S,D') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  update() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(0);

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      body.setVelocityX(-this.speed);
      this.facing = 'left';
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      body.setVelocityX(this.speed);
      this.facing = 'right';
    }

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      body.setVelocityY(-this.speed);
      this.facing = 'up';
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      body.setVelocityY(this.speed);
      this.facing = 'down';
    }

    body.velocity.normalize().scale(this.speed);
    this.playAnimation(body);
  }

  private createAnimations(scene: Phaser.Scene) {
    if (scene.anims.exists('player-idle-down')) {
      return;
    }

    scene.anims.create({
      key: 'player-idle-down',
      frames: [{ key: 'player', frame: 0 }],
      frameRate: 1,
      repeat: -1,
    });

    scene.anims.create({
      key: 'player-walk-down',
      frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
  }

  private playAnimation(body: Phaser.Physics.Arcade.Body) {
    if (body.velocity.lengthSq() === 0) {
      this.sprite.anims.play('player-idle-down', true);
      return;
    }

    this.sprite.anims.play('player-walk-down', true);
    this.sprite.setFlipX(this.facing === 'left');
  }
}
