import { expect, test, type Page } from '@playwright/test';

// DIG-40 — e2e «Обратная связь руководству» (/feedback, чёрный ящик):
//  - пункт меню «Обратная связь» — название однозначно объясняет назначение
//    (в аудированном ЛК канал назывался «Выразительная кнопка»);
//  - экран: обещание «3 рабочих дня», композер (тип, адресат, текст,
//    вложения, «Анонимно» с объяснением, что увидит адресат);
//  - лента «Что мы изменили по вашим предложениям» (3 примера из сидов);
//  - подписанное обращение → карточка с номером, статусом и сроком ответа;
//  - АНОНИМНОЕ обращение (приёмка): не хранит связь с пользователем —
//    после отправки только подтверждение по номеру, в списке его нет,
//    карточка /feedback/<номер> отвечает 404 всем;
//  - изоляция: студент видит только свои обращения, чужой номер — 404,
//    сотруднику раздел недоступен;
//  - 1440 px: две панели; 360 px: тот же экран колонкой.
//
// Изоляция состояния (memory-стор общий для параллельных проектов):
//  - desktop-1440 работает с Анной (serial-группа: подписанное обращение
//    создаётся и проверяется в одном тесте);
//  - mobile-360 работает с Ильёй; параллельные прогоны не конфликтуют.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
const ILYA = { login: 'ilya.petrov', password: 'ilya-demo-2026' };
const DEAN = { login: 'dean.kovaleva', password: 'dean-demo-2026' };

const isDesktop = () => test.info().project.name === 'desktop-1440';

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

