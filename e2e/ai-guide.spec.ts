import { expect, test, type Page } from '@playwright/test';

// DIG-62 — e2e «AI-гид по кабинету» (чёрный ящик, тренд Product Hunt:
// агент ведёт пользователя по продукту):
//  - первый вход студента: панель гида раскрыта на /dashboard и предлагает
//    экскурсию «расписание → оценки → заявки → справки»;
//  - сценарии-подсказки: «Где мои справки?» → /services, «Как записаться
//    на пересдачу?» → /grades/session (ответ — кнопка-ссылка);
//  - экскурсия: шаг «Расписание» ведёт на /schedule;
//  - отключаемость: «Пропустить» → перезагрузка и повторный вход панель
//    больше не открывают; гид доступен вручную пилюлей;
//  - 360 px: подсказка на первом входе видна, горизонтального скролла нет.
//
// Гид пишит флаг в localStorage контекста браузера — у каждого теста свой
// контекст, поэтому «первый вход» воспроизводится всегда и параллельные
// проекты друг другу не мешают.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };

async function signIn(page: Page, target = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel('Логин').fill(ANNA.login);
  await page.getByLabel('Пароль', { exact: true }).fill(ANNA.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === new URL(target, page.url()).pathname, {
    timeout: 15_000,
  });
}

