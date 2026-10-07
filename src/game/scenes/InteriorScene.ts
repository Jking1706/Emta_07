import Phaser from 'phaser';
import { Player } from '../player/Player';
import { DialogSystem } from '../systems/DialogSystem';
import type { SaveGameData } from '../systems/SaveSystem';

type InteriorKind = 'house' | 'seedShop' | 'cropMarket' | 'townHall' | 'toolShop';

type InteriorSceneData = {
  sceneKey: InteriorKind;
  returnX: number;
  returnY: number;
  save: SaveGameData;
};

type Zone = Phaser.GameObjects.Zone & { action?: string };

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
  private zones: Zone[] = [];
  private interactKey!: Phaser.Input.Keyboard.Key;
  private prompt!: Phaser.GameObjects.Text;

  constructor() {
    super('InteriorScene');
  }

  init(data: InteriorSceneData) {
    this.sceneData = data;
  }

  create() {
    const interior = interiors[this.sceneData.sceneKey];
    const map = this.make.tilemap({ key: interior.mapKey });
    this.add.image(0, 0, interior.imageKey).setOrigin(0).setDepth(0);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(2);

    this.player = new Player(this, 192, 238);
    this.player.sprite.setDepth(10);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.dialog = new DialogSystem(this);
    this.createCollision(map);
    this.createZones(map);

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
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
      .setDepth(220);
  }

  update() {
    this.player.update();
    const zone = this.getActiveZone();
    this.prompt.setVisible(Boolean(zone));

    if (zone) {
      this.prompt.setPosition(zone.x - 7, zone.y - 30);
    }

    if (zone && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.activate(zone.action ?? '');
    }
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
    if (action.startsWith('exit_')) {
      this.scene.start('FarmScene', {
        returnPosition: { x: this.sceneData.returnX, y: this.sceneData.returnY },
        save: this.sceneData.save,
      });
      return;
    }

    const messages: Record<string, string> = {
      open_shop: 'La tienda de semillas esta abierta. Pronto conectaremos compras reales.',
      open_crop_market: 'El mercado acepta cosechas. Pronto conectaremos ventas.',
      buy_farms: 'El ayuntamiento muestra escrituras de terrenos. Pronto conectaremos compras.',
      open_tool_shop: 'Herramientas nuevas cuelgan en la pared. Pronto conectaremos compras.',
    };

    if (action === 'player_house_bed') {
      this.dialog.show('Duermes un rato. La casa respira contigo.');
      return;
    }

    this.dialog.show(messages[action] ?? 'Nada sucede todavia.');
  }

  private getActiveZone() {
    return this.zones.find((zone) => {
      return Phaser.Geom.Rectangle.Contains(zone.getBounds(), this.player.sprite.x, this.player.sprite.y);
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
