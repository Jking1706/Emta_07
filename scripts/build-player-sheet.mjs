#!/usr/bin/env node
/**
 * Builds the player spritesheet as a real PNG asset.
 *
 * Layout: 18 columns x 3 rows of 32x40 frames (54 frames).
 *   Row 0 down: idle 0-3 | walk 4-9  | work 10-13 | cheer 14-17
 *   Row 1 up  : idle 18-21 | walk 22-27 | work 28-31 | cheer 32-35
 *   Row 2 side: idle 36-39 | walk 40-45 | work 46-49 | cheer 50-53
 *
 * The art is original: teal shirt, denim overalls, straw hat and boots.
 * Run with `npm run assets:player` after editing.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRAME_W = 32;
const FRAME_H = 40;
const COLS = 18;
const ROWS = 3;

const P = {
  outline: '#241f2b',
  skin: '#e8b184',
  skinLight: '#f7d0a4',
  skinShade: '#c98d64',
  hair: '#6b4632',
  hairShade: '#4a2e21',
  hairLight: '#8a5e42',
  straw: '#d8b96d',
  strawLight: '#f0dba0',
  strawShade: '#ab8947',
  band: '#3f6b66',
  bandShade: '#2c4f4b',
  shirt: '#4f8f88',
  shirtLight: '#7fb7ad',
  shirtShade: '#356a65',
  pants: '#464261',
  pantsLight: '#5d5880',
  pantsShade: '#312e47',
  belt: '#8a5a3b',
  buckle: '#e3c67a',
  boot: '#6a5038',
  bootLight: '#96754a',
  bootDark: '#4a3728',
  bootSole: '#2f251e',
  eye: '#241f2b',
  mouth: '#b9705e',
  blush: '#df9a82',
};

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
  }

  px(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b] = hexToRgb(color);
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }

  rect(x, y, w, h, color) {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) this.px(x + col, y + row, color);
    }
  }

  hline(x, y, w, color) {
    for (let col = 0; col < w; col++) this.px(x + col, y, color);
  }

  vline(x, y, h, color) {
    for (let row = 0; row < h; row++) this.px(x, y + row, color);
  }

  /** Adds a one-pixel outline around the drawn silhouette. */
  outline(color) {
    const source = Buffer.from(this.data);
    const alphaAt = (x, y) => {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
      return source[(y * this.width + x) * 4 + 3];
    };
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (alphaAt(x, y) !== 0) continue;
        if (alphaAt(x - 1, y) || alphaAt(x + 1, y) || alphaAt(x, y - 1) || alphaAt(x, y + 1)) {
          this.px(x, y, color);
        }
      }
    }
  }
}

