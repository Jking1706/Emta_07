import type { FarmingSnapshot } from './FarmingSystem';
import type { EnergySnapshot } from './EnergySystem';
import type { InventorySnapshot } from './InventorySystem';
import type { TimeSnapshot } from './TimeSystem';
import type { ProgressionSnapshot } from './ProgressionSystem';
import type { LandOwnershipSnapshot } from './LandOwnershipSystem';
import type { WateringCanSnapshot } from './WateringCanSystem';
import { items } from '../data/items';
import { marketOrders, toolUpgrades, tutorialSteps } from '../data/balance';

const storageKey = 'gothic-farm-save-slot-1';

export type SaveGameData = {
  version: 1;
  playerPosition: {
    x: number;
    y: number;
  };
  inventory: InventorySnapshot;
  storage?: InventorySnapshot;
  money: number;
  energy?: EnergySnapshot;
  wateringCan?: WateringCanSnapshot;
  progression?: ProgressionSnapshot;
  landOwnership?: LandOwnershipSnapshot;
  time: TimeSnapshot;
  farming: FarmingSnapshot;
};

export class SaveSystem {
  static lastError: string | null = null;
  static save(data: SaveGameData) {
    try {
      if (!this.isValid(data)) throw new Error('Invalid save');
      localStorage.setItem(storageKey, JSON.stringify(data));
      this.lastError = null;
      return true;
    } catch {
      this.lastError = 'No se pudo guardar. Comprueba el almacenamiento del navegador.';
      return false;
    }
  }

  static load() {
    try {
      const rawSave = localStorage.getItem(storageKey);
      if (!rawSave) return null;
      const data: unknown = JSON.parse(rawSave);
      if (!this.isValid(data)) throw new Error('Invalid save');
      this.lastError = null;
      return data;
    } catch {
      this.lastError = 'El guardado no es compatible o está dañado.';
      return null;
    }
  }

  static isValid(value: unknown): value is SaveGameData {
    const object = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v);
    const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
    const list = (v: unknown, allowed: readonly string[]) => Array.isArray(v) && v.every(id => typeof id === 'string' && allowed.includes(id)) && new Set(v).size === v.length;
    const inventory = (v: unknown, capacity: number) => object(v) && Array.isArray(v.slots) && v.slots.length <= capacity &&
      integer(v.selectedSlotIndex, 0, 7) && v.slots.every((slot: unknown) => object(slot) &&
        (slot.itemId === null ? slot.quantity === 0 : Object.hasOwn(items, slot.itemId) && integer(slot.quantity, 1, items[slot.itemId as keyof typeof items].maxStack)));
    if (!object(value) || value.version !== 1 || !object(value.playerPosition) ||
      ![value.playerPosition.x, value.playerPosition.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000) ||
      !inventory(value.inventory, 24) || (value.storage !== undefined && !inventory(value.storage, 18)) || !integer(value.money)) return false;
    const t = value.time, f = value.farming, p = value.progression;
    if (!object(t) || !integer(t.day, 1) || !integer(t.hour, 0, 23) || !integer(t.minute, 0, 59) || !object(f)) return false;
    const tile = (v: unknown) => typeof v === 'string' && /^(?:(?:farm|farm2|farm3):)?\d+,\d+$/.test(v);
    if (!Array.isArray(f.tilledTiles) || !f.tilledTiles.every(tile) || !Array.isArray(f.crops) ||
      (f.lastProcessedDay !== undefined && !integer(f.lastProcessedDay, 1, t.day)) ||
      !f.crops.every((c: unknown) => object(c) && tile(c.tileKey) && ['paleTurnip', 'blackPumpkin'].includes(c.cropId) &&
        integer(c.plantedDay, 1, t.day) && integer(c.waterCount) && typeof c.ready === 'boolean' && typeof c.wateredToday === 'boolean') ||
      new Set(f.crops.map((c: { tileKey: string }) => c.tileKey)).size !== f.crops.length) return false;
    if (value.energy !== undefined && (!object(value.energy) || !integer(value.energy.current, 0, 100))) return false;
    if (value.wateringCan !== undefined && (!object(value.wateringCan) || !integer(value.wateringCan.current, 0, 48))) return false;
    if (value.landOwnership !== undefined && (!object(value.landOwnership) || !list(value.landOwnership.ownedFarmIds, ['farm', 'farm2', 'farm3']))) return false;
    if (p !== undefined && (!object(p) || !integer(p.cropsSold) || !integer(p.marketTier, 0, 1) ||
      (p.moonBlessingDay !== undefined && !integer(p.moonBlessingDay, 0, t.day)) ||
      (p.milestones !== undefined && !list(p.milestones, tutorialSteps.map(s => s.id))) ||
      (p.completedOrders !== undefined && !list(p.completedOrders, marketOrders.map(o => o.id))) ||
      (p.upgrades !== undefined && !list(p.upgrades, Object.keys(toolUpgrades))) ||
      (p.tatianaEvents !== undefined && !list(p.tatianaEvents, ['harvest', 'land', 'dinner'])))) return false;
    return true;
  }
}
