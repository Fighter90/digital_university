import { expect, test, type Page } from '@playwright/test';

// DIG-34 — e2e «Задачи» (чёрный ящик): единый список действий из всех
// разделов, группы срочности, счётчик в меню, отметка ручной задачи,
// роли (сотрудник/аноним) и адаптив 360 px.

async function signIn(page: Page, login: string, password: string, next?: string) {
  const target = next ?? '/dashboard';
  await page.goto(`/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === new URL(target, page.url()).pathname, {
    timeout: 15_000,
  });
}

test.describe('DIG-34: задачи — студент', () => {
  test('группы срочности, строки задач и их действия ведут в свои разделы', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/tasks');
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();

    // Группы в порядке срочности.
    for (const group of ['overdue', 'today', 'week', 'later']) {
      await expect(page.getByTestId(`task-group-${group}`)).toBeVisible();
    }

    // Заявка «Нужна доработка» (канон «ЗД-…») → действие на карточку заявки,
    // где доступна форма «Исправить и подать повторно» (заявка — объект).
    const revision = page.getByTestId('task-row').filter({ hasText: 'Доработать заявку' });
    await expect(revision).toBeVisible();
    await expect(revision.getByTestId('task-action')).toHaveAttribute(
      'href',
      /^\/requests\/ЗД-\d{4}-\d{6}$/,
    );

    // Дедлайн курса и недопуск ведут на карточку дисциплины.
    await expect(
      page.getByTestId('task-group-overdue').getByTestId('task-row').filter({ hasText: 'Физика' }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('task-row')
        .filter({ hasText: 'Сдать: Лабораторная 3' })
        .getByTestId('task-action'),
    ).toHaveAttribute('href', '/grades/PI21-PROG');

    // Пересдача → на «Сессию» (терпимо к прогону session.spec: там заявка
    // записи может быть уже создана — тогда задачи нет), обращение → в деканат.
    const retake = page.getByTestId('task-row').filter({ hasText: 'Записаться на пересдачу' });
    if ((await retake.count()) > 0) {
      await expect(retake.getByTestId('task-action')).toHaveAttribute('href', '/grades/session');
    }
    await expect(
      page
        .getByTestId('task-row')
        .filter({ hasText: 'Ответить на обращение' })
        .getByTestId('task-action'),
    ).toHaveAttribute('href', '/deanery');

    // Ручная задача — с кнопкой «Отметить выполненной» (терпимо к параллельному
    // запуску второго проекта, где она уже отмечена).
    const pay = page.getByTestId('task-row').filter({ hasText: 'Оплатить обучение по договору' });
    if ((await pay.count()) > 0) {
      await expect(pay.getByTestId('task-done-button')).toBeVisible();
    }

    // «Каждая задача ведёт ровно туда»: клик по действию открывает карточку
    // канонической заявки (URL содержит кириллический номер «ЗД-…»).
    await revision.getByTestId('task-action').click();
    await expect(page).toHaveURL(/\/requests\/%D0%97%D0%94-\d{4}-\d{6}$/);
    await expect(page.getByTestId('request-fix-form')).toBeVisible();
  });

  test('счётчик в меню совпадает с числом открытых задач', async ({ page }) => {
    // Пилюля счётчика — в полном меню (≥1024), как у уведомлений; на рельсах
    // и мобильном скрыта по дизайну каркаса.
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/tasks');
    const counter = page.getByTestId('tasks-count');
    await expect(counter).toBeVisible();
    const counterText = (await counter.textContent()) ?? '';
    const rows = await page.getByTestId('task-row').count();
    expect(Number(counterText)).toBe(rows);
  });

  test('отметка ручной задачи: строка исчезает, счётчик остаётся числом', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/tasks');
    const pay = page.getByTestId('task-row').filter({ hasText: 'Оплатить обучение по договору' });
    // Идемпотентно к повторным прогонам: задача могла быть отмечена ранее.
    if ((await pay.count()) > 0) {
      await pay.getByTestId('task-done-button').click();
      await expect(pay).toHaveCount(0, { timeout: 15_000 });
    } else {
      await expect(pay).toHaveCount(0);
    }
    const counter = page.getByTestId('tasks-count');
    if ((await counter.count()) > 0) {
      expect(Number.isNaN(Number(await counter.textContent()))).toBe(false);
    }
  });

  test('360 px: группы и строки читаются без горизонтальной прокрутки', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/tasks');

    await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
    await expect(page.getByTestId('task-group-today')).toBeVisible();
    await expect(
      page.getByTestId('task-row').filter({ hasText: 'Доработать заявку' }),
    ).toBeVisible();
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(1);
  });
});

test.describe('DIG-34: блок главной и роли', () => {
  test('блок «Что от меня ждут» на главной ведёт на /tasks', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/dashboard');
    const block = page.getByTestId('dashboard-tasks');
    await expect(block).toBeVisible();
    await expect(block).toContainText('Что от меня ждут');
    await block.getByTestId('dashboard-tasks-all').click();
    await expect(page).toHaveURL(/\/tasks$/);
  });

  test('сотруднику: заглушка «Экран доступен студентам»', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, 'dean.kovaleva', 'dean-demo-2026', '/tasks');
    await expect(page.getByRole('heading', { level: 1, name: 'Задачи' })).toBeVisible();
    await expect(page.getByText('Экран доступен студентам')).toBeVisible();
    await expect(page.getByTestId('task-row')).toHaveCount(0);
  });

  test('аноним — редирект на вход', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
