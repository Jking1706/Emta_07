import Phaser from 'phaser';
import { crops } from '../data/crops';
import { createPixelArt } from '../ui/PixelArt';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    Object.values(crops).forEach(({ textureKey }) => {
      this.load.spritesheet(textureKey, `${import.meta.env.BASE_URL}assets/crops/${textureKey}.svg`, {
        frameWidth: 16,
        frameHeight: 24,
      });
    });
    this.load.image('tatiana_portrait_happy', `${import.meta.env.BASE_URL}assets/characters/tatiana_portrait_happy.svg`);
    for (const key of ['lunar_observatory', 'lookout_bench', 'moon_jukebox']) {
      this.load.image(key, `${import.meta.env.BASE_URL}assets/structures/${key}.svg`);
    }
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
    this.load.spritesheet('farmer-sheet', `${import.meta.env.BASE_URL}assets/characters/player/farmer-spritesheet.png`, {
      frameWidth: 32,
      frameHeight: 40,
    });
    this.load.spritesheet('player', '/assets/characters/player.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('character_sheet', '/assets/characters/character_spritesheet.png', {
      frameWidth: 24,
      frameHeight: 42,
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
    createPixelArt(this);
    this.createCharacterAnimations();
    this.scene.launch('UIScene');
    this.scene.start('FarmScene');
  }

  private createCharacterAnimations() {
    if (this.anims.exists('player_idle')) {
      return;
    }
    const player = (key: string, start: number, end: number, frameRate: number, repeat: number) => {
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('farmer-sheet', { start, end }),
        frameRate,
        repeat,
      });
    };
    for (const [suffix, idle, walk, work, cheer] of [
      ['', 0, 4, 10, 14],
      ['_up', 18, 22, 28, 32],
      ['_side', 36, 40, 46, 50],
    ] as const) {
      player(`player_idle${suffix}`, idle, idle + 3, 4, -1);
      player(`player_walk${suffix}`, walk, walk + 5, 10, -1);
      player(`player_work${suffix}`, work, work + 3, 8, 0);
      player(`player_cheer${suffix}`, cheer, cheer + 3, 8, -1);
      player(`player_fear${suffix}`, cheer, cheer + 3, 10, 0);
    }
    for (const [name, start, end, repeat] of [['idle', 0, 3, -1], ['walk', 4, 11, -1], ['anger', 12, 15, -1], ['cook', 12, 15, 0]] as const) {
      this.anims.create({ key: `tatiana_${name}`, frames: this.anims.generateFrameNumbers('tatiana-original', { start, end }), frameRate: 8, repeat });
    }
    this.anims.create({
      key: 'molly_idle',
      frames: this.anims.generateFrameNumbers('molly', { start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'molly_walk',
      frames: this.anims.generateFrameNumbers('molly', { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'muneca_idle',
      frames: this.anims.generateFrameNumbers('dog', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: 'muneca_run',
      frames: this.anims.generateFrameNumbers('dog', { start: 4, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
  }
}
