import { expect, test, type Page } from '@playwright/test';

// DIG-14 — каркас кабинета: e2e для приёмки.
// desktop-1440: верхняя панель, боковое меню, skip-link, ⌘K-поиск (фокус
// возвращается на триггер), меню аватара, ровно один main-landmark.
// mobile-360: без бокового меню, нижний таб-бар, без горизонтального скролла,
// плавающая AI-кнопка, счётчик уведомлений обновляется без перезагрузки.
//
// DIG-50: /dashboard защищён middleware (DIG-11) — каркас проверяется под
// сессией. Единые демо-креды (demo-набор = сид БД) работают и на memory-store,
// и на prisma-проде, поэтому вход общий для обоих режимов.

const MENU_LABEL = 'Разделы кабинета';

/** Вход тестового студента через форму (после DIG-50 — единые креды). */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await expect(page.getByLabel('Логин')).toHaveValue('anna.smirnova');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
}

test.describe('desktop 1440 — shell chrome', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('renders top bar, side menu and the nearest-deadline card', async ({ page }) => {
    await page.goto('/dashboard');

    const menu = page.getByRole('navigation', { name: MENU_LABEL });
    await expect(menu).toBeVisible();
    for (const label of [
      'Главная',
      'Расписание',
      'Успеваемость',
      'Заявки и справки',
      'Уведомления',
      'Связь с деканатом',
      'AI-ассистент',
      'Профиль',
    ]) {
      await expect(menu.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Ближайший дедлайн' })).toBeVisible();
    // Плашка концепта: и в верхней панели, и глобальным баннером.
    await expect(page.getByTestId('concept-pill')).toBeVisible();
    await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  });

  test('active section is highlighted in the menu (aria-current)', async ({ page }) => {
    await page.goto('/notifications');
    const menu = page.getByRole('navigation', { name: MENU_LABEL });
    await expect(menu.getByRole('link', { name: /Уведомления/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(menu.getByRole('link', { name: /Главная/ })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('skip link is the first tab stop and moves focus to the main content', async ({ page }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'К содержимому' });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('user menu opens with the keyboard and closes on Escape', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const trigger = page.getByRole('button', { name: /Меню пользователя/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Меню пользователя' });
    await expect(menu).toBeVisible();
    for (const item of ['Профиль', 'Настройки', 'Выйти']) {
      await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('search button and Ctrl/⌘+K open the search palette', async ({ page }) => {
    await page.goto('/dashboard');
    // Ждём гидрацию: хоткей и оверлей живут в клиентском компоненте Shell.
    await page.waitForLoadState('networkidle');
    const trigger = page.getByRole('button', { name: 'Поиск по кабинету (Command+K)' });
    await page.keyboard.press('ControlOrMeta+KeyK');
    const dialog = page.getByRole('dialog', { name: 'Поиск по кабинету' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Найти пару, преподавателя, справку…',
    );
    // Видимый интерактивный оверлей не должен нести aria-hidden вообще.
    const overlay = page.getByTestId('search-overlay');
    await expect(overlay).toHaveCount(1);
    expect(await overlay.getAttribute('aria-hidden')).toBeNull();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('search palette returns focus to the search trigger on close', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const trigger = page.getByRole('button', { name: 'Поиск по кабинету (Command+K)' });
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Поиск по кабинету' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();

    // Цикл ⌘K (открыть/закрыть) тоже возвращает фокус на кнопку поиска.
    await page.keyboard.press('ControlOrMeta+KeyK');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('ControlOrMeta+KeyK');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('the page has exactly one main landmark (the shell owns it)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
  });

  test('unread badge is shown next to the bell', async ({ page }) => {
    await page.goto('/dashboard');
    const bell = page.getByRole('link', { name: /Уведомления/ }).first();
    await expect(bell).toBeVisible();
    await expect(bell.getByTestId('unread-count')).toHaveText('3');
  });
});

test.describe('mobile 360 — tab bar and safe area', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('no horizontal scroll, side menu hidden, tab bar visible and in sync', async ({ page }) => {
    await page.goto('/dashboard');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    await expect(page.getByRole('navigation', { name: MENU_LABEL })).not.toBeVisible();

    const tabBar = page.getByRole('navigation', { name: 'Мобильная навигация' });
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link')).toHaveText([
      'Главная',
      'Расписание',
      'Оценки',
      'Заявки',
      'Ещё',
    ]);
    await expect(tabBar.getByRole('link', { name: 'Главная' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('«Ещё» tab is active for the extra sections', async ({ page }) => {
    await page.goto('/notifications');
    const tabBar = page.getByRole('navigation', { name: 'Мобильная навигация' });
    await expect(tabBar.getByRole('link', { name: 'Ещё' })).toHaveAttribute('aria-current', 'page');
    await page.goto('/more');
    await expect(
      page.getByRole('navigation', { name: 'Мобильная навигация' }).getByRole('link', {
        name: 'Ещё',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('floating AI button is visible above the tab bar', async ({ page }) => {
    await page.goto('/dashboard');
    const fab = page.getByRole('link', { name: 'AI-ассистент' }).last();
    await expect(fab).toBeVisible();
    const box = await fab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(400);
  });

  test('unread counter updates without a page reload', async ({ page }) => {
    let count = 3;
    await page.route('**/api/notifications/count', (route) => route.fulfill({ json: { count } }));

    // Часы браузера под контролем: 60-секундный интервал прокручиваем мгновенно.
    await page.clock.install();
    await page.goto('/dashboard');

    const badge = page.getByTestId('unread-count').first();
    await expect(badge).toHaveText('3');

    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker: number }).__noReloadMarker = Date.now();
    });

    count = 5;
    await page.clock.fastForward(61_000);
    await expect(badge).toHaveText('5');

    // Маркер пережил обновление счётчика — перезагрузки не было.
    const marker = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: number }).__noReloadMarker,
    );
    expect(marker).toBeTruthy();
  });
});
