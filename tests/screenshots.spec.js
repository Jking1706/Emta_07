import { test } from '@playwright/test';

test('capturas narrativas', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.player.body.reset(s.tatiana.x + 28, s.tatiana.y);
    s.tatiana.setFollowing(false, s.player);
    s.dialogSystem.showDialogue({
      name: 'Tatiana',
      portrait: 'tatiana_portrait_happy',
      messages: ['¿Vamos al observatorio o revisamos las frutas del mercado?'],
      choices: [
        { label: 'Ven conmigo', onSelect: () => s.tatiana.setFollowing(true, s.player) },
        { label: 'Nos vemos luego', onSelect: () => s.tatiana.setFollowing(false, s.player) },
      ],
    });
  });
  await page.waitForTimeout(1600);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/narrative-choices.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.dialogSystem.close();
  });

  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.timeSystem.loadSnapshot({ day: 1, hour: 21, minute: 0 });
    s.player.body.reset(s.beachZone.x, s.beachZone.y);
    s.updateBeachLookout(true);
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/narrative-beach-night.png' });
  await page.evaluate(() => window.__phaserGame.scene.getScene('FarmScene').updateBeachLookout(true));

  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.player.body.reset(s.observatoryZone.x, s.observatoryZone.y);
    s.openMoonView();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/narrative-observatory.png' });
  await page.evaluate(() => window.__phaserGame.scene.getScene('FarmScene').closeMoonView());

  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.scene.start('InteriorScene', { sceneKey: 'house', returnX: 680, returnY: 512, save: s.createSaveGame() });
  });
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('InteriorScene'));
  await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').openTelevision());
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/narrative-tv.png' });
});
