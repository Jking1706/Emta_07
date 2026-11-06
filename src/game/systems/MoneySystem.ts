export class MoneySystem {
  private balance: number;
  private changeCallbacks: Array<() => void> = [];

  constructor(initialBalance = 120) {
    this.balance = initialBalance;
  }

  getBalance() {
    return this.balance;
  }

  canAfford(amount: number) {
    return this.balance >= amount;
  }

  spend(amount: number) {
    if (!this.canAfford(amount)) {
      return false;
    }

    this.balance -= amount;
    this.notifyChange();
    return true;
  }

  earn(amount: number) {
    this.balance += amount;
    this.notifyChange();
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
