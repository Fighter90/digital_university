import { expect, test, type Page } from '@playwright/test';

// DIG-37 — e2e «Справочник» (чёрный ящик, прод-контракт):
//  - список людей с поиском (ФИО/дисциплина/подразделение) и фильтрами
//    «Мои преподаватели» / «Мой деканат» / «Все»;
//  - карточка человека: контакты, часы консультаций, дисциплины, ближайшие
//    пары, «Написать письмо» (mailto) и заглушка консультации;
//  - «Ваш менеджер» у менеджера программы студента;
//  - переходы из детали пары (карточка пары), карточки дисциплины и заявки;
//  - 360 px: карточки в одну колонку; 1440 px — в две.
// Данные фиктивные и статичные, состояние тесты не меняют — параллельные
// проекты безопасны.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
const ILYA = { login: 'ilya.petrov', password: 'ilya-demo-2026' };

/** Вход тестового студента. Серверный экшен входа может подвиснуть в
 *  pending («Входим…») на нагруженной машине (урок DIG-50) — повторяем
 *  весь заход через toPass, как в e2e/schedule.spec.ts. */
async function signIn(page: Page, login: string, password: string, next?: string) {
  const target = next ?? '/dashboard';
  await expect(async () => {
    await page.goto(`/login?next=${encodeURIComponent(target)}`);
    await page.getByLabel('Логин').fill(login);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL((u) => u.pathname === new URL(target, page.url()).pathname, {
      timeout: 10_000,
    });
  }).toPass({ timeout: 60_000 });
}

