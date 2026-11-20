import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// DIG-106+107 — регресс лендинга RU+EN и доступности.
//
// DIG-106: все секции (hero/статистика/фичи/как-работает/сотруднику/ИИ-агенты/
// FAQ/CTA/футер), меню (Личный кабинет→/dashboard, Справка→/help, якоря),
// переключатель Русский/English (реально меняет контент), параллакс-орбы,
// плавающие карточки; скриншоты 1440 и 360 px в shots/.
//
// DIG-107: plain-версия (cookie du-a11y-version=plain, ссылка над шапкой и
// в футере; тумблера в Настройках НЕТ — по спеке DIG-100): белый фон, чёрный
// текст, ≥20px, без анимаций; Настройки → Доступность (large-text/no-effects)
// работают и сохраняются.
//
// Скриншоты кладём в shots/ (в корне репозитория) — папка создаётся до прогона.

const SHOTS = resolve(__dirname, '..', 'shots');

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

const RU = {
  h1: 'Всё университетское — в одном окне',
  brand: 'Цифровой деканат',
  stats: 'Кабинет в цифрах',
  features: 'Что появится в кабинете',
  how: 'Как это работает',
  staff: 'И отдельный кабинет — сотруднику деканата',
  ai: 'Собрано роем ИИ-агентов',
  faq: 'Частые вопросы',
  cta: 'Загляните в кабинет прямо сейчас',
  footer: 'Цифровой деканат — концепт для конкурса',
  cabinet: 'Личный кабинет',
  help: 'Справка',
  plainLink: 'Версия для слабовидящих',
  plainBack: 'Обычная версия',
};

const EN = {
  h1: 'Everything university-related — in one window',
  brand: 'Digital Deanery',
  stats: 'The portal in numbers',
  features: 'What you get in the portal',
  how: 'How it works',
  staff: 'Plus a separate cabinet for the deanery staff',
  ai: 'Built by a swarm of AI agents',
  faq: 'Frequent questions',
  cta: 'Take a look at the portal right now',
  footer: 'Digital Deanery — a competition concept',
  cabinet: 'Student portal',
  help: 'Help',
};

/** Логин демо-студентом (нужен для server action'ов: toggleA11yVersion/setA11y owner-scoped). */
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('anna.smirnova');
  await page.getByLabel('Пароль', { exact: true }).fill('anna-demo-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 });
}

/** Ключи копирайта, по которым сверяем секции (без plain-полей RU). */
type SectionCopy = Pick<
  typeof RU,
  'brand' | 'h1' | 'features' | 'how' | 'staff' | 'ai' | 'faq' | 'cta' | 'footer'
>;

/** Все основные секции лендинга с ожидаемыми заголовками. */
async function expectSections(page: Page, c: SectionCopy) {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toContainText(c.brand);
  await expect(h1).toContainText(c.h1);
  await expect(page.getByRole('heading', { name: c.features })).toBeVisible();
  await expect(page.getByTestId('landing-feature')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: c.how })).toBeVisible();
  await expect(page.getByRole('heading', { name: c.staff })).toBeVisible();
  await expect(page.getByRole('heading', { name: c.ai })).toBeVisible();
  await expect(page.getByRole('heading', { name: c.faq })).toBeVisible();
  await expect(page.getByRole('heading', { name: c.cta })).toBeVisible();
  await expect(page.getByText(c.footer)).toBeVisible();
}

// ─── DIG-106: секции и меню (desktop 1440) ──────────────────────────────────

test.describe('DIG-106: лендинг RU — секции и меню (1440)', () => {
  test('все секции на месте, RU-копия', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await page.goto('/');
    await expectSections(page, RU);
    await page.screenshot({ path: resolve(SHOTS, 'dig106-landing-ru-1440.png') });
    await page.screenshot({
      path: resolve(SHOTS, 'dig106-landing-ru-1440-full.png'),
      fullPage: true,
    });
  });

  test('меню: Личный кабинет→/dashboard, Справка→/help, якоря секций', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Возможности' });
    await expect(nav.getByRole('link', { name: RU.cabinet })).toHaveAttribute('href', '/dashboard');
    await expect(nav.getByRole('link', { name: RU.help })).toHaveAttribute('href', '/help');
    for (const anchor of ['#features', '#how', '#staff']) {
      await expect(nav.locator(`a[href="${anchor}"]`)).toBeAttached();
      await expect(page.locator(anchor)).toBeAttached(); // цель якоря существует
    }
    // якорь реально прокручивает к секции
    await page.locator('#how').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: RU.how })).toBeInViewport();
  });
});

// ─── DIG-106: EN через переключатель (реальная смена контента) ──────────────

