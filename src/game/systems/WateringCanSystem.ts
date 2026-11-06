import { wateringCapacity } from '../data/balance';

export type WateringCanSnapshot = {
  current: number;
};

export class WateringCanSystem {
  capacity = wateringCapacity.base;
  current: number;
  private changeCallbacks: Array<() => void> = [];

  constructor(snapshot?: WateringCanSnapshot, upgraded = false) {
    this.capacity = upgraded ? wateringCapacity.upgraded : wateringCapacity.base;
    this.current = Math.min(Math.max(snapshot?.current ?? this.capacity, 0), this.capacity);
  }

  hasWater() {
    return this.current > 0;
  }

  useWater() {
    if (!this.hasWater()) {
      return false;
    }

    this.current--;
    this.notifyChange();
    return true;
  }

  refill() {
    this.current = this.capacity;
    this.notifyChange();
  }

  getSnapshot(): WateringCanSnapshot {
    return { current: this.current };
  }

  onChange(callback: () => void) {
    this.changeCallbacks.push(callback);
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter((saved) => saved !== callback);
    };
  }

  private notifyChange() {
    this.changeCallbacks.forEach((callback) => callback());
  }
}
