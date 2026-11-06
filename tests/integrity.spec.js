import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
});

test('inventario lleno conserva cultivos y transferencias; valida y migra guardados antiguos', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { SaveSystem } = await import('/src/game/systems/SaveSystem.ts');
    const { InventorySystem } = await import('/src/game/systems/InventorySystem.ts');
    const s = window.__phaserGame.scene.getScene('FarmScene');
    const old = s.createSaveGame();
    old.inventory.slots = old.inventory.slots.slice(0, 8);
    delete old.storage;
    const migrated = new InventorySystem(); migrated.loadSnapshot(old.inventory);
    const invalid = structuredClone(old); invalid.inventory.slots[0].itemId = 'unknown';
    const badTime = structuredClone(old); badTime.time.hour = 70;
    const bag = new InventorySystem(1), chest = new InventorySystem(1);
    bag.addItem('paleTurnip', 99); chest.addItem('hoe');
    const transfer = bag.transferTo(0, chest);
    const f = s.farmingSystem, l = f.farmLayers[0], tile = l.getTilesWithin().find(t => t.index > 0);
    const key = `${l.layer.name}:${tile.x},${tile.y}`;
    f.crops.set(key, f.createCropState(tile, key, 'paleTurnip', 1, 2, false));
    s.inventorySystem.slots.forEach(slot => { slot.itemId = 'hoe'; slot.quantity = 1; });
    const harvested = f.harvestTile(key);
    return { valid: SaveSystem.isValid(old), invalid: SaveSystem.isValid(invalid), badTime: SaveSystem.isValid(badTime),
      capacity: migrated.slots.length, transfer, count: bag.getItemCount('paleTurnip'), harvested, cropRemains: f.crops.has(key) };
  });
  expect(result).toEqual({ valid: true, invalid: false, badTime: false, capacity: 24, transfer: false, count: 99, harvested: false, cropRemains: true });
});

test('el jugador usa el spritesheet original y elige animaciones por dirección', async ({ page }) => {
  const result = await page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('FarmScene');
    const texture = window.__phaserGame.textures.get('farmer-sheet');
    const player = scene.player;
    player.setControlsEnabled(false);
    const work = ['down', 'up', 'left', 'right'].map(facing => {
      player.facing = facing;
      player.playToolAction();
      return player.anims.currentAnim?.key;
    });
    return {
      source: [texture.source[0].width, texture.source[0].height],
      frames: texture.getFrameNames().length,
      textureKey: player.texture.key,
      body: [player.body.width, player.body.height, player.body.offset.x, player.body.offset.y],
      work,
      directionAnims: ['player_idle_up', 'player_walk_up', 'player_idle_side', 'player_walk_side', 'player_cheer', 'player_cheer_up', 'player_cheer_side', 'player_fear'].every(key => scene.anims.exists(key)),
    };
  });
  expect(result).toEqual({
    source: [576, 120],
    frames: 54,
    textureKey: 'farmer-sheet',
    body: [10, 5, 11, 33],
    work: ['player_work', 'player_work_up', 'player_work_side', 'player_work_side'],
    directionAnims: true,
  });
});

test('entradas y salidas de los cinco edificios son utilizables', async ({ page }) => {
  for (const action of ['enter_house', 'enter_seed_shop', 'enter_crop_market', 'enter_town_hall', 'enter_tool_shop']) {
    await page.evaluate(action => {
      const s = window.__phaserGame.scene.getScene('FarmScene');
      const z = s.buildingEntranceSystem.zones.find(z => z.action === action);
      s.player.body.reset(z.x, z.y);
    }, action);
    await page.waitForTimeout(150);
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('InteriorScene'));
    await page.evaluate(() => {
      const s = window.__phaserGame.scene.getScene('InteriorScene');
      const z = s.zones.find(z => z.action.startsWith('exit_'));
      s.player.body.reset(z.x, z.y);
    });
    await page.waitForTimeout(150);
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('FarmScene'));
  }
});
