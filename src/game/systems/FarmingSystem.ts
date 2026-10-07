import Phaser from 'phaser';
import { crops } from '../data/crops';
import { getItemById, type CropId } from '../data/items';
import { Player } from '../player/Player';
import { DialogSystem } from './DialogSystem';
import { InventorySystem } from './InventorySystem';

type FarmTile = {
  tile: Phaser.Tilemaps.Tile;
  layer: Phaser.Tilemaps.TilemapLayer;
};

type CropState = {
  tileKey: string;
  cropId: CropId;
  plantedDay: number;
  wateredToday: boolean;
  waterCount: number;
  ready: boolean;
  body: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Text;
};

type SavedCropState = Omit<CropState, 'body' | 'marker'>;

export type FarmingSnapshot = {
  tilledTiles: string[];
  crops: SavedCropState[];
};

export class FarmingSystem {
  private scene: Phaser.Scene;
  private farmLayers: Phaser.Tilemaps.TilemapLayer[];
  private player: Player;
  private inventory: InventorySystem;
  private dialog: DialogSystem;
  private getCurrentDay: () => number;
  private tilledTiles = new Set<string>();
  private soilViews = new Map<string, Phaser.GameObjects.Rectangle>();
  private crops = new Map<string, CropState>();
  private highlight: Phaser.GameObjects.Graphics;
  private lastProcessedDay: number;

  constructor(
    scene: Phaser.Scene,
    farmLayers: Phaser.Tilemaps.TilemapLayer[],
    player: Player,
    inventory: InventorySystem,
    dialog: DialogSystem,
    getCurrentDay: () => number,
    savedState?: FarmingSnapshot,
  ) {
    this.scene = scene;
    this.farmLayers = farmLayers;
    this.player = player;
    this.inventory = inventory;
    this.dialog = dialog;
    this.getCurrentDay = getCurrentDay;
    this.lastProcessedDay = getCurrentDay();
    this.highlight = scene.add.graphics().setDepth(30);
    this.loadSnapshot(savedState);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > scene.scale.height - 92) {
        return;
      }

