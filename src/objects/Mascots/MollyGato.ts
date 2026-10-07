import Phaser from 'phaser';
import { Player } from '../../game/player/Player';

type MollyState = 'IDLE' | 'AFFECTION' | 'LEAVE';

export class MollyGato extends Phaser.Physics.Arcade.Sprite {
  state: MollyState = 'IDLE';

  private restingPoint: Phaser.Math.Vector2;
  private busy = false;

  constructor(scene: Phaser.Scene, x: number, y: number, restingX = x, restingY = y) {
    super(scene, x, y, 'molly', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.restingPoint = new Phaser.Math.Vector2(restingX, restingY);
    this.setDepth(y);
    this.setSize(18, 10);
    this.setOffset(7, 20);
    this.play('molly-idle');
  }

  updateWithPlayer() {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.state === 'LEAVE') {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, this.restingPoint.x, this.restingPoint.y);

      if (distance <= 8) {
        body.setVelocity(0);
        this.state = 'IDLE';
        this.busy = false;
        this.play('molly-idle', true);
      }
    }

    if (body.velocity.x !== 0) {
      this.setFlipX(body.velocity.x < 0);
    }

    this.setDepth(this.y);
  }

  interact(player: Player, showBubble: (x: number, y: number, text: string) => void) {
    if (this.busy) {
      return;
    }

    this.busy = true;
    this.state = 'AFFECTION';
    this.play('molly-affection', true);
    this.scene.physics.moveToObject(this, player.sprite, 48);
    showBubble(this.x, this.y - 26, 'Molly busca carino...');

    this.scene.time.delayedCall(3000, () => {
      this.state = 'LEAVE';
      this.play('molly-ignore', true);
      this.scene.physics.moveToObject(this, this.restingPoint, 48);
      showBubble(this.x, this.y - 26, 'Molly se aburrio y se fue.');
    });
  }
}
