import { expect, test, type Page } from '@playwright/test';

// DIG-39 — e2e «Обращения в деканат» (чёрный ящик):
//  - список: тема, номер, статус (Открыто / Ждём вас / Решено), последний
//    ответ («Менеджер: …»), время (сегодня → ЧЧ:ММ, вчера → «Вчера»),
//    точка непрочитанного ответа менеджера, обещание «1 рабочий день»;
//  - чат: сообщения студента и менеджера (аватар, ФИО, «Менеджер
//    программы»), вложения (имена файлов), «Прочитано» на реплике студента,
//    привязка к заявке/дисциплине;
//  - композер: 5 тем, подсказки FAQ («Возможно, это ответ на ваш вопрос»),
//    вложения, привязка к дисциплине; создание → редирект в чат; ответ в чате;
//  - уведомление: непрочитанный ответ менеджера поднимает счётчик на
//    колокольчике (полный цикл «ответ менеджера → уведомление» покрыт
//    юнит-тестами appendManagerMessage — сотрудничий UI появится в DIG-48);
//  - изоляция: студент видит только свои обращения, чужой номер — 404,
//    сотруднику раздел недоступен;
//  - 1440 px: две панели (список + чат); 360 px: чат — отдельный экран.
//
// Изоляция состояния (memory-стор общий для параллельных проектов):
//  - desktop-1440 работает с Анной (serial-группа: точка непрочитанного
//    гаснет при открытии чата, поэтому-sensitive шаги — в одном тесте);
//  - mobile-360 работает с Ильёй; композер создаёт тикеты тому пользователю,
//    который закреплён за проектом, — параллельные прогоны не конфликтуют.

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

test.describe.serial('DIG-39: список и чат обращения (Анна)', () => {
  let ticketNumber = '';

  test('список: SLA, статусы, точка непрочитанного, уведомление', async ({ page }) => {
    test.skip(!isDesktop(), 'точка непрочитанного живёт только в desktop-проекте');
    await signIn(page, ANNA.login, ANNA.password, '/deanery');
    await expect(page).toHaveURL(/\/deanery$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Обращения в деканат' }),
    ).toBeVisible();

    // Обещание срока ответа — на списке (дословно из задачи).
    await expect(page.getByTestId('deanery-sla')).toHaveText(
      'Обычно отвечаем в течение 1 рабочего дня',
    );

    const list = page.getByTestId('deanery-list');
    await expect(list).toBeVisible();

    // Обращение «Ждём вас»: непрочитанный ответ менеджера — точкой,
    // предпросмотр последнего ответа со словом «Менеджер:», время «Вчера».
    const answered = list.locator('li').filter({ has: page.getByTestId('ticket-unread') });
    await expect(answered).toHaveCount(1);
    await expect(answered.getByText('Ждём вас', { exact: true })).toBeVisible();
    await expect(answered).toContainText('Менеджер:');
    await expect(answered).toContainText('Вчера');
    ticketNumber = (await answered.locator('a').getAttribute('href'))!.split('/').pop()!;
    expect(ticketNumber).toMatch(/^TS-\d{4}-[A-Z0-9]{5}$/);

    // Есть обращение в статусе «Открыто»: предпросмотр «Вы:», время ЧЧ:ММ
    // (параллельный композер-тест может добавить Анне ещё одно «Открыто» —
    // поэтому assertions не привязаны к точному количеству).
    const openTickets = list.locator('li').filter({ hasText: 'Открыто' });
    await expect(openTickets.first()).toBeVisible();
    await expect(openTickets.first()).toContainText('Вы:');
    await expect(openTickets.first()).toContainText(/\d{2}:\d{2}/);
    await expect(list.getByTestId('ticket-unread')).toHaveCount(1);

    // Уведомление о новом сообщении менеджера: непрочитанный счётчик
    // на колокольчике (полный цикл ответ→уведомление — unit-тесты слоя данных).
    const badge = page.getByTestId('unread-count').first();
    await expect(badge).toBeVisible();
    expect(Number(await badge.textContent())).toBeGreaterThanOrEqual(1);
  });

  test('чат: менеджер, вложения, «Прочитано», привязка к заявке', async ({ page }) => {
    test.skip(!isDesktop(), 'точка непрочитанного живёт только в desktop-проекте');
    await signIn(page, ANNA.login, ANNA.password, '/deanery');
    await page.getByTestId(`deanery-ticket-${ticketNumber}`).click();
    await page.waitForURL(new RegExp(`/deanery/${ticketNumber}$`));

    const chatSection = page.locator(`[aria-label="Обращение ${ticketNumber}"]`);
    await expect(chatSection.getByRole('heading', { level: 1, name: 'Другое' })).toBeVisible();
    // Обещание срока — и в чате.
    await expect(chatSection.getByTestId('deanery-chat-sla')).toContainText(
      'Обычно отвечаем в течение 1 рабочего дня',
    );
    // Привязка к СВОЕЙ заявке (номер SR-… виден в шапке чата).
    await expect(chatSection.getByText('Заявка:')).toBeVisible();
    await expect(chatSection.getByText(/^SR-\d{4}-[A-Z0-9]{5}$/)).toBeVisible();

    const chat = page.getByTestId('ticket-chat');
    // Сообщения — li[data-testid^="ticket-message-"] (чип вложения — вложенный li).
    const message = chat.locator('li[data-testid^="ticket-message-"]');
    // Реплика менеджера: ФИО + подпись роли «Менеджер программы» + вложение.
    const staffMessage = message.filter({ hasText: 'Менеджер программы' });
    await expect(staffMessage).toHaveCount(1);
    await expect(staffMessage).toContainText('Мария Ковалёва');
    await expect(staffMessage).toContainText('Заявление принято в работу');
    await expect(
      staffMessage.getByTestId('ticket-attachment').filter({ hasText: 'скан-заявления.pdf' }),
    ).toBeVisible();
    // Реплика студента: вложение и статус «Прочитано» (менеджер её видел).
    const studentMessage = message.filter({ hasText: 'справка-с-места-учёбы.pdf' });
    await expect(studentMessage).toContainText('Анна Смирнова');
    await expect(studentMessage.getByTestId('message-read')).toHaveText('Прочитано');

    // Десктоп ≥1024 px: две панели — слева список обращений, справа чат.
    const aside = page.getByTestId('deanery-chat-aside');
    await expect(aside).toBeVisible();
    const asideBox = await aside.boundingBox();
    const chatBox = await chat.boundingBox();
    expect(asideBox!.x).toBeLessThan(chatBox!.x);
    // После открытия чата точка непрочитанного гаснет (ответ прочитан).
    await expect(aside.getByTestId('ticket-unread')).toHaveCount(0);
  });
});