      this.useSelectedItem(this.getCurrentDay(), pointer);
    });
  }

  update(currentDay: number) {
    if (currentDay !== this.lastProcessedDay) {
      this.processNewDay(currentDay);
      this.lastProcessedDay = currentDay;
    }

    this.drawHighlight();
  }

  getSnapshot(): FarmingSnapshot {
    return {
      tilledTiles: [...this.tilledTiles],
      crops: [...this.crops.values()].map((crop) => ({
        tileKey: crop.tileKey,
        cropId: crop.cropId,
        plantedDay: crop.plantedDay,
        wateredToday: crop.wateredToday,
        waterCount: crop.waterCount,
        ready: crop.ready,
      })),
    };
  }

  private useSelectedItem(currentDay: number, pointer: Phaser.Input.Pointer) {
    const farmTile = this.getPointedFarmTile(pointer);

    if (!farmTile) {
      return;
    }

    const selectedSlot = this.inventory.getSelectedSlot();

    if (!selectedSlot.itemId) {
      return;
    }

    const selectedItem = getItemById(selectedSlot.itemId);
    const tileKey = this.getTileKey(farmTile);

    if (selectedItem.id === 'hoe') {
      this.tillTile(farmTile, tileKey);
      return;
    }

    if (selectedItem.id === 'wateringCan') {
      this.waterTile(tileKey);
      return;
    }

    if (selectedItem.id === 'sickle') {
      this.harvestTile(tileKey);
      return;
    }

    if (selectedItem.type === 'seed' && selectedItem.cropId) {
      this.plantSeed(farmTile, tileKey, selectedItem.cropId, currentDay);
    }
  }

  private tillTile(farmTile: FarmTile, tileKey: string) {
    if (this.tilledTiles.has(tileKey) || this.crops.has(tileKey)) {
      return;
    }

    this.tilledTiles.add(tileKey);
    this.soilViews.set(tileKey, this.createSoilView(farmTile.tile));
  }

  private plantSeed(farmTile: FarmTile, tileKey: string, cropId: CropId, currentDay: number) {
    if (!this.tilledTiles.has(tileKey) || this.crops.has(tileKey)) {
      return;
    }

    if (!this.inventory.removeOneFromSelectedSlot()) {
      return;
    }

    this.crops.set(tileKey, this.createCropState(farmTile.tile, tileKey, cropId, currentDay, 0, false));
  }

  private waterTile(tileKey: string) {
    const crop = this.crops.get(tileKey);

    if (!crop || crop.ready || crop.wateredToday) {
      return;
    }

    crop.wateredToday = true;
    crop.marker.setText('');
    this.dialog.show('La tierra bebe con un suspiro bajo.');
  }

  private harvestTile(tileKey: string) {
    const crop = this.crops.get(tileKey);

    if (!crop || !crop.ready) {
      return;
    }

    const cropData = crops[crop.cropId];

    if (!this.inventory.addItem(cropData.harvestItemId, 1)) {
      this.dialog.show('No hay espacio en la hotbar.');
      return;
    }

    crop.body.destroy();
    crop.marker.destroy();
    this.crops.delete(tileKey);
    this.tilledTiles.delete(tileKey);
    this.soilViews.get(tileKey)?.destroy();
    this.soilViews.delete(tileKey);
    this.dialog.show(`${cropData.name} cosechado.`);
  }

  private processNewDay(currentDay: number) {
    this.crops.forEach((crop) => {
      if (crop.ready) {
        return;
      }

      if (crop.wateredToday) {
        crop.waterCount++;
      }

      crop.wateredToday = false;
      this.refreshCropView(crop, currentDay);
    });
  }

  private refreshCropView(crop: CropState, currentDay: number) {
    const cropData = crops[crop.cropId];
    crop.ready = crop.waterCount >= cropData.growthDays;
    const stageIndex = Math.min(crop.waterCount, cropData.colors.length - 1);
    crop.body.setFillStyle(cropData.colors[stageIndex]);
    crop.body.setSize(10 + stageIndex * 5, 8 + stageIndex * 5);
    crop.marker.setText(crop.ready ? '!' : crop.wateredToday ? '' : '~');

    if (crop.ready && currentDay > crop.plantedDay) {
      crop.marker.setColor('#f0b35a');
    }
  }

  private drawHighlight() {
    this.highlight.clear();
    const tile = this.getPointedFarmTile(this.scene.input.activePointer);

    if (!tile) {
      return;
    }

    this.highlight
      .lineStyle(2, 0xf0b35a, 0.9)
      .strokeRect(tile.tile.pixelX, tile.tile.pixelY, tile.tile.width, tile.tile.height);
  }

  private createCropState(
    tile: Phaser.Tilemaps.Tile,
    tileKey: string,
    cropId: CropId,
    plantedDay: number,
    waterCount: number,
    wateredToday: boolean,
  ): CropState {
    const cropData = crops[cropId];
    const body = this.scene.add
      .rectangle(tile.getCenterX(), tile.getCenterY() - 3, 10, 8, cropData.colors[0])
      .setDepth(18);
    const marker = this.scene.add
      .text(tile.getCenterX() + 6, tile.getCenterY() - 18, '~', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#8fb0d8',
      })
      .setOrigin(0.5)
      .setDepth(19);
    const crop: CropState = {
      tileKey,
      cropId,
      plantedDay,
      wateredToday,
      waterCount,
      ready: false,
      body,
      marker,
    };
    this.refreshCropView(crop, plantedDay);
    return crop;
  }

  private createSoilView(tile: Phaser.Tilemaps.Tile) {
    return this.scene.add
      .rectangle(tile.getCenterX(), tile.getCenterY(), tile.width - 5, tile.height - 5, 0x3a2b25, 0.86)
      .setDepth(12);
  }

  private loadSnapshot(snapshot?: FarmingSnapshot) {
    if (!snapshot) {
      return;
    }

    snapshot.tilledTiles.forEach((tileKey) => {
      const tile = this.getTileFromKey(tileKey);

      if (!tile) {
        return;
      }

      this.tilledTiles.add(tileKey);
      this.soilViews.set(tileKey, this.createSoilView(tile));
    });

    snapshot.crops.forEach((savedCrop) => {
      const tile = this.getTileFromKey(savedCrop.tileKey);

      if (!tile) {
        return;
      }

      const crop = this.createCropState(
        tile,
        savedCrop.tileKey,
        savedCrop.cropId,
        savedCrop.plantedDay,
        savedCrop.waterCount,
        savedCrop.wateredToday,
      );
      crop.ready = savedCrop.ready;
      this.crops.set(savedCrop.tileKey, crop);
    });
  }

  private getPointedFarmTile(pointer: Phaser.Input.Pointer) {
    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;

    for (const layer of this.farmLayers) {
      const tile = layer.getTileAtWorldXY(worldPoint.x, worldPoint.y);

      if (!tile || tile.index <= 0 || !this.isNearPlayer(layer, tile)) {
        continue;
      }

      return {
        tile,
        layer,
      };
    }

    return null;
  }

  private isNearPlayer(layer: Phaser.Tilemaps.TilemapLayer, tile: Phaser.Tilemaps.Tile) {
    const playerTileX = layer.worldToTileX(this.player.sprite.x) ?? 0;
    const playerTileY = layer.worldToTileY(this.player.sprite.y) ?? 0;
    return Math.abs(tile.x - playerTileX) <= 1 && Math.abs(tile.y - playerTileY) <= 1;
  }

  private getTileFromKey(tileKey: string) {
    const [layerName, position] = tileKey.includes(':') ? tileKey.split(':') : ['farm', tileKey];
    const [x, y] = position.split(',').map(Number);
    const layer = this.farmLayers.find((farmLayer) => farmLayer.layer.name === layerName);
    return layer?.getTileAt(x, y) ?? null;
  }

  private getTileKey(farmTile: FarmTile) {
    return `${farmTile.layer.layer.name}:${farmTile.tile.x},${farmTile.tile.y}`;
  }
}
