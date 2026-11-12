import { expect, test, type Page } from '@playwright/test';

// DIG-22 — экран «Расписание: неделя» (Figma «03 · Расписание — неделя»).
// desktop-1440: тулбар («Сегодня», ‹ ›, подпись недели, День/Неделя/Месяц,
// «Синхронизировать»), сетка 08:00–20:00 с блоками пар, листание недель
// БЕЗ перезагрузки страницы (URL ?week=2026-W46), клавиатура ←/→ и Esc,
// боковая панель деталей пары. mobile-360: недельный вид заменён мобильным.

/** Вход тестового студента через чип демо-аккаунта (как в dashboard.spec).
 *  Клик «Войти» + редирект повторяются через toPass: на нагруженной машине
 *  серверный экшен входа может подвиснуть в pending («Входим…») дольше
 *  15 с — повторный заход на /login пересоздаёт попытку (урок DIG-50). */
async function signIn(page: Page) {
  await expect(async () => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
}

/** Понедельник недели по ключу «2026-W46» (дата внутри этой недели). */
function mondayOfWeekKey(key: string): Date {
  const [year, week] = key.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year!, 0, 4));
  const day = jan4.getUTCDay(); // 0 = Sun
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - ((day + 6) % 7));
  const monday = new Date(firstMonday);
  monday.setUTCDate(firstMonday.getUTCDate() + (week! - 1) * 7);
  return monday;
}

