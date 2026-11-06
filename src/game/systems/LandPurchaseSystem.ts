import Phaser from 'phaser';
import { type FarmId, farmPurchaseOptions, LandOwnershipSystem } from './LandOwnershipSystem';
import { MoneySystem } from './MoneySystem';
import { DialogSystem } from './DialogSystem';
import { Player } from '../player/Player';
import type { InteractionCandidate } from './InteractionResolver';

type LockedFarm = {
  farmId: Exclude<FarmId, 'farm'>;
  signLayer: Phaser.Tilemaps.TilemapLayer;
  collisionLayer: Phaser.Tilemaps.TilemapLayer;
  collider?: Phaser.Physics.Arcade.Collider;
  zone: Phaser.GameObjects.Zone;
};

export class LandPurchaseSystem {
  private farms: LockedFarm[] = [];
  private prompt: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private player: Player;
  private money: MoneySystem;
  private ownership: LandOwnershipSystem;
  private dialog: DialogSystem;
  private onPurchased: (farmId: Exclude<FarmId, 'farm'>) => void;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    money: MoneySystem,
    ownership: LandOwnershipSystem,
    dialog: DialogSystem,
    definitions: Array<{ farmId: Exclude<FarmId, 'farm'>; signLayer: Phaser.Tilemaps.TilemapLayer; collisionLayer: Phaser.Tilemaps.TilemapLayer }>,
    onPurchased: (farmId: Exclude<FarmId, 'farm'>) => void,
  ) {
    this.scene = scene;
    this.player = player;
    this.money = money;
    this.ownership = ownership;
    this.dialog = dialog;
    this.onPurchased = onPurchased;
    this.prompt = scene.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#f1d88a',
      backgroundColor: '#231927dd',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(220).setVisible(false);

    definitions.forEach((definition) => this.addFarm(definition));
  }

  getInteraction(): InteractionCandidate | undefined {
    const farm = this.farms.find((candidate) => !this.ownership.isOwned(candidate.farmId) && Phaser.Geom.Rectangle.Contains(
      candidate.zone.getBounds(), this.player.x, this.player.y,
    ));
    this.prompt.setVisible(false);

    if (!farm) {
      return undefined;
    }

    const option = farmPurchaseOptions[farm.farmId];
    return { label: `Comprar ${option.name} · ${option.price} oro`, priority: 30,
      distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, farm.zone.x, farm.zone.y),
      activate: () => this.purchase(farm) };
  }

  private addFarm(definition: { farmId: Exclude<FarmId, 'farm'>; signLayer: Phaser.Tilemaps.TilemapLayer; collisionLayer: Phaser.Tilemaps.TilemapLayer }) {
    const tiles = definition.signLayer.getTilesWithin(0, 0, definition.signLayer.layer.width, definition.signLayer.layer.height)
      .filter((tile) => tile.index >= 0);
    const signTile = tiles[0];

    if (!signTile) {
      return;
    }

    const zone = this.scene.add.zone(signTile.getCenterX(), signTile.getCenterY(), 48, 40);
    const farm: LockedFarm = { ...definition, zone };
    definition.collisionLayer.setAlpha(0);

    if (this.ownership.isOwned(farm.farmId)) {
      farm.signLayer.setVisible(false);
    } else {
      definition.collisionLayer.setCollisionByExclusion([-1]).setAlpha(0);
      farm.collider = this.scene.physics.add.collider(this.player, definition.collisionLayer);
    }

    this.farms.push(farm);
  }

  private purchase(farm: LockedFarm) {
    const option = farmPurchaseOptions[farm.farmId];

    if (!this.money.spend(option.price)) {
      this.dialog.show(`Necesitas ${option.price} de oro para ${option.name}.`);
      return;
    }

    this.ownership.buy(farm.farmId);
    farm.collider?.destroy();
    farm.signLayer.setVisible(false);
    this.onPurchased(farm.farmId);
    this.dialog.show(`Compraste ${option.name}. Ya puedes cultivar alli.`);
  }
}