test.describe('DIG-37: справочник людей', () => {
  test('поиск, фильтры и карточки списка', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/people');
    await expect(page).toHaveURL(/\/people$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Справочник' })).toBeVisible();

    // Поиск по подразделению: «деканат» оставляет только сотрудников деканата.
    const search = page.getByTestId('people-search');
    await expect(search).toHaveAttribute('placeholder', 'ФИО, email или телефон…');
    await search.fill('деканат');
    const list = page.getByTestId('people-list');
    await expect(list.getByTestId(/^person-card-/)).toHaveCount(5);
    await expect(page.getByTestId('person-card-teacher-petrov')).toHaveCount(0);

    // Поиск по дисциплине: «базы данных» находит Соколова.
    await search.fill('базы данных');
    await expect(page.getByTestId('person-card-teacher-sokolov')).toBeVisible();

    // Мусорный запрос — пустое состояние «Ничего не найдено» (DIG-102).
    await search.fill('астронавт');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();

    // Фильтр «Мои преподаватели»: у Анны преподаватели группы ПИ-21 —
    // ровно пять, «свои» поверх по алфавиту (сценарий спеки «фильтр
    // „Мои преподаватели"», ревью DIG-37 r5 — точный набор, не «>= 3»).
    await search.fill('');
    await page
      .getByTestId('people-filters')
      .getByRole('button', { name: 'Мои преподаватели' })
      .click();
    const teacherIds = await list
      .getByTestId(/^person-card-/)
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(teacherIds).toEqual([
      'person-card-teacher-ivanova',
      'person-card-teacher-kuznetsova',
      'person-card-teacher-orlov',
      'person-card-teacher-petrov',
      'person-card-teacher-sokolov',
    ]);

    // Фильтр «Мой деканат» — только деканат факультета ИТ.
    await page.getByTestId('people-filters').getByRole('button', { name: 'Мой деканат' }).click();
    const deaneryIds = await list
      .getByTestId(/^person-card-/)
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(deaneryIds).toContain('person-card-staff-kovaleva');
    expect(deaneryIds).not.toContain('person-card-staff-gavrilov');

    // «Ваш менеджер» у менеджера программы Анны.
    await page.getByTestId('people-filters').getByRole('button', { name: 'Все' }).click();
    await expect(
      page.getByTestId('person-card-staff-belova').getByText('Ваш менеджер'),
    ).toBeVisible();

    // DIG-102 — вкладка «★ Избранное»: у Анны избранное пустое — честный
    // empty-state (чтение без мутаций, параллельные проекты безопасны).
    await page
      .getByTestId('people-filters')
      .getByRole('button', { name: '★ Избранное' })
      .click();
    await expect(page.getByTestId('people-fav-empty')).toBeVisible();
    await expect(page.getByText('В избранном пока никого')).toBeVisible();
  });

  test('карточка преподавателя: контакты, консультации, пары, действия', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/people');
    await page.getByTestId('person-card-teacher-ivanova').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/people\/teacher-ivanova$/);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Иванова Ирина Игоревна' }),
    ).toBeVisible();
    // Контакты: почта, кабинет, телефон.
    const contacts = page.getByTestId('person-contacts');
    await expect(contacts).toContainText('irina.ivanova@example.edu');
    await expect(contacts).toContainText('ауд. 405');
    // Часы консультаций.
    await expect(page.getByTestId('person-consultation')).toContainText('Ср 15:00–17:00');
    // Дисциплины с пометкой «ваша».
    const disciplines = page.getByTestId('person-disciplines');
    await expect(disciplines).toContainText('Программирование');
    await expect(disciplines).toContainText('ваша');
    // Кнопки: письмо (mailto) и заглушка консультации.
    await expect(page.getByTestId('person-mailto')).toHaveAttribute(
      'href',
      'mailto:irina.ivanova@example.edu',
    );
    await expect(page.getByTestId('person-consultation-stub')).toBeDisabled();
    // Ближайшие пары группы студента с этим преподавателем.
    const upcoming = page.getByTestId('person-upcoming');
    await expect(upcoming).toBeVisible();
    await expect(upcoming).toContainText('Программирование');
    // Клик по паре ведёт к дню расписания.
    await upcoming.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/schedule\?view=day&date=\d{4}-\d{2}-\d{2}$/);
  });

  test('менеджер программы помечен «Ваш менеджер» на карточке', async ({ page }) => {
    // desktop → Анна (ИТ: Белова), mobile → Илья (ЭК: Романова).
    const isDesktop = test.info().project.name === 'desktop-1440';
    const managerId = isDesktop ? 'staff-belova' : 'staff-romanova';
    await signIn(
      page,
      isDesktop ? ANNA.login : ILYA.login,
      isDesktop ? ANNA.password : ILYA.password,
      `/people/${managerId}`,
    );
    await expect(page.getByTestId('person-manager-badge')).toContainText('Ваш менеджер');
    // У менеджера программы секции «Ближайшие пары» нет вовсе — ни списка,
    // ни заголовка с пустым состоянием (ревью DIG-37 r5, спека «карточка
    // сотрудника»: секций «Ближайшие пары» нет).
    await expect(page.getByTestId('person-upcoming')).toHaveCount(0);
    await expect(page.getByTestId('person-upcoming-title')).toHaveCount(0);
    await expect(page.getByTestId('person-upcoming-empty')).toHaveCount(0);
  });

  // Requirement «Навигация» (ревью DIG-37 r5 — поведение обязано иметь тест):
  // desktop — пункт бокового меню, mobile — пункт страницы «Ещё»; оба ведут
  // на /people.
  test('пункт меню «Справочник» ведёт на /people', async ({ page }) => {
    const isDesktop = test.info().project.name === 'desktop-1440';
    if (isDesktop) {
      await signIn(page, ANNA.login, ANNA.password, '/people');
      const link = page
        .getByRole('navigation', { name: 'Разделы кабинета' })
        .getByRole('link', { name: 'Справочник' });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', '/people');
      await link.click();
      await expect(page).toHaveURL(/\/people$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Справочник' })).toBeVisible();
      return;
    }
    await signIn(page, ANNA.login, ANNA.password, '/more');
    const link = page.getByRole('link', { name: 'Справочник' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/people');
    await link.click();
    await expect(page).toHaveURL(/\/people$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Справочник' })).toBeVisible();
  });

  test('переход из карточки дисциплины в справочник', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/grades');
    // Зачётка: семестр «Весна 2025/26» (аккордеон) → строка дисциплины.
    await page.goto('/grades/gradebook');
    const accordion = page.getByTestId('semester-accordion-2025-spring');
    if ((await accordion.getAttribute('open')) === null) {
      await accordion.locator('summary').click();
    }
    const isDesktop = test.info().project.name === 'desktop-1440';
    const disciplineLink = isDesktop
      ? page
          .getByTestId('gradebook-row-PI21-ALG')
          .getByRole('link', { name: 'Алгоритмы и структуры данных' })
      : page.getByTestId('gradebook-card-PI21-ALG');
    await disciplineLink.click();
    await expect(page).toHaveURL(/\/grades\/PI21-ALG$/);
    const teacherLink = page.getByTestId('discipline-teacher-link');
    await expect(teacherLink).toHaveAttribute('href', '/people/teacher-ivanova');
    await teacherLink.click();
    await expect(page).toHaveURL(/\/people\/teacher-ivanova$/);
  });

  test('переход из карточки пары расписания в справочник', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/schedule?view=day');
    // Демо-сид «сегодня»: семинар «История» (онлайн) с Орловым. Вид «день»
    // рендерит и десктопный, и мобильный список (data-view="auto") — скоупим
    // по видимому контейнеру проекта.
    const isDesktop = test.info().project.name === 'desktop-1440';
    const container = isDesktop
      ? page.getByTestId('desktop-day')
      : page.getByTestId('mobile-day-list');
    const card = container.getByTestId('day-card-sch-pi21-6');
    await expect(card).toBeVisible();
    await card.getByTestId('event-teacher-sch-pi21-6').click();
    await expect(page).toHaveURL(/\/people\/teacher-orlov$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Орлов Олег Олегович' }),
    ).toBeVisible();
  });

  test('переход из заявки к карточке сотрудника деканата', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/requests');
    // Заявка Анны с историей, где действовала Мария Ковалёва.
    await page.getByRole('link', { name: /Заявление на место в общежитии/ }).click();
    await expect(page).toHaveURL(/\/requests\//);
    const actorLink = page.getByRole('link', { name: 'Мария Ковалёва' }).first();
    await expect(actorLink).toBeVisible();
    await actorLink.click();
    await expect(page).toHaveURL(/\/people\/staff-kovaleva$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Мария Ковалёва' })).toBeVisible();
  });

  test('неизвестный человек отвечает 404', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/people');
    const response = await page.goto('/people/teacher-hacker');
    expect(response?.status()).toBe(404);
  });
});

test.describe('DIG-37: адаптивность справочника', () => {
  test('1440 px: карточки в две колонки', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, ANNA.login, ANNA.password, '/people');
    const list = page.getByTestId('people-list');
    await expect(list).toBeVisible();
    const xs = await list
      .getByTestId(/^person-card-/)
      .evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().x));
    expect(xs.length).toBeGreaterThanOrEqual(2);
    // Вторая карточка правее первой — колонок больше одной.
    expect(xs[1]).toBeGreaterThan(xs[0]);
  });

  test('360 px: карточки в одну колонку, фильтры в одну строку', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, ANNA.login, ANNA.password, '/people');
    const list = page.getByTestId('people-list');
    await expect(list).toBeVisible();
    const xs = await list
      .getByTestId(/^person-card-/)
      .evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().x));
    expect(xs.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(xs[0] - xs[1])).toBeLessThan(2);
    // Пилюли фильтров не переносятся на вторую строку (все на одном y).
    const ys = await page
      .getByTestId('people-filters')
      .getByRole('button')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y));
    expect(ys.length).toBe(3);
    expect(new Set(ys).size).toBe(1);
  });
});
