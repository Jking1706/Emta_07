import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
});

test('observatorio conserva recompensa diaria y elimina el overlay; TV permite cambiar de canal', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.timeSystem.loadSnapshot({ day: 1, hour: 21, minute: 0 }); s.lunarEventAnnouncedDay = 1;
    s.player.body.reset(s.observatoryZone.x, s.observatoryZone.y);
  });
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => Boolean(window.__phaserGame.scene.getScene('FarmScene').moonView))).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => Boolean(window.__phaserGame.scene.getScene('FarmScene').moonView))).toBe(false);
  await page.reload(); await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('FarmScene').progressionSystem.moonBlessingDay)).toBe(1);
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.scene.start('InteriorScene', { sceneKey: 'house', returnX: 680, returnY: 512, save: s.createSaveGame() });
  });
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('InteriorScene'));
  await page.evaluate(() => { const s = window.__phaserGame.scene.getScene('InteriorScene'); s.player.body.reset(278, 222); });
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => Boolean(window.__phaserGame.scene.getScene('InteriorScene').cookingPanel))).toBe(true);
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + 620 / 960 * box.width, box.y + 326 / 540 * box.height);
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').cookingPanel.list.some(o => o.text?.includes('UNA NOCHE')))).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => Boolean(window.__phaserGame.scene.getScene('InteriorScene').cookingPanel))).toBe(false);
  expect(errors).toEqual([]);
});

test('HUD y mochila permanecen dentro del canvas al redimensionar', async ({ page }) => {
  for (const [width, height] of [[375, 812], [768, 1024], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const box = await page.locator('canvas').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(await page.evaluate(() => {
      const ui = window.__phaserGame.scene.getScene('UIScene');
      return ui.cells.every(c => { const b = c.box.getBounds(); return b.left >= 0 && b.right <= 960 && b.bottom <= 540; });
    })).toBe(true);
    await page.screenshot({ path: `test-results/responsive-${width}.png` });
  }
});
