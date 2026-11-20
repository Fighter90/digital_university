// DIG-130 — справка: раскладка не ломается на длинных заголовках.
// D1: plain-версия — sticky-оглавление не перекрывается контентом, шапка в viewport.
// D2: длинный заголовок пункта оглавления обрезается, не вылезая на контент.
import { test, expect } from '@playwright/test';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3457';
const OUT = '/tmp/guide-bug';
const LONG_ID = 'msp'; // раздел с самым длинным заголовком («Подключить внешнего AI-ассистента (MCP)…»)

/** Логин студентом (справка — внутри кабинета). */
async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#login').fill('anna.smirnova');
  await page.locator('#password').fill('anna-demo-2026');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/dashboard|guide/, { timeout: 15000 });
}

/** Открыть /guide (после логина) без networkidle. */
async function openGuide(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/guide`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('guide-browser').waitFor({ timeout: 15000 });
}

test.describe('DIG-130 — TOC не вылезает (обычная версия)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('длинный заголовок обрезан, не распирает колонку', async ({ page }) => {
    await login(page);
    await openGuide(page);
    const link = page.getByTestId(`guide-toc-${LONG_ID}`).filter({ visible: true }).first();
    await link.scrollIntoViewIfNeeded();

    const geo = await link.evaluate((el) => {
      const a = el.getBoundingClientRect();
      const card = el.closest('nav')!.getBoundingClientRect();
      const span = el.querySelector('span')!;
      const sp = span.getBoundingClientRect();
      const ul = el.closest('ul')!.getBoundingClientRect();
      const li = el.closest('li')!.getBoundingClientRect();
      const cs = getComputedStyle(span);
      return {
        aRight: a.right,
        cardRight: card.right,
        aWidth: a.width,
        cardWidth: card.width,
        spanW: sp.width,
        spanMinW: cs.minWidth,
        spanDisplay: cs.display,
        spanOverflow: cs.overflow,
        spanWhiteSpace: cs.whiteSpace,
        spanTextOverflow: cs.textOverflow,
        ulW: ul.width,
        liW: li.width,
        spanText: span.textContent!.slice(0, 40),
      };
    });
    console.log('GEO:', JSON.stringify(geo, null, 1));

    // <a> не вылезает за карточку оглавления (запас 1px на субпиксель)
    expect(
      geo.aRight,
      'пункт оглавления вылезает за карточку — обрезка не работает',
    ).toBeLessThanOrEqual(geo.cardRight + 1);
    // и по ширине не больше колонки
    expect(geo.aWidth, 'пункт оглавления шире карточки').toBeLessThanOrEqual(geo.cardWidth + 1);

    await page.screenshot({ path: `${OUT}/d130-normal-1440.png` });
  });
});

test.describe('DIG-130 — plain-версия: нет наезда и overflow', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('plain 1440: sticky off, шапка и контент в viewport', async ({ page }) => {
    await page
      .context()
      .addCookies([
        { name: 'du-a11y-version', value: 'plain', domain: new URL(BASE).hostname, path: '/' },
      ]);
    await login(page);
    await openGuide(page);

    // нет горизонтального overflow
    const noHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noHScroll, 'plain-версия: горизонтальный overflow на /guide').toBeTruthy();

    // контентные sticky отключены (оглавление прокручивается с контентом)
    const sticky = await page.evaluate(() => {
      const tocAside =
        document.querySelector('main aside') ??
        Array.from(document.querySelectorAll('aside')).find((a) =>
          a.querySelector('[data-testid^="guide-toc-"]'),
        );
      if (!tocAside) return -1;
      const els = [tocAside, ...Array.from(tocAside.querySelectorAll('[class*="sticky"]'))];
      return els.filter((el) => getComputedStyle(el).position === 'sticky').length;
    });
    expect(
      sticky,
      'plain-версия: контентные sticky-элементы не отключены (или оглавление не найдено)',
    ).toBe(0);

    // шапка в viewport
    const header = await page.evaluate(() => {
      const h = document.querySelector('header')!.getBoundingClientRect();
      return { right: h.right, vw: window.innerWidth };
    });
    expect(header.right, 'plain-версия: шапка шире viewport').toBeLessThanOrEqual(header.vw + 1);

    // прокрутка к контенту: секции рисуются ПОД оглавлением в потоке, а не поверх
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(400);
    const overlap = await page.evaluate(() => {
      const toc =
        document.querySelector('main aside') ??
        Array.from(document.querySelectorAll('aside')).find((a) =>
          a.querySelector('[data-testid^="guide-toc-"]'),
        );
      const section = document.getElementById('ai-assistant');
      if (!toc || !section) return -1;
      const tocR = toc.getBoundingClientRect();
      const secR = section.getBoundingClientRect();
      const yOverlap = Math.min(tocR.bottom, secR.bottom) - Math.max(tocR.top, secR.top);
      const xOverlap = Math.min(tocR.right, secR.right) - Math.max(tocR.left, secR.left);
      return yOverlap > 0 && xOverlap > 0 ? Math.round(xOverlap) : 0;
    });
    expect(
      overlap,
      `plain-версия: контент перекрывает оглавление на ${overlap}px (или элементы не найдены)`,
    ).toBe(0);

    await page.screenshot({ path: `${OUT}/d130-plain-1440-scrolled.png` });
  });
});
