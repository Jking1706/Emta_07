import Phaser from 'phaser';
import { startingItems } from '../data/items';
import { Player } from '../player/Player';
import { BuildingEntranceSystem } from '../systems/BuildingEntranceSystem';
import { CharacterInteractionSystem } from '../systems/CharacterInteractionSystem';
import { DialogSystem } from '../systems/DialogSystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { SaveSystem, type SaveGameData } from '../systems/SaveSystem';
import { TimeSystem } from '../systems/TimeSystem';
import { GameHud } from '../ui/GameHud';

type FarmSceneData = {
  save?: SaveGameData | null;
  returnPosition?: {
    x: number;
    y: number;
  };
};

type TiledProperty = {
  name?: string;
  value?: unknown;
};

export class FarmScene extends Phaser.Scene {
  private player!: Player;
  private buildingEntranceSystem!: BuildingEntranceSystem;
  private characterInteractionSystem!: CharacterInteractionSystem;
  private farmingSystem!: FarmingSystem;
  private dialogSystem!: DialogSystem;
  private inventorySystem!: InventorySystem;
  private timeSystem!: TimeSystem;
  private hud!: GameHud;
  private saveKey!: Phaser.Input.Keyboard.Key;
  private loadKey!: Phaser.Input.Keyboard.Key;
  private nextDayKey!: Phaser.Input.Keyboard.Key;
  private loadedSave?: SaveGameData | null;
  private returnPosition?: { x: number; y: number };

  constructor() {
    super('FarmScene');
  }

  init(data?: FarmSceneData) {
    this.loadedSave = data?.save ?? SaveSystem.load();
    this.returnPosition = data?.returnPosition;
  }

  create() {
    const map = this.make.tilemap({ key: 'farm-map' });
    const tilesets = map.tilesets.map((tileset) => {
      const loadedTileset = map.addTilesetImage(tileset.name, tileset.name);

      if (!loadedTileset) {
        throw new Error(`Tileset ${tileset.name} could not be loaded.`);
      }

      return loadedTileset;
    });
    const farmLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    let collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

    map.layers.forEach((layerData) => {
      if (layerData.name === 'Collision') {
        collisionLayer = map.createLayer(layerData.name, tilesets, 0, 0);
        collisionLayer?.setCollisionByExclusion([-1]).setAlpha(0);
        return;
      }

      if (layerData.name.endsWith('_collision')) {
        return;
      }

      const layer = map.createLayer(layerData.name, tilesets, 0, 0);

      if (!layer) {
        return;
      }

      const layerProperties = layerData.properties as TiledProperty[] | undefined;
      const tiledDepthProperty = layerProperties?.find((property) => property.name === 'gamemaker_depth');

      if (tiledDepthProperty) {
        layer.setDepth(-Number(tiledDepthProperty.value));
      }

      if (layerData.name === 'farm' || layerData.name === 'farm2' || layerData.name === 'farm3') {
        farmLayers.push(layer);
      }
    });

    if (!collisionLayer) {
      throw new Error('Collision layer could not be loaded.');
    }

    this.player = new Player(
      this,
      this.returnPosition?.x ?? this.loadedSave?.playerPosition.x ?? 672,
      this.returnPosition?.y ?? this.loadedSave?.playerPosition.y ?? 496,
    );
    this.player.sprite.setDepth(10);

    this.physics.add.collider(this.player.sprite, collisionLayer);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.65);
    this.createAmbientFx();

    this.timeSystem = new TimeSystem();
    if (this.loadedSave) {
      this.timeSystem.loadSnapshot(this.loadedSave.time);
    }

    this.inventorySystem = new InventorySystem();
    if (this.loadedSave) {
      this.inventorySystem.loadSnapshot(this.loadedSave.inventory);
    } else {
      startingItems.forEach((item) => this.inventorySystem.addItem(item.itemId, item.quantity));
    }

    this.dialogSystem = new DialogSystem(this);
    this.buildingEntranceSystem = new BuildingEntranceSystem(
      this,
      map,
      this.player,
      this.dialogSystem,
      () => this.createSaveGame(),
    );
    this.farmingSystem = new FarmingSystem(
      this,
      farmLayers,
      this.player,
      this.inventorySystem,
      this.dialogSystem,
      () => this.timeSystem.day,
      this.loadedSave?.farming,
    );
    this.characterInteractionSystem = new CharacterInteractionSystem(
      this,
      this.player,
      this.inventorySystem,
      collisionLayer,
    );
    this.hud = new GameHud(this, this.inventorySystem, this.timeSystem);

    this.setupHotbarInput();
    this.saveKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
    this.loadKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    this.nextDayKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.F5,
      Phaser.Input.Keyboard.KeyCodes.F9,
    ]);

  }

  update(time: number) {
    const dayChanged = this.timeSystem.update(time);
    this.player.update();
    this.player.sprite.setDepth(this.player.sprite.y);
    this.farmingSystem.update(this.timeSystem.day);
    this.buildingEntranceSystem.update();
    this.characterInteractionSystem.update();
    this.hud.update();

    if (dayChanged) {
      this.dialogSystem.show('Amanece otra vez sobre la granja torcida.');
    }

    if (Phaser.Input.Keyboard.JustDown(this.nextDayKey)) {
      this.timeSystem.advanceDay();
      this.dialogSystem.show('La noche se pliega. Empieza un nuevo dia.');
    }

    if (Phaser.Input.Keyboard.JustDown(this.saveKey)) {
      SaveSystem.save(this.createSaveGame());
      this.dialogSystem.show('Partida guardada.');
    }

    if (Phaser.Input.Keyboard.JustDown(this.loadKey)) {
      this.scene.restart({ save: SaveSystem.load() });
    }
  }

  private createSaveGame(): SaveGameData {
    return {
      version: 1,
      playerPosition: {
        x: this.player.sprite.x,
        y: this.player.sprite.y,
      },
      inventory: this.inventorySystem.getSnapshot(),
      time: this.timeSystem.getSnapshot(),
      farming: this.farmingSystem.getSnapshot(),
    };
  }

  private setupHotbarInput() {
    for (let index = 0; index < 8; index++) {
      const keyCode = Phaser.Input.Keyboard.KeyCodes.ONE + index;
      const key = this.input.keyboard!.addKey(keyCode);
      key.on('down', () => this.inventorySystem.selectSlot(index));
    }
  }

  private createAmbientFx() {
    const sparkle = this.add.graphics();
    sparkle.fillStyle(0xffffff, 1);
    sparkle.fillCircle(2, 2, 2);
    sparkle.generateTexture('sparkle-particle', 4, 4);
    sparkle.destroy();

    this.add.particles(470, 315, 'sparkle-particle', {
      lifespan: 1800,
      speed: { min: 4, max: 14 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 0.55, end: 0 },
      quantity: 1,
      frequency: 260,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(1);

    this.add.particles(955, 250, 'sparkle-particle', {
      lifespan: 2400,
      speedY: { min: -10, max: -4 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.35, end: 0 },
      quantity: 1,
      frequency: 420,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(2);
  }

}
