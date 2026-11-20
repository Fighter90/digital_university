import { expect, test, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// DIG-109 — регресс календаря/расписания ПРОТИВ ПРОДА (или другого стенда).
// Обычные e2e-прогоны (локальная сборка) этот файл не выполняют:
// весь сценарий включается только переменной окружения DIG109_REGRESS=1.
//   DIG109_REGRESS=1 REGRESS_BASE=https://ostrovok.store \
//     npx playwright test e2e/zz-dig109-regress.spec.ts
// Проверки data-driven: состав пар на стенде может отличаться от локального
// сида, поэтому инварианты формулируются от фактических данных DOM/MD/ICS
// (время в МСК, «было» только по реальным изменениям, валидность файлов).
// Артефакты: скриншоты и экспорт-файлы — docs/shots/dig-109/.

const BASE = process.env.REGRESS_BASE ?? 'https://ostrovok.store';
const HOST = new URL(BASE).hostname;
const OUT = path.join(process.cwd(), 'docs/shots/dig-109');

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };

const GRID_TOP_OFFSET_MIN = 480; // сетка недели 08:00
const GRID_PX_PER_HOUR = 64; // 64 px на час (DIG-22)

test.skip(!process.env.DIG109_REGRESS, 'только для явного регресс-прогона (DIG109_REGRESS=1)');

async function signIn(page: Page, locale?: 'ru' | 'en'): Promise<void> {
  if (locale) {
    await page.context().addCookies([
      { name: 'du-locale', value: locale, domain: HOST, path: '/' },
    ]);
  }
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Логин').fill(ANNA.login);
  await page.getByLabel('Пароль', { exact: true }).fill(ANNA.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 20_000 });
}

