export type ItemType = 'tool' | 'seed' | 'crop' | 'snack' | 'medicine';
export type ItemId =
  | 'hoe'
  | 'wateringCan'
  | 'sickle'
  | 'paleTurnipSeed'
  | 'blackPumpkinSeed'
  | 'paleTurnip'
  | 'blackPumpkin'
  | 'chocoSoda'
  | 'strawberry'
  | 'sourGummy'
  | 'effervescentMagnesium';
export type CropId = 'paleTurnip' | 'blackPumpkin';

export type GameItem = {
  id: ItemId;
  name: string;
  type: ItemType;
  maxStack: number;
  cropId?: CropId;
};

export const items: Record<ItemId, GameItem> = {
  hoe: {
    id: 'hoe',
    name: 'Azada torcida',
    type: 'tool',
    maxStack: 1,
  },
  wateringCan: {
    id: 'wateringCan',
    name: 'Regadera oxidada',
    type: 'tool',
    maxStack: 1,
  },
  sickle: {
    id: 'sickle',
    name: 'Hoz vieja',
    type: 'tool',
    maxStack: 1,
  },
  paleTurnipSeed: {
    id: 'paleTurnipSeed',
    name: 'Semilla de nabo palido',
    type: 'seed',
    maxStack: 99,
    cropId: 'paleTurnip',
  },
  blackPumpkinSeed: {
    id: 'blackPumpkinSeed',
    name: 'Semilla de calabaza negra',
    type: 'seed',
    maxStack: 99,
    cropId: 'blackPumpkin',
  },
  paleTurnip: {
    id: 'paleTurnip',
    name: 'Nabo palido',
    type: 'crop',
    maxStack: 99,
  },
  blackPumpkin: {
    id: 'blackPumpkin',
    name: 'Calabaza negra',
    type: 'crop',
    maxStack: 99,
  },
  chocoSoda: {
    id: 'chocoSoda',
    name: 'Choco Soda',
    type: 'snack',
    maxStack: 99,
  },
  strawberry: {
    id: 'strawberry',
    name: 'Fresa',
    type: 'snack',
    maxStack: 99,
  },
  sourGummy: {
    id: 'sourGummy',
    name: 'Gomita Acida',
    type: 'snack',
    maxStack: 99,
  },
  effervescentMagnesium: {
    id: 'effervescentMagnesium',
    name: 'Magnesio efervescente',
    type: 'medicine',
    maxStack: 99,
  },
};

export const startingItems: Array<{ itemId: ItemId; quantity: number }> = [
  { itemId: 'hoe', quantity: 1 },
  { itemId: 'wateringCan', quantity: 1 },
  { itemId: 'sickle', quantity: 1 },
  { itemId: 'paleTurnipSeed', quantity: 6 },
  { itemId: 'chocoSoda', quantity: 2 },
  { itemId: 'strawberry', quantity: 2 },
  { itemId: 'sourGummy', quantity: 2 },
  { itemId: 'effervescentMagnesium', quantity: 1 },
];

export function getItemById(itemId: ItemId) {
  return items[itemId];
}
