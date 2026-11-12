import { expect, test, type Page } from '@playwright/test';

// DIG-29 — e2e «Каталог сервисов» (чёрный ящик):
//  - каталог: карточки с сроком/форматом, поиск с подсветкой <mark>,
//    фильтр категорий пилюлями;
//  - избранное сохраняется на сервере (перезагрузка страницы), снятие;
//  - подборка «Часто нужно на N курсе» без дублей с избранным;
//  - ни одной услуги чужой роли (нет слова «абитуриент»);
//  - сотруднику — пустое состояние;
//  - 360 px: карточки в одну колонку, пилюли скроллятся горизонтально;
//  - 1440 px: сетка в несколько колонок.
//
// Изоляция состояния: прототип живёт на memory-сторе сервера, а проекты
// desktop-1440 и mobile-360 идут параллельно. Тесты, меняющие состояние,
// разбиты по парам «пользователь + сервис» (demo-студенты anna/ilya) так,
// чтобы параллельные тесты никогда не трогали одну и ту же строку, и каждый
// сводит своё состояние к известному в начале.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
const ILYA = { login: 'ilya.petrov', password: 'ilya-demo-2026' };
const DEAN = { login: 'dean.kovaleva', password: 'dean-demo-2026' };

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

test.describe('DIG-29: каталог сервисов', () => {
  test('карточки, поиск с подсветкой и фильтр категорий', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/services');
    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Каталог сервисов' })).toBeVisible();

    // Карточка документной услуги (в сетке каталога): срок, формат, «Заказать».
    const cert = page.getByTestId('services-grid').getByTestId('service-card-cert-enrollment');
    await expect(cert).toBeVisible();
    await expect(cert).toContainText('2–3 дня');
    await expect(cert).toContainText('PDF');
    await expect(cert.getByRole('link', { name: 'Заказать' })).toHaveAttribute(
      'href',
      '/requests?order=cert-enrollment',
    );

    // Мгновенная услуга открывается внутри кабинета (зачётка с выпиской).
    const instant = page
      .getByTestId('services-grid')
      .getByTestId('service-card-transcript-instant');
    await expect(instant).toContainText('Мгновенно');
    await expect(instant.getByRole('link', { name: 'Открыть' })).toHaveAttribute(
      'href',
      '/grades/gradebook',
    );

    // Поиск с подсветкой: вводим «общежит» — совпадения в <mark>.
    const search = page.getByTestId('services-search');
    await search.fill('общежит');
    await expect(page.locator('mark').first()).toBeVisible();
    // Сервисы без совпадений исчезают из сетки (подборка остаётся статичной).
    await expect(
      page.getByTestId('services-grid').getByTestId('service-card-cert-enrollment'),
    ).toHaveCount(0);
    await search.fill('');
    await expect(
      page.getByTestId('services-grid').getByTestId('service-card-cert-enrollment'),
    ).toBeVisible();

    // Пилюля категории фильтрует сетку (клики — строго по контейнеру пилюль).
    await page
      .getByTestId('services-categories')
      .getByRole('button', { name: 'Общежитие' })
      .click();
    await expect(
      page.getByTestId('services-grid').getByTestId('service-card-cert-enrollment'),
    ).toHaveCount(0);
    await expect(
      page.getByTestId('services-grid').getByTestId('service-card-dorm-residence-cert'),
    ).toBeVisible();
    await page.getByTestId('services-categories').getByRole('button', { name: 'Все' }).click();
    await expect(
      page.getByTestId('services-grid').getByTestId('service-card-cert-enrollment'),
    ).toBeVisible();
  });

  test('избранное сохраняется на сервере и снимается', async ({ page }) => {
    // desktop → Анна, mobile → Илья: параллельные проекты не делят строки.
    const isDesktop = test.info().project.name === 'desktop-1440';
    const user = isDesktop ? ANNA : ILYA;
    const serviceId = 'cert-enrollment';

    await signIn(page, user.login, user.password, '/services');

    // Сводим состояние к известному: звёздочка снята.
    const gridStar = page.getByTestId('services-grid').getByTestId(`favorite-toggle-${serviceId}`);
    if ((await gridStar.getAttribute('aria-pressed')) === 'true') {
      await gridStar.click();
      await expect(gridStar).toHaveAttribute('aria-pressed', 'false');
    }

    // Закрепляем звёздочкой на карточке каталога…
    await gridStar.click();
    await expect(gridStar).toHaveAttribute('aria-pressed', 'true');

    // …карточка появилась в блоке избранного…
    const favorites = page.getByTestId('services-favorites');
    await expect(favorites.getByTestId(`service-card-${serviceId}`)).toBeVisible();
    // …и «+ Добавить» доступен (до лимита 6).
    await expect(page.getByTestId('favorite-add')).toBeVisible();

    // ПЕРЕЗагрузка показывает то же самое — избранное на сервере.
    await page.reload();
    await expect(
      page.getByTestId('services-favorites').getByTestId(`service-card-${serviceId}`),
    ).toBeVisible();

    // Снятие звёздочки в блоке избранного убирает сервис (перезагрузка —
    // подтверждает, что сохранилось именно отсутствие).
    await page
      .getByTestId('services-favorites')
      .getByTestId(`favorite-toggle-${serviceId}`)
      .click();
    await page.reload();
    await expect(
      page.getByTestId('services-favorites').getByTestId(`service-card-${serviceId}`),
    ).toHaveCount(0);
  });

  test('подборка «Часто нужно на N курсе» без дублей с избранным', async ({ page }) => {
    // desktop → Илья (1 курс: «Заселение в общежитие»),
    // mobile → Анна (2 курса: «Справка для налогового вычета»).
    const isDesktop = test.info().project.name === 'desktop-1440';
    const user = isDesktop ? ILYA : ANNA;
    const serviceId = isDesktop ? 'dorm-checkin' : 'cert-tax';
    const heading = isDesktop ? 'Часто нужно на 1 курсе' : 'Часто нужно на 2 курсе';

    await signIn(page, user.login, user.password, '/services');
    const picks = page.getByTestId('services-picks');
    await expect(picks).toBeVisible();
    await expect(picks).toContainText(heading);

    // Сводим состояние: сервис не в избранном (иначе его нет и в подборке).
    const favorites = page.getByTestId('services-favorites');
    const favStar = favorites.getByTestId(`favorite-toggle-${serviceId}`);
    if ((await favStar.count()) > 0 && (await favStar.getAttribute('aria-pressed')) === 'true') {
      await favStar.click();
      await expect(favStar).toHaveAttribute('aria-pressed', 'false');
    }

    // Закрепляем сервис ПРЯМО из подборки.
    const pickCard = picks.getByTestId(`service-card-${serviceId}`);
    await expect(pickCard).toBeVisible();
    await pickCard.getByTestId(`favorite-toggle-${serviceId}`).click();

    // Появился в избранном и УШЁЛ из подборки — без дублей.
    await expect(favorites.getByTestId(`service-card-${serviceId}`)).toBeVisible();
    await expect(picks.getByTestId(`service-card-${serviceId}`)).toHaveCount(0);
    // Инвариант подборки: закреплённого сервиса в ней больше нет.
    const pickIds = await picks
      .getByTestId(/^service-card-/)
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(pickIds).not.toContain(`service-card-${serviceId}`);

    // Убираем за собой (нейтральное состояние для следующего прогона).
    await favorites.getByTestId(`favorite-toggle-${serviceId}`).click();
  });

  test('ни одной услуги не для роли студента', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/services');
    const content = await page.content();
    expect(content.toLowerCase()).not.toContain('абитуриент');
    expect(content).not.toContain('Личный кабинет абитуриента');
    expect(content).not.toContain('staff-schedule-editor');
  });

  test('сотруднику каталог недоступен: «Доступно студентам»', async ({ page }) => {
    await signIn(page, DEAN.login, DEAN.password, '/services');
    await expect(page.getByText('Доступно студентам')).toBeVisible();
    await expect(page.getByTestId('services-catalog')).toHaveCount(0);
    await expect(page.getByTestId('services-search')).toHaveCount(0);
  });
});

test.describe('DIG-29: адаптивность каталога', () => {
  test('1440 px: сетка карточек в несколько колонок', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, ANNA.login, ANNA.password, '/services');
    const grid = page.getByTestId('services-grid');
    await expect(grid).toBeVisible();
    const boxes = await grid
      .getByTestId(/^service-card-/)
      .evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().x));
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    // Вторая карточка правее первой — колонок больше одной.
    expect(boxes[1]).toBeGreaterThan(boxes[0]);
  });

  test('360 px: карточки в одну колонку, пилюли скроллятся горизонтально', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, ANNA.login, ANNA.password, '/services');

    // Карточки в одну колонку: x у первых двух совпадает.
    const grid = page.getByTestId('services-grid');
    await expect(grid).toBeVisible();
    const xs = await grid
      .getByTestId(/^service-card-/)
      .evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().x));
    expect(xs.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(xs[0] - xs[1])).toBeLessThan(2);

    // Пилюли категорий в одну строку с горизонтальным скроллом.
    const categories = page.getByTestId('services-categories');
    const scroll = await categories.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  });
});
