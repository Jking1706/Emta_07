import type { FarmingSnapshot } from './FarmingSystem';
import type { InventorySnapshot } from './InventorySystem';
import type { TimeSnapshot } from './TimeSystem';

const storageKey = 'gothic-farm-save-slot-1';

export type SaveGameData = {
  version: 1;
  playerPosition: {
    x: number;
    y: number;
  };
  inventory: InventorySnapshot;
  time: TimeSnapshot;
  farming: FarmingSnapshot;
};

export class SaveSystem {
  static save(data: SaveGameData) {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  static load() {
    const rawSave = localStorage.getItem(storageKey);

    if (!rawSave) {
      return null;
    }

    try {
      return JSON.parse(rawSave) as SaveGameData;
    } catch {
      return null;
    }
  }
}
