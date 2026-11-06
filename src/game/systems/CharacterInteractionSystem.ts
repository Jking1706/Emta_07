import Phaser from 'phaser';
import { getItemById, type ItemId } from '../data/items';
import { Player } from '../player/Player';
import { InventorySystem } from './InventorySystem';
import type { InteractionCandidate } from './InteractionResolver';
import { showSpeechBubble } from '../ui/SpeechBubble';

type Mood = 'normal' | 'angry' | 'cooperative';

const preferredSnacks = new Set<ItemId>(['chocoSoda', 'strawberry', 'sourGummy']);
const dislikedItems = new Set<ItemId>(['effervescentMagnesium']);

export class CharacterInteractionSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private inventory: InventorySystem;
  private mainCharacter: Phaser.GameObjects.Container;
  private mainBody: Phaser.GameObjects.Image;
  private mood: Mood = 'angry';
  private angerLevel = 2;
  private angryIgnoreCount = 0;
  private spiderZone: Phaser.GameObjects.Zone;
  private cookZone: Phaser.GameObjects.Zone;
  private spider: Phaser.GameObjects.Text;
  private insectCooldown = false;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    inventory: InventorySystem,
    collisionLayer?: Phaser.Tilemaps.TilemapLayer,
  ) {
    this.scene = scene;
    this.player = player;
    this.inventory = inventory;

    this.mainBody = scene.add.image(0, 0, 'ella-original', 0);
    const label = scene.add.text(0, 25, 'Ella', {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#efe0b3',
      stroke: '#231927',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.mainCharacter = scene.add.container(735, 520, [this.mainBody, label]).setDepth(520);

    void collisionLayer;

    this.player.setAngerLevel(0);

    this.spiderZone = scene.add.zone(595, 440, 70, 70);
    scene.physics.add.existing(this.spiderZone, true);
    scene.physics.add.overlap(this.player.sprite, this.spiderZone, () => this.triggerInsectReaction());
    this.cookZone = scene.add.zone(755, 500, 64, 58);
    scene.physics.add.existing(this.cookZone, true);
    this.spider = scene.add.text(595, 440, 'x', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#17151b',
      backgroundColor: '#b8ad85aa',
      padding: { x: 4, y: 1 },
    }).setOrigin(0.5).setDepth(440);
    scene.tweens.add({ targets: this.spider, angle: 10, yoyo: true, repeat: -1, duration: 550 });
  }

  update() {
    this.mainCharacter.setDepth(this.mainCharacter.y);
  }

  getInteraction(): InteractionCandidate | undefined {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mainCharacter.x, this.mainCharacter.y);
    if (distance > 46) return undefined;
    return { label: 'Hablar con Ella', priority: 5, distance, activate: () => this.tryInteract() };
  }

  private tryInteract() {
    const playerPosition = this.player.sprite;

    if (this.isNear(playerPosition.x, playerPosition.y, this.mainCharacter.x, this.mainCharacter.y, 46)) {
      this.interactWithMainCharacter();
      return;
    }

    if (Phaser.Geom.Rectangle.Contains(this.cookZone.getBounds(), playerPosition.x, playerPosition.y)) {
      this.player.cook((x, y, text) => this.sayAt(x, y, text));
      return;
    }

    this.player.interactWhileAngry((x, y, text) => this.sayAt(x, y, text));
  }

  private interactWithMainCharacter() {
    const selectedSlot = this.inventory.getSelectedSlot();
    const selectedItemId = selectedSlot.itemId;

    if (selectedItemId && preferredSnacks.has(selectedItemId)) {
      this.inventory.removeOneFromSelectedSlot();
      this.angerLevel = Math.max(0, this.angerLevel - 1);
      this.player.receiveSnack(selectedItemId, (x, y, text) => this.sayAt(x, y, text));
      this.mood = this.angerLevel === 0 ? 'cooperative' : 'angry';
      this.mainBody.setTint(this.mood === 'cooperative' ? 0xffffff : 0xdfb8c5);
      this.sayAt(this.mainCharacter.x, this.mainCharacter.y - 42, 'No creas que se me olvida...');
      return;
    }

    if (selectedItemId && dislikedItems.has(selectedItemId)) {
      this.inventory.removeOneFromSelectedSlot();
      this.angerLevel++;
      this.mood = 'angry';
      this.scene.tweens.add({ targets: this.mainCharacter, x: '+=8', yoyo: true, repeat: 3, duration: 45 });
      this.sayAt(this.mainCharacter.x, this.mainCharacter.y - 42, 'Magnesio? Peor.');
      return;
    }

    if (this.mood === 'angry') {
      const lines = ['...', 'No me hables', 'Estoy ignorandote'];
      this.sayAt(this.mainCharacter.x, this.mainCharacter.y - 42, lines[Math.min(this.angryIgnoreCount, lines.length - 1)]);
      this.angryIgnoreCount++;
      return;
    }

    const itemName = selectedItemId ? getItemById(selectedItemId).name : 'nada';
    this.sayAt(this.mainCharacter.x, this.mainCharacter.y - 42, `Bueno... traes ${itemName}.`);
  }

  private triggerInsectReaction() {
    if (this.insectCooldown) {
      return;
    }

    this.insectCooldown = true;
    this.player.fearFrom(this.spiderZone.x, this.spiderZone.y, (x, y, text) => this.sayAt(x, y, text));
    this.scene.cameras.main.shake(160, 0.006);
    this.scene.time.delayedCall(1200, () => {
      this.insectCooldown = false;
    });
  }

  private sayAt(x: number, y: number, message: string) {
    showSpeechBubble(this.scene, x, y, message);
  }

  private isNear(x1: number, y1: number, x2: number, y2: number, maxDistance: number) {
    return Phaser.Math.Distance.Between(x1, y1, x2, y2) <= maxDistance;
  }
}
