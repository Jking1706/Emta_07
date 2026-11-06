import type { CropId, ItemId } from './items';
import { cropBalance } from './balance';

export type CropData = {
  id: CropId;
  name: string;
  seedItemId: ItemId;
  harvestItemId: ItemId;
  growthDays: number;
  textureKey: string;
  stageCount: number;
};

export const crops: Record<CropId, CropData> = {
  paleTurnip: {
    id: 'paleTurnip',
    name: 'Nabo palido',
    seedItemId: 'paleTurnipSeed',
    harvestItemId: 'paleTurnip',
    growthDays: cropBalance.paleTurnip.growthDays,
    textureKey: 'pale_turnip_stages',
    stageCount: 3,
  },
  blackPumpkin: {
    id: 'blackPumpkin',
    name: 'Calabaza negra',
    seedItemId: 'blackPumpkinSeed',
    harvestItemId: 'blackPumpkin',
    growthDays: cropBalance.blackPumpkin.growthDays,
    textureKey: 'black_pumpkin_stages',
    stageCount: 4,
  },
};
