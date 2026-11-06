import Phaser from 'phaser';
import { MollyGato } from '../../objects/Mascots/MollyGato';
import { MunecaPerro } from '../../objects/Mascots/MunecaPerro';
import { TatianaNPC } from '../../objects/TatianaNPC';
import { getItemById, recipes, type ItemId, type Recipe } from '../data/items';
import { Player } from '../player/Player';
import { DialogSystem } from '../systems/DialogSystem';
import { EnergySystem } from '../systems/EnergySystem';
import { InventorySystem } from '../systems/InventorySystem';
import { MoneySystem } from '../systems/MoneySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { TimeSystem } from '../systems/TimeSystem';
import { SaveSystem, type SaveGameData } from '../systems/SaveSystem';
import { InventorySystem as StorageInventory } from '../systems/InventorySystem';
import { WateringCanSystem } from '../systems/WateringCanSystem';
import { UIScene } from './UIScene';
import { seedPrices, salePrices, shopPrices } from '../data/balance';
import { SoundFeedback } from '../systems/SoundFeedback';
import { resolveInteraction, type InteractionCandidate } from '../systems/InteractionResolver';
import { showSpeechBubble } from '../ui/SpeechBubble';
import { NarrativePause } from '../systems/NarrativePause';

type InteriorKind = 'house' | 'seedShop' | 'cropMarket' | 'townHall' | 'toolShop';

type InteriorSceneData = {
  sceneKey: InteriorKind;
  returnX: number;
  returnY: number;
  save: SaveGameData;
};

type Zone = Phaser.GameObjects.Zone & { action?: string };
type ShopEntry = { itemId: ItemId; price: number; mode: 'buy' | 'sell' };

const interiors: Record<InteriorKind, { mapKey: string; imageKey: string; title: string }> = {
  house: { mapKey: 'house-map', imageKey: 'house-interior', title: 'Casa' },
  seedShop: { mapKey: 'seed-shop-map', imageKey: 'seed-shop-interior', title: 'Tienda de semillas' },
  cropMarket: { mapKey: 'crop-market-map', imageKey: 'crop-market-interior', title: 'Mercado' },
  townHall: { mapKey: 'town-hall-map', imageKey: 'town-hall-interior', title: 'Ayuntamiento' },
  toolShop: { mapKey: 'tool-shop-map', imageKey: 'tool-shop-interior', title: 'Tienda de herramientas' },
};

export class InteriorScene extends Phaser.Scene {
  private sceneData!: InteriorSceneData;
  private player!: Player;
  private dialog!: DialogSystem;
  private inventory!: InventorySystem;
  private money!: MoneySystem;
  private energy!: EnergySystem;
  private timeSystem!: TimeSystem;
  private progression!: ProgressionSystem;
  private zones: Zone[] = [];
  private shopPanel?: Phaser.GameObjects.Container;
  private cookingPanel?: Phaser.GameObjects.Container;
  private kitchenZone?: Zone;
  private molly?: MollyGato;
  private muneca?: MunecaPerro;
  private tatiana?: TatianaNPC;
  private mollyLabel?: Phaser.GameObjects.Text;
  private munecaLabel?: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private ui!: UIScene;
  private storage!: StorageInventory;
  private water!: WateringCanSystem;
  private resting = false;
  private narrativePause!: NarrativePause;

  constructor() {
    super('InteriorScene');
  }

  init(data: InteriorSceneData) {
    this.sceneData = data;
    this.zones = [];
    this.shopPanel = undefined; this.cookingPanel = undefined;
    this.molly = undefined; this.muneca = undefined; this.tatiana = undefined;
    this.mollyLabel = undefined; this.munecaLabel = undefined;
    this.resting = false;
    this.data.set('uiBlocked', false); this.data.set('externalModal', false);
  }

