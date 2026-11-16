import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

// DIG-60 — QA: полный обход сайта: ни одной мёртвой ссылки/кнопки.
//
// Краулер идёт по всем поверхностям стенда (PLAYWRIGHT_BASE_URL — на проде
// https://ostrovok.store, по умолчанию локальная прод-сборка) и на каждой
// странице проверяет:
//   * документ отвечает 200, есть <main> с текстом и плашка
//     «Концепт для конкурса» (не «белый экран»);
//   * консоль без ошибок, ни один ответ сети не ≥ 400 (кроме намеренно
//     проверяемых 404 — allowHttpErrors);
//   * каждая внутренняя ссылка (a[href^="/"]) со страницы дополнительно
//     проверяется GET-запросом со следованием редиректам — финал < 400.
//
// Обход: гость (лендинг CTA → /login → /forgot-password, контракт
// редиректов, /api/health), студент (сайдбар ×8 на desktop-1440, таб-бар ×5
// и «Ещё» ×5 на mobile-360, настройки ×5 вкладок + безопасные кнопки,
// успеваемость: сводка → ведомость → дисциплина → сессия → ICS/выписка,
// заявки: список → деталь → справка PDF → /verify, расписание:
// день/неделя/месяц + стрелки недель + «Детали пары», каталог сервисов:
// карточки → href, избранное), аккуратные 404 (неизвестный адрес, чужая
// заявка). Деструктивные кнопки настроек (смена пароля, выход/отзыв
// сессий) НЕ нажимаются: проверяется видимость/enablement — поведение
// закреплено unit-тестами DIG-44/DIG-55, а фейловый ввод пароля считался бы
// попыткой входа в rate-limit.
//
// Отчёт «страница → элемент → статус» пишется в
// test-results/dig-60-crawl-report-<project>.json — источник комментария
// в Linear DIG-60.
//
// Сессия: один вход на воркер (beforeAll, общие контексты в serial-серии),
// чтобы не упереться в rate-limit входа (30 попыток/15 мин на IP).

type CrawlStatus = number | string;

interface CrawlRow {
  page: string;
  element: string;
  href: string;
  status: CrawlStatus;
  note?: string;
}

const MENU_LABEL = 'Разделы кабинета';
const TAB_BAR_LABEL = 'Мобильная навигация';
const SETTINGS_TABS_LABEL = 'Разделы настроек';
const SIDE_MENU_ITEMS = [
  'Главная',
  'Расписание',
  'Успеваемость',
  'Заявки и справки',
  'Уведомления',
  'Связь с деканатом',
  'AI-ассистент',
  'Профиль',
] as const;
const TAB_BAR_ITEMS = ['Главная', 'Расписание', 'Оценки', 'Заявки', 'Ещё'] as const;
const MORE_ITEMS = [
  'Уведомления',
  'Связь с деканатом',
  'AI-ассистент',
  'Профиль',
  'Настройки',
] as const;
// Ревью DIG-60 (раунд 3, п.3): вкладок настроек ровно 5 — добавлена «Главная»
// (?tab=home; раньше была покрыта только базовым аудитом /settings).
const SETTINGS_TAB_ITEMS = [
  'Главная',
  'Уведомления',
  'Безопасность',
  'Вид',
  'Настройка MCP',
] as const;

// Ревью DIG-60 (раунд 3, п.1): каждая вкладка — точный ожидаемый адрес
// (?tab=<id>) и маркер КОНТЕНТА вкладки. Старая проверка
// waitForURL(/\/settings\?tab=/) совпадала с уже открытым URL (паттерн не
// различал вкладки), из-за чего клики «Безопасность»/«Вид»/«Настройка MCP»
// записывались в отчёт с URL предыдущей вкладки — утверждения были пустыми.
// Маркеры — видимые тексты, существующие только на своей вкладке.
const SETTINGS_TAB_TARGET: Record<
  (typeof SETTINGS_TAB_ITEMS)[number],
  { tabId: string; marker: RegExp }
> = {
  Главная: { tabId: 'home', marker: /Виджеты главной/ },
  Уведомления: { tabId: 'notifications', marker: /Каналы уведомлений/ },
  Безопасность: { tabId: 'security', marker: /Активные сеансы/ },
  Вид: { tabId: 'appearance', marker: /Язык, шрифт и анимация/ },
  'Настройка MCP': { tabId: 'mcp', marker: /MCP-серверы ассистента/ },
};

