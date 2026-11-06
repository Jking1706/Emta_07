import Phaser from 'phaser';
import { crops } from '../data/crops';
import { actionEnergy, cropBalance } from '../data/balance';
import { getItemById, type CropId } from '../data/items';
import { Player } from '../player/Player';
import { DialogSystem } from './DialogSystem';
import { EnergySystem } from './EnergySystem';
import { InventorySystem } from './InventorySystem';
import { WateringCanSystem } from './WateringCanSystem';
import { ProgressionSystem } from './ProgressionSystem';
import { SoundFeedback } from './SoundFeedback';
import type { InteractionCandidate } from './InteractionResolver';

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
  sprite: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Text;
};

type SavedCropState = Omit<CropState, 'sprite' | 'marker'>;

export type FarmingSnapshot = {
  tilledTiles: string[];
  crops: SavedCropState[];
  lastProcessedDay?: number;
};

export class FarmingSystem {
  private scene: Phaser.Scene;
  private farmLayers: Phaser.Tilemaps.TilemapLayer[];
  private player: Player;
  private inventory: InventorySystem;
  private energy: EnergySystem;
  private wateringCan: WateringCanSystem;
  private dialog: DialogSystem;
  private getCurrentDay: () => number;
  private tilledTiles = new Set<string>();
  private soilViews = new Map<string, Phaser.GameObjects.Image>();
  private progression: ProgressionSystem;
  private crops = new Map<string, CropState>();
  private highlight: Phaser.GameObjects.Graphics;
  private lastProcessedDay: number;

  constructor(
    scene: Phaser.Scene,
    farmLayers: Phaser.Tilemaps.TilemapLayer[],
    player: Player,
    inventory: InventorySystem,
    energy: EnergySystem,
    wateringCan: WateringCanSystem,
    dialog: DialogSystem,
    getCurrentDay: () => number,
    savedState?: FarmingSnapshot,
    progression = new ProgressionSystem(),
  ) {
    this.scene = scene;
    this.progression = progression;
    this.farmLayers = farmLayers;
    this.player = player;
    this.inventory = inventory;
    this.energy = energy;
    this.wateringCan = wateringCan;
    this.dialog = dialog;
    this.getCurrentDay = getCurrentDay;
    this.lastProcessedDay = savedState?.lastProcessedDay ?? getCurrentDay();
    this.highlight = scene.add.graphics().setDepth(30);
    this.loadSnapshot(savedState);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.dialog.isActive || scene.data.get('uiBlocked')) return;
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

  addFarmLayer(layer: Phaser.Tilemaps.TilemapLayer) {
    if (!this.farmLayers.includes(layer)) {
      this.farmLayers.push(layer);
    }
  }

