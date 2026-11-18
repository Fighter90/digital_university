import { expect, test, type Page } from '@playwright/test';

// DIG-36 — e2e «Новости и объявления» (чёрный ящик):
//  - дефолтная вкладка «Моя группа»: только новости группы студента,
//    чужие (другая группа/факультет) не видны;
//  - полоса объявлений «Важно»: у посещённого — «Прочитано», открытие
//    новости помечает её прочитанной (после возврата в ленту);
//  - фильтр тем пилюлями (совместно со скоупом), пустое состояние;
//  - страница новости: дата, автор, вложение, «Поделиться ссылкой»;
//  - неизвестный id — 404;
//  - 360 px: карточки в одну колонку, пилюли скроллятся горизонтально;
//  - 1440 px: сетка в несколько колонок;
//  - сотруднику — факультетский скоуп по умолчанию.
//
// Изоляция состояния (memory-стор, проекты desktop/mobile параллельны):
// тесты, меняющие отметки «Прочитано», разбиты по парам «пользователь +
// новость» (desktop → Анна + scholarship-increased-docs, mobile → Илья +
// ek11-retake-window) и сводят состояние к известному в начале.

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

test.describe('DIG-36: лента новостей', () => {
  test('дефолт — вкладка «Моя группа», чужих новостей нет, полоса «Важно»', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/news');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Новости и объявления' }),
    ).toBeVisible();

    // Вкладки скоупа: «Моя группа» отмечена по умолчанию.
    const tabs = page.getByTestId('news-scope-tabs');
    await expect(tabs.getByRole('radio', { name: 'Моя группа' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Лента группы: карточка ПИ-21 видна, новости ЭК-11 и факультета ЭК — нет.
    await expect(page.getByTestId('news-card-pi21-lab-deadline')).toBeVisible();
    await expect(page.getByTestId('news-card-ek11-quiz')).toHaveCount(0);
    await expect(page.getByTestId('news-card-ek-roundtable')).toHaveCount(0);

    // Полоса объявлений «Важно»: посещённое объявление помечено «Прочитано».
    const strip = page.getByTestId('news-announcements');
    await expect(strip).toBeVisible();
    await expect(strip.getByText('Важно').first()).toBeVisible();
    const readCard = strip.getByTestId('news-announcement-retake-order');
    await expect(readCard).toBeVisible();
    await expect(readCard.getByTestId('news-read-badge')).toHaveText('Прочитано');
    await expect(readCard).not.toHaveAttribute('data-unread');
  });

  test('вкладки скоупа: «Весь вуз» показывает общий поток, тема сохраняется', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/news?topic=dormitory');
    await page.getByTestId('news-scope-tabs').getByRole('radio', { name: 'Весь вуз' }).click();
    await expect(page).toHaveURL(/\/news\?scope=university&topic=dormitory/);

    const grid = page.getByTestId('news-grid');
    await expect(grid.getByTestId('news-card-university-dorm-movein')).toBeVisible();
    // Скоуп вуза: чужая группа не появляется и здесь (это university-записи).
    await expect(page.getByTestId('news-card-ek11-quiz')).toHaveCount(0);
  });

  test('фильтр темы на вкладке группы: пустой результат показывает состояние', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/news');
    await page.getByTestId('news-topics').getByRole('link', { name: 'Общежитие' }).click();
    await expect(page).toHaveURL(/\/news\?topic=dormitory/);
    await expect(page.getByText('Новостей пока нет')).toBeVisible();
    // Возврат ко «Все» возвращает ленту группы.
    await page.getByTestId('news-topics').getByRole('link', { name: 'Все', exact: true }).click();
    await expect(page.getByTestId('news-card-pi21-lab-deadline')).toBeVisible();
  });

  test('открытие новости помечает её прочитанной (desktop → Анна + стипендия)', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, ANNA.login, ANNA.password, '/news?scope=university');

    // Сводим состояние к известному: memory-стор пересоздаётся на каждый
    // прогон (прод-подобный сервер), сид Анны знает только retake-order —
    // объявление стипендии гарантированно непрочитанное.
    const strip = page.getByTestId('news-announcements');
    const card = strip.getByTestId('news-announcement-scholarship-increased-docs');
    await expect(card).toHaveAttribute('data-unread', 'true');

    // Открываем объявление…
    await card.click();
    await expect(page).toHaveURL(/\/news\/scholarship-increased-docs/);
    await expect(page.getByRole('heading', { level: 1, name: /стипенди/i })).toBeVisible();
    await expect(page.getByText('Отдел стипендий').first()).toBeVisible();

    // …возвращаемся в ленту — пометка «Прочитано» на месте.
    await page.getByTestId('news-back').click();
    await expect(page).toHaveURL(/\/news\?scope=university/);
    await expect(
      page
        .getByTestId('news-announcement-scholarship-increased-docs')
        .getByTestId('news-read-badge'),
    ).toHaveText('Прочитано');
  });

  test('открытие новости помечает её прочитанной (mobile → Илья + ЭК-11)', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, ILYA.login, ILYA.password, '/news');

    // Сводим состояние: у Ильи своё объявление ЭК-11 — сводим через открытие
    // (идемпотентно), затем проверяем пометку.
    const card = page.getByTestId('news-announcement-ek11-retake-window');
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/news\/ek11-retake-window/);
    await page.getByTestId('news-back').click();
    await expect(page).toHaveURL(/\/news$/);
    await expect(
      page.getByTestId('news-announcement-ek11-retake-window').getByTestId('news-read-badge'),
    ).toHaveText('Прочитано');
    // Аннино объявление ПИ-21 в ленте Ильи не протекает.
    await expect(page.getByTestId('news-announcement-retake-order')).toHaveCount(0);
  });

  test('страница новости: вложение и «Поделиться ссылкой»', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/news/retake-order');
    await expect(page.getByRole('heading', { level: 1, name: /порядок пересдач/i })).toBeVisible();
    await expect(page.getByText('Мария Ковалёва').first()).toBeVisible();

    const attachment = page.getByTestId('news-attachments').getByRole('link').first();
    await expect(attachment).toBeVisible();
    await expect(attachment).toHaveAttribute('href', '/news/files/retake-order-2026.txt');

    const share = page.getByTestId('news-share');
    await expect(share).toBeVisible();
    await share.click();
    await expect(page.getByTestId('news-share-status')).toHaveText('Ссылка скопирована');
  });

  test('неизвестная новость — 404', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/news/no-such-news');
    await expect(page.getByText(/404|не найдена|не существует/i).first()).toBeVisible();
  });

  test('сотруднику — факультетский скоуп по умолчанию', async ({ page }) => {
    await signIn(page, DEAN.login, DEAN.password, '/news');
    const tabs = page.getByTestId('news-scope-tabs');
    await expect(tabs.getByRole('radio', { name: 'Мой факультет' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('news-card-it-hackathon')).toBeVisible();
    // Чужой факультет не протекает.
    await expect(page.getByTestId('news-card-ek-roundtable')).toHaveCount(0);
  });
});

test.describe('DIG-36: адаптивность ленты', () => {
  test('1440 px: карточки в несколько колонок', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, ANNA.login, ANNA.password, '/news');
    const grid = page.getByTestId('news-grid');
    await expect(grid).toBeVisible();
    const xs = await grid
      .getByTestId(/^news-card-/)
      .evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().x));
    expect(xs.length).toBeGreaterThanOrEqual(2);
    expect(xs[1]).toBeGreaterThan(xs[0]);
  });

  test('360 px: карточки в одну колонку, пилюли тем скроллятся горизонтально', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, ANNA.login, ANNA.password, '/news');

    const grid = page.getByTestId('news-grid');
    await expect(grid).toBeVisible();
    const xs = await grid
      .getByTestId(/^news-card-/)
      .evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().x));
    expect(xs.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(xs[0] - xs[1])).toBeLessThan(2);

    const topics = page.getByTestId('news-topics');
    const scroll = await topics.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  });
});