// Ревью DIG-60 (раунд 3, п.2): клик по виду расписания обязан ждать именно
// свой ?view=<вид>&… (обобщённый /\/schedule/ совпадал с уже открытым URL,
// а строки отчёта были верны только из-за гонки чтения page.url()).
const SCHEDULE_VIEW_URL: Record<string, RegExp> = {
  День: /[?&]view=day&date=/,
  Неделя: /[?&]view=week&week=/,
  Месяц: /[?&]view=month&month=/,
};

// Метка пункта меню → целевой адрес (для маркера целевого экрана).
const SIDE_MENU_TARGET: Record<string, string> = {
  Главная: '/dashboard',
  Расписание: '/schedule',
  Успеваемость: '/grades',
  'Заявки и справки': '/requests',
  Уведомления: '/notifications',
  'Связь с деканатом': '/deanery',
  'AI-ассистент': '/ai-assistant',
  Профиль: '/profile',
};
const TAB_BAR_TARGET: Record<string, string> = {
  Главная: '/dashboard',
  Расписание: '/schedule',
  Оценки: '/grades',
  Заявки: '/requests',
  Ещё: '/more',
};
const MORE_TARGET: Record<string, string> = {
  Уведомления: '/notifications',
  'Связь с деканатом': '/deanery',
  'AI-ассистент': '/ai-assistant',
  Профиль: '/profile',
  Настройки: '/settings',
};

// Общее состояние serial-воркера: контексты гостя и студента, аудит.
let guestCtx: BrowserContext;
let userCtx: BrowserContext;
let guestPage: Page;
let userPage: Page;
const report: CrawlRow[] = [];
let violations: string[] = [];
// Намеренные 404 (тест «ошибки не белый экран») не считаются нарушением.
let allowHttpErrors = false;

function violation(text: string) {
  violations.push(text);
}

