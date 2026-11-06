import Phaser from 'phaser';
import { getItemById } from '../data/items';
import { marketOrders, toolUpgrades, wateringCapacity, type ToolId } from '../data/balance';
import { DialogSystem } from '../systems/DialogSystem';
import type { InventorySystem } from '../systems/InventorySystem';
import type { MoneySystem } from '../systems/MoneySystem';
import type { EnergySystem } from '../systems/EnergySystem';
import type { TimeSystem } from '../systems/TimeSystem';
import type { ProgressionSystem } from '../systems/ProgressionSystem';
import type { WateringCanSystem } from '../systems/WateringCanSystem';
import type { Player } from '../player/Player';
import { SoundFeedback } from '../systems/SoundFeedback';
import { SaveSystem } from '../systems/SaveSystem';

type Context = {
  world: Phaser.Scene; player: Player; inventory: InventorySystem; storage: InventorySystem;
  money: MoneySystem; energy: EnergySystem; water: WateringCanSystem;
  progression: ProgressionSystem; clock: TimeSystem; save: () => void;
  location: string;
};

export class UIScene extends Phaser.Scene {
  private context?: Context;
  private interactionPending = false;
  dialogue!: DialogSystem;
  private hud?: Phaser.GameObjects.Container;
  private status!: Phaser.GameObjects.Text;
  private objective!: Phaser.GameObjects.Text;
  private tooltip!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private cells: Array<{ box: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.Text }> = [];
  private panel?: Phaser.GameObjects.Container;
  private selectedInventorySlot?: number;
  private mode: 'bag' | 'chest' | 'journal' | 'upgrades' = 'bag';
  constructor() { super('UIScene'); }

  create() {
    this.input.keyboard!.on('keydown-E', (event: KeyboardEvent) => {
      if (!event.repeat) this.interactionPending = true;
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => { this.interactionPending = false; });
    this.input.keyboard!.on('keydown-I', () => this.togglePanel('bag'));
    this.input.keyboard!.on('keydown-J', () => this.togglePanel('journal'));
    this.input.keyboard!.on('keydown-ESC', () => this.closePanel());
    this.input.keyboard!.on('keydown-M', () => { SoundFeedback.muted = !SoundFeedback.muted; });
    for (let i = 0; i < 8; i++) this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i).on('down', () => {
      if (!this.modalOpen && !this.dialogue?.isActive) this.context?.inventory.selectSlot(i);
    });
  }

