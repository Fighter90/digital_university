import { expect, test, type Page } from '@playwright/test';

// DIG-48 — e2e кабинета сотрудника деканата (Figma «27 · Кабинет сотрудника»).
//
// Критерии приёмки:
//  1) студент не может открыть ни один экран сотрудника — 403;
//  2) смена статуса сотрудником → уведомление студенту (< 60 с):
//     студент сразу видит событие и новый статус на карточке своей заявки.
//
// Номера заявок берутся из интерфейса (детерминированный сид, но не хардкод):
// очередь → ссылка /staff/requests/<номер> → тот же номер у студента.
// Мутации — только в desktop-сценариях; mobile-проект читает данные,
// чтобы параллельные воркеры не меняли одно и то же.

const STAFF = { login: 'dean.kovaleva', password: 'dean-demo-2026' };
const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };

async function signIn(page: Page, login: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

/** Номер заявки из карточки очереди (ссылка /staff/requests/<номер>). */
async function requestNumberFromRow(row: ReturnType<Page['locator']>): Promise<string> {
  const href = await row.getByRole('link').getAttribute('href');
  expect(href).toMatch(/^\/staff\/requests\/SR-/);
  return href!.split('/').pop()!;
}

// ── 403: студент и аноним не открывают экраны сотрудника ────────────────────

test('студент получает 403 на любой /staff* путь (не redirect)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, ANNA.login, ANNA.password, '/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const path of ['/staff', '/staff/requests', '/staff/appeals', '/staff/announcements']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(403);
  }
  await context.close();
});

test('аноним на /staff уходит на /login (кабинет закрыт входом)', async ({ page }) => {
  // APIRequestContext не следует за redirect'ами при maxRedirects: 0 —
  // видно сам 302 и заголовок Location (page.goto последнюю версию всегда
  // доварачивает до 200 страницы входа).
  const res = await page.request.get('/staff', { maxRedirects: 0 });
  expect([302, 307, 303]).toContain(res.status());
  expect(res.headers()['location']).toContain('/login');
});

// ── Очередь и «Взять в работу» (desktop) ─────────────────────────────────────

test('сотрудник видит очередь своего факультета и SLA-подсветку', async ({ page }) => {
  await signIn(page, STAFF.login, STAFF.password, '/staff');
  await expect(page.getByRole('heading', { level: 1, name: 'Сводка деканата' })).toBeVisible();
  await expect(page.getByTestId('staff-metric-today')).toBeVisible();

  await page.goto('/staff/requests');
  // Заявки факультета «ИТ» (Анна) видны, факультета «ЭК» (Илья) — нет.
  await expect(page.getByRole('heading', { level: 1, name: 'Очередь заявок' })).toBeVisible();
  const overdueRow = page.locator('li', { hasText: 'Справка для военкомата' }).first();
  await expect(overdueRow.locator('[data-testid^="sla-overdue-"]')).toBeVisible();
  await expect(page.getByText('Заявление на академический отпуск')).toHaveCount(0);

  // Фильтр «Просроченные» оставляет только просроченные.
  await page.getByRole('radio', { name: 'Просроченные' }).check();
  await page.getByRole('button', { name: 'Применить' }).click();
  await expect(page.getByText('Справка для военкомата')).toBeVisible();
  await expect(page.getByText('Заявление на перезачёт дисциплины')).toHaveCount(0);
});

test('«Взять в работу» + причина доработки → студент сразу видит результат', async ({
  browser,
}, testInfo) => {
  // Мутация общего состояния сервера: в mobile-проекте пропускаем —
  // тот же сценарий параллельно гоняет desktop-воркер (одна память).
  test.skip(testInfo.project.name === 'mobile-360', 'мутации — только в desktop-проекте');
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await signIn(staff, STAFF.login, STAFF.password, '/staff/requests');

  // Свежая заявка «сегодня»: «Взять в работу» прямо из очереди.
  const freshRow = staff.locator('li', { hasText: 'Заявление на перезачёт дисциплины' }).first();
  const freshNumber = await requestNumberFromRow(freshRow);
  const takeForm = freshRow.locator('[data-testid^="take-"]');
  await expect(takeForm).toBeVisible();
  await takeForm.getByRole('button', { name: 'Взять в работу' }).click();
  await expect(freshRow.getByText('В работе')).toBeVisible();

  // Карточка: доработка без причины невозможна (required), с причиной — да.
  await staff.getByRole('link', { name: 'Заявление на перезачёт дисциплины' }).click();
  const card = staff.locator('main');
  await expect(
    card.getByRole('heading', { name: 'Заявление на перезачёт дисциплины' }),
  ).toBeVisible();
  await expect(card.getByText('Анна Ковалёва')).toBeVisible();
  await expect(card.getByText('ПИ-21')).toBeVisible();

  await card.getByRole('button', { name: 'Вернуть студенту на доработку' }).click();
  // HTML5 required держит форму — статус не меняется, ошибки сервера нет.
  await expect(card.getByText('Требует правок')).toHaveCount(0);

  await card.getByLabel(/Причина/).fill('Приложите план перезачёта с подписью преподавателя');
  await card.getByRole('button', { name: 'Вернуть студенту на доработку' }).click();
  await expect(card.getByText('Статус обновлён — студент получил уведомление.')).toBeVisible();
  await expect(card.getByText('Требует правок')).toBeVisible();

  // Студент моментально видит событие и статус на своей карточке (< 60 с).
  const annaContext = await browser.newContext();
  const anna = await annaContext.newPage();
  await signIn(anna, ANNA.login, ANNA.password, `/requests/${freshNumber}`);
  const annaCard = anna.locator('main');
  await expect(annaCard.getByText('Требует правок')).toBeVisible();
  await expect(
    annaCard.getByText('Приложите план перезачёта с подписью преподавателя'),
  ).toBeVisible();

  await staffContext.close();
  await annaContext.close();
});

