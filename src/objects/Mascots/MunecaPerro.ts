import Phaser from 'phaser';
import { Player } from '../../game/player/Player';

type MunecaState = 'IDLE' | 'FOLLOW' | 'HAPPY';

export class MunecaPerro extends Phaser.Physics.Arcade.Sprite {
  state: MunecaState = 'IDLE';

  private speechCooldown = false;
  private hopCooldown = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'dog', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(y);
    this.setSize(18, 10);
    this.setOffset(7, 20);
    this.play('muneca_idle');
  }

  updateWithPlayer(player: Player) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.sprite.x, player.sprite.y);

    if (distance < 60) {
      this.state = 'HAPPY';
      this.play('muneca_run', true);
      this.scene.physics.moveToObject(this, player.sprite, 96);

      if (!this.hopCooldown) {
        this.hopCooldown = true;
        this.setVelocityY(-70);
        this.scene.time.delayedCall(180, () => this.setVelocityY(0));
        this.scene.time.delayedCall(1200, () => {
          this.hopCooldown = false;
        });
      }
    } else if (distance > 80) {
      this.state = 'FOLLOW';
      this.scene.physics.moveToObject(this, player.sprite, 72);
      this.play('muneca_run', true);
    } else if (distance < 40) {
      this.state = 'IDLE';
      body.setVelocity(0);
      this.play('muneca_idle', true);
    }

    if (body.velocity.x !== 0) {
      this.setFlipX(body.velocity.x < 0);
    }

    this.setDepth(this.y);
  }

  interact(showBubble: (x: number, y: number, text: string) => void) {
    if (this.speechCooldown) {
      return;
    }

    this.speechCooldown = true;
    this.state = 'HAPPY';
    this.play('muneca_run', true);
    this.setVelocityY(-55);
    showBubble(this.x, this.y - 26, 'Woof! <3');
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.play('muneca_idle', true));
    this.scene.time.delayedCall(750, () => {
      this.setVelocityY(0);
      this.speechCooldown = false;
    });
  }
}
