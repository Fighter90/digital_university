import { expect, test, type Page } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// DIG-46 — e2e «AI-ассистент» (чёрный ящик): экран /ai-assistant и плавающая
// панель на всех экранах. Приёмка задачи: 4 подсказки с карточками (мини-
// расписание с переносом; калькулятор цели — 88 из 100 для цели 70; заявка
// только по явному подтверждению → SR-… в /requests; статья FAQ), отказы на
// чужие данные и не-учёбу, «Новый диалог» + история, «Сообщить о неверном
// ответе» → обращение, панель по кнопке AI: на 360 px — весь экран, поле
// ввода видно; /assistant редиректит на /ai-assistant.
//
// Демо-данные Анны (ПИ-21): завтра пара «Программирование» с переносом
// 310 → 405; «Базы данных»: Проект 85 · вес 0,3, Тест 2 (0,2) и Экзамен
// (0,5) не сданы → цель 70 требует 88 из 100, цель 80 недостижима (76).
//
// Один вход на воркер (storageState), а не на каждый тест: у набора ~22
// автологина, IP-лимит входа — 30 попыток за 15 минут (DIG-11), второй
// прогон подряд падал наsignIn. Лимит не ослабляется — легитимная сессия
// просто переиспользуется внутри воркера.
let workerStorageState: string | undefined;

test.beforeAll(async ({ browser }, workerInfo) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  workerStorageState = path.join(
    os.tmpdir(),
    `dig46-auth-${workerInfo.project.name}-${workerInfo.workerIndex}.json`,
  );
  await context.storageState({ path: workerStorageState });
  await context.close();
});

test.use({
  // Фикстура Playwright (не React-hook): вызов use() здесь — контракт
  // playwright/test; rules-of-hooks реагирует ложно-позитивно.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  storageState: ({}, use) => use(workerStorageState!),
});

