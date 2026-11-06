import { test, expect } from '@playwright/test';

// Setup positions and resources through the dev-only game handle. Actions use real keyboard/mouse input.
async function press(page, key) {
  await page.keyboard.down(key); await page.waitForTimeout(100); await page.keyboard.up(key);
  await page.waitForTimeout(80);
}
async function clickUI(page, x, y) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + x * box.width / 960, box.y + y * box.height / 540);
  await page.waitForTimeout(100);
}
async function interior(page, kind) {
  await page.evaluate(kind => {
    const g = window.__phaserGame;
    const active = g.scene.isActive('FarmScene') ? g.scene.getScene('FarmScene') : g.scene.getScene('InteriorScene');
    const save = active.createSaveGame ? active.createSaveGame() : active.createUpdatedSave();
    active.scene.start('InteriorScene', { sceneKey: kind, returnX: 680, returnY: 512, save });
  }, kind);
  await page.waitForFunction(kind => {
    const g = window.__phaserGame;
    return g.scene.isActive('InteriorScene') && g.scene.getScene('UIScene').context?.location === kind;
  }, kind);
}
async function farm(page) {
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('InteriorScene');
    s.scene.start('FarmScene', { save: s.createUpdatedSave() });
  });
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('FarmScene'));
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
});

test('UI fija, E único y mochila bloquea las acciones del mundo', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.player.body.reset(760, 550); s.tatiana.setPosition(770, 550); s.tatiana.setVelocity(0); s.tatiana.state = 'EVENT_BUSY';
  });
  await press(page, 'e');
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('UIScene').dialogue.text.text)).toContain('melodía');
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('UIScene').dialogue.isActive)).toBe(false);
  await press(page, 'i');
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('UIScene').modalOpen)).toBe(true);
  const before = await page.evaluate(() => { const p = window.__phaserGame.scene.getScene('FarmScene').player; return [p.x, p.y]; });
  await press(page, 'd'); await press(page, 'e');
  expect(await page.evaluate(() => { const p = window.__phaserGame.scene.getScene('FarmScene').player; return [p.x, p.y]; })).toEqual(before);
  await clickUI(page, 108 + 4 * 47, 165); await clickUI(page, 108, 221);
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('FarmScene').inventorySystem.slots[8].itemId)).toBe('chocoSoda');
  await press(page, 'Escape');
  await page.evaluate(() => { window.__phaserGame.scene.getScene('FarmScene').cameras.main.setZoom(2.2); });
  expect(await page.evaluate(() => { const s = window.__phaserGame.scene.getScene('UIScene'); return [s.cameras.main.zoom, s.cells[0].box.x]; })).toEqual([1, 252]);
  await page.screenshot({ path: 'test-results/ui-desktop.png' });
  expect(errors).toEqual([]);
});

test('cofre transfiere pilas y conserva objetos al recargar', async ({ page }) => {
  await interior(page, 'house');
  await page.evaluate(() => { window.__phaserGame.scene.getScene('InteriorScene').player.body.reset(132, 244); });
  await press(page, 'e');
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('UIScene').mode)).toBe('chest');
  await clickUI(page, 108 + 4 * 47, 165);
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').storage.getItemCount('chocoSoda'))).toBe(2);
  await page.reload(); await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('FarmScene').storage.getItemCount('chocoSoda'))).toBe(2);
  await interior(page, 'house');
  await page.evaluate(() => { window.__phaserGame.scene.getScene('InteriorScene').player.body.reset(132, 244); });
  await press(page, 'e'); await clickUI(page, 554, 165);
  expect(await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('InteriorScene'); return [s.inventory.getItemCount('chocoSoda'), s.storage.getItemCount('chocoSoda')];
  })).toEqual([2, 0]);
});

