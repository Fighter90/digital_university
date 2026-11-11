import { expect, test, type Page } from '@playwright/test';

// DIG-23 — «Расписание: виды День / Месяц + мобильный вид с лентой дат»
// (Figma «04 · Расписание — день / месяц» и вариант 360 px).
//
// desktop-1440: список пар карточками (время, цветная полоса типа, аудитория,
// преподаватель, бейджи «Перенос»/«Отмена»), сетка месяца 7×N с точками пар,
// клик по дню открывает вид «День».
// mobile-360: горизонтальная лента дат недели (скроллится сама, страница без
// горизонтального скролла), свайп влево/вправо листает дни, переключатель
// «Неделя» — компактный список по дням; перенос и отмена заметны как на
// десктопе.

/** Московский ключ сегодняшнего дня «YYYY-MM-DD» (совпадает с сервером). */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
}

/** Вход тестового студента через чип демо-аккаунта. */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
}

/** Свайп по элементу (синтетический TouchEvent, слева направо или обратно). */
async function swipe(page: Page, selector: string, direction: 'left' | 'right') {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no bounding box for ${selector}`);
  const y = box.y + box.height / 2;
  const startX = direction === 'left' ? box.x + box.width * 0.8 : box.x + box.width * 0.2;
  const endX = direction === 'left' ? box.x + box.width * 0.2 : box.x + box.width * 0.8;
  await page.evaluate(
    ({ sel, sx, ex, cy }: { sel: string; sx: number; ex: number; cy: number }) => {
      const target = document.querySelector(sel);
      if (!target) throw new Error(`missing ${sel}`);
      const touch = (x: number) => new Touch({ identifier: 1, target, clientX: x, clientY: cy });
      target.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touch(sx)],
          changedTouches: [touch(sx)],
        }),
      );
      target.dispatchEvent(
        new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          changedTouches: [touch(ex)],
        }),
      );
    },
    { sel: selector, sx: startX, ex: endX, cy: y },
  );
}

test.describe('desktop 1440 — виды «День» и «Месяц»', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('день: карточки пар с бейджами переноса и отмены', async ({ page }) => {
    await page.goto('/schedule?view=day');

    const desktop = page.getByTestId('desktop-day');
    await expect(desktop).toBeVisible();
    await expect(desktop.getByTestId('day-title')).toContainText('сегодня');

    // Демо-данные «сегодня» (ПИ-21): 4 пары — перенос, отмена, онлайн.
    await expect(desktop.getByTestId('day-card-sch-pi21-1')).toBeVisible();
    await expect(desktop.getByTestId('day-card-sch-pi21-4')).toBeVisible();
    await expect(desktop.getByTestId('day-card-sch-pi21-5')).toBeVisible();
    await expect(desktop.getByTestId('day-card-sch-pi21-6')).toBeVisible();

    const moved = desktop.getByTestId('day-card-sch-pi21-4');
    await expect(moved).toContainText('Программирование');
    await expect(moved).toContainText('Перенос');
    await expect(moved).toContainText('было: ауд. 214');

    const cancelled = desktop.getByTestId('day-card-sch-pi21-5');
    await expect(cancelled).toContainText('Отмена');
    await expect(cancelled).toContainText('Лаборатория закрыта');

    // Время слева, тип и аудитория с преподавателем на карточке
    await expect(desktop.getByTestId('day-card-sch-pi21-1')).toContainText('10:00');
    await expect(desktop.getByTestId('day-card-sch-pi21-6')).toContainText('онлайн');
  });

  test('без ?view= десктоп открывает неделю (DIG-22); переключатель ведёт в «День»', async ({
    page,
  }) => {
    await page.goto('/schedule');

    await expect(page.getByTestId('week-grid')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Неделя' })).toBeChecked();

    const desktopSwitcher = page.getByTestId('view-switcher-desktop');
    await expect(desktopSwitcher).toBeVisible();
    await expect(desktopSwitcher.getByRole('radio', { name: 'День' })).toBeEnabled();

    await desktopSwitcher.getByRole('radio', { name: 'День' }).click();
    await expect(page).toHaveURL(/view=day/);
    await expect(page.getByTestId('desktop-day')).toBeVisible();
    await expect(page.getByTestId('day-card-sch-pi21-1')).toBeVisible();
  });

  test('«Месяц» открывает сетку с точками пар и выделенным «сегодня»', async ({ page }) => {
    await page.goto('/schedule');

    const desktopSwitcher = page.getByTestId('view-switcher-desktop');
    await desktopSwitcher.getByRole('radio', { name: 'Месяц' }).click();
    await expect(page).toHaveURL(/\/schedule\?view=month$/);
    await expect(page.getByTestId('month-grid')).toBeVisible();

    const todayCell = page.getByTestId(`month-cell-${todayKey()}`);
    await expect(todayCell).toHaveAttribute('data-today', 'true');
    await expect(todayCell.locator('[data-testid="month-dot"]').first()).toBeVisible();
  });

  test('клик по дню в месяце открывает вид «День» с парами этого дня', async ({ page }) => {
    await page.goto('/schedule?view=month');
    await page.getByTestId(`month-cell-${todayKey()}`).click();
    await expect(page).toHaveURL(new RegExp(`view=day&date=${todayKey()}`));
    await expect(page.getByTestId('desktop-day').getByTestId('day-card-sch-pi21-1')).toBeVisible();
  });

  test('стрелки листают дни: завтрашняя пара с переносом аудитории', async ({ page }) => {
    await page.goto('/schedule?view=day');
    await page.getByLabel('Следующий день').click();
    // Демо-данные «завтра» (ПИ-21): пара перенесена из ауд. 310 в 405.
    const tomorrow = page.getByTestId('desktop-day').getByTestId('day-card-sch-pi21-2');
    await expect(tomorrow).toBeVisible();
    await expect(tomorrow).toContainText('Программирование');
    await expect(tomorrow).toContainText('Перенос');
    await expect(tomorrow).toContainText('было: ауд. 310');
  });

  test('пустой день показывает ближайшие пары или честный финал семестра', async ({ page }) => {
    await page.goto('/schedule?view=day');
    await page.getByLabel('Предыдущий день').click(); // вчера — пар нет
    await expect(page.getByTestId('day-empty')).toBeVisible();
    await expect(page.getByText(/Ближайшие пары|В семестре пар больше нет/)).toBeVisible();
  });
});

test.describe('mobile 360 — лента дат и свайп', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('нет горизонтального скролла страницы, лента скроллится сама', async ({ page }) => {
    await page.goto('/schedule');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    const ribbon = page.getByTestId('date-ribbon');
    await expect(ribbon).toBeVisible();
    const ribbonScroll = await ribbon.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(
      ribbonScroll.scrollWidth,
      'лента дат должна скроллиться независимо от страницы',
    ).toBeGreaterThan(ribbonScroll.clientWidth);

    // 7 дней недели в ленте, выбран — сегодня
    const today = todayKey();
    await expect(page.getByTestId(`ribbon-item-${today}`)).toHaveAttribute('data-selected', 'true');
    const items = await ribbon.locator('button').count();
    expect(items).toBe(7);
  });

  test('свайп влево и вправо по списку листает дни', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByTestId('mobile-day-title')).toBeVisible();

    await swipe(page, '[data-testid="mobile-day-list"]', 'left');
    await expect(page.getByTestId('mobile-day-title')).not.toContainText(/Среда|Monday/);
    const mobileList = page.getByTestId('mobile-day-list');
    const tomorrow = mobileList.getByTestId('day-card-sch-pi21-2');
    await expect(tomorrow).toBeVisible();
    await expect(tomorrow).toContainText('Перенос');

    await swipe(page, '[data-testid="mobile-day-list"]', 'right');
    await expect(page.getByTestId('mobile-day-title')).toContainText('сегодня');
    await expect(mobileList.getByTestId('day-card-sch-pi21-4')).toBeVisible();
  });

  test('перенос и отмена видны так же заметно, как на десктопе', async ({ page }) => {
    await page.goto('/schedule');
    const mobile = page.getByTestId('mobile-schedule');
    const moved = mobile.getByTestId('day-card-sch-pi21-4');
    await expect(moved).toContainText('Перенос');
    await expect(moved).toContainText('было: ауд. 214');
    const cancelled = mobile.getByTestId('day-card-sch-pi21-5');
    await expect(cancelled).toContainText('Отмена');
    await expect(cancelled).toContainText('Лаборатория закрыта');
  });

  test('клик по дню ленты переключает выбранный день', async ({ page }) => {
    await page.goto('/schedule');
    const today = todayKey();
    const tomorrow = new Date(Date.now() + 86_400_000);
    const tomorrowKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(
      tomorrow,
    );
    await page.getByTestId(`ribbon-item-${tomorrowKey}`).click();
    await expect(page.getByTestId(`ribbon-item-${tomorrowKey}`)).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(page.getByTestId(`ribbon-item-${today}`)).not.toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(
      page.getByTestId('mobile-day-list').getByTestId('day-card-sch-pi21-2'),
    ).toBeVisible();
  });

  test('переключатель «Неделя» показывает компактный список по дням', async ({ page }) => {
    await page.goto('/schedule');
    await page.getByTestId('view-switcher-mobile').getByRole('radio', { name: 'Неделя' }).click();

    const weekList = page.getByTestId('mobile-week-list');
    await expect(weekList).toBeVisible();
    // 7 секций-дней, у пар — те же карточки с бейджами переноса
    expect(await weekList.locator('section').count()).toBe(7);
    const movedCompact = weekList.getByTestId('day-card-sch-pi21-4');
    await expect(movedCompact).toBeVisible();
    await expect(movedCompact).toContainText('Перенос');
  });

  test('вид «Месяц» умещается в 360 px без горизонтального скролла', async ({ page }) => {
    await page.goto('/schedule?view=month');
    await expect(page.getByTestId('month-grid')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const todayCell = page.getByTestId(`month-cell-${todayKey()}`);
    await expect(todayCell).toHaveAttribute('data-today', 'true');
    await todayCell.click();
    await expect(page.getByTestId('mobile-schedule')).toBeVisible();
  });

  test('пустой день: иллюстрация и ближайшие пары', async ({ page }) => {
    await page.goto('/schedule');
    await swipe(page, '[data-testid="mobile-day-list"]', 'right'); // вчера
    await expect(page.getByTestId('mobile-day-empty')).toBeVisible();
    await expect(page.getByText(/Ближайшие пары|В семестре пар больше нет/)).toBeVisible();
  });
});
