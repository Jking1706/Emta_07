import Phaser from 'phaser';
import type { ItemId } from '../data/items';

type Direction = 'up' | 'down' | 'left' | 'right';
type PlayerState = 'NORMAL' | 'COOKING' | 'FEAR' | 'EMOTE';

const angerLines = ['...', 'Ni me mires.', 'Estoy ocupada no hablando contigo.'];
const preferredSnacks = new Set<ItemId>(['chocoSoda', 'strawberry']);

export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: Direction = 'down';
  angerLevel = 0;

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<string, Phaser.Input.Keyboard.Key>;
  private speed = 130;
  private acceleration = 0.22;
  private playerState: PlayerState = 'NORMAL';
  private angerLineIndex = 0;
  private controlsEnabled = true;
  private toolAnimationUntil = 0;

  playToolAction() {
    this.toolAnimationUntil = this.scene.time.now + 480;
    this.playFacing('work');
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'farmer-sheet', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setScale(1);
    this.setSize(10, 5);
    this.setOffset(11, 33);
    this.play('player_idle');

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = scene.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  get sprite() {
    return this;
  }

  update() {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (!this.controlsEnabled || this.playerState !== 'NORMAL') {
      body.setVelocity(0, 0);
      this.setDepth(this.y);
      return;
    }

    const desiredVelocity = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      desiredVelocity.x = -this.speed;
      this.facing = 'left';
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      desiredVelocity.x = this.speed;
      this.facing = 'right';
    }

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      desiredVelocity.y = -this.speed;
      this.facing = 'up';
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      desiredVelocity.y = this.speed;
      this.facing = 'down';
    }

    if (desiredVelocity.lengthSq() > 0) {
      desiredVelocity.normalize().scale(this.speed);
    }

    const nextVelocityX = Phaser.Math.Linear(body.velocity.x, desiredVelocity.x, this.acceleration);
    const nextVelocityY = Phaser.Math.Linear(body.velocity.y, desiredVelocity.y, this.acceleration);
    body.setVelocity(
      Math.abs(nextVelocityX) < 6 ? 0 : nextVelocityX,
      Math.abs(nextVelocityY) < 6 ? 0 : nextVelocityY,
    );
    this.playMovementAnimation(body);
    this.setDepth(this.y);
  }

  setControlsEnabled(enabled: boolean) {
    this.controlsEnabled = enabled;

    if (!enabled) {
      this.setVelocity(0, 0);
    }
  }

  emote(showBubble: (x: number, y: number, text: string) => void, message = '!') {
    if (this.playerState !== 'NORMAL') {
      return;
    }

    this.playerState = 'EMOTE';
    this.setVelocity(0, 0);
    this.playFacing('cheer');
    showBubble(this.x, this.y - 36, message);
    this.scene.time.delayedCall(650, () => {
      this.playerState = 'NORMAL';
      this.playIdle();
    });
  }

  interactWhileAngry(showBubble: (x: number, y: number, text: string) => void) {
    if (this.angerLevel === 0) {
      return false;
    }

    const line = angerLines[Math.min(this.angerLineIndex, angerLines.length - 1)];
    this.angerLineIndex++;
    showBubble(this.x, this.y - 34, line);
    return true;
  }

  receiveSnack(itemId: ItemId, showBubble: (x: number, y: number, text: string) => void) {
    if (!preferredSnacks.has(itemId)) {
      return false;
    }

    this.angerLevel = Math.max(0, this.angerLevel - 1);
    this.angerLineIndex = 0;
    this.playIdle();
    showBubble(this.x, this.y - 34, this.angerLevel === 0 ? 'Bueno... ya se me paso.' : 'No creas que se me olvida.');
    return true;
  }

  cook(showBubble: (x: number, y: number, text: string) => void) {
    if (this.playerState !== 'NORMAL') {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    this.playerState = 'COOKING';
    body.setVelocity(0);
    this.playFacing('work');
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      showBubble(this.x, this.y - 34, 'Preparando unas trufas de chocolate!');
      this.playerState = 'NORMAL';
      this.playIdle();
    });
  }

  fearFrom(sourceX: number, sourceY: number, showBubble: (x: number, y: number, text: string) => void) {
    if (this.playerState === 'FEAR') {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const away = new Phaser.Math.Vector2(this.x - sourceX, this.y - sourceY).normalize();
    this.playerState = 'FEAR';
    this.setFlipX(away.x < 0);
    this.playFacing('fear');
    body.setVelocity(away.x * 260, away.y * 260);
    showBubble(this.x, this.y - 38, 'AH! Bicho!');

    this.scene.time.delayedCall(420, () => body.setVelocity(0));
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.playerState = 'NORMAL';
      this.playIdle();
    });
  }

  setAngerLevel(level: number) {
    this.angerLevel = Phaser.Math.Clamp(level, 0, 2);
  }

  private get directionSuffix() {
    return this.facing === 'up' ? '_up' : this.facing === 'down' ? '' : '_side';
  }

  private playFacing(kind: 'work' | 'cheer' | 'fear') {
    this.play(`player_${kind}${this.directionSuffix}`, true);
  }

  private playIdle() {
    if (this.angerLevel > 0) this.playFacing('cheer');
    else this.play(`player_idle${this.directionSuffix}`, true);
  }

  private playMovementAnimation(body: Phaser.Physics.Arcade.Body) {
    if (this.scene.time.now < this.toolAnimationUntil) return;
    this.setFlipX(this.facing === 'left');
    if (body.velocity.lengthSq() < 20) {
      this.playIdle();
      return;
    }

    this.play(`player_walk${this.directionSuffix}`, true);
    this.setFlipX(this.facing === 'left');
  }
}