  bind(context: Context) {
    this.interactionPending = false;
    this.closePanel();
    this.dialogue?.destroy();
    this.hud?.destroy(true);
    this.context = context;
    this.cells = [];
    this.dialogue = new DialogSystem(this, context.player);
    this.hud = this.add.container(0, 0).setDepth(100);
    const text = (x: number, y: number, value: string, size = 13) => this.add.text(x, y, value, { fontFamily: 'monospace', fontSize: `${size}px`, color: '#eee3c7' });
    this.hud.add(this.add.rectangle(16, 14, 550, 49, 0x1e1c2c, .94).setOrigin(0).setStrokeStyle(1, 0x80715e).setInteractive());
    this.status = text(28, 24, ''); this.hud.add(this.status);
    this.objective = text(28, 76, '', 12).setWordWrapWidth(500).setBackgroundColor('#211e2be6').setPadding(8, 6);
    this.hud.add(this.objective);
    this.tooltip = text(480, 430, '', 12).setOrigin(.5).setBackgroundColor('#211e2b').setPadding(8, 5).setVisible(false);
    this.prompt = text(480, 398, '', 14).setOrigin(.5).setBackgroundColor('#211e2b').setPadding(10, 7).setVisible(false);
    this.hud.add([this.tooltip, this.prompt]);
    for (let i = 0; i < 8; i++) {
      const x = 252 + i * 65;
      const box = this.add.rectangle(x, 482, 58, 56, 0x211e2b, .97).setStrokeStyle(2, 0x776752).setInteractive({ useHandCursor: true });
      const icon = this.add.image(x, 481, 'item-hoe').setDisplaySize(32, 32);
      const count = text(x + 23, 495, '', 11).setOrigin(1, 0);
      box.on('pointerdown', () => { if (!this.modalOpen && !this.dialogue.isActive) context.inventory.selectSlot(i); });
      box.on('pointerover', () => { const id = context.inventory.slots[i].itemId; this.tooltip.setVisible(Boolean(id)).setText(id ? getItemById(id).name : ''); });
      box.on('pointerout', () => this.tooltip.setVisible(false));
      this.hud.add([box, icon, count, text(x - 23, 457, String(i + 1), 10)]);
      this.cells.push({ box, icon, count });
    }
    this.hud.add(text(480, 522, 'E interactuar · I mochila · J diario · Esc cerrar · M sonido', 11).setOrigin(.5));
    context.world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.context === context) { this.closePanel(); this.dialogue.destroy(); this.hud?.destroy(true); this.context = undefined; }
    });
    this.scene.bringToTop();
  }

  get modalOpen() { return Boolean(this.panel); }
  consumeInteraction() {
    const pressed = this.interactionPending;
    this.interactionPending = false;
    return pressed;
  }
  setPrompt(message = '') { this.prompt?.setText(message).setVisible(Boolean(message)); }

  update() {
    const c = this.context;
    if (!c) return;
    this.hud?.setVisible(!this.dialogue.isActive && !c.world.data.get('externalModal') && !c.world.data.get('uiBlocked'));
    this.status.setText(`Día ${c.clock.day}  ${String(c.clock.hour).padStart(2, '0')}:${String(c.clock.minute).padStart(2, '0')}   Oro ${c.money.getBalance()}\nEnergía ${c.energy.current}/100   Agua ${c.water.current}/${c.water.capacity}   Sonido ${SoundFeedback.muted ? 'OFF' : 'ON'}`);
    this.objective.setText(SaveSystem.lastError ?? c.progression.getObjective());
    this.cells.forEach(({ box, icon, count }, i) => {
      const slot = c.inventory.slots[i];
      box.setStrokeStyle(2, c.inventory.selectedSlotIndex === i ? 0xefc67a : 0x776752);
      icon.setVisible(Boolean(slot.itemId));
      if (slot.itemId) icon.setTexture(`item-${slot.itemId}`);
      count.setText(slot.quantity > 1 ? String(slot.quantity) : '');
    });
  }

  private togglePanel(mode: 'bag' | 'journal') {
    if (!this.context || this.dialogue.isActive || this.context.world.data.get('externalModal')) return;
    if (this.panel) this.closePanel(); else this.openPanel(mode);
  }

  openPanel(mode: 'bag' | 'chest' | 'journal' | 'upgrades') {
    if (!this.context || this.dialogue.isActive) return;
    this.mode = mode; this.selectedInventorySlot = undefined;
    this.context.world.data.set('uiBlocked', true);
    this.context.player.setControlsEnabled(false);
    this.drawPanel();
  }

  closePanel() {
    this.panel?.destroy(true); this.panel = undefined;
    this.context?.world.data.set('uiBlocked', false);
    if (!this.dialogue?.isActive) this.context?.player.setControlsEnabled(true);
  }

  private drawPanel() {
    this.panel?.destroy(true);
    const c = this.context!;
    const panel = this.add.container(0, 0).setDepth(5000); this.panel = panel;
    panel.add(this.add.rectangle(480, 270, 960, 540, 0x0d101a, .6).setInteractive());
    panel.add(this.add.rectangle(480, 270, 850, 440, 0x211e2b, .99).setStrokeStyle(2, 0xa38b67));
    const label = (x: number, y: number, value: string, size = 14) => {
      const t = this.add.text(x, y, value, { fontFamily: 'monospace', fontSize: `${size}px`, color: '#eee3c7', wordWrap: { width: 740 } }); panel.add(t); return t;
    };
    const button = (x: number, y: number, value: string, action: () => void) => {
      const b = label(x, y, value).setPadding(9, 7).setBackgroundColor('#435e51').setInteractive({ useHandCursor: true }); b.on('pointerdown', action); return b;
    };
    label(84, 70, ({ bag: 'MOCHILA', chest: 'COFRE DE CASA', journal: 'DIARIO Y ENCARGOS', upgrades: 'TALLER DE HERRAMIENTAS' })[this.mode], 21);
    button(790, 66, 'Cerrar', () => this.closePanel());
    if (this.mode === 'bag' || this.mode === 'chest') {
      label(84, 108, this.mode === 'bag' ? 'Pulsa un espacio y otro para intercambiarlos. Fila superior: accesos 1–8.' : 'Pulsa un objeto para transferir toda la pila. Izquierda: mochila · Derecha: cofre.', 12);
      const drawInventory = (inventory: InventorySystem, x: number, columns: number, storage: boolean) => {
        const detail = label(x - 20, 370, '', 12);
        inventory.slots.forEach((slot, i) => {
          const cx = x + (i % columns) * 47, cy = 165 + Math.floor(i / columns) * 56;
          const box = this.add.rectangle(cx, cy, 42, 48, i < 8 && !storage ? 0x383044 : 0x2a2b37).setStrokeStyle(1, this.selectedInventorySlot === i && !storage ? 0xefc67a : 0x766b60).setInteractive({ useHandCursor: true });
          panel.add(box);
          if (slot.itemId) { panel.add(this.add.image(cx, cy - 2, `item-${slot.itemId}`).setDisplaySize(28, 28)); label(cx + 6, cy + 11, slot.quantity > 1 ? String(slot.quantity) : '', 10); }
          box.on('pointerdown', () => {
            if (this.mode === 'chest') {
              if (slot.itemId && !inventory.transferTo(i, storage ? c.inventory : c.storage)) this.dialogue.show('No hay espacio en el destino.');
              c.save();
            } else if (this.selectedInventorySlot === undefined) this.selectedInventorySlot = i;
            else { inventory.swapSlots(this.selectedInventorySlot, i); this.selectedInventorySlot = undefined; c.save(); }
            this.drawPanel();
          });
          box.on('pointerover', () => detail.setText(slot.itemId ? getItemById(slot.itemId).name : 'Vacío'));
          box.on('pointerout', () => detail.setText(''));
        });
      };
      drawInventory(c.inventory, 108, 8, false);
      if (this.mode === 'chest') drawInventory(c.storage, 554, 6, true);
      label(84, 431, '24 espacios de mochila · Herramientas y semillas se usan desde los primeros 8 espacios.', 12);
    } else if (this.mode === 'journal') {
      label(84, 110, c.progression.getObjective(), 12);
      marketOrders.forEach((order, i) => {
        const y = 168 + i * 88, done = c.progression.completedOrders.has(order.id);
        label(84, y, `${order.title} — ${order.reward} oro`);
        label(84, y + 25, `${getItemById(order.itemId).name}: ${c.inventory.getItemCount(order.itemId)}/${order.quantity}${done ? ' · Entregado' : ''}`, 12);
        button(701, y, done ? 'Completado' : 'Entregar', () => {
          if (c.location !== 'cropMarket') { this.dialogue.show('Entrega los encargos en el mercado.'); return; }
          const result = c.progression.claimOrder(order.id, c.inventory, c.money);
          this.dialogue.show(result ? 'Encargo entregado. Recompensa recibida.' : 'Encargo ya completado o faltan productos.');
          if (result) { SoundFeedback.play(this, 'reward'); c.save(); }
          this.drawPanel();
        });
      });
      label(84, 450, 'Los encargos se entregan una sola vez, dentro del mercado.', 12);
    } else {
      (Object.keys(toolUpgrades) as ToolId[]).forEach((id, i) => {
        const info = toolUpgrades[id], y = 142 + i * 95;
        label(84, y, `${info.name} — ${info.price} oro`); label(84, y + 29, info.description, 12);
        button(708, y, c.progression.upgrades.has(id) ? 'Mejorada' : 'Mejorar', () => {
          if (c.location !== 'toolShop') return;
          if (c.progression.buyUpgrade(id, c.money)) {
            c.water.capacity = c.progression.upgrades.has('wateringCan') ? wateringCapacity.upgraded : wateringCapacity.base;
            c.save(); SoundFeedback.play(this, 'reward'); this.dialogue.show('Herramienta mejorada permanentemente.');
          } else this.dialogue.show('Ya tienes esta mejora o falta oro.');
          this.drawPanel();
        });
      });
    }
  }
}