  create() {
    this.narrativePause = new NarrativePause(this);
    const interior = interiors[this.sceneData.sceneKey];
    const map = this.make.tilemap({ key: interior.mapKey });
    this.add.image(0, 0, interior.imageKey).setOrigin(0).setDepth(0);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(2);

    this.player = new Player(this, 192, 238);
    this.player.sprite.setDepth(10);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.inventory = new InventorySystem();
    this.inventory.loadSnapshot(this.sceneData.save.inventory);
    this.money = new MoneySystem(this.sceneData.save.money ?? 120);
    this.energy = new EnergySystem(this.sceneData.save.energy);
    this.timeSystem = new TimeSystem();
    this.timeSystem.loadSnapshot(this.sceneData.save.time);
    this.progression = new ProgressionSystem(this.sceneData.save.progression);
    this.storage = new StorageInventory(18);
    if (this.sceneData.save.storage) this.storage.loadSnapshot(this.sceneData.save.storage);
    this.water = new WateringCanSystem(this.sceneData.save.wateringCan, this.progression.upgrades.has('wateringCan'));
    this.ui = this.scene.get('UIScene') as UIScene;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.shopPanel?.destroy(true); this.cookingPanel?.destroy(true);
    });
    this.ui.bind({ world: this, player: this.player, inventory: this.inventory, storage: this.storage,
      money: this.money, energy: this.energy, water: this.water, progression: this.progression,
      clock: this.timeSystem, location: this.sceneData.sceneKey, save: () => SaveSystem.save(this.createUpdatedSave()) });
    this.dialog = this.ui.dialogue;
    this.createCollision(map);
    this.createZones(map);
    this.createHousePets();
    this.createKitchenZone();
    this.createContextTatiana();
    if (this.sceneData.sceneKey === 'house') {
      this.add.image(132, 234, 'farm-chest').setDepth(244);
      const chest = this.add.zone(132, 244, 54, 46) as Zone;
      chest.action = 'storage'; this.zones.push(chest);
      this.add.rectangle(278, 194, 30, 24, 0x332d43).setStrokeStyle(2, 0xa5a9ad).setDepth(220);
      this.add.rectangle(278, 192, 22, 15, 0x648d98).setDepth(221);
      const tv = this.add.zone(278, 222, 40, 44) as Zone;
      tv.action = 'tv'; this.zones.push(tv);
    }
    if (this.sceneData.sceneKey === 'cropMarket') {
      this.add.rectangle(130, 225, 26, 22, 0x6c4832).setStrokeStyle(2, 0xc9ac74).setDepth(240);
      this.add.text(130, 224, '!', { fontSize: '18px', color: '#fff2ca' }).setOrigin(.5).setDepth(241);
      const board = this.add.zone(130, 244, 40, 36) as Zone;
      board.action = 'orders'; this.zones.push(board);
    }

    this.prompt = this.add
      .text(0, 0, 'E', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#f1d88a',
        backgroundColor: '#231927dd',
        padding: { x: 5, y: 3 },
      })
      .setDepth(220)
      .setVisible(false);

    this.add
      .text(16, 14, `${interior.title} | E: interactuar`, {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#efe0b3',
        backgroundColor: '#231927cc',
        padding: { x: 8, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(220).setVisible(false);
  }

  update() {
    const pressed = this.ui.consumeInteraction();
    this.narrativePause.set(this.dialog.isActive || this.ui.modalOpen || Boolean(this.shopPanel || this.cookingPanel));
    if (this.dialog.update(pressed) || this.ui.modalOpen || this.resting) {
      this.player.setVelocity(0);
      this.ui.setPrompt();
      return;
    }
    const panelOpen = Boolean(this.shopPanel || this.cookingPanel);
    this.player.setControlsEnabled(!panelOpen);
    this.player.update();
    if (!panelOpen) {
      this.molly?.updateWithPlayer();
      this.muneca?.updateWithPlayer(this.player);
      this.tatiana?.update(this.player.sprite);
    }
    this.updatePetLabels();
    const zone = this.getActiveZone();
    const candidates: Array<InteractionCandidate | undefined> = [];
    if (zone) candidates.push({ distance: Phaser.Math.Distance.Between(zone.x, zone.y, this.player.x, this.player.y), priority: 10,
      label: this.zoneLabel(zone.action ?? ''), activate: () => this.activate(zone.action ?? '') });
    const pet = (sprite: Phaser.Physics.Arcade.Sprite | undefined, label: string, activate: () => void) => {
      if (sprite && this.isNear(sprite.x, sprite.y, 42)) candidates.push({ label, activate, priority: 0,
        distance: Phaser.Math.Distance.Between(sprite.x, sprite.y, this.player.x, this.player.y) });
    };
    pet(this.molly, 'Acariciar a Molly', () => this.molly?.interact(this.player, (x, y, text) => this.sayAt(x, y, text)));
    pet(this.muneca, 'Acariciar a Muñeca', () => this.muneca?.interact((x, y, text) => this.sayAt(x, y, text)));
    pet(this.tatiana, 'Hablar con Tatiana', () => this.dialog.showDialogue({
      name: 'Tatiana', portrait: 'tatiana_portrait_happy',
      messages: [this.sceneData.sceneKey === 'house' ? '¿Preparamos algo juntas? Con fresas y chocolate podemos hacer trufas.' : 'Las fresas son mis favoritas. Podemos guardar algunas para cocinar.'],
      choices: [
        { label: 'Acompáñame', onSelect: () => this.tatiana?.setFollowing(true, this.player) },
        { label: 'Quédate por aquí', onSelect: () => this.tatiana?.setFollowing(false, this.player) },
      ],
    }));
    const candidate = resolveInteraction(candidates);
    this.prompt.setVisible(false);
    this.ui.setPrompt(panelOpen ? 'E: cerrar' : candidate ? `E: ${candidate.label}` : '');

    if (panelOpen && pressed) {
      this.shopPanel?.destroy(true);
      this.cookingPanel?.destroy(true);
      this.shopPanel = undefined;
      this.cookingPanel = undefined;
      this.data.set('externalModal', false);
      this.player.setControlsEnabled(true);
      return;
    }
    if (panelOpen) return;

    if (zone) {
      this.prompt.setPosition(zone.x - 7, zone.y - 30);
    }

    if (pressed) candidate?.activate();
  }

  private zoneLabel(action: string) {
    if (action.startsWith('exit_')) return 'Salir';
    return ({ tv: 'Ver TV / DVD', orders: 'Consultar encargos', storage: 'Abrir cofre', player_house_bed: 'Dormir y guardar', cook: 'Cocinar',
      open_shop: 'Comprar semillas y frutas', open_crop_market: 'Vender cosechas',
      open_tool_shop: 'Mejorar herramientas', buy_farms: 'Consultar terrenos' } as Record<string, string>)[action] ?? 'Interactuar';
  }

  private createCollision(map: Phaser.Tilemaps.Tilemap) {
    const collisionObjects = map.getObjectLayer('Collision')?.objects ?? [];

    collisionObjects.forEach((object) => {
      const rectangle = this.add.rectangle(
        (object.x ?? 0) + (object.width ?? 0) / 2,
        (object.y ?? 0) + (object.height ?? 0) / 2,
        object.width ?? 1,
        object.height ?? 1,
        0x000000,
        0,
      );
      this.physics.add.existing(rectangle, true);
      this.physics.add.collider(this.player.sprite, rectangle);
    });
  }

  private createZones(map: Phaser.Tilemaps.Tilemap) {
    const interactionObjects = map.getObjectLayer('Interactions')?.objects ?? [];

    interactionObjects.forEach((object) => {
      const action = this.readAction(object.properties) ?? object.name;

      if (!action) {
        return;
      }

      const zone = this.add.zone(
        (object.x ?? 0) + (object.width ?? 0) / 2,
        (object.y ?? 0) + (object.height ?? 0) / 2,
        object.width ?? 1,
        object.height ?? 1,
      ) as Zone;
      zone.action = action;
      this.zones.push(zone);
    });
  }

  private activate(action: string) {
    if (this.resting) return;
    if (action === 'tv') { this.openTelevision(); return; }
    if (action === 'orders') { this.ui.openPanel('journal'); return; }
    if (action === 'storage') { this.ui.openPanel('chest'); return; }
    if (action.startsWith('exit_')) {
      this.scene.start('FarmScene', {
        returnPosition: { x: this.sceneData.returnX, y: this.sceneData.returnY },
        save: this.createUpdatedSave(),
      });
      return;
    }

    if (action === 'open_shop') {
      const discount = this.progression.getSeedDiscount();
      this.openShop('Tienda de semillas', [
        { itemId: 'paleTurnipSeed', price: seedPrices.paleTurnipSeed - discount, mode: 'buy' },
        { itemId: 'blackPumpkinSeed', price: seedPrices.blackPumpkinSeed - discount, mode: 'buy' },
        { itemId: 'strawberry', price: shopPrices.strawberry, mode: 'buy' },
        { itemId: 'chocoSoda', price: shopPrices.chocoSoda, mode: 'buy' },
      ]);
      return;
    }

    if (action === 'open_crop_market') {
      this.openShop('Mercado de cosechas', [
        { itemId: 'paleTurnip', price: salePrices.paleTurnip, mode: 'sell' },
        { itemId: 'blackPumpkin', price: salePrices.blackPumpkin, mode: 'sell' },
      ]);
      return;
    }

    if (action === 'open_tool_shop') {
      this.ui.openPanel('upgrades');
      return;
    }

    const messages: Record<string, string> = {
      buy_farms: 'Compra las parcelas en sus carteles. Consulta tus objetivos y encargos con J.',
    };

    if (action === 'player_house_bed') {
      this.resting = true;
      this.player.setVelocity(0);
      this.timeSystem.advanceDay();
      this.energy.restore();
      this.progression.record('sleep');
      const morningSave = this.createUpdatedSave();
      SaveSystem.save(morningSave);
      this.dialog.show(`Dia ${this.timeSystem.day}. Energia restaurada y partida guardada.`);
      this.time.delayedCall(900, () => {
        this.scene.start('FarmScene', {
          returnPosition: { x: this.sceneData.returnX, y: this.sceneData.returnY },
          save: morningSave,
        });
      });
      return;
    }

    if (action === 'cook' || action === 'kitchen' || action === 'stove') {
      this.openCookingPanel();
      return;
    }

    this.dialog.show(messages[action] ?? 'Nada sucede todavia.');
  }

  private openShop(title: string, entries: ShopEntry[]) {
    this.shopPanel?.destroy(true);
    this.data.set('externalModal', true);

    const width = this.scale.width;
    const height = this.scale.height;
    const panel = this.ui.add.container(0, 0).setDepth(3000);
    const background = this.ui.add.rectangle(width / 2, height / 2, 520, 390, 0x231927, 0.97)
      .setStrokeStyle(3, 0xd8c9a3);
    const titleText = this.ui.add.text(width / 2, height / 2 - 158, `${title} | Oro: ${this.money.getBalance()}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#f1d88a',
    }).setOrigin(0.5);
    const closeHint = this.ui.add.text(width / 2, height / 2 + 158, 'Click: comprar/vender · E: cerrar · J: encargos al cerrar', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#d8c9a3',
    }).setOrigin(0.5);

    panel.add([background, titleText, closeHint]);

    entries.forEach((entry, index) => {
      const item = getItemById(entry.itemId);
      const y = height / 2 - 96 + index * 48;
      const row = this.ui.add.rectangle(width / 2, y, 450, 36, 0x342843, 0.96)
        .setStrokeStyle(1, 0x5a4632);
      const label = this.ui.add.text(width / 2 - 205, y, `${item.name} ${entry.mode === 'buy' ? '$' : '+$'}${entry.price}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#efe0b3',
      }).setOrigin(0, 0.5);
      const descriptions: Partial<Record<ItemId, string>> = {
        strawberry: 'Las favoritas de Tatiana; sirven para preparar trufas.',
        chocoSoda: 'Un toque de chocolate para una tarde de cocina.',
        paleTurnipSeed: 'Cosecha tras dos días regados.', blackPumpkinSeed: 'Tres días regados; reserva una para el guiso.',
        paleTurnip: 'Del huerto al mercado, o a la olla de casa.', blackPumpkin: 'Una cosecha para compartir una cena.',
      };
      label.setY(y - 7);
      const detail = this.ui.add.text(width / 2 - 205, y + 7, descriptions[entry.itemId] ?? '', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#d8c9a3', wordWrap: { width: 325 },
      });
      const button = this.ui.add.rectangle(width / 2 + 168, y, 86, 26, 0x5c6d4f)
        .setStrokeStyle(1, 0xf1d88a)
        .setInteractive({ useHandCursor: true });
      const buttonText = this.ui.add.text(width / 2 + 168, y, entry.mode === 'buy' ? 'Comprar' : 'Vender', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#fff4d7',
      }).setOrigin(0.5);

      button.on('pointerover', () => button.setFillStyle(0x6f805b));
      button.on('pointerout', () => button.setFillStyle(0x5c6d4f));
      button.on('pointerdown', () => {
        this.handleShopEntry(entry);
        titleText.setText(`${title} | Oro: ${this.money.getBalance()}`);
      });
      panel.add([row, label, detail, button, buttonText]);
    });

    this.shopPanel = panel;
  }

  private handleShopEntry(entry: ShopEntry) {
    const item = getItemById(entry.itemId);

    if (entry.mode === 'sell') {
      if (!this.inventory.removeOneItem(entry.itemId)) {
        this.dialog.show(`No tienes ${item.name} para vender.`);
        return;
      }

      this.money.earn(entry.price);
      const discountUnlocked = this.progression.recordCropSale();
      SaveSystem.save(this.createUpdatedSave());
      SoundFeedback.play(this, 'reward');
      this.tatiana?.reactToMarketItem(item.name, (x, y, text) => this.sayAt(x, y, text));
      this.dialog.show(discountUnlocked
        ? `Vendiste ${item.name}. El mercado te concede descuento en semillas!`
        : `Vendiste ${item.name} por ${entry.price} de oro.`);
      return;
    }

    if (!this.money.canAfford(entry.price)) {
      this.dialog.show('No tienes suficiente oro.');
      return;
    }

    if (!this.inventory.addItem(entry.itemId, 1)) {
      this.dialog.show('Inventario lleno.');
      return;
    }

    this.money.spend(entry.price);
    SaveSystem.save(this.createUpdatedSave());
    SoundFeedback.play(this, 'reward');
    this.tatiana?.reactToMarketItem(item.name, (x, y, text) => this.sayAt(x, y, text));
    this.dialog.show(`Compraste ${item.name}.`);
  }

  private createUpdatedSave(): SaveGameData {
    return {
      ...this.sceneData.save,
      playerPosition: { x: this.sceneData.returnX, y: this.sceneData.returnY },
      inventory: this.inventory.getSnapshot(),
      storage: this.storage.getSnapshot(),
      wateringCan: this.water.getSnapshot(),
      money: this.money.getBalance(),
      energy: this.energy.getSnapshot(),
      time: this.timeSystem.getSnapshot(),
      progression: this.progression.getSnapshot(),
    };
  }

  private createKitchenZone() {
    if (this.sceneData.sceneKey !== 'house') {
      return;
    }

    this.kitchenZone = this.add.zone(218, 205, 76, 64) as Zone;
    this.kitchenZone.action = 'cook';
    this.zones.push(this.kitchenZone);
    this.add.text(218, 170, 'Cocina', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#efe0b3',
      stroke: '#231927',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(220);
  }

  private openCookingPanel() {
    this.cookingPanel?.destroy(true);
    this.data.set('externalModal', true);

    const width = this.scale.width;
    const height = this.scale.height;
    const panel = this.ui.add.container(0, 0).setDepth(3200);
    panel.add(this.ui.add.rectangle(width / 2, height / 2, 540, 360, 0x231927, 0.97).setStrokeStyle(3, 0xd8c9a3));
    panel.add(this.ui.add.text(width / 2, height / 2 - 140, 'Recetas de cocina', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#f1d88a',
    }).setOrigin(0.5));
    panel.add(this.ui.add.text(width / 2, height / 2 + 142, 'Una receta para compartir con Tatiana. E: cerrar.', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#d8c9a3',
    }).setOrigin(0.5));

    recipes.forEach((recipe, index) => {
      const y = height / 2 - 78 + index * 66;
      const ingredients = recipe.ingredients
        .map((ingredient) => `${getItemById(ingredient.itemId).name} x${ingredient.quantity}`)
        .join(' + ');
      const row = this.ui.add.rectangle(width / 2, y, 470, 48, 0x342843, 0.96).setStrokeStyle(1, 0x5a4632);
      const label = this.ui.add.text(width / 2 - 220, y - 5, `${recipe.name}\n${ingredients}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#efe0b3',
      }).setOrigin(0, 0.5);
      const button = this.ui.add.rectangle(width / 2 + 174, y, 88, 28, 0x5c6d4f).setStrokeStyle(1, 0xf1d88a).setInteractive({ useHandCursor: true });
      const buttonText = this.ui.add.text(width / 2 + 174, y, 'Cocinar', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#fff4d7',
      }).setOrigin(0.5);
      button.on('pointerdown', () => this.startCookingMinigame(recipe));
      panel.add([row, label, button, buttonText]);
    });

    this.cookingPanel = panel;
  }

  private startCookingMinigame(recipe: Recipe) {
    if (!this.inventory.hasItems(recipe.ingredients)) {
      this.dialog.show('Faltan ingredientes para esa receta.');
      return;
    }

    this.cookingPanel?.destroy(true);
    const width = this.scale.width;
    const height = this.scale.height;
    const panel = this.ui.add.container(0, 0).setDepth(3300);
    const barX = width / 2;
    const barY = height / 2 + 18;
    panel.add(this.ui.add.rectangle(width / 2, height / 2, 520, 260, 0x1b1424, 0.98).setStrokeStyle(3, 0xd8c9a3));
    panel.add(this.ui.add.text(width / 2, height / 2 - 88, recipe.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#f1d88a',
    }).setOrigin(0.5));
    panel.add(this.ui.add.text(width / 2, height / 2 - 52, 'Haz click cuando el marcador pase por la zona dorada.', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#efe0b3',
    }).setOrigin(0.5));
    panel.add(this.ui.add.rectangle(barX, barY, 330, 16, 0x342843).setStrokeStyle(1, 0xefe0b3));
    panel.add(this.ui.add.rectangle(barX, barY, 64, 22, 0xf1d88a, 0.62));
    const marker = this.ui.add.rectangle(barX - 150, barY, 8, 34, 0xb8e7ff).setStrokeStyle(1, 0xffffff);
    panel.add(marker);
    const cookButton = this.ui.add.rectangle(width / 2, height / 2 + 82, 140, 30, 0x5c6d4f).setStrokeStyle(1, 0xf1d88a).setInteractive({ useHandCursor: true });
    const cookText = this.ui.add.text(width / 2, height / 2 + 82, 'Ahora!', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#fff4d7',
    }).setOrigin(0.5);
    panel.add([cookButton, cookText]);

    this.ui.tweens.add({ targets: marker, x: barX + 150, duration: 1050, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    marker.once('destroy', () => this.ui.tweens.killTweensOf(marker));
    cookButton.once('pointerdown', () => {
      const success = Math.abs(marker.x - barX) <= 38;
      panel.destroy(true);
      this.cookingPanel = undefined;
      this.data.set('externalModal', false);
      this.finishCooking(recipe, success);
    });
    this.cookingPanel = panel;
  }

  private finishCooking(recipe: Recipe, success: boolean) {
    const result = success ? recipe.result : 'sourGummy';
    const before = this.inventory.getSnapshot();
    if (!this.inventory.removeItems(recipe.ingredients)) return;
    if (!this.inventory.addItem(result, 1)) {
      this.inventory.loadSnapshot(before);
      this.dialog.show('Mochila llena: guarda objetos antes de cocinar. Conservas los ingredientes.');
      return;
    }
    SaveSystem.save(this.createUpdatedSave());
    SoundFeedback.play(this, 'reward');
    this.tatiana?.startCookingEvent(220, 210, (x, y, text) => this.sayAt(x, y, text));
    this.player.cook((x, y, text) => this.sayAt(x, y, text));

    if (success) {
      this.dialog.show(`Receta perfecta: preparaste ${getItemById(recipe.result).name}.`);
      this.molly?.interact(this.player, (x, y, text) => this.sayAt(x, y, text));
      this.muneca?.interact((x, y, text) => this.sayAt(x, y, text));
      return;
    }

    this.dialog.show('Se paso un poco... obtuviste una gomita acida misteriosa.');
  }

  private openTelevision() {
    this.data.set('externalModal', true);
    const panel = this.ui.add.container(0, 0).setDepth(3200);
    panel.add(this.ui.add.rectangle(480, 270, 960, 540, 0x0d101a, 0.58).setInteractive());
    panel.add(this.ui.add.rectangle(480, 270, 700, 400, 0x2a2d38).setStrokeStyle(3, 0xa5a9ad));
    panel.add(this.ui.add.rectangle(480, 188, 600, 186, 0x0b141b).setStrokeStyle(2, 0x648d98));
    for (let i = 0; i < 12; i++) {
      panel.add(this.ui.add.rectangle(480, 104 + i * 15, 588, 1, 0xb8d8d0, 0.08));
    }
    panel.add(this.ui.add.text(196, 102, 'TV · VHS / DVD', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8fc4c9',
    }).setOrigin(0, 0.5));
    panel.add(this.ui.add.circle(762, 102, 4, 0xd05b5b));
    const screen = this.ui.add.text(480, 188, 'TELEVISIÓN DEL VALLE\n\nElige un canal o reproduce el DVD.', {
      fontFamily: 'monospace', fontSize: '15px', color: '#d8eedb', align: 'center', lineSpacing: 7, wordWrap: { width: 540 },
    }).setOrigin(.5);
    panel.add(screen);
    const programs = [
      ['Huerto', 'HUERTO AL DÍA\n\nEl nabo necesita dos días regados.\nLa calabaza necesita tres.\nGuarda ingredientes para tus recetas.'],
      ['Cielo', `CIELO DEL VALLE\n\nDía ${this.timeSystem.day}: visita el observatorio\na partir de las 20:00 para ver estrellas.`],
      ['DVD', 'UNA NOCHE EN EL VALLE\n\nDos amigas, una cesta de frutas\ny un cielo lleno de estrellas.\nTatiana: «Esta es mi parte favorita».'],
    ];
    programs.forEach(([name, message], i) => {
      const x = 340 + i * 140;
      const button = this.ui.add.rectangle(x, 326, 120, 38, 0x435e51).setStrokeStyle(1, 0x8fb08b).setInteractive({ useHandCursor: true });
      const label = this.ui.add.text(x, 326, name, { fontFamily: 'monospace', fontSize: '16px', color: '#fff0d0' }).setOrigin(.5);
      button.on('pointerover', () => button.setFillStyle(0x55735f));
      button.on('pointerout', () => button.setFillStyle(0x435e51));
      button.on('pointerdown', () => { screen.setText(message); SoundFeedback.play(this, 'talk'); });
      panel.add([button, label]);
    });
    panel.add(this.ui.add.text(480, 392, 'Tatiana se sienta a tu lado si la invitas a acompañarte.', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#b9c8bb',
    }).setOrigin(.5));
    panel.add(this.ui.add.text(480, 438, 'E: apagar y volver', {
      fontFamily: 'monospace', fontSize: '14px', color: '#d8eedb',
    }).setOrigin(.5));
    this.cookingPanel = panel;
  }

  private createHousePets() {
    if (this.sceneData.sceneKey !== 'house') {
      return;
    }

    this.molly = new MollyGato(this, 142, 220, 104, 228);
    this.muneca = new MunecaPerro(this, 234, 226);
    this.mollyLabel = this.createPetLabel(this.molly.x, this.molly.y + 18, 'Molly');
    this.munecaLabel = this.createPetLabel(this.muneca.x, this.muneca.y + 18, 'Muneca');
  }

  private createContextTatiana() {
    if (this.sceneData.sceneKey !== 'house' && this.sceneData.sceneKey !== 'cropMarket' && this.sceneData.sceneKey !== 'seedShop') {
      return;
    }

    const points = this.sceneData.sceneKey === 'house'
      ? [{ x: 168, y: 228 }, { x: 220, y: 218 }, { x: 244, y: 240 }]
      : [{ x: 160, y: 230 }, { x: 230, y: 230 }, { x: 240, y: 250 }];
    this.tatiana = new TatianaNPC(this, points[0].x, points[0].y, points);
  }

  private updatePetLabels() {
    if (this.molly && this.mollyLabel) {
      this.updatePetLabel(this.molly, this.mollyLabel);
    }

    if (this.muneca && this.munecaLabel) {
      this.updatePetLabel(this.muneca, this.munecaLabel);
    }
  }

  private updatePetLabel(pet: Phaser.Physics.Arcade.Sprite, label: Phaser.GameObjects.Text) {
    label.setPosition(pet.x, pet.y + 18);
    label.setDepth(pet.depth + 1);
    label.setAlpha(this.isNear(pet.x, pet.y, 52) ? 0.9 : 0);
  }

  private createPetLabel(x: number, y: number, name: string) {
    return this.add.text(x, y, name, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#efe0b3',
      stroke: '#231927',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(y + 1).setAlpha(0);
  }

  private sayAt(x: number, y: number, message: string) {
    showSpeechBubble(this, x, y, message);
  }

  private isNear(x: number, y: number, maxDistance: number) {
    return Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, x, y) <= maxDistance;
  }

  private getActiveZone() {
    return this.zones.filter((zone) => {
      return Phaser.Geom.Rectangle.Contains(zone.getBounds(), this.player.sprite.x, this.player.sprite.y);
    }).sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y) - Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y))[0];
  }

  private readAction(properties?: Phaser.Types.Tilemaps.TiledObject['properties']) {
    if (!Array.isArray(properties)) {
      return null;
    }

    const action = properties.find((property) => property.name === 'action');
    return action ? String(action.value) : null;
  }
}
