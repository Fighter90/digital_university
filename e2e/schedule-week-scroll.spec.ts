import { expect, test, type Page } from '@playwright/test';

// DIG-56 — прокрутка недельной сетки как в Google Calendar (desktop-1440).
// Сценарий задачи: прокрутили (drag + Shift+wheel + вертикальное колесо) →
// клик по паре открывает детали → позиция сетки сохранилась. Дополнительно:
// drag, начатый на блоке пары, НЕ открывает детали (порог движения).
//
// На mobile-360 недельная сетка скрыта (DIG-23: компактный список) — спек
// помечен desktop-only; мобильная гарантия «страница без горизонтального
// скролла» остаётся в e2e/schedule.spec.ts.

/** Вход тестового студента через чип демо-аккаунта (как в schedule.spec). */
async function signIn(page: Page) {
  await expect(async () => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Анна Смирнова · ПИ-21' }).click();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
}

test.describe('desktop 1440 — прокрутка недельной сетки (DIG-56)', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/schedule');
    // гидрация: drag/wheel живут на обработчиках после mount
    // (маркер — красная линия «сейчас», она client-only)
    await expect(page.getByTestId('now-line')).toBeVisible({ timeout: 15_000 });
  });

  test('drag мышью и Shift+wheel прокручивают сетку; вертикальное колесо скроллит сетку, а не страницу', async ({
    page,
  }) => {
    const grid = page.getByTestId('week-grid');
    await expect(grid).toBeVisible();

    // сетка шире видимой области: колонки дня имеют минимальную ширину
    const overflow = await grid.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'ожидали горизонтальный overflow недельной сетки').toBeGreaterThan(100);

    // ── drag мышью с зажатой кнопкой: тянем содержимое влево ────────────────
    const box = await grid.boundingBox();
    if (!box) throw new Error('week-grid has no bounding box');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= 6; step += 1) {
      await page.mouse.move(startX - step * 40, startY + 6, { steps: 2 });
    }
    await page.mouse.up();
    const afterDrag = await grid.evaluate((el) => el.scrollLeft);
    expect(afterDrag, 'drag должен панорамировать сетку').toBeGreaterThan(100);

    // ── Shift+колесо: горизонталь ────────────────────────────────────────────
    await grid.evaluate((el) => {
      el.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 240, shiftKey: true, bubbles: true, cancelable: true }),
      );
    });
    const afterShiftWheel = await grid.evaluate((el) => el.scrollLeft);
    expect(afterShiftWheel).toBeGreaterThan(afterDrag);

    // ── вертикальное колесо: сетка скроллится, страница — нет ────────────────
    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    await grid.hover();
    await page.mouse.wheel(0, 240);
    // Chrome применяет скролл от wheel асинхронно — ждём через poll
    await expect
      .poll(() => grid.evaluate((el) => el.scrollTop), { timeout: 5_000 })
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
  });

  test('drag, начатый на паре, не открывает детали; клик по паре открывает, позиция сетки сохраняется', async ({
    page,
  }) => {
    const grid = page.getByTestId('week-grid');
    const lesson = page.getByRole('button', {
      name: 'Лабораторная, Программирование, 12:00–13:30, ауд. 305, перенос',
    });
    await expect(lesson).toBeAttached();

    // блок пары должен быть внутри видимой области сетки для честного
    // pointer-жеста: Playwright скроллит контейнер к элементу
    await lesson.scrollIntoViewIfNeeded();

    // drag НА блоке пары (дальше порога) — детали НЕ открываются
    const box = await lesson.boundingBox();
    if (!box) throw new Error('lesson block has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // зафиксировали позицию сетки и кликнули по паре
    const [scrollLeft, scrollTop] = await grid.evaluate((el) => [el.scrollLeft, el.scrollTop]);
    // клик без автоскролла: позиция вокруг клика должна остаться той же
    await lesson.evaluate((el) => (el as HTMLElement).click());
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Программирование');

    // закрыли панель — позиция сетки не изменилась
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    const [restoredLeft, restoredTop] = await grid.evaluate((el) => [el.scrollLeft, el.scrollTop]);
    expect(restoredLeft, 'scrollLeft сетки должен сохраниться').toBe(scrollLeft);
    expect(restoredTop, 'scrollTop сетки должен сохраниться').toBe(scrollTop);
  });
});