test.describe('DIG-39: композер нового обращения', () => {
  test('подсказки FAQ, создание с вложением и привязкой, ответ в чате', async ({ page }) => {
    const isAnna = isDesktop();
    const user = isAnna ? ANNA : ILYA;
    await signIn(page, user.login, user.password, '/deanery');

    const composer = page.getByTestId('deanery-composer');
    await expect(composer).toBeVisible();
    // Обещание срока дублируется в композере.
    await expect(composer).toContainText('Обычно отвечаем в течение 1 рабочего дня');

    // Тема — из фиксированного списка (ровно 5 тем из задачи).
    const subject = page.getByTestId('ticket-subject');
    expect(await subject.locator('option').count()).toBe(5);
    await subject.selectOption({ label: 'Оценки' });

    // Подсказки FAQ по набранному тексту: «Возможно, это ответ на ваш вопрос».
    await page
      .getByTestId('ticket-body')
      .fill('Здравствуйте! Проверьте, пожалуйста, оценку в зачётке за проект по базам данных.');
    const hints = page.getByTestId('faq-hints');
    await expect(hints).toContainText('Возможно, это ответ на ваш вопрос');
    await expect(hints).toContainText('Что делать, если в зачётке ошибка в оценке');

    // Привязка к дисциплине СВОЕЙ группы (Анна: ПИ-21 → «Базы данных»).
    const disciplineSelect = page.getByTestId('ticket-discipline');
    if (isAnna) {
      await disciplineSelect.selectOption({ label: 'Базы данных' });
    }

    // Вложение (прототип хранит только имя файла).
    await page.getByTestId('ticket-attachments').setInputFiles({
      name: 'skrinshot-zachetki.png',
      mimeType: 'image/png',
      buffer: Buffer.from('png-mock'),
    });

    await page.getByRole('button', { name: 'Создать обращение' }).click();
    await page.waitForURL(/\/deanery\/TS-\d{4}-[A-Z0-9]{5}$/, { timeout: 15_000 });

    // Новый тикет открыт в чате: тема, текст, вложение, статус «Отправлено».
    const chat = page.getByTestId('ticket-chat');
    await expect(
      page
        .locator('[aria-label^="Обращение TS-"]')
        .getByRole('heading', { level: 1, name: 'Оценки' }),
    ).toBeVisible();
    await expect(chat).toContainText('Проверьте, пожалуйста, оценку в зачётке');
    await expect(
      chat.getByTestId('ticket-attachment').filter({ hasText: 'skrinshot-zachetki.png' }),
    ).toBeVisible();
    await expect(chat.getByTestId('message-sent').first()).toBeVisible();
    if (isAnna) {
      await expect(
        page.locator('[aria-label^="Обращение TS-"]').getByText('Дисциплина: PI21-DB'),
      ).toBeVisible();
    }

    // Мобильный: чат — отдельный экран (без левой панели), ссылка назад.
    if (isAnna) {
      await expect(page.getByTestId('deanery-chat-aside')).toBeVisible();
    } else {
      // aside рендерится и на мобильном, но скрыт CSS-ом (lg:flex) —
      // мобильный чат это отдельный экран со ссылкой назад к списку.
      await expect(page.getByTestId('deanery-chat-aside')).toBeHidden();
      await expect(page.getByRole('link', { name: '← Все обращения' })).toBeVisible();
    }

    // Ответ в чате своего обращения — сообщение появляется в переписке.
    await page
      .getByTestId('ticket-reply')
      .getByLabel('Сообщение')
      .fill('Уточнение: на защите объявили 90 баллов, прикладываю скриншот.');
    await page.getByTestId('ticket-reply').getByRole('button', { name: 'Отправить' }).click();
    await expect(page.getByTestId('ticket-chat')).toContainText('на защите объявили 90 баллов');
  });
});

