import Phaser from 'phaser';

/** World-space speech follows its speaker; all lifetime work uses the scene clock. */
export function showSpeechBubble(scene: Phaser.Scene, x: number, y: number, message: string) {
  const speaker = scene.children.list.filter((object): object is Phaser.Physics.Arcade.Sprite => object instanceof Phaser.Physics.Arcade.Sprite)
    .map(sprite => ({ sprite, distance: Phaser.Math.Distance.Between(x, y + 34, sprite.x, sprite.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  const anchor = speaker && speaker.distance < 28 ? speaker.sprite : undefined;
  const bubble = scene.add.text(x, y, message, {
    fontFamily: 'Georgia, serif', fontSize: '11px', color: '#fff0d0', backgroundColor: '#231927f2',
    padding: { x: 7, y: 5 }, wordWrap: { width: 150 }, align: 'center',
  }).setOrigin(.5, 1).setDepth(2000);
  const follow = () => {
    if (anchor && !anchor.active) { bubble.destroy(); return; }
    if (anchor) bubble.setPosition(anchor.x, anchor.y - 28).setDepth(anchor.depth + 1000);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  const timer = scene.time.delayedCall(2400, () => bubble.destroy());
  bubble.once('destroy', () => { timer.remove(false); scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow); });
  follow();
  return bubble;
}