  getInteraction(): InteractionCandidate | undefined {
    if (!this.inventory.getItemCount('sickle')) return undefined;
    const crop = [...this.crops.values()].filter(c => c.ready)
      .map(c => ({ crop: c, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y) }))
      .filter(c => c.distance <= 24).sort((a, b) => a.distance - b.distance)[0];
    if (!crop) return undefined;
    return { label: 'Cosechar', distance: crop.distance, priority: 5, activate: () => {
      if (this.harvestTile(crop.crop.tileKey)) this.spendEnergy(this.progression.energyCost('sickle'));
    } };
  }

  getSnapshot(): FarmingSnapshot {
    return {
      tilledTiles: [...this.tilledTiles],
      lastProcessedDay: this.lastProcessedDay,
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
      if (this.tillTile(farmTile, tileKey)) {
        this.spendEnergy(this.progression.energyCost('hoe'));
      }
      return;
    }

    if (selectedItem.id === 'wateringCan') {
      if (this.waterTile(tileKey)) {
        this.spendEnergy(this.progression.energyCost('wateringCan'));
        this.wateringCan.useWater();
      }
      return;
    }

    if (selectedItem.id === 'sickle') {
      if (this.harvestTile(tileKey)) {
        this.spendEnergy(this.progression.energyCost('sickle'));
      }
      return;
    }

    if (selectedItem.type === 'seed' && selectedItem.cropId) {
      if (this.plantSeed(farmTile, tileKey, selectedItem.cropId, currentDay)) {
        this.spendEnergy(actionEnergy.plant);
      }
    }
  }

  private tillTile(farmTile: FarmTile, tileKey: string) {
    if (this.tilledTiles.has(tileKey) || this.crops.has(tileKey)) {
      return false;
    }

    if (!this.energy.canSpend(this.progression.energyCost('hoe'))) {
      this.dialog.show('Estas demasiado cansada para arar.');
      return false;
    }

    this.tilledTiles.add(tileKey);
    this.soilViews.set(tileKey, this.createSoilView(farmTile.tile));
    this.progression.record('till');
    this.feedback(farmTile.tile.getCenterX(), farmTile.tile.getCenterY(), 0xb88b60);
    SoundFeedback.play(this.scene, 'tool');
    return true;
  }

  private plantSeed(farmTile: FarmTile, tileKey: string, cropId: CropId, currentDay: number) {
    if (!this.tilledTiles.has(tileKey) || this.crops.has(tileKey)) {
      return false;
    }

    if (!this.energy.canSpend(actionEnergy.plant)) {
      this.dialog.show('Necesitas descansar antes de sembrar.');
      return false;
    }

    if (!this.inventory.removeOneFromSelectedSlot()) {
      return false;
    }

    this.crops.set(tileKey, this.createCropState(farmTile.tile, tileKey, cropId, currentDay, 0, false));
    this.progression.record('plant');
    this.feedback(farmTile.tile.getCenterX(), farmTile.tile.getCenterY(), 0x9cbf71);
    SoundFeedback.play(this.scene, 'tool');
    return true;
  }

  private waterTile(tileKey: string) {
    const crop = this.crops.get(tileKey);

    if (!crop || crop.ready || crop.wateredToday) {
      return false;
    }

    if (!this.energy.canSpend(this.progression.energyCost('wateringCan'))) {
      this.dialog.show('Estas demasiado cansada para regar.');
      return false;
    }

    if (!this.wateringCan.hasWater()) {
      this.dialog.show('La regadera esta vacia. Busca el pozo.');
      return false;
    }

    crop.wateredToday = true;
    this.soilViews.get(tileKey)?.setTexture('soil-wet');
    this.progression.record('water');
    this.feedback(crop.sprite.x, crop.sprite.y, 0x80ccdf);
    SoundFeedback.play(this.scene, 'water');
    this.refreshCropView(crop, this.getCurrentDay());
    this.dialog.show('La tierra bebe con un suspiro bajo.');
    return true;
  }

  private harvestTile(tileKey: string) {
    const crop = this.crops.get(tileKey);

    if (!crop || !crop.ready) {
      return false;
    }

    if (!this.energy.canSpend(this.progression.energyCost('sickle'))) {
      this.dialog.show('Necesitas descansar antes de cosechar.');
      return false;
    }

    const cropData = crops[crop.cropId];

    if (!this.inventory.addItem(cropData.harvestItemId, cropBalance[crop.cropId].yield)) {
      this.dialog.show('Mochila llena. Guarda objetos en el cofre de casa; el cultivo seguirá aquí.');
      return false;
    }

    this.feedback(crop.sprite.x, crop.sprite.y, 0xe9c878);
    crop.sprite.destroy();
    crop.marker.destroy();
    this.crops.delete(tileKey);
    this.tilledTiles.delete(tileKey);
    this.soilViews.get(tileKey)?.destroy();
    this.soilViews.delete(tileKey);
    this.progression.record('harvest');
    SoundFeedback.play(this.scene, 'reward');
    this.dialog.show(`${cropData.name} cosechado.`);
    return true;
  }

  private spendEnergy(amount: number) {
    this.energy.spend(amount);
  }

  private feedback(x: number, y: number, tint: number) {
    this.player.playToolAction();
    const emitter = this.scene.add.particles(x, y, 'sparkle-particle', {
      emitting: false, lifespan: 380, speed: { min: 12, max: 30 }, gravityY: 45,
      scale: { start: .65, end: 0 }, alpha: { start: .8, end: 0 }, tint,
    }).setDepth(y + 2);
    emitter.explode(7);
    this.scene.time.delayedCall(450, () => emitter.destroy());
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
      this.soilViews.get(crop.tileKey)?.setTexture('soil-dry');
      this.refreshCropView(crop, currentDay);
    });
  }

  private refreshCropView(crop: CropState, currentDay: number) {
    const cropData = crops[crop.cropId];
    crop.ready = crop.waterCount >= cropData.growthDays;
    const stageIndex = Math.min(cropData.stageCount - 1,
      Math.floor(crop.waterCount / cropData.growthDays * (cropData.stageCount - 1)));
    crop.sprite.setFrame(stageIndex);
    crop.marker.setText(crop.ready ? '!' : crop.wateredToday ? '.' : '~');

    if (crop.ready && currentDay > crop.plantedDay) {
      crop.marker.setColor('#f0b35a');
    }
  }

  private drawHighlight() {
    this.highlight.clear();
    if (this.dialog.isActive || this.scene.data.get('uiBlocked')) return;
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
    const rootY = tile.getCenterY() + 6;
    const sprite = this.scene.add
      .image(tile.getCenterX(), rootY, cropData.textureKey, 0)
      .setOrigin(0.5, 22 / 24)
      .setDepth(rootY);
    const marker = this.scene.add
      .text(tile.getCenterX() + 6, tile.getCenterY() - 18, '~', {
        fontFamily: 'Georgia, serif',
         fontSize: '9px',
        color: '#8fb0d8',
      })
      .setOrigin(0.5)
      .setDepth(rootY + 1);
    const crop: CropState = {
      tileKey,
      cropId,
      plantedDay,
      wateredToday,
      waterCount,
      ready: false,
      sprite,
      marker,
    };
    this.refreshCropView(crop, plantedDay);
    return crop;
  }

  private createSoilView(tile: Phaser.Tilemaps.Tile) {
    return this.scene.add
      .image(tile.getCenterX(), tile.getCenterY(), 'soil-dry')
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
      if (savedCrop.wateredToday) {
        this.soilViews.get(savedCrop.tileKey)?.setTexture('soil-wet');
      }
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
