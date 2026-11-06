import Phaser from 'phaser';
import { getItemById } from '../data/items';
import { hotbarSlotCount, type InventorySystem } from '../systems/InventorySystem';
import { type MoneySystem } from '../systems/MoneySystem';
import { type EnergySystem } from '../systems/EnergySystem';
import { type TimeSystem } from '../systems/TimeSystem';
import { type WateringCanSystem } from '../systems/WateringCanSystem';
import { type ProgressionSystem } from '../systems/ProgressionSystem';

export class GameHud {
  readonly uiObjects: Phaser.GameObjects.GameObject[] = [];

  private scene: Phaser.Scene;
  private inventory: InventorySystem;
  private money: MoneySystem;
  private energy: EnergySystem;
  private wateringCan: WateringCanSystem;
  private progression: ProgressionSystem;
  private time: TimeSystem;
  private slots: Phaser.GameObjects.Container[] = [];
  private slotBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private timeText: Phaser.GameObjects.Text;
  private moneyText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private waterText: Phaser.GameObjects.Text;
  private progressText: Phaser.GameObjects.Text;
  private helpText: Phaser.GameObjects.Text;
  private readonly textPositions = [
    { x: 16, y: 14 },
    { x: 16, y: 50 },
    { x: 16, y: 86 },
    { x: 16, y: 122 },
    { x: 16, y: 158 },
    { x: 16, y: 194 },
  ];
  private hotbarPositions: Array<{ x: number; y: number }> = [];

  constructor(scene: Phaser.Scene, inventory: InventorySystem, money: MoneySystem, energy: EnergySystem, wateringCan: WateringCanSystem, progression: ProgressionSystem, time: TimeSystem) {
    this.scene = scene;
    this.inventory = inventory;
    this.money = money;
    this.energy = energy;
    this.wateringCan = wateringCan;
    this.progression = progression;
    this.time = time;
    this.timeText = scene.add
      .text(16, 14, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#efe0b3',
        backgroundColor: '#231927cc',
        padding: { x: 8, y: 5 },
      })
      .setDepth(200);

    this.moneyText = scene.add
      .text(16, 50, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#f1d88a',
        backgroundColor: '#231927cc',
        padding: { x: 8, y: 5 },
      })
      .setDepth(200);

    this.energyText = scene.add
      .text(16, 86, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#b8e7ff',
        backgroundColor: '#231927cc',
        padding: { x: 8, y: 5 },
      })
      .setDepth(200);

    this.waterText = scene.add
      .text(16, 122, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#8fb0d8',
        backgroundColor: '#231927cc',
        padding: { x: 8, y: 5 },
      })
      .setDepth(200);

    this.progressText = scene.add
      .text(16, 158, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#d8c9a3',
        backgroundColor: '#231927cc',
        padding: { x: 8, y: 5 },
      })
      .setDepth(200);

    this.helpText = scene.add
      .text(16, 194, 'Click: usar herramienta | 1-8: hotbar | F5: guardar | F9: cargar', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#d8c9a3',
        backgroundColor: '#101219aa',
        padding: { x: 8, y: 4 },
      })
      .setDepth(200);

    this.createHotbar();
    this.uiObjects.push(this.timeText, this.moneyText, this.energyText, this.waterText, this.progressText, this.helpText, ...this.slots);
    this.inventory.onChange(() => this.refresh());
    this.money.onChange(() => this.refresh());
    this.energy.onChange(() => this.refresh());
    this.wateringCan.onChange(() => this.refresh());
    this.progression.onChange(() => this.refresh());
    this.refresh();
  }

  update() {
    this.refreshTime();
    this.pinToCamera();
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
    this.moneyText.setText(`Oro: ${this.money.getBalance()}`);
    this.energyText.setText(`Energia: ${this.energy.current}/${this.energy.max}`);
    this.waterText.setText(`Agua: ${this.wateringCan.current}/${this.wateringCan.capacity}`);
    const nextTier = Math.max(0, 10 - this.progression.cropsSold);
    this.progressText.setText(this.progression.marketTier > 0
      ? 'Mercado: clienta frecuente, semillas con descuento.'
      : `Mercado: vende ${nextTier} cultivos para un descuento.`);
  }

  private createHotbar() {
    const slotSize = 64;
    const gap = 8;
    const totalWidth = hotbarSlotCount * slotSize + (hotbarSlotCount - 1) * gap;
    const startX = (this.scene.scale.width - totalWidth) / 2;
    const y = this.scene.scale.height - 78;

    for (let index = 0; index < hotbarSlotCount; index++) {
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
      const position = { x: startX + index * (slotSize + gap) + slotSize / 2, y: y + slotSize / 2 };
      const container = this.scene.add
        .container(position.x, position.y, [background, text])
        .setDepth(200);

      this.slotBackgrounds.push(background);
      this.slotTexts.push(text);
      this.slots.push(container);
      this.hotbarPositions.push(position);
    }
  }

  private refreshTime() {
    const hour = String(this.time.hour).padStart(2, '0');
    const minute = String(this.time.minute).padStart(2, '0');
    this.timeText.setText(`Dia ${this.time.day}  ${hour}:${minute}`);
  }

  private pinToCamera() {
    const camera = this.scene.cameras.main;
    const textObjects = [this.timeText, this.moneyText, this.energyText, this.waterText, this.progressText, this.helpText];

    textObjects.forEach((text, index) => {
      const position = this.textPositions[index];
      text.setPosition(
        camera.worldView.x + position.x / camera.zoom,
        camera.worldView.y + position.y / camera.zoom,
      );
    });

    this.slots.forEach((slot, index) => {
      const position = this.hotbarPositions[index];
      slot.setPosition(
        camera.worldView.x + position.x / camera.zoom,
        camera.worldView.y + position.y / camera.zoom,
      );
    });
  }

  private getShortName(name: string) {
    return name.split(' ').slice(0, 2).join('\n');
  }
}