function drawFront(c, dir, opts) {
  const {
    bob = 0,
    blink = false,
    legL = 0,
    legR = 0,
    armL = 0,
    armR = 0,
    armPose = 'idle',
  } = opts;
  const t = bob;

  const leg = (x, lift, outerLeft) => {
    const bottom = 35 - lift;
    const height = bottom - 29 + 1;
    c.rect(x, 29, 4, height, P.pants);
    c.vline(outerLeft ? x : x + 3, 29, height, P.pantsLight);
    c.vline(outerLeft ? x + 3 : x, 29, height, P.pantsShade);
    c.rect(x - 1, bottom + 1, 5, 3, P.boot);
    c.hline(x - 1, bottom + 1, 5, P.bootLight);
    c.hline(x - 1, bottom + 3, 5, P.bootSole);
  };
  leg(10, legL, true);
  leg(18, legR, false);

  // Torso: shirt over denim overalls.
  c.rect(9, 18 + t, 14, 4, P.shirt);
  c.hline(9, 18 + t, 14, P.shirtLight);
  c.vline(9, 18 + t, 4, P.shirtShade);
  c.rect(11, 21 + t, 10, 7, P.pants);
  c.hline(11, 21 + t, 10, P.pantsLight);
  c.vline(20, 21 + t, 7, P.pantsShade);
  c.rect(11, 18 + t, 2, 3, P.pants);
  c.rect(19, 18 + t, 2, 3, P.pants);
  c.px(12, 20 + t, P.buckle);
  c.px(19, 20 + t, P.buckle);
  c.rect(13, 24 + t, 6, 3, P.pantsShade);
  c.hline(13, 25 + t, 6, P.pants);
  c.rect(10, 28 + t, 12, 1, P.belt);
  if (dir === 'down') c.rect(14, 17 + t, 4, 2, P.skinShade);

  const arm = (side, dy) => {
    const x = side === 'left' ? 7 : 22;
    const dirX = side === 'left' ? -1 : 1;
    if (armPose === 'lift') {
      c.rect(x, 19 + t + dy, 3, 4, P.shirt);
      const hx = side === 'left' ? x + 1 : x - 1;
      c.rect(hx, 23 + t + dy, 3, 3, P.skin);
      c.px(hx, 23 + t + dy, P.skinLight);
      return;
    }
    if (armPose === 'push') {
      c.rect(x, 19 + t + dy, 3, 5, P.shirt);
      const hx = side === 'left' ? x - 1 : x + 1;
      c.rect(hx, 24 + t + dy, 4, 4, P.skin);
      c.hline(hx, 27 + t + dy, 4, P.skinShade);
      return;
    }
    if (armPose === 'up' || armPose === 'high') {
      const up = armPose === 'high' ? 2 : 0;
      c.rect(x, 16 + t + dy - up, 3, 4, P.shirt);
      c.rect(x + dirX, 13 + t + dy - up, 3, 4, P.shirt);
      c.rect(x + dirX * 2, 10 + t + dy - up, 3, 3, P.skin);
      c.hline(x + dirX * 2, 10 + t + dy - up, 3, P.skinLight);
      return;
    }
    c.rect(x, 19 + t + dy, 3, 5, P.shirt);
    c.vline(x + (side === 'left' ? 0 : 2), 19 + t + dy, 5, P.shirtShade);
    c.rect(x, 24 + t + dy, 3, 4, P.skin);
    c.px(x + (side === 'left' ? 0 : 2), 27 + t + dy, P.skinShade);
  };
  arm('left', armL);
  arm('right', armR);

  // Head.
  const h = t;
  c.rect(9, 11 + h, 1, 3, P.skinShade);
  c.rect(22, 11 + h, 1, 3, P.skinShade);
  if (dir === 'down') {
    c.rect(10, 8 + h, 12, 10, P.skin);
    c.hline(11, 17 + h, 10, P.skinShade);
    c.rect(10, 7 + h, 12, 2, P.hair);
    c.rect(9, 9 + h, 2, 6, P.hair);
    c.rect(21, 9 + h, 2, 6, P.hair);
    c.px(9, 8 + h, P.hair);
    c.px(22, 8 + h, P.hair);
    if (blink) {
      c.hline(12, 12 + h, 3, P.eye);
      c.hline(17, 12 + h, 3, P.eye);
    } else {
      c.rect(12, 11 + h, 2, 3, P.eye);
      c.rect(17, 11 + h, 2, 3, P.eye);
      c.px(12, 11 + h, P.skinLight);
      c.px(17, 11 + h, P.skinLight);
    }
    c.rect(15, 14 + h, 2, 1, P.skinShade);
    c.hline(14, 15 + h, 4, P.mouth);
    c.hline(11, 14 + h, 2, P.blush);
    c.hline(19, 14 + h, 2, P.blush);
  } else {
    c.rect(10, 8 + h, 12, 10, P.hair);
    c.hline(11, 8 + h, 10, P.hairLight);
    c.hline(10, 15 + h, 12, P.hairShade);
    c.rect(14, 9 + h, 1, 5, P.hairLight);
    c.rect(18, 9 + h, 1, 5, P.hairShade);
  }

  // Straw hat.
  c.rect(11, 1 + h, 10, 4, P.straw);
  c.hline(11, 1 + h, 10, P.strawLight);
  c.vline(20, 1 + h, 4, P.strawShade);
  c.rect(11, 3 + h, 10, 2, P.band);
  c.hline(11, 4 + h, 10, P.bandShade);
  c.rect(7, 5 + h, 18, 3, P.straw);
  c.hline(7, 5 + h, 18, P.strawLight);
  c.hline(7, 7 + h, 18, P.strawShade);
  c.px(6, 7 + h, P.strawShade);
  c.px(25, 7 + h, P.strawShade);
}