test.describe('DIG-62: AI-гид по кабинету', () => {
  test('первый вход: подсказка с экскурсией «расписание → оценки → заявки → справки»', async ({
    page,
  }) => {
    await signIn(page);

    const panel = page.getByTestId('ai-guide-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('AI-гид');
    await expect(panel).toContainText(/расписание\s*→\s*оценки\s*→\s*заявки\s*→\s*справки/i);
    await expect(page.getByRole('button', { name: /начать экскурсию/i })).toBeVisible();

    // Гид знает сценарии-подсказки уже на приветствии.
    await expect(panel.getByRole('button', { name: 'Где мои справки?' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Как записаться на пересдачу?' })).toBeVisible();
  });

  test('сценарий «Где мои справки?» отвечает кнопкой-ссылкой на /services', async ({ page }) => {
    await signIn(page);
    const panel = page.getByTestId('ai-guide-panel');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Где мои справки?' }).click();
    const cta = page.getByTestId('ai-guide-answer-cta');
    await expect(cta).toBeVisible();

    await cta.click();
    await page.waitForURL(/\/services$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Каталог сервисов' })).toBeVisible();
    // После перехода по ответу гид не всплывает снова на новом экране.
    await expect(page.getByTestId('ai-guide-panel')).toHaveCount(0);
  });

  test('сценарий «Как записаться на пересдачу?» ведёт на /grades/session', async ({ page }) => {
    await signIn(page);
    const panel = page.getByTestId('ai-guide-panel');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Как записаться на пересдачу?' }).click();
    await page.getByTestId('ai-guide-answer-cta').click();
    await page.waitForURL(/\/grades\/session$/);
    await expect(page.getByRole('heading', { level: 1, name: /Сессия/i })).toBeVisible();
  });

  test('экскурсия: шаг «Расписание» ведёт на /schedule', async ({ page }) => {
    await signIn(page);
    const panel = page.getByTestId('ai-guide-panel');
    await expect(panel).toBeVisible();

    await page.getByRole('button', { name: /начать экскурсию/i }).click();
    const step = page.getByTestId('ai-guide-step');
    await expect(step).toBeVisible();
    await expect(step).toContainText('Расписание');
    await expect(step).toContainText('шаг 1 из 4');

    // Первый шаг сразу ведёт на свой экран кнопкой-ссылкой.
    await expect(page.getByTestId('ai-guide-step-cta')).toHaveAttribute('href', '/schedule');
    await page.getByTestId('ai-guide-step-cta').click();
    await page.waitForURL(/\/schedule$/);
    await expect(page.getByTestId('ai-guide-panel')).toHaveCount(0);

    // Порядок остальных шагов и их адреса: оценки → заявки → справки.
    await page.getByTestId('ai-guide-pill').click();
    await expect(page.getByTestId('ai-guide-panel')).toBeVisible();
    await page.getByRole('button', { name: /начать экскурсию/i }).click();
    const expected = [
      ['Оценки', 'шаг 2 из 4', '/grades'],
      ['Заявки', 'шаг 3 из 4', '/requests'],
      ['Справки', 'шаг 4 из 4', '/services'],
    ] as const;
    for (const [title, progress, href] of expected) {
      await page.getByRole('button', { name: 'Дальше' }).click();
      await expect(page.getByTestId('ai-guide-step')).toContainText(title);
      await expect(page.getByTestId('ai-guide-step')).toContainText(progress);
      await expect(page.getByTestId('ai-guide-step-cta')).toHaveAttribute('href', href);
    }
    // Последний шаг закрывается кнопкой «Завершить экскурсию».
    await page.getByRole('button', { name: /завершить экскурсию/i }).click();
    await expect(page.getByTestId('ai-guide-panel')).toHaveCount(0);
  });

  test('отключаемость: после «Пропустить» перезагрузка и повторный вход не открывают панель', async ({
    page,
  }) => {
    await signIn(page);
    const panel = page.getByTestId('ai-guide-panel');
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить' }).click();
    await expect(panel).toHaveCount(0);

    // Перезагрузка той же сессии: подсказка не мешает.
    await page.reload();
    await expect(page.getByTestId('ai-guide-panel')).toHaveCount(0);

    // Повторный вход в кабинет в том же браузере (новая сессия — cookies
    // сброшены): панель сама не открывается. Проверка через clearCookies,
    // а не через «Выйти»: у меню аватара на mobile-360 есть давнее
    // перекрытие контентом, не относящееся к гиду (см. e2e/auth.spec.ts —
    // DIG-55 покрывает «Выйти» на desktop).
    await page.context().clearCookies();
    await signIn(page);

    await expect(page.getByTestId('ai-guide-panel')).toHaveCount(0);
    // …но гид доступен вручную пилюлей.
    await page.getByTestId('ai-guide-pill').click();
    await expect(page.getByTestId('ai-guide-panel')).toBeVisible();
    // Закрытие крестиком тоже запоминается.
    await page.getByTestId('ai-guide-close').click();
    await expect(page.getByTestId('ai-guide-panel')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('ai-guide-panel')).toHaveCount(0);
  });

  // Раунд 2 (ревью DIG-62): гид живёт рядом с плавающей AI-кнопкой
  // (aria-label «AI-ассистент», тот же нижне-правый угол) — пилюля и панель
  // не должны её перекрывать ни в открытом, ни в закрытом состоянии.
  test('360 px: пилюля и панель гида не перекрывают плавающую AI-кнопку', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page);

    // Плавающая кнопка — единственная «AI-ассистент»-кнопка с fixed-
    // позиционированием (в шапке есть одноимённая иконка, это не она).
    // DIG-46: кнопка (не ссылка) открывает ассистента; DIG-72 — попап-чат.
    const fab = page.getByRole('button', { name: 'AI-ассистент' }).last();
    await expect(fab).toBeVisible();
    const overlaps = async (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

    // Панель раскрыта (первый вход): AI-кнопка остаётся видимой и не перекрыта.
    const panel = page.getByTestId('ai-guide-panel');
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    const fabBox = await fab.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(fabBox).not.toBeNull();
    expect(await overlaps(panelBox!, fabBox!), 'panel covers the floating AI button').toBe(false);

    // Панель закрыта: пилюля «AI-гид» тоже не наезжает на AI-кнопку.
    await page.getByTestId('ai-guide-close').click();
    await expect(panel).toHaveCount(0);
    const pill = page.getByTestId('ai-guide-pill');
    await expect(pill).toBeVisible();
    const pillBox = await pill.boundingBox();
    const fabBoxAfter = await fab.boundingBox();
    expect(pillBox).not.toBeNull();
    expect(fabBoxAfter).not.toBeNull();
    expect(await overlaps(pillBox!, fabBoxAfter!), 'pill covers the floating AI button').toBe(
      false,
    );
  });

  test('360 px: подсказка на первом входе видна, скролла и перекрытия таб-бара нет', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page);

    const panel = page.getByTestId('ai-guide-panel');
    await expect(panel).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    // Панель живёт выше таб-бара: навигация не перекрыта.
    const tabBar = page.getByRole('navigation', { name: 'Мобильная навигация' });
    await expect(tabBar).toBeVisible();
    const panelBox = await panel.boundingBox();
    const tabBarBox = await tabBar.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(tabBarBox).not.toBeNull();
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(tabBarBox!.y + 1);

    // «Пропустить» — и мобильная навигация работает без помех.
    await page.getByRole('button', { name: 'Пропустить' }).click();
    await expect(panel).toHaveCount(0);
    await tabBar.getByRole('link', { name: 'Расписание' }).click();
    await page.waitForURL(/\/schedule$/);
  });
});
