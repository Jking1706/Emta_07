import type { ItemId } from './items';

export const seedPrices = { paleTurnipSeed: 8, blackPumpkinSeed: 18 };
export const salePrices = { paleTurnip: 14, blackPumpkin: 34 };
export const shopPrices = { strawberry: 12, chocoSoda: 16 };
export const cropBalance = { paleTurnip: { growthDays: 2, yield: 1 }, blackPumpkin: { growthDays: 3, yield: 1 } };
export const actionEnergy = { plant: 1, hoe: [3, 2], wateringCan: [2, 1], sickle: [2, 1] } as const;
export const wateringCapacity = { base: 24, upgraded: 48 };
export const landPrices = { farm2: 80, farm3: 180 };
export const toolUpgrades = {
  hoe: { name: 'Azada templada', price: 70, description: 'Arar consume 2 de energía en lugar de 3.' },
  wateringCan: { name: 'Regadera de cobre', price: 90, description: '48 cargas; regar consume 1 de energía.' },
  sickle: { name: 'Hoz afilada', price: 60, description: 'Cosechar consume 1 de energía.' },
} as const;
export type ToolId = keyof typeof toolUpgrades;
export const marketOrders: Array<{ id: string; title: string; itemId: ItemId; quantity: number; reward: number }> = [
  { id: 'turnips', title: 'La primera cesta', itemId: 'paleTurnip', quantity: 3, reward: 55 },
  { id: 'pumpkins', title: 'Cena de otoño', itemId: 'blackPumpkin', quantity: 2, reward: 85 },
  { id: 'stew', title: 'Una cena para Tatiana', itemId: 'pumpkinStew', quantity: 1, reward: 90 },
];
export const tutorialSteps = [
  { id: 'till', text: '1. Prepara tierra: azada (1) + clic en la parcela del este.' },
  { id: 'plant', text: '2. Siembra: selecciona semillas (4) y pulsa la tierra preparada.' },
  { id: 'water', text: '3. Riega: regadera (2) + clic en el brote. Recarga en el pozo.' },
  { id: 'sleep', text: '4. Descansa en la cama de casa. Cada día regado hace crecer el cultivo.' },
  { id: 'harvest', text: '5. Riega otro día; cuando esté listo, cosecha con la hoz (3).' },
  { id: 'sell', text: '6. Vende en el mercado. I: mochila · J: diario y encargos.' },
  { id: 'land', text: '7. Amplía la granja: ahorra 80 de oro y compra el huerto en su cartel.' },
] as const;
