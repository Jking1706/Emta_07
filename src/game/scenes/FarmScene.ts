import Phaser from 'phaser';
import { TatianaNPC } from '../../objects/TatianaNPC';
import { startingItems } from '../data/items';
import { Player } from '../player/Player';
import { BuildingEntranceSystem } from '../systems/BuildingEntranceSystem';
import { CharacterInteractionSystem } from '../systems/CharacterInteractionSystem';
import { DialogSystem } from '../systems/DialogSystem';
import { EnergySystem } from '../systems/EnergySystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { LandOwnershipSystem, type FarmId } from '../systems/LandOwnershipSystem';
import { LandPurchaseSystem } from '../systems/LandPurchaseSystem';
import { MoneySystem } from '../systems/MoneySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { SaveSystem, type SaveGameData } from '../systems/SaveSystem';
import { TimeSystem } from '../systems/TimeSystem';
import { WateringCanSystem } from '../systems/WateringCanSystem';
import { UIScene } from './UIScene';
import { resolveInteraction, type InteractionCandidate } from '../systems/InteractionResolver';
import { SoundFeedback } from '../systems/SoundFeedback';
import { wateringCapacity } from '../data/balance';
import { showSpeechBubble } from '../ui/SpeechBubble';
import { NarrativePause } from '../systems/NarrativePause';

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
  private tatiana!: TatianaNPC;
  private buildingEntranceSystem!: BuildingEntranceSystem;
  private characterInteractionSystem!: CharacterInteractionSystem;
  private farmingSystem!: FarmingSystem;
  private dialogSystem!: DialogSystem;
  private inventorySystem!: InventorySystem;
  private moneySystem!: MoneySystem;
  private energySystem!: EnergySystem;
  private wateringCanSystem!: WateringCanSystem;
  private progressionSystem!: ProgressionSystem;
  private landOwnershipSystem!: LandOwnershipSystem;
  private landPurchaseSystem!: LandPurchaseSystem;
  private timeSystem!: TimeSystem;
  private ui!: UIScene;
  private narrativePause!: NarrativePause;
  private storage!: InventorySystem;
  private saveKey!: Phaser.Input.Keyboard.Key;
  private loadKey!: Phaser.Input.Keyboard.Key;
  private nextDayKey!: Phaser.Input.Keyboard.Key;
  private observatoryZone!: Phaser.GameObjects.Zone;
  private observatoryPrompt!: Phaser.GameObjects.Text;
  private beachZone!: Phaser.GameObjects.Zone;
  private beachPrompt!: Phaser.GameObjects.Text;
  private beachView?: Phaser.GameObjects.Container;
  private jukeboxZone!: Phaser.GameObjects.Zone;
  private jukeboxPrompt!: Phaser.GameObjects.Text;
  private activityText!: Phaser.GameObjects.Text;
  private moonView?: Phaser.GameObjects.Container;
  private lunarEventAnnouncedDay = 0;
  private loadedSave?: SaveGameData | null;
  private returnPosition?: { x: number; y: number };

  constructor() {
    super('FarmScene');
  }

  init(data?: FarmSceneData) {
    this.moonView = undefined; this.beachView = undefined;
    this.data.set('uiBlocked', false); this.data.set('externalModal', false);
    this.loadedSave = data?.save ?? SaveSystem.load();
    this.returnPosition = data?.returnPosition;
  }

  create() {
    this.narrativePause = new NarrativePause(this);
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
    const purchasableFarmLayers = new Map<Exclude<FarmId, 'farm'>, Phaser.Tilemaps.TilemapLayer>();
    const signLayers = new Map<Exclude<FarmId, 'farm'>, Phaser.Tilemaps.TilemapLayer>();
    const lockedCollisionLayers = new Map<Exclude<FarmId, 'farm'>, Phaser.Tilemaps.TilemapLayer>();
    this.landOwnershipSystem = new LandOwnershipSystem(this.loadedSave?.landOwnership);

    map.layers.forEach((layerData) => {
      if (layerData.name === 'Collision') {
        collisionLayer = map.createLayer(layerData.name, tilesets, 0, 0);
        collisionLayer?.setCollisionByExclusion([-1]).setAlpha(0);
        return;
      }

      const lockedCollisionMatch = layerData.name.match(/^buy_(farm[23])_collision$/);

      if (lockedCollisionMatch) {
        const farmId = lockedCollisionMatch[1] as Exclude<FarmId, 'farm'>;
        const layer = map.createLayer(layerData.name, tilesets, 0, 0);

        if (layer) {
          lockedCollisionLayers.set(farmId, layer);
        }
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

      if (layerData.name === 'farm') {
        farmLayers.push(layer);
      } else if (layerData.name === 'farm2' || layerData.name === 'farm3') {
        const farmId = layerData.name as Exclude<FarmId, 'farm'>;
        purchasableFarmLayers.set(farmId, layer);

        if (this.landOwnershipSystem.isOwned(farmId)) {
          farmLayers.push(layer);
        }
      }

      const signMatch = layerData.name.match(/^buy_(farm[23])$/);

      if (signMatch) {
        signLayers.set(signMatch[1] as Exclude<FarmId, 'farm'>, layer);
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
    this.tatiana = new TatianaNPC(this, 730, 545, [
      { x: 730, y: 545 },
      { x: 690, y: 500 },
      { x: 760, y: 475 },
      { x: 820, y: 535 },
      { x: 875, y: 600 },
    ]);

    this.physics.add.collider(this.player.sprite, collisionLayer);
    this.physics.add.collider(this.tatiana, collisionLayer);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.65);
    this.createAmbientFx();
    this.createObservatory();
    this.createBeachLookout();
    this.createJukebox();

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
    this.moneySystem = new MoneySystem(this.loadedSave?.money ?? 120);
    this.energySystem = new EnergySystem(this.loadedSave?.energy);
    this.wateringCanSystem = new WateringCanSystem(this.loadedSave?.wateringCan);
    this.progressionSystem = new ProgressionSystem(this.loadedSave?.progression);
    this.wateringCanSystem.capacity = this.progressionSystem.upgrades.has('wateringCan') ? wateringCapacity.upgraded : wateringCapacity.base;
    this.wateringCanSystem.current = Math.min(this.loadedSave?.wateringCan?.current ?? wateringCapacity.base, this.wateringCanSystem.capacity);
    this.storage = new InventorySystem(18);
    if (this.loadedSave?.storage) this.storage.loadSnapshot(this.loadedSave.storage);
    this.ui = this.scene.get('UIScene') as UIScene;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.moonView?.destroy(true); this.beachView?.destroy(true);
    });
    this.ui.bind({ world: this, player: this.player, inventory: this.inventorySystem, storage: this.storage,
      money: this.moneySystem, energy: this.energySystem, water: this.wateringCanSystem,
      progression: this.progressionSystem, clock: this.timeSystem, location: 'farm',
      save: () => SaveSystem.save(this.createSaveGame()) });
    this.dialogSystem = this.ui.dialogue;
    this.buildingEntranceSystem = new BuildingEntranceSystem(
      this,
      map,
      this.player,
      this.dialogSystem,
      this.wateringCanSystem,
      () => this.createSaveGame(),
    );
    this.farmingSystem = new FarmingSystem(
      this,
      farmLayers,
      this.player,
      this.inventorySystem,
      this.energySystem,
      this.wateringCanSystem,
      this.dialogSystem,
      () => this.timeSystem.day,
      this.loadedSave?.farming,
      this.progressionSystem,
    );
    this.landPurchaseSystem = new LandPurchaseSystem(
      this,
      this.player,
      this.moneySystem,
      this.landOwnershipSystem,
      this.dialogSystem,
      (['farm2', 'farm3'] as const).flatMap((farmId) => {
        const signLayer = signLayers.get(farmId);
        const collision = lockedCollisionLayers.get(farmId);
        return signLayer && collision ? [{ farmId, signLayer, collisionLayer: collision }] : [];
      }),
      (farmId) => {
        const farmLayer = purchasableFarmLayers.get(farmId);
        if (farmLayer) {
          this.farmingSystem.addFarmLayer(farmLayer);
        }
        this.progressionSystem.record('land');
        SoundFeedback.play(this, 'reward');
        SaveSystem.save(this.createSaveGame());
      },
    );
    this.characterInteractionSystem = new CharacterInteractionSystem(
      this,
      this.player,
      this.inventorySystem,
      collisionLayer,
    );
    const farmDayWasPending = this.farmingSystem.getSnapshot().lastProcessedDay !== this.timeSystem.day;
    this.farmingSystem.update(this.timeSystem.day);

    if (farmDayWasPending) {
      SaveSystem.save(this.createSaveGame());
    }

    this.createActivityTracker();

    this.saveKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
    this.loadKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    this.nextDayKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.F5,
      Phaser.Input.Keyboard.KeyCodes.F9,
    ]);

  }

  update(time: number) {
    const pressed = this.ui.consumeInteraction();
    this.narrativePause.set(this.dialogSystem.isActive || this.ui.modalOpen || Boolean(this.moonView || this.beachView));
    if (this.dialogSystem.update(pressed) || this.ui.modalOpen) {
      this.timeSystem.pauseAt(time);
      this.player.setVelocity(0); this.tatiana.setVelocity(0);
      this.ui.setPrompt();
      return;
    }
    if (this.moonView || this.beachView) {
      this.timeSystem.pauseAt(time);
      this.ui.setPrompt('E: volver a la granja');
      if (pressed) { if (this.moonView) this.closeMoonView(); else this.updateBeachLookout(true); }
      return;
    }
    const dayChanged = this.timeSystem.update(time);
    this.player.update();
    this.player.sprite.setDepth(this.player.sprite.y);
    this.tatiana.update(this.player.sprite);
    this.farmingSystem.update(this.timeSystem.day);
    this.characterInteractionSystem.update();
    const candidate = resolveInteraction([
      this.landPurchaseSystem.getInteraction(), this.buildingEntranceSystem.getInteraction(),
      this.characterInteractionSystem.getInteraction(),
      this.farmingSystem.getInteraction(),
      this.nearInteraction(this.tatiana.x, this.tatiana.y, 48, 'Hablar con Tatiana', () => this.tryTatianaInteraction(), 10),
      this.zoneInteraction(this.observatoryZone, 'Observar la luna', () => this.updateObservatory(true)),
      this.zoneInteraction(this.beachZone, 'Mirar el mar', () => this.updateBeachLookout(true)),
      this.zoneInteraction(this.jukeboxZone, 'Escuchar la rocola', () => this.updateJukebox(true)),
    ]);
    this.ui.setPrompt(candidate ? `E: ${candidate.label}` : '');
    if (pressed && candidate) { candidate.activate(); return; }
    this.updateActivityEvents();

    if (dayChanged) {
      SaveSystem.save(this.createSaveGame());
      this.dialogSystem.show('Amanece otra vez sobre la granja torcida.');
    }

    if (Phaser.Input.Keyboard.JustDown(this.nextDayKey)) {
      this.timeSystem.advanceDay();
      this.dialogSystem.show('La noche se pliega. Empieza un nuevo dia.');
    }

    if (Phaser.Input.Keyboard.JustDown(this.saveKey)) {
      const saved = SaveSystem.save(this.createSaveGame());
      this.dialogSystem.show(saved ? 'Partida guardada.' : SaveSystem.lastError!);
    }

    if (Phaser.Input.Keyboard.JustDown(this.loadKey)) {
      this.scene.restart({ save: SaveSystem.load() });
    }

  }

  private nearInteraction(x: number, y: number, range: number, label: string, activate: () => void, priority = 15): InteractionCandidate | undefined {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    return distance <= range ? { label, activate, priority, distance } : undefined;
  }

  private zoneInteraction(zone: Phaser.GameObjects.Zone, label: string, activate: () => void) {
    return Phaser.Geom.Rectangle.Contains(zone.getBounds(), this.player.x, this.player.y)
      ? this.nearInteraction(zone.x, zone.y, 100, label, activate) : undefined;
  }

  private createSaveGame(): SaveGameData {
    return {
      version: 1,
      playerPosition: {
        x: this.player.sprite.x,
        y: this.player.sprite.y,
      },
      inventory: this.inventorySystem.getSnapshot(),
      storage: this.storage.getSnapshot(),
      money: this.moneySystem.getBalance(),
      energy: this.energySystem.getSnapshot(),
      wateringCan: this.wateringCanSystem.getSnapshot(),
      progression: this.progressionSystem.getSnapshot(),
      landOwnership: this.landOwnershipSystem.getSnapshot(),
      time: this.timeSystem.getSnapshot(),
      farming: this.farmingSystem.getSnapshot(),
    };
  }

  private createAmbientFx() {
    const sparkle = this.add.graphics();
    sparkle.fillStyle(0xffffff, 1);
    sparkle.fillCircle(2, 2, 2);
    if (!this.textures.exists('sparkle-particle')) sparkle.generateTexture('sparkle-particle', 4, 4);
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

    this.add.particles(720, 420, 'sparkle-particle', {
      lifespan: 3200,
      speed: { min: 2, max: 8 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.32, end: 0 },
      quantity: 1,
      frequency: 360,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(3);
  }

  private createActivityTracker() {
    this.activityText = this.add.text(16, 230, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#efe0b3',
      backgroundColor: '#231927bb',
      padding: { x: 8, y: 6 },
      wordWrap: { width: 260 },
    }).setScrollFactor(0).setDepth(250).setVisible(false);
    this.updateActivityText();
  }

  private updateActivityEvents() {
    this.updateActivityText();

    if (!this.isLunarViewingTime() || this.lunarEventAnnouncedDay === this.timeSystem.day) {
      return;
    }

    this.lunarEventAnnouncedDay = this.timeSystem.day;
    this.dialogSystem.show('La noche esta despejada. El observatorio puede revelar algo en la luna.');
  }

  private updateActivityText() {
    if (!this.activityText) {
      return;
    }

    const timeLabel = `${String(this.timeSystem.hour).padStart(2, '0')}:${String(this.timeSystem.minute).padStart(2, '0')}`;
    const lunarLine = this.isLunarViewingTime()
      ? 'Evento: observacion lunar activa.'
      : 'Esta noche vuelve al observatorio.';
    this.activityText.setText([
      `Dia ${this.timeSystem.day} | ${timeLabel}`,
      lunarLine,
      'Actividades: cultiva, visita la casa, cuida a Molly y Muneca.',
    ].join('\n'));
  }

  private createObservatory() {
    const x = 440;
    const y = 325;
    this.add.image(x, y + 45, 'lunar_observatory').setOrigin(0.5, 1).setDepth(y + 45);
    const label = this.add.text(x, y + 55, 'Observatorio lunar', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#efe0b3',
      stroke: '#231927',
      strokeThickness: 2,
    }).setOrigin(0.5);

    label.setDepth(y + 60);
    this.observatoryZone = this.add.zone(x, y + 28, 96, 76);
    this.physics.add.existing(this.observatoryZone, true);
    this.observatoryPrompt = this.add.text(x, y - 46, 'E: mirar la luna', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#f1d88a',
      backgroundColor: '#231927dd',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(2000).setVisible(false);
  }

  private updateObservatory(pressed: boolean) {
    if (this.moonView) {
      if (pressed) {
        this.closeMoonView();
      }
      return;
    }

    const isNear = Phaser.Geom.Rectangle.Contains(
      this.observatoryZone.getBounds(),
      this.player.sprite.x,
      this.player.sprite.y,
    );
    this.observatoryPrompt.setText(this.isLunarViewingTime() ? 'E: observar evento lunar' : 'E: mirar la luna');
    this.observatoryPrompt.setVisible(false);

    if (isNear && pressed) {
      this.tatiana.startObservatoryEvent(this.observatoryZone.x + 46, this.observatoryZone.y);
      this.openMoonView();
    }
  }

  private openMoonView() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const width = this.scale.width;
    const height = this.scale.height;
    const overlay = this.ui.add.container(0, 0).setDepth(5000);
    if (!reduceMotion) {
      overlay.setAlpha(0);
      const reveal = () => {
        this.cameras.main.fadeIn(220, 7, 9, 20);
        this.ui.tweens.add({ targets: overlay, alpha: 1, duration: 220, ease: 'Cubic.Out' });
      };
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, reveal);
      overlay.once('destroy', () => {
        this.cameras.main.off(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, reveal);
        this.ui.tweens.killTweensOf(overlay);
        this.cameras.main.resetFX();
      });
      this.cameras.main.fadeOut(220, 7, 9, 20);
    }
    const phase = this.getMoonPhase();
    const isEventTime = this.isLunarViewingTime();
    const moonY = Math.round(height * 0.36);
    const sky = this.add.rectangle(0, 0, width, height, 0x070914, 0.96).setOrigin(0);
    const moon = this.add.circle(width / 2, moonY, 58, 0xf1ead0).setStrokeStyle(3, 0xffffff);
    const pluto = this.add.circle(width / 2 + 142, moonY + 64, 17, 0xb68f73).setStrokeStyle(2, 0xf4d7bd);
    const plutoLabel = this.add.text(width / 2 + 142, moonY + 90, 'Pluton', {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#f4d7bd',
    }).setOrigin(0.5);
    const shadow = this.add.circle(width / 2 + 24, moonY - 8, 50, 0xc9c0a8, 0.28);
    const crater1 = this.add.circle(width / 2 - 18, moonY - 23, 8, 0xb9ad94, 0.55);
    const crater2 = this.add.circle(width / 2 + 11, moonY + 14, 12, 0xb9ad94, 0.45);
    const crater3 = this.add.circle(width / 2 - 30, moonY + 24, 5, 0xb9ad94, 0.5);
    const title = this.add.text(width / 2, 34, `Observatorio lunar - ${phase}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#f4e7b2',
    }).setOrigin(0.5);
    const hint = this.add.text(width / 2, height - 42, 'La luna mira de vuelta. Pulsa E para cerrar.', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#d7e4ff',
      backgroundColor: '#070914cc',
      padding: { x: 12, y: 6 },
      align: 'center',
    }).setOrigin(0.5);

    overlay.add(sky);
    const galaxy = this.ui.add.particles(width / 2, height / 2, 'sparkle-particle', {
      lifespan: 2400, frequency: 65, speed: { min: 5, max: 24 },
      x: { min: -width / 2, max: width / 2 }, y: { min: -height / 2, max: height / 2 },
      scale: { start: .75, end: 0 }, alpha: { start: .85, end: 0 }, tint: [0xc7b7e9, 0x9bceef, 0xf1ead0],
    });
    overlay.add(galaxy);
    if (reduceMotion) galaxy.stop();

    for (let index = 0; index < 42; index++) {
      overlay.add(this.add.circle(
        Phaser.Math.Between(18, width - 18),
        Phaser.Math.Between(18, height - 18),
        Phaser.Math.FloatBetween(0.7, 1.8),
        0xffffff,
        Phaser.Math.FloatBetween(0.35, 0.9),
      ));
    }

    if (isEventTime && !reduceMotion) {
      for (let index = 0; index < 5; index++) {
        const star = this.add.rectangle(
          Phaser.Math.Between(30, width - 30),
          Phaser.Math.Between(40, Math.floor(height * 0.45)),
          34,
          2,
          0xb8e7ff,
          0.9,
        ).setAngle(-22);
        overlay.add(star);
        star.once('destroy', () => this.ui.tweens.killTweensOf(star));
        this.ui.tweens.add({
          targets: star,
          x: star.x + 46,
          y: star.y + 18,
          alpha: 0,
          duration: 900,
          delay: index * 140,
          repeat: -1,
          repeatDelay: 1100,
          ease: 'Cubic.easeOut',
        });
      }
    }

    overlay.add([moon, shadow, crater1, crater2, crater3, pluto, plutoLabel, title, hint]);
    this.moonView = overlay;
    this.data.set('uiBlocked', true);
    this.data.set('externalModal', true);
    this.player.sprite.setVelocity(0);
    this.grantMoonBlessing(isEventTime);
  }

  private closeMoonView() {
    this.moonView?.destroy(true);
    this.moonView = undefined;
    this.data.set('uiBlocked', false);
    this.data.set('externalModal', false);
    this.tatiana.finishContextEvent();
  }

  private createBeachLookout() {
    const x = 900;
    const y = 612;
    this.add.image(x, y + 7, 'lookout_bench').setOrigin(0.5, 1).setDepth(y + 7);
    const sign = this.add.text(x, y + 22, 'Mirador', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#efe0b3',
      stroke: '#231927',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(y + 1);
    void sign;
    this.beachZone = this.add.zone(x, y, 96, 54);
    this.physics.add.existing(this.beachZone, true);
    this.beachPrompt = this.add.text(x, y - 38, 'E: mirar el mar', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#f1d88a',
      backgroundColor: '#231927dd',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(2000).setVisible(false);
  }

  private updateBeachLookout(pressed: boolean) {
    if (this.beachView) {
      if (pressed) {
        this.beachView.destroy(true);
        this.beachView = undefined;
        this.data.set('uiBlocked', false);
        this.data.set('externalModal', false);
        this.tatiana.finishContextEvent();
        this.cameras.main.zoomTo(1.65, 450, 'Sine.easeOut');
      }
      return;
    }

    const isNear = Phaser.Geom.Rectangle.Contains(this.beachZone.getBounds(), this.player.sprite.x, this.player.sprite.y);
    this.beachPrompt.setVisible(false);

    if (isNear && pressed) {
      this.openBeachView();
    }
  }

  private openBeachView() {
    this.tatiana.startBeachEvent(this.beachZone.x + 28, this.beachZone.y, (x, y, text) => this.sayAt(x, y, text));
    const width = this.scale.width;
    const height = this.scale.height;
    const isNight = this.timeSystem.hour >= 19 || this.timeSystem.hour < 6;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const overlay = this.ui.add.container(0, 0).setDepth(4800);
    if (!reduceMotion) {
      overlay.setAlpha(0);
      this.ui.tweens.add({ targets: overlay, alpha: 1, duration: 260, ease: 'Cubic.Out' });
    }
    const sky = this.add.rectangle(0, 0, width, height, isNight ? 0x10172f : 0xf0a35a, 0.35).setOrigin(0);
    const sea = this.add.rectangle(width / 2, height * 0.58, width, height * 0.45, 0x214b6b, 0.74);
    const light = this.add.circle(width * 0.72, height * 0.22, isNight ? 34 : 46, isNight ? 0xf4e7b2 : 0xffc66d, 0.86);
    const title = this.add.text(width / 2, 48, isNight ? 'Mirador · luz de luna' : 'Mirador · atardecer', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: isNight ? '#d7e4ff' : '#fff4d7',
      backgroundColor: '#10172f88',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5);
    const text = this.add.text(width / 2, height - 38, 'El mar respira lento. Pulsa E para volver.', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#fff4d7',
      backgroundColor: '#10172fcc',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5);
    overlay.add([sky, sea, light, title, text]);

    for (let index = 0; index < 7; index++) {
      const wave = this.add.rectangle(width / 2 - 160 + index * 54, height * 0.58 + index % 2 * 22, 42, 3, 0xb8e7ff, 0.65);
      overlay.add(wave);
      wave.once('destroy', () => this.ui.tweens.killTweensOf(wave));
      if (!reduceMotion) this.ui.tweens.add({ targets: wave, x: wave.x + 28, alpha: 0.2, yoyo: true, repeat: -1, duration: 1100 + index * 80, ease: 'Sine.easeInOut' });
    }

    this.beachView = overlay;
    this.data.set('uiBlocked', true);
    this.data.set('externalModal', true);
    if (!reduceMotion) this.cameras.main.zoomTo(2.15, 700, 'Sine.easeInOut');
    this.dialogSystem.show(isNight ? 'La luna pinta el borde del agua.' : 'El sol calienta la espuma del mar.');
  }

  private createJukebox() {
    const x = 760;
    const y = 550;
    this.add.image(x, y + 21, 'moon_jukebox').setOrigin(0.5, 1).setDepth(y + 21);
    this.jukeboxZone = this.add.zone(x, y, 58, 58);
    this.physics.add.existing(this.jukeboxZone, true);
    this.jukeboxPrompt = this.add.text(x, y - 42, 'E: rocola', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#f1d88a',
      backgroundColor: '#231927dd',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(2000).setVisible(false);
  }

  private updateJukebox(pressed: boolean) {
    const isNear = Phaser.Geom.Rectangle.Contains(this.jukeboxZone.getBounds(), this.player.sprite.x, this.player.sprite.y);
    this.jukeboxPrompt.setVisible(false);

    if (isNear && pressed) {
      this.player.emote((x, y, text) => this.sayAt(x, y, text), '♪');
      SoundFeedback.play(this, 'music');
      this.dialogSystem.show('Una melodía breve acompaña la tarde. M: activar o silenciar sonido.');
    }
  }

  private tryTatianaInteraction() {
    if (this.moonView || !this.tatiana) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.sprite.x,
      this.player.sprite.y,
      this.tatiana.x,
      this.tatiana.y,
    );

    if (distance > 48) {
      return;
    }

    const event = this.progressionSystem.completedOrders.has('stew') ? 'dinner'
      : this.progressionSystem.milestones.has('land') ? 'land'
      : this.progressionSystem.milestones.has('harvest') ? 'harvest' : undefined;
    if (event && !this.progressionSystem.tatianaEvents.has(event)) {
      this.progressionSystem.tatianaEvents.add(event);
      const lines = {
        harvest: ['¡Tu primera cosecha! Sabía que este suelo tenía algo bueno.', 'Guarda una parte para cocinar. Me encantaría probarla contigo.'],
        land: ['Vi el cartel del huerto. ¡Ahora es tuyo!', 'Podemos plantar calabazas allí y guardar una para una cena bajo las estrellas.'],
        dinner: ['La cena estaba deliciosa. Gracias por pensar en mí.', 'Este valle ya se siente como nuestro hogar.'],
      };
      this.dialogSystem.showDialogue({ name: 'Tatiana', portrait: 'tatiana_portrait_happy', messages: lines[event] });
      SoundFeedback.play(this, 'talk');
      SaveSystem.save(this.createSaveGame());
      return;
    }

    this.dialogSystem.showDialogue({
      name: 'Tatiana',
      portrait: 'tatiana_portrait_happy',
      messages: [this.tatiana.isFollowing ? '¿Seguimos juntas o nos vemos más tarde?' : '¿Vamos al observatorio o revisamos las frutas del mercado?'],
      choices: [
        { label: 'Ven conmigo', onSelect: () => { this.tatiana.setFollowing(true, this.player); this.sayAt(this.tatiana.x, this.tatiana.y - 34, '¡Voy contigo!'); } },
        { label: 'Nos vemos luego', onSelect: () => { this.tatiana.setFollowing(false, this.player); this.sayAt(this.tatiana.x, this.tatiana.y - 34, 'Daré un paseo por la playa.'); } },
      ],
    });
    SoundFeedback.play(this, 'talk');
  }

  private sayAt(x: number, y: number, message: string) {
    showSpeechBubble(this, x, y, message);
  }

  private grantMoonBlessing(isEventTime: boolean) {
    if (!isEventTime) {
      this.dialogSystem.show('Ajustas el telescopio. La luna aun duerme entre nubes claras.');
      return;
    }

    if (this.progressionSystem.moonBlessingDay === this.timeSystem.day) {
      this.dialogSystem.show('La luna ya compartio su secreto esta noche.');
      return;
    }

    if (!this.inventorySystem.addItem('blackPumpkinSeed', 1)) {
      this.dialogSystem.show('Mochila llena. Libera espacio y vuelve esta noche para recibir la semilla.');
      return;
    }
    this.progressionSystem.moonBlessingDay = this.timeSystem.day;
    SaveSystem.save(this.createSaveGame());
    this.dialogSystem.show('Lluvia de estrellas: recibes una semilla de calabaza negra.');
  }

  private isLunarViewingTime() {
    return this.timeSystem.hour >= 20 || this.timeSystem.hour < 5;
  }

  private getMoonPhase() {
    const phases = ['luna nueva', 'creciente', 'cuarto creciente', 'gibosa', 'luna llena', 'menguante'];
    return phases[this.timeSystem.day % phases.length];
  }

}
