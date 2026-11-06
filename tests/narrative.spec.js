import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('FarmScene'));
});

test('respuestas rápidas confirman una única acción y bocadillos siguen al hablante', async ({ page }) => {
  await page.evaluate(async () => {
    const g = window.__phaserGame, s = g.scene.getScene('FarmScene');
    window.answerCount = 0;
    g.scene.getScene('UIScene').dialogue.showDialogue({ name: 'Tatiana', messages: ['¿Vamos?'], choices: [
      { label: 'Vamos', onSelect: () => { window.answerCount++; } },
      { label: 'Luego', onSelect: () => { window.answerCount += 10; } },
    ] });
    const { showSpeechBubble } = await import('/src/game/ui/SpeechBubble.ts');
    window.bubble = showSpeechBubble(s, s.player.x, s.player.y - 34, 'Aquí estoy');
    s.player.setPosition(s.player.x + 12, s.player.y);
  });
  await page.waitForTimeout(300);
  await expect.poll(() => page.evaluate(() => window.__phaserGame.scene.getScene('UIScene').dialogue.choiceViews.length)).toBe(2);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(80); await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => window.answerCount)).toBe(10);
  expect(await page.evaluate(() => window.bubble.x === window.__phaserGame.scene.getScene('FarmScene').player.x)).toBe(true);
});

test('Tatiana conserva seguimiento entre escenas y vuelve a patrullar tras una elección', async ({ page }) => {
  await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    s.tatiana.setFollowing(true, s.player);
    s.scene.start('InteriorScene', { sceneKey: 'house', returnX: 680, returnY: 512, save: s.createSaveGame() });
  });
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('InteriorScene'));
  expect(await page.evaluate(() => window.__phaserGame.scene.getScene('InteriorScene').tatiana.isFollowing)).toBe(true);
  const state = await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('InteriorScene');
    s.tatiana.startBeachEvent(150, 240, () => {});
    const busy = s.tatiana.state;
    s.tatiana.finishContextEvent(); const resumed = s.tatiana.state;
    s.tatiana.setFollowing(false, s.player);
    return [busy, resumed, s.tatiana.state, s.tatiana.isFollowing];
  });
  expect(state).toEqual(['EVENT_BUSY', 'FOLLOWING', 'PATROL', false]);
});

test('diálogos pausan temporizadores y animaciones del mundo sin bloquear UI; Y-sort se recupera', async ({ page }) => {
  await page.evaluate(() => {
    const g = window.__phaserGame, s = g.scene.getScene('FarmScene');
    window.timerFired = false;
    s.time.delayedCall(500, () => { window.timerFired = true; });
    g.scene.getScene('UIScene').dialogue.showDialogue({ name: 'Tatiana', messages: ['Un momento.'] });
  });
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    return [window.timerFired, s.time.paused, s.player.anims.isPaused, s.tatiana.anims.isPaused];
  })).toEqual([false, true, true, true]);
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => window.timerFired)).toBe(true);
  expect(await page.evaluate(() => {
    const s = window.__phaserGame.scene.getScene('FarmScene');
    return [s.time.paused, s.player.depth === s.player.y, s.tatiana.depth === s.tatiana.y];
  })).toEqual([false, true, true]);
  await page.screenshot({ path: 'test-results/narrative-resumed.png' });
});
