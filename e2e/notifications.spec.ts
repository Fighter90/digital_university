import { expect, test, type Page } from '@playwright/test';

// DIG-35 — экран «Уведомления» (Figma «08») и панель колокольчика.
// Спек БЕЗ мутаций данных (воркеры бегут параллельно против общего стора):
// отметки «прочитано» покрывают компонентные и слоёные vitest-тесты; здесь —
// рендер, фильтры, клавиатура панели и пустое состояние сотрудника.
// desktop-1440: группы, конкретные строки, «Важно», фильтр «Финансы», панель.
// mobile-360: одна колонка без горизонтального скролла, панель по тапу.

/** Вход через чипы демо-аккаунтов (см. e2e/auth.spec.ts). */
async function signIn(page: Page, chip: RegExp) {
  await page.goto('/login');
  await page.getByRole('button', { name: chip }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
}

const ANNA = /Анна Ковалёва · ПИ-21/;
const STAFF = /Сотрудник деканата/;
const DB_ROOM_TITLE = 'Пара «Базы данных» перенесена в ауд. Б-204';
const MILITARY_CERT_TITLE = 'Справка для военкомата готова';
const DORM_PAYMENT_TITLE = 'Оплата за общежитие — до 25 ноября';

test.describe('desktop 1440 — центр уведомлений', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page, ANNA);
  });

  test('рендер: заголовок, фильтры, группы дней и конкретные строки', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { level: 1, name: 'Уведомления' })).toBeVisible();

    const filters = page.getByRole('group', { name: 'Фильтры уведомлений' });
    for (const label of ['Все', 'Непрочитанные', 'Учёба', 'Заявки', 'Деканат', 'Финансы']) {
      await expect(filters.getByRole('button', { name: label })).toBeVisible();
    }

    for (const group of ['Сегодня', 'Вчера', 'Ранее']) {
      await expect(page.getByRole('heading', { name: group })).toBeVisible();
    }

    // Приёмка: ни одного уведомления без конкретики.
    await expect(page.getByText(MILITARY_CERT_TITLE)).toBeVisible();
    await expect(page.getByText(DB_ROOM_TITLE)).toBeVisible();
    await expect(page.getByText(/Сменился статус/)).toHaveCount(0);

    // «Важно» — только у срочных (у Анны их 3).
    await expect(page.getByText('Важно', { exact: true })).toHaveCount(3);

    // Ссылка «Настроить уведомления» → экран «Настройки».
    await expect(page.getByTestId('notification-settings-link')).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  test('фильтр «Финансы» оставляет только дедлайны платежей', async ({ page }) => {
    await page.goto('/notifications');
    await page.getByRole('button', { name: 'Финансы' }).click();

    await expect(page.getByText(DORM_PAYMENT_TITLE)).toBeVisible();
    await expect(page.getByText(DB_ROOM_TITLE)).not.toBeVisible();
    await expect(page.getByText(MILITARY_CERT_TITLE)).not.toBeVisible();
  });

  test('панель колокольчика открывается с клавиатуры и закрывается по Esc', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bell = page.getByTestId('notifications-bell');
    await expect(bell).toHaveAttribute('aria-expanded', 'false');
    await bell.focus();
    await page.keyboard.press('Enter');

    const panel = page.getByTestId('notifications-panel');
    await expect(panel).toBeVisible();
    // Последние 5 — не больше.
    await expect(panel.getByTestId(/^notification-item-/)).toHaveCount(5);
    await expect(panel.getByTestId('panel-all')).toHaveAttribute('href', '/notifications');
    await expect(panel.getByTestId('panel-settings')).toHaveAttribute('href', '/settings');

    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(bell).toBeFocused();
    await expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  test('сотруднику центр уведомлений недоступен — пустое состояние без данных', async ({
    page,
  }) => {
    await signIn(page, STAFF);
    await page.goto('/notifications');
    await expect(page.getByTestId('notifications-empty')).toBeVisible();
    await expect(page.getByText('Новых уведомлений нет')).toBeVisible();
  });
});

test.describe('mobile 360 — центр уведомлений', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test('экран в одну колонку без горизонтального скролла, фильтры скроллятся', async ({ page }) => {
    await signIn(page, ANNA);
    await page.goto('/notifications');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    await expect(page.getByRole('heading', { level: 1, name: 'Уведомления' })).toBeVisible();
    await expect(page.getByText(MILITARY_CERT_TITLE)).toBeVisible();
    await expect(page.getByText('Важно', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('notification-settings-link')).toBeVisible();
  });

  test('панель колокольчика открывается тапом и закрывается по Esc', async ({ page }) => {
    await signIn(page, ANNA);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bell = page.getByTestId('notifications-bell');
    await bell.tap();
    const panel = page.getByTestId('notifications-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId(/^notification-item-/)).toHaveCount(5);

    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
  });
});
