import Phaser from 'phaser';

export type TatianaState = 'PATROL' | 'FOLLOWING' | 'EVENT_BUSY' | 'ICE_AGE';

type BubbleFn = (x: number, y: number, text: string) => void;

export class TatianaNPC extends Phaser.Physics.Arcade.Sprite {
  state: TatianaState = 'PATROL';

  private waypoints: Phaser.Math.Vector2[];
  private waypointIndex = 0;
  private waitingAtWaypoint = false;
  private followTarget?: Phaser.Physics.Arcade.Sprite;
  private iceTimer?: Phaser.Time.TimerEvent;
  get isFollowing() { return this.scene.registry.get('tatianaFollowing') === true; }

  setFollowing(enabled: boolean, player: Phaser.Physics.Arcade.Sprite) {
    this.scene.registry.set('tatianaFollowing', enabled);
    this.followTarget = enabled ? player : undefined;
    this.state = enabled ? 'FOLLOWING' : 'PATROL';
    this.waitingAtWaypoint = false;
    this.setVelocity(0);
  }

  startBeachEvent(x: number, y: number, showBubble: BubbleFn) {
    if (!this.isFollowing) return;
    this.state = 'EVENT_BUSY'; this.setPosition(x, y); this.setVelocity(0);
    this.play('tatiana_idle', true);
    showBubble(this.x, this.y - 34, 'Me quedaría aquí hasta que salgan las estrellas.');
  }

  constructor(scene: Phaser.Scene, x: number, y: number, waypoints: Array<{ x: number; y: number }>) {
    super(scene, x, y, 'tatiana-original', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.waypoints = waypoints.map((point) => new Phaser.Math.Vector2(point.x, point.y));
    this.setOrigin(0.5, 0.5);
    this.setSize(this.width * 0.5, this.height * 0.3);
    this.setOffset(this.width * 0.25, this.height * 0.68);
    this.play('tatiana_idle');
    if (this.isFollowing) this.state = 'FOLLOWING';
  }

  update(player: Phaser.Physics.Arcade.Sprite) {
    if (this.isFollowing) this.followTarget = player;
    if (this.state === 'PATROL') {
      this.updatePatrol();
    } else if (this.state === 'FOLLOWING') {
      this.updateFollowing(player);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.state === 'PATROL' || this.state === 'FOLLOWING') {
      const moving = body.velocity.lengthSq() > 1;
      if (moving) {
        const suffix = Math.abs(body.velocity.x) > Math.abs(body.velocity.y) ? '_side' : body.velocity.y < 0 ? '_up' : '';
        this.play(`tatiana_walk${suffix}`, true);
      }
    }
    if (body.velocity.x !== 0) {
      this.setFlipX(body.velocity.x < 0);
    }

    this.setDepth(this.y);
  }

  interact(player: Phaser.Physics.Arcade.Sprite, showBubble: BubbleFn) {
    if (this.state === 'ICE_AGE') {
      showBubble(this.x, this.y - 34, '...');
      return;
    }

    if (this.state === 'FOLLOWING') {
      this.setFollowing(false, player);
      this.setVelocity(0, 0);
      this.play('tatiana_idle', true);
      showBubble(this.x, this.y - 34, 'Voy a caminar un rato.');
      return;
    }

    this.setFollowing(true, player);
    this.waitingAtWaypoint = false;
    showBubble(this.x, this.y - 34, 'Voy contigo!');
  }

  startObservatoryEvent(x: number, y: number) {
    if (this.state !== 'FOLLOWING') {
      return;
    }

    this.state = 'EVENT_BUSY';
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.play('tatiana_idle', true);
  }

  finishContextEvent() {
    if (this.state !== 'EVENT_BUSY') {
      return;
    }

    this.state = this.followTarget ? 'FOLLOWING' : 'PATROL';
    this.play('tatiana_idle', true);
  }

  reactToMarketItem(itemName: string, showBubble: BubbleFn) {
    const normalized = itemName.toLowerCase();

    if (normalized.includes('fresa') || normalized.includes('mango')) {
      showBubble(this.x, this.y - 34, 'Mi favorito!');
      return;
    }

    if (normalized.includes('tamarindo') || normalized.includes('magnesio')) {
      this.enterIceAge(showBubble, 'Que asco!');
    }
  }

  startCookingEvent(x: number, y: number, showBubble: BubbleFn) {
    if (this.state !== 'FOLLOWING') {
      return;
    }

    this.state = 'EVENT_BUSY';
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.play('tatiana_cook', true);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      showBubble(this.x, this.y - 34, 'Quedo perfecto!');
      this.finishContextEvent();
    });
  }

  enterIceAge(showBubble: BubbleFn, message = '...') {
    this.iceTimer?.remove(false);
    this.state = 'ICE_AGE';
    this.setVelocity(0, 0);
    this.play('tatiana_anger', true);
    showBubble(this.x, this.y - 34, message);
    this.iceTimer = this.scene.time.delayedCall(10000, () => {
      this.state = this.followTarget ? 'FOLLOWING' : 'PATROL';
      this.play('tatiana_idle', true);
    });
  }

  private updatePatrol() {
    if (this.waitingAtWaypoint || this.waypoints.length === 0) {
      return;
    }

    const target = this.waypoints[this.waypointIndex];
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    if (distance <= 8) {
      this.setVelocity(0, 0);
      this.play('tatiana_idle', true);
      this.waitingAtWaypoint = true;
      this.scene.time.delayedCall(Phaser.Math.Between(2000, 5000), () => {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        this.waitingAtWaypoint = false;
      });
      return;
    }

    this.scene.physics.moveTo(this, target.x, target.y, 55);
  }

  private updateFollowing(player: Phaser.Physics.Arcade.Sprite) {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance > 300) {
      this.setPosition(player.x - 40, player.y);
      this.setVelocity(0, 0);
      return;
    }

    if (distance > 45) {
      this.scene.physics.moveToObject(this, player, Phaser.Math.Clamp((distance - 40) * 2, 18, 135));
      return;
    }

    if (distance <= 45) {
      this.setVelocity(0, 0);
      this.play('tatiana_idle', true);
    }
  }
}
