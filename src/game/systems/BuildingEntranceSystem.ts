import Phaser from 'phaser';
import { Player } from '../player/Player';
import { DialogSystem } from './DialogSystem';
import type { SaveGameData } from './SaveSystem';

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
  private interactKey: Phaser.Input.Keyboard.Key;
  private zones: Zone[] = [];
  private prompt: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private player: Player;
  private dialog: DialogSystem;
  private createSaveGame: () => SaveGameData;

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    player: Player,
    dialog: DialogSystem,
    createSaveGame: () => SaveGameData,
  ) {
    this.scene = scene;
    this.player = player;
    this.dialog = dialog;
    this.createSaveGame = createSaveGame;
    this.interactKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
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

  update() {
    const zone = this.getActiveZone();
    this.prompt.setVisible(Boolean(zone));

    if (zone) {
      this.prompt.setPosition(zone.x - 7, zone.y - 30);
    }

    if (zone && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.activate(zone.action ?? '');
    }
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
      this.dialog.show('Llenaste la regadera con agua fria del pozo.');
      return;
    }

    this.dialog.show('Todavia no hay nada mas que hacer aqui.');
  }

  private getActiveZone() {
    return this.zones.find((zone) => {
      return Phaser.Geom.Rectangle.Contains(
        zone.getBounds(),
        this.player.sprite.x,
        this.player.sprite.y,
      );
    });
  }

  private readAction(properties?: Phaser.Types.Tilemaps.TiledObject['properties']) {
    if (!Array.isArray(properties)) {
      return null;
    }

    const action = properties.find((property) => property.name === 'action');
    return action ? String(action.value) : null;
  }
}