test.describe('DIG-39: изоляция данных и роли', () => {
  test('студент видит только свои обращения; чужой номер — 404', async ({ page }) => {
    test.skip(!isDesktop(), 'IDOR-контракт проверяется в desktop-проекте');

    // Илья читает номер СВОЕГО обращения из своего списка (случайный за запуск).
    const ilya = await page.context().browser()!.newContext();
    const ilyaPage = await ilya.newPage();
    await signIn(ilyaPage, ILYA.login, ILYA.password, '/deanery');
    const ownLink = ilyaPage.locator('main a[href^="/deanery/TS-"]').first();
    await expect(ownLink).toBeVisible();
    const ilyaNumber = (await ownLink.getAttribute('href'))!.split('/').pop()!;
    expect(ilyaNumber).toMatch(/^TS-\d{4}-[A-Z0-9]{5}$/);
    // У Ильи обращение «Решено» и непрочитанных ответов нет.
    await expect(ilyaPage.getByTestId('deanery-list').getByText('Решено')).toBeVisible();
    await expect(ilyaPage.getByTestId('ticket-unread')).toHaveCount(0);
    // Свой чат Ильи открывается: реплика менеджера видна.
    await ownLink.click();
    await expect(ilyaPage.getByTestId('ticket-chat')).toContainText('Заявление на перевод');
    await ilyaPage.close();
    await ilya.close();

    // Анне чужой номер недоступен: в списке его нет, по URL — 404.
    await signIn(page, ANNA.login, ANNA.password, '/deanery');
    const annaHrefs = await page.locator('main a[href^="/deanery/TS-"]').all();
    for (const link of annaHrefs) {
      expect(await link.getAttribute('href')).not.toContain(ilyaNumber);
    }
    const res = await page.goto(`/deanery/${ilyaNumber}`);
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Страница не найдена' }),
    ).toBeVisible();

    // Несуществующий номер отвечает ровно так же (нет оракула существования).
    const missing = await page.goto('/deanery/TS-2026-ZZZZZ');
    expect(missing?.status()).toBe(404);

    // Некорректный percent-encoding не должен давать 500 (раунд 2 ревью
    // DIG-39). Наблюдаемое поведение по слоям: битые последовательности
    // («%zz», «%E0%A4%A») отсекает сам Next — 400 Bad Request до страницы;
    // защитный try/catch в page переводит любой остаточный URIError от
    // decodeURIComponent в тот же контрактный 404 (unit: deanery-page).
    const malformed = await page.goto('/deanery/%E0%A4%A');
    expect([400, 404]).toContain(malformed?.status());
  });

  test('сотруднику раздел недоступен: «Доступно студентам»', async ({ page }) => {
    test.skip(!isDesktop(), 'роль сотрудника проверяется в desktop-проекте');
    await signIn(page, DEAN.login, DEAN.password, '/deanery');
    await expect(page.getByText('Доступно студентам')).toBeVisible();
    await expect(page.getByTestId('deanery-list')).toHaveCount(0);
    await expect(page.getByTestId('deanery-composer')).toHaveCount(0);
  });
});