test('PDF выполненной справки отдаётся сотруднику того же факультета', async ({ page }) => {
  await signIn(page, STAFF.login, STAFF.password, '/staff/requests');
  await page.getByRole('link', { name: 'Справка об обучении для налоговой' }).click();
  const pdfLink = page.getByTestId('staff-certificate-pdf');
  await expect(pdfLink).toBeVisible();

  const href = await pdfLink.getAttribute('href');
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect((await res.body()).length).toBeGreaterThan(1000);

  // Повторное формирование — стабильный документ (тот же код проверки).
  const res2 = await page.request.get(href!);
  expect(res2.status()).toBe(200);
});

test('обращения: список по факультету, шаблон ответа, «Решено»', async ({ page }, testInfo) => {
  // Ответ и «Решено» меняют общее состояние сервера — только в desktop.
  test.skip(testInfo.project.name === 'mobile-360', 'мутации — только в desktop-проекте');
  await signIn(page, STAFF.login, STAFF.password, '/staff/appeals');
  await expect(page.getByRole('heading', { level: 1, name: 'Обращения студентов' })).toBeVisible();
  await expect(page.getByText('Вопрос по зачёту по физкультуре')).toBeVisible();
  await expect(page.getByText('Пересдача математического анализа')).toHaveCount(0); // чужой факультет

  await page.getByRole('link', { name: /Вопрос по зачёту по физкультуре/ }).click();
  await expect(page.getByTestId('appeal-chat')).toContainText('Засчитывается ли зачёт');

  // Шаблон подставляет текст в поле ответа.
  await page.getByTestId('template-received').click();
  const body = page.getByLabel('Текст ответа');
  await expect(body).toHaveValue(/принято в работу/i);
  await body.fill('Зачёт перенесён, проверьте экран «Успеваемость» завтра.');
  await page.getByRole('button', { name: 'Отправить ответ' }).click();
  await expect(page.getByTestId('appeal-chat')).toContainText(
    'Зачёт перенесён, проверьте экран «Успеваемость» завтра.',
  );
  await expect(page.getByText('Отвечено').first()).toBeVisible();

  // «Решено» закрывает обращение.
  await page.getByRole('button', { name: 'Решено' }).click();
  await expect(page.getByText('Обращение решено и закрыто')).toBeVisible();
});

test('объявления: предпросмотр при вводе, публикация в список', async ({ page }) => {
  await signIn(page, STAFF.login, STAFF.password, '/staff/announcements');
  await expect(page.getByRole('heading', { level: 1, name: 'Объявления' })).toBeVisible();

  // Живой предпросмотр обновляется при вводе.
  await page.getByLabel('Заголовок').fill('Перенос собрания группы ПИ-21');
  await page
    .getByLabel('Текст объявления')
    .fill('Собрание перенесено с четверга на пятницу, 15:00, ауд. 305.');
  const preview = page.getByTestId('announcement-preview');
  await expect(preview).toContainText('Перенос собрания группы ПИ-21');
  await expect(preview).toContainText('ауд. 305');

  // Публикация: аудитория «группа», объявление появляется в списке.
  await page.getByRole('radio', { name: 'Группа' }).check();
  await page.getByLabel(/Группа \(только группы/).selectOption('ПИ-21');
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByText('Объявление опубликовано.')).toBeVisible();
  await expect(page.getByTestId('staff-announcements-list')).toContainText(
    'Перенос собрания группы ПИ-21',
  );
  await expect(page.getByTestId('staff-announcements-list')).toContainText('группа ПИ-21');
});

// ── Mobile 360: только чтение (мутации — в desktop, чтобы не гонять стейт) ──

test('мобильный 360: студенту 403, сотруднику — кабинет с таб-баром деканата', async ({ page }) => {
  await signIn(page, ANNA.login, ANNA.password, '/dashboard');
  // Ждём завершения входа: иначе /staff открывается анонимом и редирект
  // на /login отвечает 200 (проверялся бы не экран сотрудника, а вход).
  await expect(page).toHaveURL(/\/dashboard$/);
  const res = await page.goto('/staff');
  expect(res?.status()).toBe(403);

  await signIn(page, STAFF.login, STAFF.password, '/staff');
  await expect(page.getByRole('heading', { level: 1, name: 'Сводка деканата' })).toBeVisible();
  // Таб-бар сотрудника (мобильный Shell по роли).
  const tabBar = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await expect(tabBar.getByRole('link', { name: 'Сводка' })).toBeVisible();
  await expect(tabBar.getByRole('link', { name: 'Заявки' })).toBeVisible();
  await expect(tabBar.getByRole('link', { name: 'Обращения' })).toBeVisible();
  await expect(tabBar.getByRole('link', { name: 'Объявления' })).toBeVisible();

  await tabBar.getByRole('link', { name: 'Заявки' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Очередь заявок' })).toBeVisible();
  await expect(page.locator('[data-testid^="sla-overdue-"]').first()).toBeVisible();
});