test.describe.serial('DIG-40: экран обратной связи (Анна, desktop)', () => {
  let submissionNumber = '';

  test('меню: пункт «Обратная связь» с понятным названием ведёт на /feedback', async ({ page }) => {
    test.skip(!isDesktop(), 'боковое меню — только в desktop-проекте');
    await signIn(page, ANNA.login, ANNA.password, '/feedback');
    await expect(page).toHaveURL(/\/feedback$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Обратная связь руководству' }),
    ).toBeVisible();

    // В боковом меню нет пунктов с непонятным названием канала.
    const nav = page.getByRole('navigation', { name: 'Разделы кабинета' });
    await expect(nav.getByRole('link', { name: 'Обратная связь' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /выразительная/i })).toHaveCount(0);
  });

  test('экран: обещание срока, лента «Что мы изменили», свои обращения', async ({ page }) => {
    test.skip(!isDesktop(), 'сид-состояние закреплено за desktop-проектом');
    await signIn(page, ANNA.login, ANNA.password, '/feedback');

    // Обещание срока ответа (текст задачи).
    await expect(page.getByTestId('feedback-sla')).toHaveText(
      'Рассматриваем обращения в течение 3 рабочих дней',
    );

    // Свои обращения из сидов: тип, адресат, номер, статус, срок.
    const list = page.getByTestId('feedback-list');
    await expect(list).toBeVisible();
    await expect(list.getByText('Предложение · Деканат').first()).toBeVisible();
    await expect(list.getByText('На рассмотрении').first()).toBeVisible();

    // Публичная лента решённых предложений — 3 примера из сидов.
    const outcomes = page.getByTestId('feedback-outcomes');
    await expect(
      outcomes.getByRole('heading', { name: 'Что мы изменили по вашим предложениям' }),
    ).toBeVisible();
    await expect(outcomes.locator('li')).toHaveCount(3);
    await expect(
      outcomes.getByText('Запись появилась в разделе «Связь с деканатом»'),
    ).toBeVisible();
    await expect(
      outcomes.getByText('Срок готовности теперь виден при заказе и на карточке заявки'),
    ).toBeVisible();
    await expect(outcomes.getByText('В расписании появился выбор корпуса')).toBeVisible();
  });

  test('композер: «Анонимно» объясняет, что увидит адресат (переключение)', async ({ page }) => {
    test.skip(!isDesktop(), 'переключатель проверяется на desktop');
    await signIn(page, ANNA.login, ANNA.password, '/feedback');

    const note = page.getByTestId('feedback-anonymous-note');
    await expect(note).toContainText('имя и учебную группу');
    // Переключатель — чекбокс формы; кликаем по видимой подписи (label).
    await page.getByText('Анонимно', { exact: true }).click();
    await expect(note).toContainText('без вашего имени');
    await expect(note).toContainText('не связано с вашим аккаунтом');
    await expect(page.getByTestId('feedback-anonymous')).toBeChecked();
    await page.getByText('Анонимно', { exact: true }).click();
    await expect(note).toContainText('имя и учебную группу');
    await expect(page.getByTestId('feedback-anonymous')).not.toBeChecked();
  });

  test('подписанное предложение: создание → карточка с номером, статусом и сроком', async ({
    page,
  }) => {
    test.skip(!isDesktop(), 'создание закреплено за desktop-проектом');
    await signIn(page, ANNA.login, ANNA.password, '/feedback');

    await page.getByTestId('feedback-kind').selectOption('SUGGESTION');
    await page.getByTestId('feedback-target').selectOption('ACADEMIC_OFFICE');
    await page
      .getByTestId('feedback-text')
      .fill('Добавьте, пожалуйста, напоминание о дедлайне оплаты за общежитие в календарь.');
    await page.getByRole('button', { name: 'Отправить обращение' }).click();

    // Редирект в карточку нового обращения: номер + срок ответа (текст задачи).
    await page.waitForURL(/\/feedback\/FB-\d{4}-[A-Z0-9]{5}$/);
    submissionNumber = page.url().split('/').pop()!;
    const card = page.getByTestId('feedback-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Предложение · Учебный офис');
    await expect(page.getByTestId('feedback-card-number')).toContainText(submissionNumber);
    await expect(card.getByTestId('feedback-status')).toHaveText('На рассмотрении');
    await expect(page.getByTestId('feedback-card-due')).toContainText(/^до \d{1,2} \S+$/);

    // Обращение появилось в списке «Мои обращения».
    await page.goto('/feedback');
    await expect(page.getByTestId(`feedback-item-${submissionNumber}`)).toBeVisible();
  });

  test('изоляция: чужой номер неотличим от несуществующего (404)', async ({ page }) => {
    test.skip(!isDesktop(), 'изоляция проверяется на desktop');
    await signIn(page, ANNA.login, ANNA.password, '/feedback');

    // FB-2026-RB53D — сид-жалоба Ильи; ответ тот же 404, что и для мусора.
    await page.goto('/feedback/FB-2026-RB53D');
    await expect(page.locator('body')).toContainText(/404|не найден|не существует/i);
    await page.goto('/feedback/FB-2026-ZZZZZ');
    await expect(page.locator('body')).toContainText(/404|не найден|не существует/i);
  });

  test('сотруднику раздел недоступен', async ({ page }) => {
    test.skip(!isDesktop(), 'роль-контракт проверяется на desktop');
    await signIn(page, DEAN.login, DEAN.password, '/feedback');
    await expect(page.getByText('Доступно студентам')).toBeVisible();
    await expect(page.getByTestId('feedback-list')).toHaveCount(0);
    await expect(page.getByTestId('feedback-composer')).toHaveCount(0);
  });

  test('АНОНИМНОЕ обращение: подтверждение по номеру, без связи с пользователем', async ({
    page,
  }) => {
    test.skip(!isDesktop(), 'анонимный сценарий закреплён за desktop-проектом');
    await signIn(page, ANNA.login, ANNA.password, '/feedback');

    await page.getByTestId('feedback-kind').selectOption('COMPLAINT');
    await page.getByTestId('feedback-target').selectOption('UNIVERSITY_MANAGEMENT');
    await page
      .getByTestId('feedback-text')
      .fill('Прошу проверить освещение у входа в третий корпус вечером.');
    await page.getByText('Анонимно', { exact: true }).click();
    await page.getByRole('button', { name: 'Отправить обращение' }).click();

    // Редирект на подтверждение по номеру (НЕ в карточку).
    await page.waitForURL(/\/feedback\/sent\/FB-\d{4}-[A-Z0-9]{5}$/);
    const anonNumber = page.url().split('/').pop()!;
    const sent = page.getByTestId('feedback-sent');
    await expect(sent).toBeVisible();
    await expect(page.getByTestId('feedback-sent-number')).toHaveText(anonNumber);
    await expect(sent.getByTestId('feedback-status')).toHaveText('На рассмотрении');
    await expect(page.getByTestId('feedback-sent-due')).toContainText(/^до \d{1,2} \S+$/);
    // Пояснение анонимности и никаких пользовательских данных.
    await expect(sent).toContainText('не связано с вашим аккаунтом');
    await expect(sent).not.toContainText('Анна');
    await expect(sent).not.toContainText('освещение');

    // Анонимного обращения нет в списке «Мои обращения»…
    await page.goto('/feedback');
    await expect(page.getByTestId(`feedback-item-${anonNumber}`)).toHaveCount(0);
    // …и карточка по его номеру отвечает 404 всем (включая автора сессии).
    await page.goto(`/feedback/${anonNumber}`);
    await expect(page.locator('body')).toContainText(/404|не найден|не существует/i);

    // Сид-анонимное из демо-данных тоже неотслеживаемо по карточке.
    await page.goto('/feedback/FB-2026-QA77X');
    await expect(page.locator('body')).toContainText(/404|не найден|не существует/i);
  });

  test('360 px: экран колонкой, композер доступен, лента видна', async ({ page }) => {
    test.skip(isDesktop(), 'мобильный сценарий — только в mobile-360');
    await signIn(page, ILYA.login, ILYA.password, '/feedback');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Обратная связь руководству' }),
    ).toBeVisible();
    await expect(page.getByTestId('feedback-list')).toBeVisible();
    await expect(page.getByTestId('feedback-composer')).toBeVisible();
    await expect(page.getByTestId('feedback-outcomes').locator('li')).toHaveCount(3);

    // «Ещё» содержит пункт с понятным названием.
    await page.goto('/more');
    await expect(page.getByRole('link', { name: 'Обратная связь' })).toBeVisible();

    // Жалоба Ильи из сидов видна в его списке (свой контакт owner-scoped).
    await page.goto('/feedback');
    await expect(page.getByText('Жалоба · Руководство вуза')).toBeVisible();
    await expect(page.getByTestId('feedback-list')).not.toContainText('Предложение · Деканат');
  });
});
