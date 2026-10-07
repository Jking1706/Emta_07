import Phaser from 'phaser';
import { getItemById } from '../data/items';
import { hotbarSlotCount, type InventorySystem } from '../systems/InventorySystem';
import { type TimeSystem } from '../systems/TimeSystem';

export class GameHud {
  readonly uiObjects: Phaser.GameObjects.GameObject[] = [];

  private scene: Phaser.Scene;
  private inventory: InventorySystem;
  private time: TimeSystem;
  private slots: Phaser.GameObjects.Container[] = [];
  private slotBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private timeText: Phaser.GameObjects.Text;
  private helpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, inventory: InventorySystem, time: TimeSystem) {
    this.scene = scene;
    this.inventory = inventory;
    this.time = time;
    this.timeText = scene.add
      .text(16, 14, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#efe0b3',
        backgroundColor: '#231927cc',
        padding: { x: 8, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(200);

    this.helpText = scene.add
      .text(16, 50, 'Click: usar herramienta | 1-8: hotbar | F5: guardar | F9: cargar', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#d8c9a3',
        backgroundColor: '#101219aa',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(200);

    this.createHotbar();
    this.uiObjects.push(this.timeText, this.helpText, ...this.slots);
    this.inventory.onChange(() => this.refresh());
    this.refresh();
  }

  update() {
    this.refreshTime();
  }

  refresh() {
    this.refreshTime();

    this.inventory.slots.forEach((slot, index) => {
      const selected = this.inventory.selectedSlotIndex === index;
      this.slotBackgrounds[index].setStrokeStyle(2, selected ? 0xf0b35a : 0x5a4632);
      this.slotBackgrounds[index].setFillStyle(selected ? 0x3a2b25 : 0x231927, 0.94);

      if (!slot.itemId) {
        this.slotTexts[index].setText(`${index + 1}\n-`);
        return;
      }

      const item = getItemById(slot.itemId);
      const quantity = item.maxStack > 1 ? ` x${slot.quantity}` : '';
      this.slotTexts[index].setText(`${index + 1}\n${this.getShortName(item.name)}${quantity}`);
    });
  }

  private createHotbar() {
    const slotSize = 64;
    const gap = 8;
    const totalWidth = hotbarSlotCount * slotSize + (hotbarSlotCount - 1) * gap;
    const startX = (this.scene.scale.width - totalWidth) / 2;
    const y = this.scene.scale.height - 78;

    for (let index = 0; index < hotbarSlotCount; index++) {
      const x = startX + index * (slotSize + gap);
      const background = this.scene.add.rectangle(0, 0, slotSize, slotSize, 0x231927, 0.94);
      const text = this.scene.add
        .text(0, -4, '', {
          fontFamily: 'Georgia, serif',
          fontSize: '11px',
          color: '#efe0b3',
          align: 'center',
          wordWrap: { width: slotSize - 8 },
        })
        .setOrigin(0.5);
      const container = this.scene.add
        .container(x + slotSize / 2, y + slotSize / 2, [background, text])
        .setScrollFactor(0)
        .setDepth(200);

      this.slotBackgrounds.push(background);
      this.slotTexts.push(text);
      this.slots.push(container);
    }
  }

  private refreshTime() {
    const hour = String(this.time.hour).padStart(2, '0');
    const minute = String(this.time.minute).padStart(2, '0');
    this.timeText.setText(`Dia ${this.time.day}  ${hour}:${minute}`);
  }

  private getShortName(name: string) {
    return name.split(' ').slice(0, 2).join('\n');
  }
}
