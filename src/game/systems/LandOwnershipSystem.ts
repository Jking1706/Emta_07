import { landPrices } from '../data/balance';
export type FarmId = 'farm' | 'farm2' | 'farm3';

export type LandOwnershipSnapshot = {
  ownedFarmIds: FarmId[];
};

export const farmPurchaseOptions: Record<Exclude<FarmId, 'farm'>, { name: string; price: number }> = {
  farm2: { name: 'Huerto de la bruma', price: landPrices.farm2 },
  farm3: { name: 'Terreno lunar', price: landPrices.farm3 },
};

export class LandOwnershipSystem {
  private ownedFarmIds: Set<FarmId>;

  constructor(snapshot?: LandOwnershipSnapshot) {
    this.ownedFarmIds = new Set<FarmId>(['farm', ...(snapshot?.ownedFarmIds ?? [])]);
  }

  isOwned(farmId: FarmId) {
    return this.ownedFarmIds.has(farmId);
  }

  buy(farmId: Exclude<FarmId, 'farm'>) {
    this.ownedFarmIds.add(farmId);
  }

  getSnapshot(): LandOwnershipSnapshot {
    return { ownedFarmIds: [...this.ownedFarmIds] };
  }
}