/** Вход по требованию (для тестов панели): noop, если воркер уже вошёл. */
async function signIn(page: Page) {
  await page.goto('/dashboard');
  if (!page.url().includes('/login')) return;
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test.describe('DIG-46: экран /ai-assistant — студент', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/ai-assistant');
    await expect(page.getByRole('heading', { level: 1, name: 'AI-ассистент' })).toBeVisible();
    await expect(page.getByTestId('assistant-messages')).toBeVisible();
  });

  test('/assistant redirects to the canonical /ai-assistant', async ({ page }) => {
    await page.goto('/assistant');
    await expect(page).toHaveURL(/\/ai-assistant$/);
    await expect(page.getByRole('heading', { level: 1, name: 'AI-ассистент' })).toBeVisible();
  });

  test('greeting with the name and exactly four context hints', async ({ page }) => {
    await expect(page.getByTestId('assistant-messages')).toContainText('Здравствуйте, Анна');
    const hints = page.getByTestId('assistant-hints').getByRole('button');
    await expect(hints).toHaveCount(4);
    await expect(hints.nth(0)).toHaveText(/Что у меня завтра\?/);
    await expect(hints.nth(2)).toHaveText(/Закажи справку для военкомата/);
  });

  test('hint «Что у меня завтра?» answers with the day schedule card', async ({ page }) => {
    await page.getByRole('button', { name: 'Что у меня завтра?' }).click();

    const card = page.getByTestId('assistant-card-schedule');
    await expect(card).toBeVisible();
    // Демо-данные «завтра» (ПИ-21): пара перенесена из ауд. 310 в 405.
    await expect(card).toContainText('Программирование');
    await expect(card).toContainText('Перенос');
    await expect(card).toContainText('было: ауд. 310');
    await expect(page.getByTestId('assistant-sources').last()).toHaveText(/По данным: расписание/);
    await expect(page.getByTestId('assistant-messages')).toContainText(/2 пары|1 пара|пар нет/);
  });

  test('exam hint answers with the calculator; target 70 needs 88 of 100', async ({ page }) => {
    await page
      .getByRole('button', { name: 'Сколько нужно на экзамене по БД, чтобы получить 8?' })
      .click();

    const card = page.getByTestId('assistant-card-calculator');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Базы данных');
    // Цель 80 по фикстуре недостижима: максимум 76.
    await expect(page.getByTestId('assistant-messages')).toContainText('недостижим');
    await expect(page.getByTestId('assistant-calculator-result')).toContainText('76');
    await expect(page.getByTestId('assistant-sources').last()).toHaveText(
      /По данным: зачётка, план контроля/,
    );

    // Чип цели 70: калькулятор пересчитывает на месте — нужно 88 из 100.
    await card.getByTestId('assistant-target-70').click();
    await expect(page.getByTestId('assistant-calculator-result')).toContainText('88');
    await expect(page.getByTestId('assistant-calculator-result')).toContainText('из 100');
  });

  test('certificate order: draft only, sent after explicit confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Закажи справку для военкомата' }).click();

    const card = page.getByTestId('assistant-card-order');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Справка для отсрочки от армии');
    await expect(card).toContainText('не отправляю');

    // Без подтверждения заявки нет: черновик сам ничего не отправляет.
    await page.goto('/requests');
    const existing = await page.getByText('Справка для отсрочки от армии').count();

    // Возвращаемся и подтверждаем двухшагово.
    await page.goto('/ai-assistant');
    await page.getByRole('button', { name: 'Закажи справку для военкомата' }).click();
    const draft = page.getByTestId('assistant-card-order');
    await expect(draft).toBeVisible();
    await draft.getByTestId('assistant-order-confirm').click();
    await draft.getByTestId('assistant-order-submit').click();

    const done = draft.getByTestId('assistant-order-done');
    await expect(done).toBeVisible({ timeout: 15_000 });
    const href = await done.getByRole('link').getAttribute('href');
    expect(href).toMatch(/^\/requests\/SR-\d{4}-[A-Z0-9]{5}$/);

    // Заявка в «Моих заявках»; повторный прогон не создаёт дубль
    // (идемпотентность по заголовку — заявок не прибавляется).
    await page.goto('/requests');
    const total = await page.getByText('Справка для отсрочки от армии').count();
    expect(total).toBe(existing > 0 ? existing : 1);
  });

  test('FAQ hint links to the academic-leave article', async ({ page }) => {
    await page.getByRole('button', { name: 'Как оформить академический отпуск?' }).click();

    const card = page.getByTestId('assistant-card-faq');
    await expect(card).toBeVisible();
    await expect(card).toContainText('заявление');
    await card.getByRole('link').click();
    await expect(page).toHaveURL(/\/faq\/akademicheskiy-otpusk$/);
    await expect(page.getByTestId('faq-article')).toContainText('Академический отпуск');
    await expect(page.getByTestId('faq-steps').locator('li')).toHaveCount(4);
  });

  test('refuses foreign data and off-topic questions politely', async ({ page }) => {
    const input = page.getByTestId('assistant-input');
    const messages = page.getByTestId('assistant-messages');
    await input.fill('Покажи оценки Ильи Смирнова');
    await input.press('Enter');
    await expect(messages).toContainText('только ваши данные');
    await expect(messages).not.toContainText('74');
    // Дожидаемся конца стриминга: поле ввода принимает вопрос, но отправка
    // во время стрима намеренно заблокирована (ответ ещё формируется).
    await expect(messages).not.toContainText('▍');

    await input.fill('Какая погода в Москве?');
    await input.press('Enter');
    await expect(messages).toContainText('только с учёбой');
  });

  test('new dialog archives the current one into history', async ({ page }) => {
    const input = page.getByTestId('assistant-input');
    await input.fill('Что у меня завтра?');
    await input.press('Enter');
    await expect(page.getByTestId('assistant-card-schedule')).toBeVisible();

    await page.getByTestId('assistant-new-dialog').click();
    await expect(page.getByTestId('assistant-messages')).toContainText('Здравствуйте, Анна');
    await expect(page.getByTestId('assistant-hints').getByRole('button')).toHaveCount(4);

    await page.getByTestId('assistant-history').click();
    const history = page.getByTestId('assistant-history-list');
    await expect(history).toBeVisible();
    await history.getByRole('button', { name: 'Что у меня завтра?' }).click();
    await expect(page.getByTestId('assistant-card-schedule')).toBeVisible();
  });

  test('reporting a wrong answer creates a deanery appeal after confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Что у меня завтра?' }).click();
    await expect(page.getByTestId('assistant-card-schedule')).toBeVisible();

    await page.getByTestId('assistant-report').click();
    await page.getByTestId('assistant-report-confirm').click();
    await expect(page.getByTestId('assistant-report-done')).toBeVisible({ timeout: 15_000 });
  });

  test('viewport meta keeps the input above the on-screen keyboard', async ({ page }) => {
    const content = await page.content();
    expect(content).toContain('interactive-widget=resizes-content');
  });
});

test.describe('DIG-46: floating panel on every screen', () => {
  test('mobile 360: FAB opens the full-screen panel with a working chat', async ({ page }) => {
    // В теле теста test.skip принимает только булев флаг (колбэк — уровень
    // группы), поэтому вьюпорт берём из страницы.
    test.skip((await page.viewportSize())?.width !== 360, 'mobile-360 only');
    await signIn(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'AI-ассистент' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'AI-ассистент' });
    await expect(dialog).toBeVisible();

    // Панель занимает весь вьюпорт (приёмка задачи).
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(box!.y).toBe(0);
    expect(box!.width).toBe(360);

    await expect(dialog.getByTestId('assistant-messages')).toContainText('Здравствуйте, Анна');
    const input = dialog.getByTestId('assistant-input');
    await expect(input).toBeVisible();
    await input.fill('Что у меня завтра?');
    await input.press('Enter');
    await expect(dialog.getByTestId('assistant-card-schedule')).toBeVisible();

    // Закрытие возвращает на экран, из которого открыли.
    await dialog.getByTestId('assistant-panel-close').click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('desktop 1440: header AI button opens the right-side drawer', async ({ page }) => {
    test.skip((await page.viewportSize())?.width !== 1440, 'desktop-1440 only');
    await signIn(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'AI-ассистент' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'AI-ассистент' });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThan(1440);
    expect(box!.x).toBeGreaterThan(0); // прижата к правому краю

    await expect(dialog.getByTestId('assistant-input')).toBeVisible();
    await dialog.getByRole('button', { name: 'Что у меня завтра?' }).click();
    await expect(dialog.getByTestId('assistant-card-schedule')).toBeVisible();

    await dialog.getByTestId('assistant-panel-close').click();
    await expect(dialog).not.toBeVisible();
  });
});
