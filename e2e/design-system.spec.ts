import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// DIG-13: галерея дизайн-системы /design (dev-only) на 1440 и 360,
// видимое кольцо фокуса с клавиатуры, скриншоты для сверки с макетом.

const SHOTS = 'docs/design/screenshots';

test.describe('/design — галерея дизайн-системы', () => {
  test('открывается и показывает компоненты', async ({ page }) => {
    await page.goto('/design');
    await expect(page.getByRole('heading', { level: 1, name: /дизайн-система/i })).toBeVisible();
    // разделы компонентов
    for (const section of ['Button', 'Chip', 'Badge', 'Stepper', 'Toast', 'Avatar']) {
      await expect(page.getByRole('heading', { name: new RegExp(section, 'i') })).toBeVisible();
    }
    // плашка «Концепт» наследуется из layout
    await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  });

  test('видимое кольцо фокуса при навигации с клавиатуры', async ({ page }) => {
    await page.goto('/design');
    await page.keyboard.press('Tab');
    const focused = page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { ok: false, detail: 'нет активного элемента' };
      const s = getComputedStyle(el);
      const outline = `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`.trim();
      const ringed = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      return { ok: ringed, detail: outline };
    });
    expect((await focused).ok, `outline: ${(await focused).detail}`).toBe(true);
  });

  test('скриншоты компонентов для сверки с Figma', async ({ page }, testInfo) => {
    mkdirSync(SHOTS, { recursive: true });
    await page.goto('/design');
    // DIG-13: дождаться фактической загрузки Onest. document.fonts.ready
    // может отработать раньше, чем холодный dev-сервер отдаст шрифтовой чанк,
    // и на скриншот попадёт засечный fallback — ломает сверку с макетом.
    await page.waitForFunction(
      () => document.fonts.check('400 16px Onest') && document.fonts.check('800 16px Onest'),
      undefined,
      { timeout: 30_000 },
    );
    const name = testInfo.project.name; // desktop-1440 | mobile-360
    await page.screenshot({ path: `${SHOTS}/design-full-${name}.png`, fullPage: true });
    expect(true).toBe(true);
  });
});