test('cultivar, dormir, cosechar y vender avanza la introducción', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const tile = await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    const l = s.farmingSystem.farmLayers[0], t = l.getTilesWithin().filter(t => t.index > 0)[10];
    return { x: t.getCenterX(), y: t.getCenterY(), key: `${l.layer.name}:${t.x},${t.y}` };
  });
  async function aim() {
    await page.evaluate(t => {
      const s = window.__phaserGame.scene.getScene('FarmScene'); s.player.body.reset(t.x, t.y + 16);
      s.cameras.main.stopFollow().centerOn(t.x, t.y);
    }, tile);
    await page.waitForTimeout(150);
  }
  async function use(key) { await press(page, key); await clickUI(page, 480, 270); }
  await aim(); await use('1'); await use('4'); await use('2');
  expect(await page.evaluate(key => window.__phaserGame.scene.getScene('FarmScene').farmingSystem.crops.get(key)?.wateredToday, tile.key)).toBe(true);
  async function sleep() {
    await interior(page, 'house');
    await page.evaluate(() => {
      const s = window.__phaserGame.scene.getScene('InteriorScene'), bed = s.zones.find(z => z.action === 'player_house_bed');
      s.player.body.reset(bed.x, bed.y);
    });
    await press(page, 'e');
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('FarmScene'));
  }
  await sleep(); await aim(); await use('2'); await sleep(); await aim(); await use('3');
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('FarmScene').inventorySystem.getItemCount('paleTurnip'))).toBe(1);
  await interior(page, 'cropMarket');
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('InteriorScene'), z = s.zones.find(z => z.action === 'open_crop_market');
    s.player.body.reset(z.x, z.y);
  });
  await press(page, 'e'); await clickUI(page, 648, 174);
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').money.getBalance())).toBe(134);
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').progression.getObjective())).toContain('Amplía');
  expect(await page.evaluate(() => [...window.__phaserGame.scene.getScene('InteriorScene').progression.milestones])).toEqual(expect.arrayContaining(['till', 'plant', 'water', 'sleep', 'harvest', 'sell']));
  await page.reload(); await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('FarmScene').farmingSystem.crops.size)).toBe(0);
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    const z = s.landPurchaseSystem.farms.find(f => f.farmId === 'farm2').zone;
    s.player.body.reset(z.x, z.y + 12);
  });
  await press(page, 'e');
  expect(await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    return [s.landOwnershipSystem.isOwned('farm2'), s.moneySystem.getBalance(), s.progressionSystem.milestones.has('land')];
  })).toEqual([true, 54, true]);
  expect(errors).toEqual([]);
});

test('encargos y mejoras se cobran una vez, y Tatiana recuerda la primera cosecha', async ({ page }) => {
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene'); s.inventorySystem.addItem('paleTurnip', 3); s.moneySystem.earn(500);
    s.progressionSystem.record('harvest');
  });
  await interior(page, 'cropMarket'); await press(page, 'j'); await clickUI(page, 730, 180);
  const gold = await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').money.getBalance());
  expect(gold).toBe(675);
  await clickUI(page, 730, 180);
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').money.getBalance())).toBe(gold);
  await press(page, 'Escape'); await interior(page, 'toolShop');
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('InteriorScene'), z = s.zones.find(z => z.action === 'open_tool_shop');
    s.player.body.reset(z.x, z.y);
  });
  await press(page, 'e'); await clickUI(page, 740, 250);
  expect(await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('InteriorScene'); return [s.water.capacity, s.progression.energyCost('wateringCan'), s.money.getBalance()];
  })).toEqual([48, 1, gold - 90]);
  await clickUI(page, 740, 250);
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').money.getBalance())).toBe(gold - 90);
  await press(page, 'Escape'); await farm(page);
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene'); s.player.body.reset(1000, 500); s.tatiana.setPosition(1020, 500); s.tatiana.setVelocity(0); s.tatiana.state = 'EVENT_BUSY';
  });
  await press(page, 'e');
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('UIScene').dialogue.messages[0])).toContain('primera cosecha');
  await page.reload(); await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
  expect(await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene'); return [s.wateringCanSystem.capacity, s.progressionSystem.tatianaEvents.has('harvest'), s.progressionSystem.completedOrders.has('turnips')];
  })).toEqual([48, true, true]);
});