function drawSide(c, opts) {
  const { bob = 0, blink = false, stride = 0, liftBack = 0, liftFront = 0, armPose = 'idle', armSwing = 0 } = opts;
  const t = bob;

  const leg = (x, dx, lift, back) => {
    const bottom = 35 - lift;
    const height = bottom - 29 + 1;
    c.rect(x + dx, 29, 4, height, back ? P.pantsShade : P.pants);
    if (!back) c.vline(x + dx, 29, height, P.pantsLight);
    c.vline(x + dx + 3, 29, height, P.pantsShade);
    c.rect(x + dx - 1, bottom + 1, 6, 3, back ? P.bootDark : P.boot);
    c.hline(x + dx - 1, bottom + 1, 6, back ? P.boot : P.bootLight);
    c.hline(x + dx - 1, bottom + 3, 6, P.bootSole);
  };
  leg(15, -stride, liftBack, true);
  leg(12, stride, liftFront, false);

  c.rect(10, 18 + t, 12, 4, P.shirt);
  c.hline(10, 18 + t, 12, P.shirtLight);
  c.vline(10, 18 + t, 4, P.shirtShade);
  c.rect(11, 21 + t, 10, 7, P.pants);
  c.hline(11, 21 + t, 10, P.pantsLight);
  c.vline(20, 21 + t, 7, P.pantsShade);
  c.rect(11, 18 + t, 2, 3, P.pants);
  c.px(12, 20 + t, P.buckle);
  c.rect(13, 25 + t, 7, 3, P.pantsShade);
  c.hline(13, 26 + t, 7, P.pants);
  c.rect(11, 28 + t, 10, 1, P.belt);
  c.rect(15, 17 + t, 4, 2, P.skinShade);

  // Head in profile, facing right.
  const h = t;
  c.rect(12, 8 + h, 9, 10, P.skin);
  c.hline(13, 17 + h, 8, P.skinShade);
  c.px(21, 13 + h, P.skin);
  c.px(21, 14 + h, P.skinShade);
  c.px(20, 16 + h, P.skinShade);
  c.rect(10, 8 + h, 4, 9, P.hair);
  c.rect(10, 8 + h, 10, 2, P.hair);
  c.vline(10, 8 + h, 10, P.hairShade);
  c.rect(13, 9 + h, 1, 5, P.hairLight);
  c.rect(12, 12 + h, 2, 3, P.skinShade);
  if (blink) {
    c.hline(16, 12 + h, 2, P.eye);
  } else {
    c.rect(16, 11 + h, 2, 3, P.eye);
    c.px(16, 11 + h, P.skinLight);
  }
  c.hline(17, 15 + h, 2, P.mouth);
  c.px(19, 14 + h, P.blush);

  // Hat, brim tilted toward the facing side.
  c.rect(11, 1 + h, 10, 4, P.straw);
  c.hline(11, 1 + h, 10, P.strawLight);
  c.vline(20, 1 + h, 4, P.strawShade);
  c.rect(11, 3 + h, 10, 2, P.band);
  c.hline(11, 4 + h, 10, P.bandShade);
  c.rect(7, 5 + h, 17, 3, P.straw);
  c.hline(7, 5 + h, 17, P.strawLight);
  c.hline(7, 7 + h, 17, P.strawShade);
  c.px(6, 7 + h, P.strawShade);
  c.px(23, 6 + h, P.strawShade);

  // Near arm, drawn over the torso.
  if (armPose === 'lift') {
    c.rect(19, 19 + t + armSwing, 3, 4, P.shirt);
    c.rect(17, 23 + t + armSwing, 4, 3, P.skin);
    c.px(17, 23 + t + armSwing, P.skinLight);
  } else if (armPose === 'push') {
    c.rect(19, 19 + t + armSwing, 3, 5, P.shirt);
    c.rect(21, 23 + t + armSwing, 4, 4, P.skin);
    c.hline(21, 26 + t + armSwing, 4, P.skinShade);
  } else if (armPose === 'up' || armPose === 'high') {
    const up = armPose === 'high' ? 2 : 0;
    c.rect(19, 16 + t + armSwing - up, 3, 4, P.shirt);
    c.rect(21, 13 + t + armSwing - up, 3, 4, P.shirt);
    c.rect(22, 10 + t + armSwing - up, 3, 3, P.skin);
    c.hline(22, 10 + t + armSwing - up, 3, P.skinLight);
  } else {
    c.rect(19, 19 + t + armSwing, 3, 5, P.shirt);
    c.rect(19, 24 + t + armSwing, 3, 4, P.skin);
    c.px(21, 27 + t + armSwing, P.skinShade);
  }
}