test.describe('DIG-106: переключатель Русский/English', () => {
  test('клик English меняет контент и cookie, клик Русский возвращает', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(RU.h1);

    // EN
    await page.getByTestId('locale-en').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(EN.h1);
    await expect(page.getByTestId('locale-en')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('landing-feature')).toHaveCount(5);
    // cookie du-locale httpOnly — персистентность проверяем перезагрузкой
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(EN.h1);
    await expectSections(page, EN);
    await page.screenshot({ path: resolve(SHOTS, 'dig106-landing-en-1440.png') });
    await page.screenshot({
      path: resolve(SHOTS, 'dig106-landing-en-1440-full.png'),
      fullPage: true,
    });

    // назад в RU
    await page.getByTestId('locale-ru').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(RU.h1);
  });

  test('EN также работает при выставленной cookie du-locale=en (deep-link)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await page
      .context()
      .addCookies([
        {
          name: 'du-locale',
          value: 'en',
          domain: new URL(testInfo.project.use.baseURL ?? 'http://localhost').hostname,
          path: '/',
        },
      ]);
    await page.goto('/');
    await expectSections(page, EN);
  });
});

// ─── DIG-106: параллакс-орбы и плавающие карточки ───────────────────────────

test.describe('DIG-106: декор лендинга', () => {
  test('1440: параллакс-орбы есть и смещаются при прокрутке; плавающие карточки видимы', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await page.goto('/');
    // орбы: 3 слоя с data-speed (градиентные пятна hero)
    const orbs = page.locator('[data-speed]');
    await expect(orbs).toHaveCount(3);
    // параллакс: transform меняется после прокрутки (rAF-эффект)
    const before = await orbs.first().evaluate((el) => el.style.transform);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(async () => orbs.first().evaluate((el) => el.style.transform), { timeout: 5_000 })
      .not.toBe(before);
    // плавающие карточки hero — на ≥lg видимы, анимация float назначена
    const floats = page.locator('main .animate-float');
    await expect(floats.first()).toBeVisible();
    const animation = await floats.first().evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).not.toBe('none');
  });

  test('360: плавающие карточки скрыты (декор ≥lg), горизонтального скролла нет', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360');
    await page.goto('/');
    await expect(page.locator('main .animate-float').first()).not.toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);
  });
});

// ─── DIG-106: мобильные скриншоты RU/EN 360 ────────────────────────────────

test.describe('DIG-106: скриншоты mobile 360', () => {
  test('RU 360: секции на месте, полный скриншот', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(RU.h1);
    await expect(page.getByTestId('landing-feature')).toHaveCount(5);
    await page.screenshot({
      path: resolve(SHOTS, 'dig106-landing-ru-360-full.png'),
      fullPage: true,
    });
  });

  test('EN 360: секции EN, полный скриншот', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360');
    await page
      .context()
      .addCookies([
        {
          name: 'du-locale',
          value: 'en',
          domain: new URL(testInfo.project.use.baseURL ?? 'http://localhost').hostname,
          path: '/',
        },
      ]);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(EN.h1);
    await page.screenshot({
      path: resolve(SHOTS, 'dig106-landing-en-360-full.png'),
      fullPage: true,
    });
  });
});

// ─── DIG-107: plain-версия ──────────────────────────────────────────────────