/** «09:00–11:30» из aria-label пары → минуты от полуночи. */
function parseTimeRange(aria: string): { start: number; end: number } | null {
  const m = /(\d{2}):(\d{2})–(\d{2}):(\d{2})/.exec(aria);
  if (!m) return null;
  return {
    start: Number(m[1]) * 60 + Number(m[2]),
    end: Number(m[3]) * 60 + Number(m[4]),
  };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** Все блоки пар недельной сетки с их московскими временами из aria-label. */
async function weekLessonBlocks(page: Page): Promise<Locator> {
  return page.locator('[data-testid="week-grid"] [data-testid^="lesson-"]');
}

test.describe('DIG-109 регресс расписания — десктоп 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Moscow' });
  test.setTimeout(240_000);

  test('RU: сетка недели в МСК, перенос/отмена (BUG-14), детали пары, синк (BUG-17), месяц', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    mkdirSync(`${OUT}/ru`, { recursive: true });
    await signIn(page, 'ru');

    // ── Вид «Неделя»: сетка, времена в МСК ──────────────────────────────
    await page.goto(`${BASE}/schedule?view=week`);
    await expect(page.getByTestId('week-board')).toBeVisible();
    await expect(page.getByTestId('week-grid')).toBeVisible();

    // 7 колонок дней, первая — понедельник (неделя с понедельника, МСК).
    const dayColumns = page.locator('[data-testid="week-grid"] [data-date-key]');
    await expect(dayColumns).toHaveCount(7);
    const dateKeys = await dayColumns.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.dateKey ?? ''),
    );
    const mondayJsDay = new Date(`${dateKeys[0]}T12:00:00Z`).getUTCDay(); // 0=Sun
    expect((mondayJsDay + 6) % 7, 'первый день недели — понедельник').toBe(0);

    // Каждая пара: позиция в сетке соответствует московскому времени из
    // aria-label (BUG-02 — регресс таймзоны: top/height считаются из МСК).
    const blocks = await weekLessonBlocks(page);
    const blockCount = await blocks.count();
    expect(blockCount, 'в неделе есть пары').toBeGreaterThan(0);
    for (let i = 0; i < blockCount; i += 1) {
      const block = blocks.nth(i);
      const aria = (await block.getAttribute('aria-label')) ?? '';
      const range = parseTimeRange(aria);
      expect(range, `aria-label с временем в МСК: ${aria}`).not.toBeNull();
      const style = await block.evaluate((el) => ({
        top: Number((el as HTMLElement).style.top.replace('px', '')),
        height: Number((el as HTMLElement).style.height.replace('px', '')),
      }));
      const expectedTop = ((range!.start - GRID_TOP_OFFSET_MIN) / 60) * GRID_PX_PER_HOUR;
      expect(
        Math.abs(style.top - Math.max(0, expectedTop)),
        `позиция блока соответствует времени «${aria}»`,
      ).toBeLessThanOrEqual(2);
      const visible = Math.min(range!.end, 1200) - Math.max(range!.start, GRID_TOP_OFFSET_MIN);
      expect(
        Math.abs(style.height - (visible / 60) * GRID_PX_PER_HOUR),
        `высота блока соответствует длительности «${aria}»`,
      ).toBeLessThanOrEqual(2);
    }
    await page.screenshot({ path: `${OUT}/ru/schedule-week.png`, fullPage: false });

    // ── BUG-14: перенос «было» только по реальным изменениям ────────────
    // Все переносы: «было» есть, времени в «было» нет (если менялось только
    // место), аудитория «было» ≠ текущей аудитории пары.
    const moved = page.locator('[data-testid="week-grid"] [data-status="moved"]');
    const movedCount = await moved.count();
    expect(movedCount, 'на стенде есть перенос').toBeGreaterThanOrEqual(1);
    for (let i = 0; i < movedCount; i += 1) {
      const block = moved.nth(i);
      const aria = (await block.getAttribute('aria-label')) ?? '';
      expect(aria, `aria переноса: ${aria}`).toContain('перенос');
      const text = normalize(await block.innerText());
      expect(text, `«было» у переноса «${aria}»`).toContain('было:');
      expect(text, '«было» времени не дублируется (BUG-14)').not.toMatch(/было: \d{2}:\d{2}/);
      const currentRoom = /ауд\. ([^,]+),/.exec(aria)?.[1] ?? /онлайн/.exec(aria)?.[0] ?? '';
      const wasRoom = /было: ауд\. ([^,]+)(?: |$)/.exec(text)?.[1] ?? '';
      expect(wasRoom, `прежняя аудитория ≠ текущей («${aria}»)`).not.toBe(currentRoom);
    }

    // Отменённая пара: бейдж «Отменена», «было» нет вовсе.
    const cancelled = page.locator('[data-testid="week-grid"] [data-status="cancelled"]');
    const cancelledCount = await cancelled.count();
    expect(cancelledCount, 'на стенде есть отмена').toBeGreaterThanOrEqual(1);
    for (let i = 0; i < cancelledCount; i += 1) {
      const block = cancelled.nth(i);
      const aria = (await block.getAttribute('aria-label')) ?? '';
      expect(aria).toContain('отменена');
      const text = normalize(await block.innerText());
      expect(text, `у отмены нет «было» (${aria})`).not.toContain('было:');
      expect(text).toContain('Отменена');
    }

    // ── Детали пары (боковая панель): тип/время/аудитория/преподаватель ─
    await moved.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const movedAria = (await moved.first().getAttribute('aria-label')) ?? '';
    const movedTime = /(\d{2}:\d{2}–\d{2}:\d{2})/.exec(movedAria)?.[1] ?? '';
    await expect(dialog).toContainText('Тип');
    await expect(dialog).toContainText('Время');
    await expect(dialog).toContainText(movedTime);
    await expect(dialog).toContainText('Аудитория');
    const movedRoom = /ауд\. ([^,]+),/.exec(movedAria)?.[1];
    if (movedRoom) await expect(dialog).toContainText(`ауд. ${movedRoom}`);
    await expect(dialog).toContainText('Преподаватель');
    await expect(dialog).toContainText('Статус');
    await expect(dialog).toContainText('Перенос');
    await expect(dialog).toContainText(/было: ауд\. /);
    await expect(dialog).toContainText('Причина:');
    await page.screenshot({ path: `${OUT}/ru/details-panel.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // ── BUG-17: «Синхронизировать» — видимый отклик ─────────────────────
    await page.getByRole('button', { name: 'Синхронизировать' }).click();
    await expect(page.getByTestId('sync-status')).toHaveText(/./, { timeout: 5_000 });
    await expect(page.getByTestId('sync-status')).toHaveText('Расписание обновлено', {
      timeout: 10_000,
    });

    // ── Вид «Месяц»: сетка с понедельника, точки пар, «сегодня» ─────────
    await page.goto(`${BASE}/schedule?view=month`);
    await expect(page.getByTestId('month-grid')).toBeVisible();
    // Инвариант Monday-first: колонка каждой ячейки-ссылки = будний день её
    // даты (индекс в ряду 0..6 при неделе с понедельника).
    const cellsInfo = await page
      .locator('[data-testid="month-grid"] > *')
      .evaluateAll((els) =>
        els.map((el) => ({
          isAnchor: el.tagName === 'A',
          dateKey: (el as HTMLElement).dataset.testid?.replace('month-cell-', '') ?? '',
        })),
      );
    expect(cellsInfo.length, 'сетка месяца 5–6 строк').toBeGreaterThanOrEqual(35);
    const anchors = cellsInfo.filter((c) => c.isAnchor);
    expect(anchors.length, 'все дни месяца — ссылки').toBeGreaterThanOrEqual(28);
    for (const [index, cell] of cellsInfo.entries()) {
      if (!cell.isAnchor) continue;
      const jsDay = new Date(`${cell.dateKey}T12:00:00Z`).getUTCDay();
      expect(index % 7, `${cell.dateKey} в колонке своего дня`).toBe((jsDay + 6) % 7);
    }
    expect(await page.locator('[data-testid="month-grid"] [data-today="true"]').count()).toBe(1);
    expect(
      await page.locator('[data-testid="month-grid"] [data-testid="month-dot"]').count(),
    ).toBeGreaterThan(0);
    await page.screenshot({ path: `${OUT}/ru/schedule-month.png`, fullPage: false });
  });

  test('RU: вид «День» — карточки, «Прослушать день» (BUG-18), экспорт и ICS валидны', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    mkdirSync(`${OUT}/ru`, { recursive: true });
    mkdirSync(`${OUT}/exports`, { recursive: true });
    await signIn(page, 'ru');

    await page.goto(`${BASE}/schedule?view=day`);
    await expect(page.getByTestId('desktop-day')).toBeVisible();
    const dayAria = await page
      .locator('[data-testid="desktop-day"] [aria-label]')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label') ?? '').filter((a) => a.length > 0),
      );
    const lessonAria = dayAria.filter((a) => /\d{2}:\d{2}–\d{2}:\d{2}/.test(a));
    expect(lessonAria.length, 'карточки дня с временем в МСК').toBeGreaterThan(0);
    for (const aria of lessonAria) {
      expect(aria, `формат карточки «${aria}»`).toMatch(/, \d{2}:\d{2}–\d{2}:\d{2}, /);
    }
    await page.screenshot({ path: `${OUT}/ru/schedule-day.png`, fullPage: false });

    // ── BUG-18: «Прослушать день» — нет «тихого ничего» ─────────────────
    const listen = page.getByTestId('desktop-day').getByTestId('listen-day');
    if (await listen.isVisible()) {
      await listen.click();
      // В headless-браузере голосового движка нет: сторож (1.2 c) обязан
      // показать запасное сообщение; если движок есть — кнопка в «playing».
      const fallback = page.getByTestId('desktop-day').getByTestId('listen-day-fallback');
      await expect
        .poll(
          async () =>
            (await fallback.isVisible()) || (await listen.getAttribute('aria-pressed')) === 'true',
          { timeout: 6_000, intervals: [250] },
        )
        .toBe(true);
      if (await fallback.isVisible()) {
        expect((await fallback.innerText()).length).toBeGreaterThan(10);
      }
      // Повторный клик — остановка (состояние сбрасывается).
      await listen.click();
      await expect(listen).toHaveAttribute('aria-pressed', 'false');
    }

    // ── Экспорт MD/XLSX/PDF: скачивается и валиден ─────────────────────
    const dateParam = /date=(\d{4}-\d{2}-\d{2})/.exec(page.url())?.[1];
    const fetchExport = async (
      ext: 'md' | 'xlsx' | 'pdf',
      view: 'day' | 'week',
    ): Promise<{ body: Buffer; status: number; type: string }> => {
      const query = dateParam ? `view=${view}&date=${dateParam}` : `view=${view}`;
      const res = await page.request.get(`${BASE}/api/export/schedule.${ext}?${query}`);
      return {
        body: Buffer.from(await res.body()),
        status: res.status(),
        type: res.headers()['content-type'] ?? '',
      };
    };

    const md = await fetchExport('md', 'week');
    expect(md.status).toBe(200);
    expect(md.type).toContain('text/markdown');
    const mdText = md.body.toString('utf8');
    expect(mdText.length, 'MD читаем: заголовок, плашка, таблица').toBeGreaterThan(200);
    expect(mdText).toContain('# Расписание');
    expect(mdText).toContain('| Время |');
    expect(mdText).toContain('Концепт для конкурса');
    writeFileSync(`${OUT}/exports/schedule-week.md`, md.body);

    const xlsx = await fetchExport('xlsx', 'week');
    expect(xlsx.status).toBe(200);
    expect(xlsx.type).toContain('spreadsheet');
    expect(xlsx.body.subarray(0, 2).toString('latin1'), 'ZIP-подпись XLSX').toBe('PK');
    const xlsxPath = `${OUT}/exports/schedule-week.xlsx`;
    writeFileSync(xlsxPath, xlsx.body);
    // Целостность контейнера и наличие рабочей книги.
    const zipList = execFileSync('unzip', ['-t', xlsxPath], { encoding: 'utf8' });
    expect(zipList).toContain('xl/workbook.xml');
    expect(zipList).toContain('No errors detected');

    const pdf = await fetchExport('pdf', 'week');
    expect(pdf.status).toBe(200);
    expect(pdf.type).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString('latin1'), 'PDF-подпись').toBe('%PDF-');
    expect(pdf.body.length).toBeGreaterThan(1000);
    expect(pdf.body.subarray(-1024).toString('latin1')).toContain('%%EOF');
    writeFileSync(`${OUT}/exports/schedule-week.pdf`, pdf.body);

    // ── ICS-подписка: живой фид, валидный ICS, работает без cookies ────
    await page.goto(`${BASE}/grades/session`);
    const feedUrl = await page.getByTestId('calendar-subscribe-url').inputValue();
    expect(feedUrl).toMatch(/\/api\/calendar\/ics\?token=v1\./);
    const fresh = await page.context().request;
    const icsRes = await fresh.get(feedUrl);
    expect(icsRes.status()).toBe(200);
    expect(icsRes.headers()['content-type']).toContain('text/calendar');
    const ics = await icsRes.text();
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThan(0);
    writeFileSync(`${OUT}/exports/calendar.ics`, Buffer.from(ics, 'utf8'));
  });

  test('EN: лейблы недели/дня/деталей по cookie du-locale=en', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    mkdirSync(`${OUT}/en`, { recursive: true });
    await signIn(page, 'en');

    // ── Неделя EN ───────────────────────────────────────────────────────
    await page.goto(`${BASE}/schedule?view=week`);
    await expect(page.getByTestId('week-board')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to the current week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync' })).toBeVisible();
    const boardText = normalize(await page.getByTestId('week-board').innerText());
    expect(boardText).toMatch(/\bLecture\b/);
    expect(boardText).toMatch(/\b(Practice|Lab|Seminar|Consultation)\b/);
    // Перенос: EN-лейблы бейджа и «было» (только реально изменившееся).
    const moved = page.locator('[data-testid="week-grid"] [data-status="moved"]');
    expect(await moved.count()).toBeGreaterThanOrEqual(1);
    const movedTextEn = normalize(await moved.first().innerText());
    expect(movedTextEn).toContain('Rescheduled');
    expect(movedTextEn).toMatch(/was: room /);
    expect(movedTextEn, 'EN: «было» времени нет (BUG-14)').not.toMatch(/was: \d{2}:\d{2}/);

    // Детали пары EN.
    await moved.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Type');
    await expect(dialog).toContainText('Time');
    await expect(dialog).toContainText('Room');
    await expect(dialog).toContainText('Teacher');
    await expect(dialog).toContainText('Status');
    await expect(dialog).toContainText('Rescheduled');
    await expect(dialog).toContainText(/was: room /);
    await expect(dialog).toContainText('Reason:');
    await page.screenshot({ path: `${OUT}/en/details-panel.png`, fullPage: false });
    await page.keyboard.press('Escape');

    // BUG-17 EN.
    await page.getByRole('button', { name: 'Sync' }).click();
    await expect(page.getByTestId('sync-status')).toHaveText('Schedule updated', {
      timeout: 10_000,
    });
    await page.screenshot({ path: `${OUT}/en/schedule-week.png`, fullPage: false });

    // ── День EN ─────────────────────────────────────────────────────────
    await page.goto(`${BASE}/schedule?view=day`);
    await expect(page.getByTestId('desktop-day')).toBeVisible();
    const dayText = normalize(await page.getByTestId('desktop-day').innerText());
    expect(dayText).toMatch(/\b(Lecture|Practice|Lab|Seminar)\b/);
    await expect(page.getByTestId('schedule-export')).toContainText('Export');
    await expect(page.getByTestId('schedule-export-md')).toHaveAttribute(
      'aria-label',
      'Download as Markdown',
    );
    await expect(page.getByTestId('schedule-export-xlsx')).toHaveAttribute(
      'aria-label',
      'Download as Excel',
    );
    await expect(page.getByTestId('schedule-export-pdf')).toHaveAttribute(
      'aria-label',
      'Download as PDF',
    );
    await page.screenshot({ path: `${OUT}/en/schedule-day.png`, fullPage: false });

    // ── Месяц EN: заголовок «November 2026» ────────────────────────────
    await page.goto(`${BASE}/schedule?view=month`);
    const monthTitle = await page.getByTestId('month-title').innerText();
    expect(monthTitle).toMatch(/^[A-Z][a-z]+ 20\d{2}$/);
    await page.screenshot({ path: `${OUT}/en/schedule-month.png`, fullPage: false });
  });
});

test.describe('DIG-109 регресс расписания — мобильный 360', () => {
  test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'Europe/Moscow' });
  test.setTimeout(240_000);

  test('RU: лента дат, карточки дня, «Прослушать день», экспорт', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360');
    mkdirSync(`${OUT}/ru`, { recursive: true });
    await signIn(page, 'ru');

    await page.goto(`${BASE}/schedule`);
    await expect(page.getByTestId('mobile-schedule')).toBeVisible();
    const ribbon = page.getByTestId('date-ribbon');
    await expect(ribbon).toBeVisible();
    expect(await ribbon.locator('[data-testid^="ribbon-item-"]').count()).toBe(7);
    const list = page.getByTestId('mobile-day-list');
    await expect(list).toBeVisible();
    const mobileAria = await list
      .locator('[aria-label]')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label') ?? '').filter((a) => a.length > 0),
      );
    expect(
      mobileAria.some((a) => /\d{2}:\d{2}–\d{2}:\d{2}/.test(a)),
      'время пар в МСК в мобильном списке',
    ).toBe(true);
    await page.screenshot({ path: `${OUT}/ru/mobile-day.png`, fullPage: false });

    // «Прослушать день» и на мобильном (BUG-18 — нет «тихого ничего»).
    const listen = page.getByTestId('mobile-schedule').getByTestId('listen-day');
    if (await listen.isVisible()) {
      await listen.click();
      await expect
        .poll(
          async () =>
            (await page.getByTestId('mobile-schedule').getByTestId('listen-day-fallback').isVisible()) ||
            (await listen.getAttribute('aria-pressed')) === 'true',
          { timeout: 6_000, intervals: [250] },
        )
        .toBe(true);
      await listen.click();
    }

    // Экспорт-блок на мобильном.
    await expect(page.getByTestId('schedule-export')).toBeVisible();
    await page.screenshot({ path: `${OUT}/ru/mobile-day-full.png`, fullPage: true });
  });

  test('EN: мобильные лейблы', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360');
    mkdirSync(`${OUT}/en`, { recursive: true });
    await signIn(page, 'en');

    await page.goto(`${BASE}/schedule`);
    await expect(page.getByTestId('mobile-schedule')).toBeVisible();
    const body = normalize(await page.getByTestId('mobile-schedule').innerText());
    expect(body, 'EN-подписи дней недели').toMatch(/\b(mon|tue|wed)\b/i);
    expect(body, 'EN: типы пар').toMatch(/\b(Lecture|Practice|Lab|Seminar)\b/);
    expect(body, 'EN: кириллицы в контенте нет').not.toMatch(/[А-Яа-яЁё]{4,}/);
    await page.screenshot({ path: `${OUT}/en/mobile-day.png`, fullPage: false });
  });
});
