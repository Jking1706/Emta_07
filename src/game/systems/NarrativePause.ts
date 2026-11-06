import Phaser from 'phaser';

/** Pause world clocks, not the parallel UI clock that advances dialogue and cinematics. */
export class NarrativePause {
  private paused = false;
  private animations = new Set<Phaser.Physics.Arcade.Sprite>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.set(false));
  }

  set(paused: boolean) {
    const actors = this.scene.children.list.filter((object): object is Phaser.Physics.Arcade.Sprite => object instanceof Phaser.Physics.Arcade.Sprite);
    actors.forEach(actor => actor.setDepth(actor.y));
    if (paused === this.paused) return;
    this.paused = paused;
    this.scene.time.paused = paused;
    if (paused) {
      this.scene.physics.world.pause(); this.scene.tweens.pauseAll();
      actors.forEach(actor => {
        actor.setVelocity(0);
        if (!actor.anims.isPaused) { actor.anims.pause(); this.animations.add(actor); }
      });
    } else {
      this.scene.physics.world.resume(); this.scene.tweens.resumeAll();
      this.animations.forEach(actor => { if (actor.active) actor.anims.resume(); });
      this.animations.clear();
    }
  }
}