test.describe('DIG-107: plain-версия для слабовидящих', () => {
  // Спека DIG-100: включение — ссылкой над шапкой/в футере (cookie
  // du-a11y-version), НЕ тумблером в Настройках. Действие owner-scoped,
  // поэтому нужен демо-логин.
  test('/?plain не является переключателем — включение только ссылкой (спека DIG-100)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    // query-параметр не предусмотрен спекой: страница остаётся обычной версией
    await page.goto('/?plain');
    await expect(page.locator('html')).not.toHaveClass(/a11y-plain/);
    // и при этом plain достижим штатно: cookie → версия применяется
    await page
      .context()
      .addCookies([
        {
          name: 'du-a11y-version',
          value: 'plain',
          domain: new URL(testInfo.project.use.baseURL ?? 'http://localhost').hostname,
          path: '/',
        },
      ]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/a11y-plain/);
  });

  test('ссылка над шапкой включает plain: белый фон/чёрный текст/≥20px/без анимаций', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await login(page);
    await page.goto('/');
    // вход в plain — ссылка в футере (полоска над шапкой убрана, change remove-a11y-top-strip)
    await page.getByTestId('a11y-version-footer').getByTestId('a11y-version-link').click();
    await expect(page.locator('html')).toHaveClass(/a11y-plain/, { timeout: 15_000 });

    const styles = await page.evaluate(() => {
      const html = document.documentElement;
      const h1 = document.querySelector('h1');
      const link = document.querySelector('a[href="/login"]');
      return {
        htmlFontSize: getComputedStyle(html).fontSize,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
        h1Color: h1 ? getComputedStyle(h1).color : null,
        h1BgImage: h1 ? getComputedStyle(h1).backgroundColor : null,
        linkTextDecoration: link ? getComputedStyle(link).textDecorationLine : null,
        serif: getComputedStyle(document.body).fontFamily,
      };
    });
    expect(parseInt(styles.htmlFontSize, 10)).toBeGreaterThanOrEqual(20);
    expect(styles.bodyBg).toBe('rgb(255, 255, 255)');
    expect(styles.bodyColor).toBe('rgb(0, 0, 0)');
    expect(styles.h1Color).toBe('rgb(0, 0, 0)');
    expect(styles.serif).toContain('Georgia');
    // анимации выключены: плавающие карточки и reveal не двигаются
    const animations = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.animate-float, [data-reveal]'))
        .slice(0, 8)
        .map((el) => getComputedStyle(el).animationName),
    );
    for (const name of animations) expect(name === 'none' || name === '').toBeTruthy();

    await page.screenshot({ path: resolve(SHOTS, 'dig107-plain-1440.png') });
    await page.screenshot({ path: resolve(SHOTS, 'dig107-plain-1440-full.png'), fullPage: true });

    // футер-ссылка со значком — та же обратная ссылка «Обычная версия»
    const footerLink = page.getByTestId('a11y-version-footer').getByTestId('a11y-version-link');
    await expect(footerLink).toContainText(RU.plainBack);
    await footerLink.click();
    await expect(page.locator('html')).not.toHaveClass(/a11y-plain/, { timeout: 15_000 });
  });

  test('360: plain действует без исключений, скролл не шире вьюпорта', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360');
    await login(page);
    await page.goto('/');
    await page.getByTestId('a11y-version-footer').getByTestId('a11y-version-link').click();
    await expect(page.locator('html')).toHaveClass(/a11y-plain/, { timeout: 15_000 });
    const styles = await page.evaluate(() => ({
      fontSize: getComputedStyle(document.documentElement).fontSize,
      bg: getComputedStyle(document.body).backgroundColor,
    }));
    expect(parseInt(styles.fontSize, 10)).toBeGreaterThanOrEqual(20);
    expect(styles.bg).toBe('rgb(255, 255, 255)');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);
    await page.screenshot({ path: resolve(SHOTS, 'dig107-plain-360-full.png'), fullPage: true });
  });
});

// ─── DIG-107: Настройки → Доступность (large-text/no-effects) ──────────────

test.describe('DIG-107: Настройки → a11y-тумблеры', () => {
  test('large-text и no-effects применяются и сохраняются после перезагрузки', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await login(page);
    await page.goto('/settings?tab=accessibility');
    const largeToggle = page.getByTestId('a11y-large-text-toggle');
    const effectsToggle = page.getByTestId('a11y-no-effects-toggle');
    await expect(largeToggle).toBeVisible();

    // крупный текст: ждём подтверждение server action (статус «Сохранено…»),
    // иначе reload уходит раньше записи cookie
    await largeToggle.click();
    await expect(page.getByRole('status')).toContainText('Сохранено', { timeout: 15_000 });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/a11y-large-text/, { timeout: 15_000 });
    const largeFont = await page.evaluate(() =>
      parseInt(getComputedStyle(document.documentElement).fontSize, 10),
    );
    expect(largeFont).toBeGreaterThanOrEqual(18); // 125% от 16px = 20px

    // без эффектов
    await effectsToggle.click();
    await expect(page.getByRole('status')).toContainText('Сохранено', { timeout: 15_000 });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/a11y-no-effects/, { timeout: 15_000 });
    // параллакс-эффекты уважают режим: слои не смещаются
    await page.goto('/');
    const before = await page
      .locator('[data-speed]')
      .first()
      .evaluate((el) => el.style.transform);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(600);
    const after = await page
      .locator('[data-speed]')
      .first()
      .evaluate((el) => el.style.transform);
    expect(after).toBe(before);

    await page.goto('/settings?tab=accessibility');
    await page.screenshot({ path: resolve(SHOTS, 'dig107-settings-a11y-1440.png') });

    // прибираем за собой: оба режима выключить (ждём подтверждение action'а)
    await page.getByTestId('a11y-large-text-toggle').click();
    await expect(page.getByRole('status')).toContainText('Сохранено', { timeout: 15_000 });
    await page.getByTestId('a11y-no-effects-toggle').click();
    await expect(page.getByRole('status')).toContainText('Сохранено', { timeout: 15_000 });
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/a11y-large-text/);
    await expect(page.locator('html')).not.toHaveClass(/a11y-no-effects/);
  });
});
