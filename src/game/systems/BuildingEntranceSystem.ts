import Phaser from 'phaser';
import { Player } from '../player/Player';
import { DialogSystem } from './DialogSystem';
import type { SaveGameData } from './SaveSystem';
import { WateringCanSystem } from './WateringCanSystem';
import type { InteractionCandidate } from './InteractionResolver';

type EntranceTarget = {
  sceneKey: string;
  returnX: number;
  returnY: number;
};

const actionTargets: Record<string, EntranceTarget> = {
  enter_house: { sceneKey: 'house', returnX: 680, returnY: 512 },
  enter_seed_shop: { sceneKey: 'seedShop', returnX: 537, returnY: 404 },
  enter_crop_market: { sceneKey: 'cropMarket', returnX: 260, returnY: 532 },
  enter_town_hall: { sceneKey: 'townHall', returnX: 552, returnY: 230 },
  enter_tool_shop: { sceneKey: 'toolShop', returnX: 452, returnY: 600 },
};

type Zone = Phaser.GameObjects.Zone & { action?: string };

export class BuildingEntranceSystem {
  private zones: Zone[] = [];
  private prompt: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private player: Player;
  private dialog: DialogSystem;
  private createSaveGame: () => SaveGameData;
  private wateringCan: WateringCanSystem;

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    player: Player,
    dialog: DialogSystem,
    wateringCan: WateringCanSystem,
    createSaveGame: () => SaveGameData,
  ) {
    this.scene = scene;
    this.player = player;
    this.dialog = dialog;
    this.wateringCan = wateringCan;
    this.createSaveGame = createSaveGame;
    this.prompt = scene.add
      .text(0, 0, 'E', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#f1d88a',
        backgroundColor: '#231927dd',
        padding: { x: 5, y: 3 },
      })
      .setDepth(220)
      .setVisible(false);
    this.createZones(map);
  }

  getInteraction(): InteractionCandidate | undefined {
    const zone = this.getActiveZone();
    this.prompt.setVisible(false);
    if (!zone) return undefined;
    return { label: zone.action === 'fill_watering_can' ? 'Llenar regadera' : 'Entrar', priority: 20,
      distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, zone.x, zone.y),
      activate: () => this.activate(zone.action ?? '') };
  }

  private createZones(map: Phaser.Tilemaps.Tilemap) {
    const objectLayer = map.getObjectLayer('Interactions');

    objectLayer?.objects.forEach((object) => {
      const action = this.readAction(object.properties);

      if (!action) {
        return;
      }

      const zone = this.scene.add.zone(
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
    const target = actionTargets[action];

    if (target) {
      this.scene.scene.start('InteriorScene', {
        ...target,
        save: this.createSaveGame(),
      });
      return;
    }

    if (action === 'fill_watering_can') {
      this.wateringCan.refill();
      this.dialog.show('Llenaste la regadera con agua fria del pozo.');
      return;
    }

    this.dialog.show('Todavia no hay nada mas que hacer aqui.');
  }

  private getActiveZone() {
    return this.zones.filter((zone) => {
      return Phaser.Geom.Rectangle.Contains(
        zone.getBounds(),
        this.player.sprite.x,
        this.player.sprite.y,
      );
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
