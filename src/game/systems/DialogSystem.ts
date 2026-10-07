import Phaser from 'phaser';

export class DialogSystem {
  private box: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private hideEvent?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.box = scene.add
      .rectangle(480, 462, 660, 92, 0x231927, 0.94)
      .setStrokeStyle(2, 0xd8c9a3)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.text = scene.add
      .text(178, 432, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#efe0b3',
        wordWrap: { width: 604 },
      })
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
  }

  show(message: string) {
    this.hideEvent?.remove(false);
    this.box.setVisible(true);
    this.text.setText(message).setVisible(true);
    this.hideEvent = this.box.scene.time.delayedCall(2400, () => this.hide());
  }

  hide() {
    this.box.setVisible(false);
    this.text.setVisible(false);
  }
}
