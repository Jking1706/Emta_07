import Phaser from 'phaser';
import { MollyGato } from '../../objects/Mascots/MollyGato';
import { MunecaPerro } from '../../objects/Mascots/MunecaPerro';
import { getItemById, type ItemId } from '../data/items';
import { Player } from '../player/Player';
import { InventorySystem } from './InventorySystem';

type Mood = 'normal' | 'angry' | 'cooperative';

const preferredSnacks = new Set<ItemId>(['chocoSoda', 'strawberry', 'sourGummy']);
const dislikedItems = new Set<ItemId>(['effervescentMagnesium']);

export class CharacterInteractionSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private inventory: InventorySystem;
  private interactKey: Phaser.Input.Keyboard.Key;
  private mainCharacter: Phaser.GameObjects.Container;
  private mainBody: Phaser.GameObjects.Ellipse;
  private mood: Mood = 'angry';
  private angerLevel = 2;
  private angryIgnoreCount = 0;
  private molly: MollyGato;
  private mollyLabel: Phaser.GameObjects.Text;
  private muneca: MunecaPerro;
  private munecaLabel: Phaser.GameObjects.Text;
  private spiderZone: Phaser.GameObjects.Zone;
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
    this.createAnimations(scene);
    this.interactKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.mainBody = scene.add.ellipse(0, 0, 24, 34, 0x7b3142).setStrokeStyle(2, 0xf0b35a);
    const face = scene.add.text(0, -4, ':|', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#fff0c7',
    }).setOrigin(0.5);
    const label = scene.add.text(0, 25, 'Ella', {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#efe0b3',
      stroke: '#231927',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.mainCharacter = scene.add.container(735, 520, [this.mainBody, face, label]).setDepth(520);

    this.molly = new MollyGato(scene, 710, 552, 690, 582);
    this.mollyLabel = this.createPetLabel(this.molly.x, this.molly.y + 18, 'Molly');
    this.muneca = new MunecaPerro(scene, 650, 548);
    this.munecaLabel = this.createPetLabel(this.muneca.x, this.muneca.y + 18, 'Muneca');

    if (collisionLayer) {
      scene.physics.add.collider(this.molly, collisionLayer);
      scene.physics.add.collider(this.muneca, collisionLayer);
    }

    this.spiderZone = scene.add.zone(595, 440, 70, 70);
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
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.tryInteract();
    }

    this.muneca.updateWithPlayer(this.player);
    this.molly.updateWithPlayer();
    this.updateLabels();
    this.updateInsectReaction();
    this.mainCharacter.setDepth(this.mainCharacter.y);
  }

  private tryInteract() {
    const playerPosition = this.player.sprite;

    if (this.isNear(playerPosition.x, playerPosition.y, this.mainCharacter.x, this.mainCharacter.y, 46)) {
      this.interactWithMainCharacter();
      return;
    }

    if (this.isNear(playerPosition.x, playerPosition.y, this.molly.x, this.molly.y, 42)) {
      this.molly.interact(this.player, (x, y, text) => this.sayAt(x, y, text));
      return;
    }

    if (this.isNear(playerPosition.x, playerPosition.y, this.muneca.x, this.muneca.y, 42)) {
      this.muneca.interact((x, y, text) => this.sayAt(x, y, text));
    }
  }

  private interactWithMainCharacter() {
    const selectedSlot = this.inventory.getSelectedSlot();
    const selectedItemId = selectedSlot.itemId;

    if (selectedItemId && preferredSnacks.has(selectedItemId)) {
      this.inventory.removeOneFromSelectedSlot();
      this.angerLevel = Math.max(0, this.angerLevel - 1);
      this.mood = this.angerLevel === 0 ? 'cooperative' : 'angry';
      this.mainBody.setFillStyle(this.mood === 'cooperative' ? 0x5c6d4f : 0x7b3142);
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

  private updateInsectReaction() {
    if (this.insectCooldown || !Phaser.Geom.Rectangle.Contains(
      this.spiderZone.getBounds(),
      this.player.sprite.x,
      this.player.sprite.y,
    )) {
      return;
    }

    this.insectCooldown = true;
    const away = new Phaser.Math.Vector2(
      this.player.sprite.x - this.spiderZone.x,
      this.player.sprite.y - this.spiderZone.y,
    ).normalize();
    this.player.sprite.setPosition(this.player.sprite.x + away.x * 42, this.player.sprite.y + away.y * 42);
    this.player.sprite.setFlipX(away.x < 0);
    this.scene.cameras.main.shake(160, 0.006);
    this.sayAt(this.player.sprite.x, this.player.sprite.y - 38, 'AH! Bicho!');
    this.scene.time.delayedCall(1200, () => {
      this.insectCooldown = false;
    });
  }

  private updateLabels() {
    this.updatePetLabel(this.molly, this.mollyLabel);
    this.updatePetLabel(this.muneca, this.munecaLabel);
  }

  private updatePetLabel(pet: Phaser.Physics.Arcade.Sprite, label: Phaser.GameObjects.Text) {
    const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, pet.x, pet.y);
    label.setPosition(pet.x, pet.y + 18);
    label.setDepth(pet.depth + 1);
    label.setAlpha(distance < 52 ? 0.9 : 0);
  }

  private createPetLabel(x: number, y: number, name: string) {
    return this.scene.add.text(x, y, name, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#efe0b3',
      stroke: '#231927',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(y + 1).setAlpha(0);
  }

  private createAnimations(scene: Phaser.Scene) {
    if (scene.anims.exists('molly-idle')) {
      return;
    }

    scene.anims.create({
      key: 'molly-idle',
      frames: scene.anims.generateFrameNumbers('molly', { start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });
    scene.anims.create({
      key: 'molly-affection',
      frames: scene.anims.generateFrameNumbers('molly', { start: 4, end: 7 }),
      frameRate: 8,
      repeat: 1,
    });
    scene.anims.create({
      key: 'molly-ignore',
      frames: scene.anims.generateFrameNumbers('molly', { start: 8, end: 11 }),
      frameRate: 6,
      repeat: 1,
    });
    scene.anims.create({
      key: 'muneca_idle',
      frames: scene.anims.generateFrameNumbers('dog', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });
    scene.anims.create({
      key: 'muneca_run',
      frames: scene.anims.generateFrameNumbers('dog', { start: 4, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
  }

  private sayAt(x: number, y: number, message: string) {
    const bubble = this.scene.add.text(x, y, message, {
      fontFamily: 'Georgia, serif',
      fontSize: '9px',
      color: '#efe0b3',
      backgroundColor: '#231927f2',
      padding: { x: 5, y: 3 },
      wordWrap: { width: 116 },
      align: 'center',
    }).setOrigin(0.5).setDepth(2000);
    this.scene.tweens.add({
      targets: bubble,
      y: y - 8,
      alpha: 0,
      duration: 1600,
      onComplete: () => bubble.destroy(),
    });
  }

  private isNear(x1: number, y1: number, x2: number, y2: number, maxDistance: number) {
    return Phaser.Math.Distance.Between(x1, y1, x2, y2) <= maxDistance;
  }
}
