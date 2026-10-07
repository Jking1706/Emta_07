import Phaser from 'phaser';
import { getItemById, items, type ItemId } from '../data/items';
import { Player } from '../player/Player';
import { DialogSystem } from './DialogSystem';
import { InventorySystem } from './InventorySystem';

type InteractionTarget = {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: string;
  message: string;
  itemId?: ItemId;
  consumed?: boolean;
};

export class InteractionSystem {
  private interactKey: Phaser.Input.Keyboard.Key;
  private targets: InteractionTarget[] = [];
  private prompt: Phaser.GameObjects.Text;
  private player: Player;
  private dialogSystem: DialogSystem;
  private inventorySystem: InventorySystem;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    dialogSystem: DialogSystem,
    inventorySystem: InventorySystem,
  ) {
    this.player = player;
    this.dialogSystem = dialogSystem;
    this.inventorySystem = inventorySystem;
    this.interactKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.prompt = scene.add
      .text(0, 0, 'E', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#f1d88a',
        backgroundColor: '#231927dd',
        padding: { x: 5, y: 3 },
      })
      .setDepth(20)
      .setVisible(false);
  }

  addTarget(target: InteractionTarget) {
    this.targets.push(target);
  }

  update() {
    const target = this.getClosestTarget();
    this.prompt.setVisible(Boolean(target));

    if (target) {
      this.prompt.setPosition(target.x - 7, target.y - 28);
    }

    if (target && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.activate(target);
    }
  }

  private getClosestTarget() {
    return this.targets.find((target) => {
      if (target.consumed) {
        return false;
      }

      return Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        target.x,
        target.y,
      ) <= target.radius;
    });
  }

  private activate(target: InteractionTarget) {
    if (target.type === 'pickup' && target.itemId && target.itemId in items) {
      const item = getItemById(target.itemId);

      if (!this.inventorySystem.addItem(target.itemId)) {
        this.dialogSystem.show('No hay espacio en la hotbar.');
        return;
      }

      target.consumed = true;
      this.dialogSystem.show(`${item.name} anadido a la hotbar.`);
      return;
    }

    this.dialogSystem.show(target.message);
  }
}
