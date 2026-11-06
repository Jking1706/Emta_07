import Phaser from 'phaser';
import { items } from '../data/items';

/** Small original assets generated once; shared textures keep the render inexpensive. */
export function createPixelArt(scene: Phaser.Scene) {
  const make = (key: string, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, width, height)!;
    paint(texture.context);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  for (const wet of [false, true]) {
    make(wet ? 'soil-wet' : 'soil-dry', 16, 16, c => {
      c.fillStyle = wet ? '#303e40' : '#614333'; c.fillRect(1, 1, 14, 14);
      c.fillStyle = wet ? '#202f35' : '#422e29';
      for (let y = 3; y < 15; y += 4) c.fillRect(2, y, 12, 2);
      c.fillStyle = wet ? '#587278' : '#98704a';
      for (let y = 2; y < 14; y += 4) c.fillRect(3, y, 9, 1);
    });
  }
  make('farm-chest', 24, 20, c => {
    c.fillStyle = '#322c38'; c.fillRect(1, 4, 22, 15);
    c.fillStyle = '#99643f'; c.fillRect(2, 5, 20, 12);
    c.fillStyle = '#d0a369'; c.fillRect(2, 4, 20, 3);
    c.fillStyle = '#503945'; c.fillRect(2, 10, 20, 2);
    c.fillStyle = '#dfbd79'; c.fillRect(4, 5, 2, 12); c.fillRect(18, 5, 2, 12); c.fillRect(10, 9, 4, 5);
  });
  for (const item of Object.values(items)) {
    make(`item-${item.id}`, 20, 20, c => {
      c.fillStyle = '#292838';
      if (item.type === 'tool') {
        c.fillStyle = '#b98754'; c.fillRect(9, 7, 3, 11);
        c.fillStyle = '#a9c8c5';
        if (item.id === 'hoe') { c.fillRect(3, 3, 13, 4); c.fillRect(3, 7, 3, 3); }
        if (item.id === 'sickle') { c.fillRect(7, 2, 9, 3); c.fillRect(14, 5, 3, 6); c.fillRect(11, 10, 5, 2); }
        if (item.id === 'wateringCan') { c.fillStyle = '#5b97a1'; c.fillRect(4, 8, 10, 9); c.fillRect(13, 10, 4, 3); c.fillRect(16, 7, 3, 4); c.strokeStyle = '#b2d7ca'; c.strokeRect(5.5, 3.5, 7, 5); }
      } else if (item.type === 'seed') {
        c.fillStyle = '#d7bc87'; c.fillRect(4, 3, 12, 15);
        c.fillStyle = '#816a4f'; c.fillRect(4, 3, 12, 2);
        c.fillStyle = item.cropId === 'paleTurnip' ? '#f4e8c6' : '#76607e'; c.fillRect(8, 10, 5, 5);
        c.fillStyle = '#5e8f50'; c.fillRect(9, 7, 3, 3);
      } else {
        const colors: Record<string, string> = { paleTurnip: '#f4e8c6', blackPumpkin: '#76607e', chocoSoda: '#9f684d', strawberry: '#d86276', sourGummy: '#9fbf64', effervescentMagnesium: '#a9d4de', moonTruffle: '#7c5367', pumpkinStew: '#c69662' };
        c.fillStyle = colors[item.id] ?? '#d7bc87'; c.fillRect(4, 7, 12, 9); c.fillRect(6, 5, 8, 13);
        c.fillStyle = '#f3dfaf'; c.fillRect(6, 8, 3, 2);
        c.fillStyle = '#54874c'; c.fillRect(8, 3, 4, 3);
        if (item.id === 'pumpkinStew') { c.fillStyle = '#b9ced3'; c.fillRect(3, 13, 14, 4); }
        if (item.id === 'effervescentMagnesium') { c.fillStyle = '#fff0d2'; c.fillRect(9, 8, 2, 7); c.fillRect(7, 10, 6, 2); }
      }
    });
  }
  // Original 24x42 characters: four idle and eight walk frames plus four action frames.
  // The player uses the authored spritesheet in assets/characters/player instead.
  for (const [key, coat, hair] of [['tatiana-original', '#795879', '#352a3b'], ['ella-original', '#a56a55', '#58473b']]) {
    make(key, 576, 42, c => {
      for (let f = 0; f < 24; f++) {
        const x = f * 24, step = (f >= 4 && f < 12) || f >= 16 ? (f % 2 ? 1 : -1) : 0;
        c.fillStyle = '#292535'; c.fillRect(x + 7, 33 + step, 4, 7); c.fillRect(x + 13, 33 - step, 4, 7);
        c.fillStyle = coat; c.fillRect(x + 6, 22, 12, 12); c.fillRect(x + 3, 24 + step, 3, 8); c.fillRect(x + 18, 24 - step, 3, 8);
        c.fillStyle = '#343044'; c.fillRect(x + 6, 32, 12, 2);
        c.fillStyle = '#d9be8b'; c.fillRect(x + 3, 30 + step, 3, 2); c.fillRect(x + 18, 30 - step, 3, 2);
        c.fillStyle = hair; c.fillRect(x + 5, 5, 14, 17); c.fillRect(x + 7, 3, 10, 3);
        c.fillStyle = '#e4ac85'; c.fillRect(x + 7, 10, 10, 11); c.fillRect(x + 10, 21, 4, 3);
        c.fillStyle = hair; c.fillRect(x + 6, 7, 12, 5); c.fillRect(x + 6, 12, 3, 3);
        c.fillStyle = '#292535'; c.fillRect(x + 10, 15, 1, 2); c.fillRect(x + 15, 15, 1, 2);
        c.fillStyle = '#d8ba78'; c.fillRect(x + 11, 25, 2, 2);
        c.fillStyle = '#b98573'; c.fillRect(x + 12, 19, 3, 1);
        c.fillStyle = '#d8ba78'; c.fillRect(x + 17, 10, 3, 3);
        if (f < 4 && f % 2) { c.fillStyle = '#e4ac85'; c.fillRect(x + 10, 15, 7, 2); c.fillStyle = '#67473d'; c.fillRect(x + 10, 16, 1, 1); c.fillRect(x + 15, 16, 1, 1); }
        if (f >= 12 && f < 16) {
          const lift = (f % 2) * 4;
          c.clearRect(x + 18, 24, 5, 9);
          c.fillStyle = coat; c.fillRect(x + 17, 21 + lift, 5, 4);
          c.fillStyle = '#e4ac85'; c.fillRect(x + 20, 20 + lift, 3, 3);
          c.fillStyle = '#d9ba84'; c.fillRect(x + 21, 14 + lift, 2, 10);
        }
        if (f >= 16 && f < 20) { c.fillStyle = hair; c.fillRect(x + 6, 11, 12, 11); }
        if (f >= 20) { c.fillStyle = hair; c.fillRect(x + 6, 11, 7, 11); c.fillStyle = '#e4ac85'; c.fillRect(x + 17, 15, 2, 3); }
      }
    });
    const texture = scene.textures.get(key);
    for (let i = 0; i < 24; i++) if (!texture.has(String(i))) texture.add(i, 0, i * 24, 0, 24, 42);
  }
}
