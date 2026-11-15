import { expect, test, type Page } from '@playwright/test';

// DIG-66 — e2e «Что изменилось»: AI-объяснение динамики оценок
// (тренд Product Hunt: AI-анализ данных → интерактивные визуалы):
//  - карточка рендерится на «Успеваемости» с человеческим объяснением месяца;
//  - данные совпадают с успеваемостью: средний карточки = GPA-кольцу сводки;
//  - интерактив: наведение/фокус на точку графика показывает работы,
//    повлиявшие на средний на эту дату;
//  - 360 px: график и карточка без горизонтального скролла.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };

async function signIn(page: Page, target = '/grades') {
  await page.goto(`/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel('Логин').fill(ANNA.login);
  await page.getByLabel('Пароль', { exact: true }).fill(ANNA.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === new URL(target, page.url()).pathname, {
    timeout: 15_000,
  });
}

test.describe('DIG-66: AI-объяснение динамики оценок', () => {
  test('карточка «Что изменилось» рендерится и совпадает с успеваемостью', async ({ page }) => {
    await signIn(page);

    const card = page.getByTestId('grade-insight');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Что изменилось' })).toBeVisible();
    await expect(card.getByTestId('grade-insight-headline')).toContainText(/средний балл/i);
    // Честность демо: детерминированный анализ без LLM и внешних сервисов.
    await expect(card.getByText(/без внешних сервисов/i)).toBeVisible();

    // Данные совпадают с успеваемостью: текущий средний карточки равен
    // значению GPA-кольца сводки (одна формула — одно число на экране).
    const ring = await page.getByTestId('gpa-ring-value').textContent();
    expect(ring?.trim()).not.toBe('—');
    await expect(card.getByTestId('grade-insight-current')).toHaveText(ring!.trim());
  });

  test('наведение и фокус на точку показывают работы, повлиявшие на средний', async ({ page }) => {
    await signIn(page);

    const card = page.getByTestId('grade-insight');
    const pointDots = card.getByTestId('insight-point');
    // Демо-сид Анны: три работы идущего семестра — три точки графика.
    await expect(pointDots).toHaveCount(3);

    // По умолчанию раскрыта последняя точка: все три работы, новые сверху.
    const works = card.getByTestId('insight-work');
    await expect(works).toHaveCount(3);
    await expect(works.nth(0)).toContainText('Проект');
    await expect(works.nth(1)).toContainText('Лабораторная 2');
    await expect(works.nth(2)).toContainText('Тест 1');

    // Наведение на первую точку: в среднем только «Тест 1» (Информатика, 88).
    const first = pointDots.first();
    await first.hover();
    await expect(card.getByTestId('insight-work')).toHaveCount(1);
    await expect(card.getByTestId('insight-work')).toContainText('Тест 1');
    await expect(card.getByTestId('insight-work')).toContainText('88 из 100');

    // Наведение на последнюю точку — разбор по всем трём работам.
    await pointDots.last().hover();
    await expect(card.getByTestId('insight-work')).toHaveCount(3);
    await expect(card.getByTestId('insight-work').nth(0)).toContainText('85 из 100');

    // Клавиатура: фокус на точке раскрывает разбор так же, как наведение.
    await first.focus();
    await expect(card.getByTestId('insight-work')).toHaveCount(1);
    await expect(first).toHaveAttribute('aria-pressed', 'true');
  });

  test('360 px: карточка и график без горизонтального скролла', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page);

    await expect(page.getByTestId('grade-insight')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);
  });

  test('360 px: точки графика доступны нажатием', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page);

    const card = page.getByTestId('grade-insight');
    await card.getByTestId('insight-point').first().click();
    await expect(card.getByTestId('insight-work')).toHaveCount(1);
    await expect(card.getByTestId('insight-work')).toContainText('Тест 1');
  });
});
