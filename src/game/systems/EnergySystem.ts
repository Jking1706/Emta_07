export type EnergySnapshot = {
  current: number;
};

export class EnergySystem {
  readonly max = 100;
  current: number;
  private changeCallbacks: Array<() => void> = [];

  constructor(snapshot?: EnergySnapshot) {
    this.current = Math.min(Math.max(snapshot?.current ?? this.max, 0), this.max);
  }

  canSpend(amount: number) {
    return this.current >= amount;
  }

  spend(amount: number) {
    if (!this.canSpend(amount)) {
      return false;
    }

    this.current -= amount;
    this.notifyChange();
    return true;
  }

  restore() {
    this.current = this.max;
    this.notifyChange();
  }

  getSnapshot(): EnergySnapshot {
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