/** Ключ ISO-недели для даты (UTC-математика достаточно точна для +03:00). */
function weekKeyOf(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7)); // понедельник
  const thursday = new Date(utc);
  thursday.setUTCDate(utc.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const week = Math.round((utc.getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

test.describe('desktop 1440 — неделя в стиле Google Calendar', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('renders the toolbar, mini calendar, filters and the time grid', async ({ page }) => {
    await page.goto('/schedule');

    await expect(page.getByRole('link', { name: 'Перейти к текущей неделе' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Предыдущая неделя' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Следующая неделя' })).toBeVisible();
    await expect(page.getByTestId('week-label')).toContainText(/ноября|декабря/);
    await expect(page.getByRole('radio', { name: 'Неделя' })).toBeChecked();
    // DIG-23: «День» и «Месяц» включены — переключение видов работает
    await expect(page.getByRole('radio', { name: 'День' })).toBeEnabled();
    await expect(page.getByRole('radio', { name: 'Месяц' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Синхронизировать' })).toBeVisible();

    await expect(page.getByTestId('mini-calendar')).toBeVisible();
    await expect(page.getByTestId('teacher-filter')).toBeVisible();
    for (const kind of ['Лекция', 'Семинар', 'Лабораторная', 'Практика', 'Консультация']) {
      await expect(page.getByRole('checkbox', { name: new RegExp(kind) })).toBeVisible();
    }

    const grid = page.getByTestId('week-grid');
    await expect(grid).toBeVisible();
    for (const hour of ['08:00', '12:00', '19:00']) {
      await expect(grid.getByText(hour, { exact: true })).toBeVisible();
    }
    // Демо-данные сегодняшнего дня: пара перенесена из ауд. 214 в 305.
    await expect(
      page.getByRole('button', {
        name: 'Лабораторная, Программирование, 12:00–13:30, ауд. 305, перенос',
      }),
    ).toBeVisible();
    // Концепт-плашка из корневого макета видна и на этом экране.
    await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  });

  test('navigates weeks via arrows WITHOUT page reload; URL reflects the week', async ({
    page,
  }) => {
    await page.goto('/schedule');

    const startKey = await page.getByTestId('week-board').getAttribute('data-week-key');
    expect(startKey).toMatch(/^\d{4}-W\d{2}$/);

    // маркер «живого» окна: после full reload он бы исчез
    await page.evaluate(() => {
      (window as unknown as { __du_alive?: string }).__du_alive = 'yes';
    });

    await page.getByRole('link', { name: 'Следующая неделя' }).click();
    const monday = mondayOfWeekKey(startKey!);
    monday.setUTCDate(monday.getUTCDate() + 7);
    const expectedNext = weekKeyOf(monday);
    // URL и КОНТЕНТ недели: мягкая навигация применяется асинхронно, клик
    // в окно перехода может быть проглочен — шаг с settle-маркером контента
    // повторяется через toPass.
    const board = page.getByTestId('week-board');
    await expect(async () => {
      await page.getByRole('link', { name: 'Следующая неделя' }).click();
      await expect(page).toHaveURL(new RegExp(`week=${expectedNext}`), { timeout: 5_000 });
      await expect(board).toHaveAttribute('data-week-key', expectedNext, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    expect(
      await page.evaluate(() => (window as unknown as { __du_alive?: string }).__du_alive),
    ).toBe('yes');

    // «Сегодня» возвращает на текущую неделю (тоже без перезагрузки)
    await expect(async () => {
      await page.getByRole('link', { name: 'Перейти к текущей неделе' }).click();
      await expect(page).toHaveURL(new RegExp(`week=${startKey!}`), { timeout: 5_000 });
      await expect(board).toHaveAttribute('data-week-key', startKey!, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    expect(
      await page.evaluate(() => (window as unknown as { __du_alive?: string }).__du_alive),
    ).toBe('yes');
  });

  test('keyboard ←/→ flip weeks, Esc closes the details panel', async ({ page }) => {
    await page.goto('/schedule');
    // Гидрация: ←/→ листают недели через router.push из client-эффекта —
    // нажатие до гидрации будет проглочено (маркер — красная линия «сейчас»,
    // она появляется только после mount).
    await expect(page.getByTestId('now-line')).toBeVisible({ timeout: 15_000 });
    const startKey = await page.getByTestId('week-board').getAttribute('data-week-key');

    const board = page.getByTestId('week-board');
    /** Нажатие стрелки + подтверждение URL и КОНТЕНТА недели (toPass: клик в
     * окно применения мягкой навигации может быть проглочен). */
    const pressArrow = async (key: 'ArrowLeft' | 'ArrowRight', expected: string) => {
      await expect(async () => {
        await page.keyboard.press(key);
        await expect(page).toHaveURL(new RegExp(`week=${expected}`), { timeout: 5_000 });
        await expect(board).toHaveAttribute('data-week-key', expected, { timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
    };

    // ← : неделя назад
    const prevMonday = mondayOfWeekKey(startKey!);
    prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
    await pressArrow('ArrowLeft', weekKeyOf(prevMonday));

    // → : дважды — неделя вперёд и ещё одна
    await pressArrow('ArrowRight', startKey!);
    const nextMonday = mondayOfWeekKey(startKey!);
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
    await pressArrow('ArrowRight', weekKeyOf(nextMonday));

    // вернулись на текущую неделю: у сегодняшней пары открываем панель деталей
    await pressArrow('ArrowLeft', startKey!);
    const lesson = page.getByRole('button', {
      name: 'Лабораторная, Программирование, 12:00–13:30, ауд. 305, перенос',
    });
    await lesson.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Программирование');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('the now line appears after mount (client-only, no SSR mismatch)', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByTestId('now-line')).toBeVisible();
  });

  test('kind filters hide and reveal lesson blocks with counts', async ({ page }) => {
    await page.goto('/schedule');
    const lecture = page.getByRole('button', {
      name: 'Лекция, Информатика, 10:00–11:30, ауд. 301',
    });
    await expect(lecture).toBeVisible();

    await page.getByRole('checkbox', { name: /Лекция/ }).uncheck();
    await expect(lecture).toBeHidden();
    await page.getByRole('checkbox', { name: /Лекция/ }).check();
    await expect(lecture).toBeVisible();
  });

  test('cancelled lesson: strikethrough heading and «Отменена» badge', async ({ page }) => {
    await page.goto('/schedule');
    const cancelled = page.getByRole('button', {
      name: 'Лабораторная, Физика, 14:00–15:30, ауд. 212, отменена',
    });
    await expect(cancelled).toBeVisible();
    await expect(cancelled).toContainText('Отменена');
    await expect(cancelled).toContainText('Лаборатория закрыта');
  });
});

test.describe('mobile 360 — лента дат мобильного вида (DIG-23)', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('week grid is hidden, the mobile day view (date ribbon) is shown, no horizontal scroll', async ({
    page,
  }) => {
    await page.goto('/schedule');

    await expect(page.getByTestId('week-grid')).not.toBeVisible();
    // DIG-23: мобильный вид — лента дат и пары выбранного дня
    await expect(page.getByTestId('date-ribbon')).toBeVisible();
    await expect(page.getByTestId('mobile-day-title')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);
  });
});
