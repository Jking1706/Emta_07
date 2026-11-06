import { actionEnergy, marketOrders, toolUpgrades, tutorialSteps, type ToolId } from '../data/balance';
import type { InventorySystem } from './InventorySystem';
import type { MoneySystem } from './MoneySystem';

export type ProgressionSnapshot = {
  cropsSold: number;
  marketTier: number;
  milestones?: string[];
  completedOrders?: string[];
  upgrades?: ToolId[];
  tatianaEvents?: string[];
  moonBlessingDay?: number;
};

export class ProgressionSystem {
  cropsSold: number;
  marketTier: number;
  milestones = new Set<string>();
  completedOrders = new Set<string>();
  upgrades = new Set<ToolId>();
  tatianaEvents = new Set<string>();
  moonBlessingDay = 0;
  private changeCallbacks: Array<() => void> = [];

  constructor(snapshot?: ProgressionSnapshot) {
    this.cropsSold = snapshot?.cropsSold ?? 0;
    this.marketTier = snapshot?.marketTier ?? 0;
    this.milestones = new Set(snapshot?.milestones ?? []);
    this.completedOrders = new Set(snapshot?.completedOrders ?? []);
    this.upgrades = new Set(snapshot?.upgrades ?? []);
    this.tatianaEvents = new Set(snapshot?.tatianaEvents ?? []);
    this.moonBlessingDay = snapshot?.moonBlessingDay ?? 0;
  }

  recordCropSale() {
    this.record('sell');
    this.cropsSold++;
    const unlocked = this.marketTier === 0 && this.cropsSold >= 10;

    if (unlocked) {
      this.marketTier = 1;
    }

    this.notifyChange();
    return unlocked;
  }

  getSeedDiscount() {
    return this.marketTier >= 1 ? 2 : 0;
  }

  getSnapshot(): ProgressionSnapshot {
    return { cropsSold: this.cropsSold, marketTier: this.marketTier,
      milestones: [...this.milestones], completedOrders: [...this.completedOrders],
      upgrades: [...this.upgrades], tatianaEvents: [...this.tatianaEvents], moonBlessingDay: this.moonBlessingDay };
  }

  record(id: string) {
    this.milestones.add(id);
    this.notifyChange();
  }

  getObjective() {
    return tutorialSteps.find(step => !this.milestones.has(step.id))?.text ?? 'Tu granja crece. Consulta los encargos del mercado con J.';
  }

  claimOrder(id: string, inventory: InventorySystem, money: MoneySystem) {
    const order = marketOrders.find(entry => entry.id === id);
    if (!order || this.completedOrders.has(id) || !inventory.hasItems([{ itemId: order.itemId, quantity: order.quantity }])) return false;
    inventory.removeItems([{ itemId: order.itemId, quantity: order.quantity }]);
    this.completedOrders.add(id);
    money.earn(order.reward);
    this.notifyChange();
    return true;
  }

  buyUpgrade(id: ToolId, money: MoneySystem) {
    if (this.upgrades.has(id) || !money.spend(toolUpgrades[id].price)) return false;
    this.upgrades.add(id);
    this.notifyChange();
    return true;
  }

  energyCost(id: ToolId) {
    return actionEnergy[id][this.upgrades.has(id) ? 1 : 0];
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
