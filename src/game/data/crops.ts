import type { CropId, ItemId } from './items';

export type CropData = {
  id: CropId;
  name: string;
  seedItemId: ItemId;
  harvestItemId: ItemId;
  growthDays: number;
  colors: readonly [number, number, number];
};

export const crops: Record<CropId, CropData> = {
  paleTurnip: {
    id: 'paleTurnip',
    name: 'Nabo palido',
    seedItemId: 'paleTurnipSeed',
    harvestItemId: 'paleTurnip',
    growthDays: 2,
    colors: [0x817b65, 0xb8ad85, 0xe4d6aa],
  },
  blackPumpkin: {
    id: 'blackPumpkin',
    name: 'Calabaza negra',
    seedItemId: 'blackPumpkinSeed',
    harvestItemId: 'blackPumpkin',
    growthDays: 3,
    colors: [0x342136, 0x5b2c46, 0x8f4a28],
  },
};