const LEG_LIFTS = [
  [0, 0],
  [1, 0],
  [2, 0],
  [0, 0],
  [0, 1],
  [0, 2],
];
const ARM_SWINGS = [
  [0, 0],
  [-1, 1],
  [-1, 1],
  [0, 0],
  [1, -1],
  [1, -1],
];
const SIDE_STRIDES = [0, 1, 2, 0, -1, -2];
const CHEER_POSES = ['up', 'high', 'high', 'up'];
const CHEER_BOBS = [0, 0, 1, 0];

function paintFrame(c, frame) {
  const row = Math.floor(frame / COLS);
  const col = frame % COLS;
  const side = row === 2;
  const dir = row === 0 ? 'down' : 'up';

  if (col < 4) {
    const opts = { bob: col === 2 ? 1 : 0 };
    if (side) drawSide(c, opts);
    else drawFront(c, dir, opts);
    return;
  }

  if (col < 10) {
    const step = col - 4;
    if (side) {
      const stride = SIDE_STRIDES[step];
      drawSide(c, {
        bob: step === 3 ? 1 : 0,
        stride,
        liftBack: stride === -2 ? 1 : 0,
        liftFront: stride === 2 ? 1 : 0,
        armSwing: -stride,
      });
    } else {
      drawFront(c, dir, {
        bob: step === 2 || step === 5 ? 1 : 0,
        legL: LEG_LIFTS[step][0],
        legR: LEG_LIFTS[step][1],
        armL: ARM_SWINGS[step][0],
        armR: ARM_SWINGS[step][1],
      });
    }
    return;
  }

  if (col < 14) {
    const step = col - 10;
    const opts = {
      bob: step === 2 ? 1 : 0,
      armPose: step === 1 ? 'lift' : step === 2 ? 'push' : 'idle',
    };
    if (side) drawSide(c, opts);
    else drawFront(c, dir, opts);
    return;
  }

  const step = col - 14;
  const opts = {
    bob: CHEER_BOBS[step],
    armPose: CHEER_POSES[step],
    legL: !side && step === 1 ? 1 : 0,
    legR: !side && step === 2 ? 1 : 0,
    liftFront: side && step === 1 ? 1 : 0,
  };
  if (side) drawSide(c, opts);
  else drawFront(c, dir, opts);
}

// ---- PNG encoding -------------------------------------------------------

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildSheet() {
  const sheet = new Canvas(FRAME_W * COLS, FRAME_H * ROWS);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const frame = row * COLS + col;
      const cell = new Canvas(FRAME_W, FRAME_H);
      paintFrame(cell, frame);
      cell.outline(P.outline);
      for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
          const i = (y * FRAME_W + x) * 4;
          if (cell.data[i + 3] === 0) continue;
          sheet.px(col * FRAME_W + x, row * FRAME_H + y, `#${[0, 1, 2]
            .map((channel) => cell.data[i + channel].toString(16).padStart(2, '0'))
            .join('')}`);
        }
      }
    }
  }
  return sheet;
}

function buildPreview(sheet, scale, background) {
  const preview = new Canvas(sheet.width * scale, sheet.height * scale);
  for (let y = 0; y < preview.height; y++) {
    for (let x = 0; x < preview.width; x++) preview.px(x, y, background);
  }
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const i = (y * sheet.width + x) * 4;
      if (sheet.data[i + 3] === 0) continue;
      const color = `#${[0, 1, 2].map((channel) => sheet.data[i + channel].toString(16).padStart(2, '0')).join('')}`;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) preview.px(x * scale + dx, y * scale + dy, color);
      }
    }
  }
  return preview;
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sheet = buildSheet();
const target = resolve(root, 'public/assets/characters/player/farmer-spritesheet.png');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, encodePng(sheet.width, sheet.height, sheet.data));

const previewArg = process.argv.indexOf('--preview');
if (previewArg !== -1 && process.argv[previewArg + 1]) {
  const preview = buildPreview(sheet, 5, '#8a9a7b');
  writeFileSync(resolve(process.argv[previewArg + 1]), encodePng(preview.width, preview.height, preview.data));
}

console.log(`player spritesheet: ${sheet.width}x${sheet.height} (${COLS * ROWS} frames de ${FRAME_W}x${FRAME_H}) -> ${target}`);
