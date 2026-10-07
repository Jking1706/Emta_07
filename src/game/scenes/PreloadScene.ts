import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.load.tilemapTiledJSON('farm-map', '/assets/maps/farm.json');
    this.load.tilemapTiledJSON('house-map', '/assets/maps/Casa_player.tmj');
    this.load.tilemapTiledJSON('seed-shop-map', '/assets/maps/Seed_shop.tmj');
    this.load.tilemapTiledJSON('crop-market-map', '/assets/maps/Crop_market.tmj');
    this.load.tilemapTiledJSON('town-hall-map', '/assets/maps/Town_hall.tmj');
    this.load.tilemapTiledJSON('tool-shop-map', '/assets/maps/tool_shop.tmj');
    this.load.image('ts_map', '/assets/tilesets/ts_map.png');
    this.load.image('ts_forest', '/assets/tilesets/ts_forest.png');
    this.load.image('house-interior', '/assets/tilesets/house_interior_sem_fundo.png');
    this.load.image('seed-shop-interior', '/assets/tilesets/seed_shop_sunnyside_style_384x288.png');
    this.load.image('crop-market-interior', '/assets/tilesets/crop_market_sem_fundo.png');
    this.load.image('town-hall-interior', '/assets/tilesets/town_hall_sunnyside_style_384x288.png');
    this.load.image('tool-shop-interior', '/assets/tilesets/tool_shop_sunnyside_style_384x288.png');
    this.load.spritesheet('player', '/assets/characters/player.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('molly', '/assets/characters/pets/molly.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('muneca', '/assets/characters/pets/muneca.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('dog', '/assets/sprites/dog_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    this.scene.start('FarmScene');
  }
}