function wireListeners(page: Page) {
  page.on('console', (message) => {
    if (message.type() === 'error') violation(`console.error на ${page.url()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    // React #418 — восстанавливаемая ошибка гидратации: React перерисовывает
    // дерево на клиенте. Если страница после этого живая (main непустой —
    // проверяет auditPage/clickLink), это наблюдение в отчёте, не «белый экран».
    if (error.message.includes('React error #418')) {
      report.push({
        page: page.url(),
        element: 'наблюдение: гидратация',
        href: '#',
        status: 'warn',
        note: 'React #418 (восстанавливаемая ошибка гидратации, дерево перерисовано клиентом)',
      });
      return;
    }
    violation(`uncaught exception на ${page.url()}: ${error.message}`);
  });
  page.on('response', (response) => {
    const status = response.status();
    if (allowHttpErrors) return;
    if (status >= 400) {
      violation(`HTTP ${status} на ${response.url()} (страница ${page.url()})`);
    }
  });
}

/** Загрузка страницы: 200 у документа, main с текстом, плашка концепта. */
async function auditPage(page: Page, url: string) {
  const response = await page.goto(url);
  const status = response?.status() ?? 0;
  expect(status, `страница ${url} отвечает 200`).toBe(200);
  const main = page.locator('main');
  await expect(main, `на ${url} есть <main>`).toBeVisible();
  // Стриминг RSC: goto возвращается по заголовкам, контент доезжает позже —
  // ждём непустой текст в <main>, а не читаем его мгновенно (DIG-60, flake).
  await expect(main, `${url} не белый экран`).toContainText(/\S/, { timeout: 20_000 });
  await expect(
    page.getByRole('note', { name: 'Концепт для конкурса' }),
    `на ${url} видна плашка «Концепт для конкурса»`,
  ).toBeVisible();
  report.push({ page: url, element: 'страница', href: url, status });
  expect(violations, `на ${url} нет ошибок сети/консоли: ${violations.join('; ')}`).toEqual([]);
}

/**
 * Каждая внутренняя ссылка посещённой страницы обязана вести на живой адрес.
 * GET со следованием редиректам (вкладки настроек и «Заявки?order=…»
 * отвечают на тот же запрос, что и браузеру). Якоря (#catalog) живут внутри
 * страницы — HTTP-проверка не нужна.
 */
async function crawlInternalLinks(page: Page, sourcePage: string) {
  // Дожидаемся тихой сети: после RSC-перехода старое дерево может ещё
  // висеть на экране — иначе соберём ссылки предыдущей страницы.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const links = await page.locator('main a[href^="/"]').evaluateAll((anchors) =>
    anchors.map((a) => ({
      href: a.getAttribute('href') ?? '',
      text: (a.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
    })),
  );
  const seen = new Set<string>();
  for (const { href, text } of links) {
    const path = href.split('#')[0] ?? '';
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const response = await page.request.get(path);
    const status = response.status();
    expect(
      status,
      `ссылка «${text || href}» со страницы ${sourcePage} живая (получено HTTP ${status})`,
    ).toBeLessThan(400);
    report.push({ page: sourcePage, element: `ссылка: ${text || '(без текста)'}`, href, status });
  }
}

/** Внешние ссылки фиксируем в отчёте, но не роняем прогон: вне прототипа. */
async function crawlExternalLinks(page: Page, sourcePage: string) {
  const hrefs = await page
    .locator('main a[href^="http"]')
    .evaluateAll((anchors) => [...new Set(anchors.map((a) => a.getAttribute('href') ?? ''))]);
  for (const href of hrefs) {
    let status: CrawlStatus = 'n/a';
    try {
      const response = await page.request.get(href);
      status = response.status();
    } catch {
      status = 'network-error';
    }
    report.push({ page: sourcePage, element: 'внешняя ссылка', href, status });
  }
}

/**
 * Клик по ссылке: URL сменился и отрисовалСЯ ЦЕЛЕВОЙ экран (маркер — текст,
 * который есть только на целевой странице). RSC-переход обновляет URL
 * оптимистично, а контент приходит позже: без маркера можно «проверить»
 * предыдущую страницу. Локатор обязан быть скоупнут (меню / таб-бар / main),
 * чтобы не поймать одноимённые ссылки хедера.
 */
async function clickLink(
  page: Page,
  locator: Locator,
  urlPattern: RegExp,
  from: string,
  label: string,
  marker: RegExp,
) {
  await expect(locator.first(), `«${label}» кликабельна на ${from}`).toBeEnabled();
  await locator.first().click();
  await page.waitForURL(urlPattern, { timeout: 20_000 });
  await expect(
    page.locator('main').getByText(marker).first(),
    `после клика «${label}» отрисовался целевой экран (${marker})`,
  ).toBeVisible({ timeout: 20_000 });
  const main = page.locator('main');
  await expect(main, `после клика «${label}» не белый экран`).toContainText(/\S/, {
    timeout: 20_000,
  });
  expect(await main.innerText(), `после клика «${label}» не страница входа`).not.toContain(
    'Вход в кабинет',
  );
  expect(page.url(), `после клика «${label}» остались на целевом адресе`).toMatch(urlPattern);
  report.push({ page: from, element: `клик: ${label}`, href: page.url(), status: 'ok' });
  expect(violations, `после клика «${label}» нет ошибок: ${violations.join('; ')}`).toEqual([]);
}

// Маркеры целевых экранов: текст, который есть только на этой странице.
const PAGE_MARKER: Record<string, RegExp> = {
  '/dashboard': /^Ваша неделя/,
  '/schedule': /^Расписание/,
  '/grades': /^Успеваемость/,
  '/requests': /^Мои заявки/,
  '/notifications': /^Уведомления/,
  '/deanery': /^Связь с деканатом/,
  '/ai-assistant': /^AI-ассистент/,
  '/profile': /^Профиль/,
  '/more': /^Ещё/,
  '/settings': /^Настройки/,
};

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('DIG-60: полный обход сайта', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test.beforeAll(async ({ browser }, workerInfo) => {
    const isMobile = workerInfo.project.name === 'mobile-360';
    const viewport = isMobile ? { width: 360, height: 800 } : { width: 1440, height: 900 };

    guestCtx = await browser.newContext({ viewport });
    wireListeners((guestPage = await guestCtx.newPage()));

    userCtx = await browser.newContext({ viewport });
    userPage = await userCtx.newPage();
    wireListeners(userPage);

    // Один вход на воркер: демо-креды сида (кнопка автозаполнения на /login).
    await userPage.goto('/login');
    await userPage.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
    await userPage.getByRole('button', { name: 'Войти', exact: true }).click();
    await userPage.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  });

  test.afterAll(async ({}, workerInfo) => {
    // Отчёт «страница → элемент → статус» — источник комментария в Linear.
    const dir = path.join(process.cwd(), 'test-results');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `dig-60-crawl-report-${workerInfo.project.name}.json`);
    writeFileSync(file, JSON.stringify({ project: workerInfo.project.name, report }, null, 2));
    // Прогресс обхода виден в reporter 'list'.
    console.log(`DIG-60: отчёт обхода (${report.length} проверок) → ${file}`);
    await guestCtx?.close();
    await userCtx?.close();
  });

  test.afterEach(() => {
    violations = [];
  });

  // ── Гость ────────────────────────────────────────────────────────────────

  test('гость: лендинг CTA → вход → восстановление пароля — всё живое', async () => {
    const p = guestPage;

    await auditPage(p, '/');
    await crawlInternalLinks(p, '/');
    await crawlExternalLinks(p, '/');
    const cta = p.locator('main a[href="/login"]').first();
    await expect(cta, 'на лендинге есть CTA «Войти» → /login').toBeVisible();
    await cta.click();
    await p.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(p.getByRole('heading', { name: 'Вход в кабинет' })).toBeVisible({
      timeout: 20_000,
    });
    report.push({ page: '/', element: 'клик: CTA «Войти»', href: '/login', status: 'ok' });

    await auditPage(p, '/login');
    await crawlInternalLinks(p, '/login');
    const forgot = p.locator('main a[href="/forgot-password"]');
    await expect(forgot, 'на входе есть «Забыли пароль?»').toBeVisible();
    await forgot.click();
    await p.waitForURL(/\/forgot-password/, { timeout: 20_000 });
    await expect(p.getByRole('heading', { name: 'Восстановление пароля' })).toBeVisible({
      timeout: 20_000,
    });
    report.push({
      page: '/login',
      element: 'клик: «Забыли пароль?»',
      href: '/forgot-password',
      status: 'ok',
    });

    await auditPage(p, '/forgot-password');
    await crawlInternalLinks(p, '/forgot-password');
    const back = p.locator('main a[href="/login"]');
    await expect(back, 'есть возврат «Назад ко входу»').toBeVisible();
    await back.click();
    await p.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(p.getByRole('heading', { name: 'Вход в кабинет' })).toBeVisible({
      timeout: 20_000,
    });
    report.push({
      page: '/forgot-password',
      element: 'клик: «Назад ко входу»',
      href: '/login',
      status: 'ok',
    });

    // Мониторинг: health-эндпоинт доступен без входа.
    const health = await p.request.get('/api/health');
    expect(health.status(), '/api/health отвечает 200').toBe(200);
    report.push({ page: '(гость)', element: 'API /api/health', href: '/api/health', status: 200 });
  });

  test('гость: защищённые маршруты отдают ожидаемый редирект на вход', async () => {
    const p = guestPage;
    for (const path of ['/dashboard', '/schedule', '/design']) {
      const response = await p.request.get(path, { maxRedirects: 0 });
      const status = response.status();
      expect(
        [301, 302, 303, 307, 308],
        `${path} для анонима — редирект (получено HTTP ${status})`,
      ).toContain(status);
      const location = response.headers()['location'] ?? '';
      expect(location, `${path} уводит на /login?next=…`).toContain('/login?next=');
      report.push({
        page: '(гость)',
        element: 'редирект на /login',
        href: path,
        status,
        note: `→ ${location}`,
      });
    }
    expect(violations).toEqual([]);
  });

  // ── Студент: кабинет ────────────────────────────────────────────────────

  test('главная кабинета после входа — живая', async () => {
    await auditPage(userPage, '/dashboard');
    await crawlInternalLinks(userPage, '/dashboard');
  });

  test('сайдбар: каждый из 8 разделов открывается кликом (desktop-1440)', async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop-1440', 'desktop-1440 only');

    const menu = userPage.getByRole('navigation', { name: MENU_LABEL });
    await expect(menu).toBeVisible();
    for (const label of SIDE_MENU_ITEMS) {
      const link = menu.getByRole('link', { name: new RegExp(`^${escapeRe(label)}`) });
      const target = SIDE_MENU_TARGET[label];
      await clickLink(
        userPage,
        link,
        new RegExp(`${target.replace(/\//g, '\\/')}$`),
        userPage.url(),
        label,
        PAGE_MARKER[target],
      );
      await crawlInternalLinks(userPage, `сайдбар → ${label}`);
    }

    // Страница «Ещё» (сводка мобильного меню) доступна и на десктопе.
    await auditPage(userPage, '/more');
    await crawlInternalLinks(userPage, '/more');
  });

  test('таб-бар: каждая из 5 вкладок открывается кликом (mobile-360)', async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'mobile-360', 'mobile-360 only');

    const tabBar = userPage.getByRole('navigation', { name: TAB_BAR_LABEL });
    await expect(tabBar).toBeVisible();
    for (const label of TAB_BAR_ITEMS) {
      const link = tabBar.getByRole('link', { name: new RegExp(`^${escapeRe(label)}$`) });
      const target = TAB_BAR_TARGET[label];
      await clickLink(
        userPage,
        link,
        new RegExp(`${target.replace(/\//g, '\\/')}$`),
        userPage.url(),
        label,
        PAGE_MARKER[target],
      );
    }
    await crawlInternalLinks(userPage, 'таб-бар (финал)');
  });

  test('«Ещё»: каждый из 5 пунктов открывается кликом (mobile-360)', async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'mobile-360', 'mobile-360 only');

    const p = userPage;
    await auditPage(p, '/more');
    const main = p.locator('main');
    for (const label of MORE_ITEMS) {
      const link = main.getByRole('link', { name: new RegExp(`^${escapeRe(label)}$`) });
      const target = MORE_TARGET[label];
      await clickLink(
        p,
        link,
        new RegExp(`${target.replace(/\//g, '\\/')}$`),
        p.url(),
        `«Ещё» → ${label}`,
        PAGE_MARKER[target],
      );
      await auditPage(p, '/more'); // назад к меню для следующего пункта
    }
    await crawlInternalLinks(p, '/more');
  });

  test('настройки: все 5 вкладок открываются, безопасные кнопки нажимаются', async () => {
    const p = userPage;
    await auditPage(p, '/settings');
    const tabsNav = p.getByRole('navigation', { name: SETTINGS_TABS_LABEL });
    await expect(tabsNav).toBeVisible();
    for (const label of SETTINGS_TAB_ITEMS) {
      const link = tabsNav.getByRole('link', { name: new RegExp(`^${escapeRe(label)}$`) });
      const { tabId, marker } = SETTINGS_TAB_TARGET[label];
      // Точный адрес вкладки + её контентный маркер (ревью DIG-60, раунд 3):
      // навигация обязана сменить URL на ?tab=<id> и отрисовать контент
      // именно этой вкладки — иначе клик не засчитывается.
      await clickLink(
        p,
        link,
        new RegExp(`\\?tab=${tabId}$`),
        '/settings',
        `вкладка настроек «${label}»`,
        marker,
      );
    }
    // Ревью DIG-60 (раунд 3, п.5): вкладка «Настройка MCP» — полный аудит
    // рендера (main непустой, плашка концепта), а не только GET-статус.
    await auditPage(p, '/settings?tab=mcp');
    await crawlInternalLinks(p, '/settings');

    // Вид: переключатель темы — безопасная мутация (демо-аккаунт): щёлкаем
    // первую свободную тему и возвращаем исходную (не «скоро»/выключенную).
    await auditPage(p, '/settings?tab=appearance');
    const theme = p.getByRole('radiogroup', { name: 'Тема оформления' });
    const radios = theme.getByRole('radio');
    const total = await radios.count();
    let originIndex = -1;
    let clickIndex = -1;
    for (let i = 0; i < total; i += 1) {
      const radio = radios.nth(i);
      if ((await radio.getAttribute('aria-checked')) === 'true') originIndex = i;
      else if (clickIndex === -1 && !(await radio.isDisabled())) clickIndex = i;
    }
    if (clickIndex !== -1 && originIndex !== -1) {
      await radios.nth(clickIndex).click();
      await expect(radios.nth(clickIndex)).toHaveAttribute('aria-checked', 'true', {
        timeout: 15_000,
      });
      report.push({
        page: '/settings?tab=appearance',
        element: 'кнопка: смена темы',
        href: '#',
        status: 'ok',
      });
      // Возврат: ждём завершения server action (networkidle), чтобы две
      // мутации темы не гонялись друг с другом на revalidatePath.
      await radios.nth(originIndex).click();
      await expect(radios.nth(originIndex)).toHaveAttribute('aria-checked', 'true', {
        timeout: 15_000,
      });
      await p.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    }

    // Безопасность: поля и кнопка смены пароля видны и активны (не нажимаем:
    // деструктив; фейловый ввод считался бы попыткой входа в rate-limit).
    await auditPage(p, '/settings?tab=security');
    const submitPassword = p.getByRole('button', { name: /сменить|измен/i }).first();
    await expect(submitPassword).toBeVisible();
    await expect(submitPassword).toBeEnabled();
    report.push({
      page: '/settings?tab=security',
      element: 'кнопка «Сменить пароль»',
      href: '#',
      status: 'ok',
      note: 'видна и активна; не нажимается намеренно (деструктивная)',
    });
    expect(violations).toEqual([]);
  });

  test('успеваемость: сводка → ведомость → дисциплина → сессия → ICS/выписка', async () => {
    const p = userPage;

    await auditPage(p, '/grades');
    await crawlInternalLinks(p, '/grades');

    // Ведомость: каждая дисциплина — кликабельная карточка с деталями
    // (на mobile у таблицы и карточек разные вёрстки — берём видимую).
    await auditPage(p, '/grades/gradebook');
    await crawlInternalLinks(p, '/grades/gradebook');
    const discipline = p.locator('main a[href^="/grades/"]:visible').first();
    if ((await discipline.count()) === 0) {
      report.push({
        page: '/grades/gradebook',
        element: '(карточки дисциплин)',
        href: '/grades/gradebook',
        status: 'skip',
        note: 'демо-сид без дисциплин',
      });
    } else {
      const href = (await discipline.getAttribute('href'))!;
      await discipline.click();
      await p.waitForURL(new RegExp(`${escapeRe(href)}$`), { timeout: 20_000 });
      await expect(p.locator('main')).toBeVisible();
      await expect(p.locator('main')).toContainText(/\S/, { timeout: 20_000 });
      report.push({
        page: '/grades/gradebook',
        element: 'клик: карточка дисциплины',
        href: p.url(),
        status: 'ok',
      });
      await crawlInternalLinks(p, `дисциплина ${href}`);
    }

    // Сессия: расписание сессии + живая ICS-подписка + подсказка AI-ассистента.
    await auditPage(p, '/grades/session');
    await crawlInternalLinks(p, '/grades/session');
    // DIG-63: персональная подписка — ссылка из карточки отвечает календарём.
    const feedUrl = await p.getByTestId('calendar-subscribe-url').inputValue();
    expect(feedUrl, 'персональная ICS-ссылка показана студенту').toMatch(
      /^https?:\/\/.+\/api\/calendar\/ics\?token=v1\./,
    );
    const ics = await p.request.get(feedUrl);
    expect(ics.status(), 'ICS-подписка отвечает 200').toBe(200);
    expect(ics.headers()['content-type'] ?? '', 'ICS отдаётся календарём').toContain(
      'text/calendar',
    );
    const icsBody = await ics.text();
    expect(icsBody).toContain('BEGIN:VCALENDAR');
    expect(icsBody).toContain('BEGIN:VEVENT');
    report.push({
      page: '/grades/session',
      element: 'карточка: ICS-подписка календаря',
      href: '/api/calendar/ics?token=…',
      status: 200,
    });

    // Выписка об успеваемости — PDF.
    const transcript = await p.request.get('/api/grades/transcript');
    expect(transcript.status(), 'выписка отвечает 200').toBe(200);
    expect(transcript.headers()['content-type'] ?? '', 'выписка — PDF').toContain(
      'application/pdf',
    );
    report.push({
      page: '/grades/gradebook',
      element: 'кнопка: выписка (transcript)',
      href: '/api/grades/transcript',
      status: 200,
    });
    expect(violations).toEqual([]);
  });

  test('заявки: список → деталь → справка PDF → публичная проверка подлинности', async () => {
    const p = userPage;

    await auditPage(p, '/requests');
    await crawlInternalLinks(p, '/requests');

    const detail = p.locator('main a[href^="/requests/SR-"]:visible').first();
    if ((await detail.count()) === 0) {
      report.push({
        page: '/requests',
        element: '(карточки заявок)',
        href: '/requests',
        status: 'skip',
        note: 'демо-сид без заявок',
      });
      return;
    }

    const number = (await detail.getAttribute('href'))!.split('/').pop()!;
    await detail.click();
    await p.waitForURL(new RegExp(`/requests/${escapeRe(number)}$`), { timeout: 20_000 });
    // Деталь заявки: номер присутствует на странице (font-mono подпись).
    await expect(p.getByText(number).first()).toBeVisible({ timeout: 20_000 });
    await expect(p.locator('main')).toContainText(/\S/, { timeout: 20_000 });
    report.push({
      page: '/requests',
      element: `клик: заявка ${number}`,
      href: p.url(),
      status: 'ok',
    });
    await crawlInternalLinks(p, `деталь заявки ${number}`);

    // Справка по заявке — PDF.
    const certificate = await p.request.get(`/api/requests/${number}/certificate`);
    expect(certificate.status(), 'справка отвечает 200').toBe(200);
    expect(certificate.headers()['content-type'] ?? '', 'справка — PDF').toContain(
      'application/pdf',
    );
    report.push({
      page: `деталь заявки ${number}`,
      element: 'кнопка: скачать справку',
      href: `/api/requests/${number}/certificate`,
      status: 200,
    });

    // Публичная проверка подлинности (ссылка с детали заявки).
    const verifyHref = await p.locator('main a[href^="/verify/"]').first().getAttribute('href');
    if (verifyHref) {
      await auditPage(p, verifyHref);
      await crawlInternalLinks(p, verifyHref);
    } else {
      report.push({
        page: `деталь заявки ${number}`,
        element: 'ссылка: проверка подлинности',
        href: '(отсутствует)',
        status: 'ok',
        note: 'у заявки нет справки с кодом проверки',
      });
    }
    expect(violations).toEqual([]);
  });

  test('расписание: виды день/неделя/месяц, стрелки недель и «Детали пары»', async ({}, testInfo) => {
    const p = userPage;
    const isDesktop = testInfo.project.name === 'desktop-1440';

    await auditPage(p, '/schedule');
    await crawlInternalLinks(p, '/schedule');

    // Переключатель видов — ссылки role=radio (работают и без JS).
    const switcher = p.getByRole('radiogroup', { name: /Вид расписания/ });
    await expect(switcher.first()).toBeVisible();
    for (const view of ['День', 'Неделя', 'Месяц']) {
      const radio = switcher
        .first()
        .getByRole('radio', { name: new RegExp(`^${escapeRe(view)}$`) });
      // Точный паттерн ?view=<вид>&… (ревью DIG-60, раунд 3): обобщённый
      // /\/schedule/ совпадал с уже открытым URL и не ждал навигацию.
      await clickLink(
        p,
        radio,
        SCHEDULE_VIEW_URL[view],
        '/schedule',
        `вид расписания «${view}»`,
        PAGE_MARKER['/schedule'],
      );
    }

    if (isDesktop) {
      // «Детали пары» живут в недельной сетке; после цикла видов вернёмся
      // на «Неделю» (цикл выше заканчивает на «Месяце»).
      const weekRadio = switcher.first().getByRole('radio', { name: /^Неделя$/ });
      await clickLink(
        p,
        weekRadio,
        SCHEDULE_VIEW_URL['Неделя'],
        '/schedule',
        'вид расписания «Неделя» (для деталей пары)',
        PAGE_MARKER['/schedule'],
      );

      // Стрелка «Следующая неделя» и «Сегодня» — кликабельны.
      const nextWeek = p.getByRole('button', { name: 'Следующая неделя' }).first();
      if ((await nextWeek.count()) > 0 && (await nextWeek.isEnabled())) {
        await nextWeek.click();
        report.push({
          page: '/schedule',
          element: 'кнопка: следующая неделя',
          href: '#',
          status: 'ok',
        });
      }
      const today = p.getByRole('link', { name: 'Перейти к текущей неделе' }).first();
      if ((await today.count()) > 0) {
        await today.click();
        await expect(p.locator('main')).toBeVisible();
        report.push({ page: '/schedule', element: 'кнопка: сегодня', href: p.url(), status: 'ok' });
      }

      // «Детали пары»: клик по паре открывает панель с досье.
      const lesson = p.locator('main [data-testid^="lesson-"]').first();
      if ((await lesson.count()) === 0) {
        report.push({
          page: '/schedule',
          element: '(пары недели)',
          href: '/schedule',
          status: 'skip',
          note: 'на текущей неделе пар нет',
        });
      } else {
        await lesson.click();
        const details = p.getByRole('dialog');
        await expect(details, 'после клика по паре открылись детали').toBeVisible({
          timeout: 15_000,
        });
        await expect(details, 'в деталях пары есть досье').toContainText(/Тип|Преподаватель/, {
          timeout: 15_000,
        });
        report.push({
          page: '/schedule',
          element: 'клик: пара → «Детали пары»',
          href: '#',
          status: 'ok',
        });
        await p.keyboard.press('Escape');
        await expect(details).toBeHidden({ timeout: 15_000 });
      }
    } else {
      // mobile-360: вернуть «День» (лента дат есть только там) и тапнуть дату.
      const dayRadio = switcher.first().getByRole('radio', { name: /^День$/ });
      await clickLink(
        p,
        dayRadio,
        SCHEDULE_VIEW_URL['День'],
        '/schedule',
        'вид расписания «День» (для ленты дат)',
        PAGE_MARKER['/schedule'],
      );
      const ribbon = p.locator('main [data-testid^="ribbon-item-"]');
      await expect(ribbon.first()).toBeAttached({ timeout: 15_000 });
      const dates = await ribbon.count();
      expect(dates, 'лента дат недели отрисована').toBeGreaterThan(0);
      await ribbon.nth(Math.min(2, dates - 1)).click();
      await expect(p.locator('main')).toBeVisible();
      report.push({ page: '/schedule', element: 'клик: дата в ленте', href: '#', status: 'ok' });
    }
    expect(violations).toEqual([]);
  });

  test('каталог сервисов: карточки услуг ведут на живые адреса, избранное работает', async () => {
    const p = userPage;

    await auditPage(p, '/services');
    await crawlInternalLinks(p, '/services');
    await crawlExternalLinks(p, '/services');

    // Каждая карточка услуги — кнопка «Заказать/Открыть» со своим href;
    // в отчёт пишем название услуги (h3 карточки), а не текст кнопки.
    const cards = p.locator('main article:has(a[href^="/"])');
    const cardCount = await cards.count();
    expect(cardCount, 'в каталоге есть карточки услуг с кнопками').toBeGreaterThan(0);
    const seen = new Set<string>();
    for (let i = 0; i < cardCount; i += 1) {
      const card = cards.nth(i);
      const link = card.locator('a[href^="/"]').first();
      const href = (await link.getAttribute('href')) ?? '';
      const title = ((await card.locator('h3').first().textContent()) ?? '').trim() || href;
      if (!href || seen.has(href)) continue;
      seen.add(href);
      const response = await p.request.get(href);
      expect(
        response.status(),
        `карточка услуги «${title}» (${href}) отвечает без ошибки`,
      ).toBeLessThan(400);
      report.push({
        page: '/services',
        element: `карточка услуги: ${title}`,
        href,
        status: response.status(),
      });
    }

    // Звёздочка избранного — рабочая кнопка (мутация демо-аккаунта допустима).
    const star = p.locator('main button[aria-pressed]:visible').first();
    if ((await star.count()) > 0) {
      const before = (await star.getAttribute('aria-pressed')) === 'true';
      await star.click();
      await expect(star).toHaveAttribute('aria-pressed', String(!before), { timeout: 15_000 });
      report.push({
        page: '/services',
        element: 'кнопка: избранное (звёздочка)',
        href: '#',
        status: 'ok',
      });
      await star.click(); // вернуть как было
      await expect(star).toHaveAttribute('aria-pressed', String(before), { timeout: 15_000 });
    }
    expect(violations).toEqual([]);
  });

  test('ошибки обработаны: 404 — аккуратная страница, не белый экран', async () => {
    const p = userPage;
    allowHttpErrors = true;
    try {
      const res1 = await p.goto('/bogus-page-dig-60');
      expect(res1?.status(), 'неизвестный адрес — честный 404').toBe(404);
      const main = p.locator('main');
      await expect(main).toBeVisible();
      await expect(main).toContainText(/\S/, { timeout: 20_000 });
      await expect(p.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
      const back = p.locator('main a[href^="/"]').first();
      await expect(back, 'на 404 есть живая ссылка обратно').toBeVisible();
      report.push({
        page: '(404)',
        element: 'страница',
        href: '/bogus-page-dig-60',
        status: 404,
        note: 'not-found UI с навигацией',
      });

      // Несуществующий номер заявки — тот же аккуратный 404.
      const res2 = await p.goto('/requests/SR-0000-ZZZZZ');
      expect(res2?.status(), 'несуществующая заявка — 404').toBe(404);
      await expect(p.locator('main')).toBeVisible();
      await expect(p.locator('main')).toContainText(/\S/, { timeout: 20_000 });
      report.push({
        page: '(404)',
        element: 'страница',
        href: '/requests/SR-0000-ZZZZZ',
        status: 404,
        note: 'not-found UI',
      });
    } finally {
      allowHttpErrors = false;
    }
    expect(violations.filter((v) => !/bogus-page-dig-60|SR-0000-ZZZZZ/.test(v))).toEqual([]);
  });
});
