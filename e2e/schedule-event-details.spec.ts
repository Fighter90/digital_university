import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

// DIG-24 — экран «Детали пары» (боковая панель / нижний лист на мобильном,
// Figma «04 · Расписание — детали пары»). Приёмка: открывается по клику на
// пару из любого вида (?event=<id>), «Назад» браузера закрывает, фокус
// переходит в панель, Esc закрывает и возвращает фокус на блок пары,
// чужая пара по прямой ссылке → 404. Состав панели: перенос («Было →
// Стало», причина, кто изменил), отмена (причина, «Что делать»), аудитория
// и корпус («Как пройти»), преподаватель (справочник, email, «Написать»),
// онлайн-ссылка, домашнее задание и материалы, «Моя заметка» (сохранение/
// удаление), «Добавить в календарь» (.ics), «Спросить AI об этой паре».

/**
 * Вход тестового студента (Анна Ковалёва · ПИ-21). Один заход на воркер
 * (см. фикстуру storageState ниже): per-IP rate limiter входа на сервере —
 * 30 попыток / 15 минут с одного IP, а параллельные воркеры долбят логин
 * с одного localhost. Проштучный вход каждого теста с toPass-повторами
 * выжигал бюджет и каскадно лочил остальные тесты; не ослабляя лимитер,
 * логинимся один раз на воркер и переиспользуем сессию через storageState.
 */
async function signIn(page: Page) {
  await expect(async () => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
  }).toPass({
    // ограниченный повтор (гонка гидрации на первом клике): не более 3-4
    // попыток за 30 с — не «молотилка» на 60 с без пауз
    timeout: 30_000,
    intervals: [2_000, 5_000, 10_000],
  });
}

/** Каталог для сессионных файлов воркеров. */
const AUTH_DIR = path.join(os.tmpdir(), 'dig-24-e2e-auth');

/**
 * Каждый воркер входит один раз и дальше его тесты стартуют уже с сессией
 * (канонический паттерн Playwright «Authenticate once per worker»).
 */
const test = base.extend<{ storageState: string }, { workerStorageState: string }>({
  storageState: async ({ workerStorageState }, use) => {
    // фикстура Playwright, не React-хук: use() — контракт фикстур
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(workerStorageState);
  },
  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const file = path.join(
        AUTH_DIR,
        `${process.pid}-${Date.now()}-worker-${workerInfo.workerIndex}.json`,
      );
      // browser.newPage() не наследует опции тестового контекста — baseURL
      // (и пустой storageState) передаём явно, чтобы signIn ходил по «/login»
      const page = await browser.newPage({
        baseURL: workerInfo.project.use.baseURL ?? 'http://localhost:3000',
        storageState: undefined,
      });
      await signIn(page);
      await page.context().storageState({ path: file });
      await page.close();
      await use(file);
      // сессия живёт на сервере и в файле tmpdir — оставлять её осознанно
      // нечего (демо-данные), файл удаляем вместе с воркером
      fs.rmSync(file, { force: true });
    },
    { scope: 'worker' },
  ],
});

test.describe('desktop 1440 — панель из вида «Неделя»', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  // сессия приходит из worker-scoped storageState — повторный вход не нужен

  test('клик по паре открывает панель по ?event=; Esc закрывает и возвращает фокус; «Назад» закрывает', async ({
    page,
  }) => {
    await page.goto('/schedule');

    // перенос «сегодня» (sch-pi21-4, демо-данные): блок пары — ссылка
    const lesson = page.getByTestId('lesson-sch-pi21-4');
    await expect(lesson).toBeVisible();
    await lesson.click();

    await expect(page).toHaveURL(/event=sch-pi21-4/);
    const dialog = page.getByTestId('event-details-panel');
    // 10с — гидрация панели под нагрузкой параллельного прогона двух проектов
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText('Программирование');
    // жёлтый блок переноса: «Было → Стало», причина и кто изменил
    await expect(dialog).toContainText('Было: ауд. 214, 12:00');
    await expect(dialog).toContainText('Стало: ауд. 305, 12:00');
    await expect(dialog).toContainText('Причина: Аудитория 214 занята факультетским мероприятием');
    await expect(dialog).toContainText('Изменил(а): Мария Петрова (деканат)');
    // аудитория и корпус с «Как пройти»
    await expect(dialog).toContainText('ауд. 305');
    await expect(dialog).toContainText('Главный корпус');
    await expect(dialog.getByRole('button', { name: 'Как пройти' })).toBeVisible();
    // действия: ICS одной пары и AI
    await expect(dialog.getByText('Добавить в календарь')).toBeVisible();
    await expect(dialog.getByText('Спросить AI об этой паре')).toBeVisible();

    // фокус при открытии — в панели (a11y-требование приёмки); эффект
    // начального фокуса срабатывает после гидрации — ждём через expect.poll
    // (таймаут с запасом: полный прогон идёт параллельно двум проектам)
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (document.activeElement?.closest('[role="dialog"]') ?? null) !== null &&
              document.activeElement?.getAttribute('data-testid') === 'event-details-panel',
          ),
        { timeout: 10_000 },
      )
      .toBe(true);

    // Esc закрывает панель, фокус возвращается на блок пары, ?event= уходит из URL
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    // фокус возвращает эффект закрытия панели — ждём, а не читаем мгновенно
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.getAttribute('data-event-id') ?? null),
        { timeout: 10_000 },
      )
      .toBe('sch-pi21-4');
    await expect(page).not.toHaveURL(/event=/);

    // «Назад» браузера ведёт к записи до открытия панели (панель закрыта)
    await page.goBack();
    await expect(page.getByTestId('event-details-panel')).toHaveCount(0);
    await expect(page).not.toHaveURL(/event=/);
  });

  test('отменённая пара: красный блок с причиной и «Что делать»', async ({ page }) => {
    await page.goto('/schedule?event=sch-pi21-5');
    const dialog = page.getByTestId('event-details-panel');
    // 10с — гидрация панели под нагрузкой параллельного прогона двух проектов
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText('Причина: Лаборатория закрыта');
    await expect(dialog).toContainText('Что делать: Занятие будет восполнено 20 ноября, ауд. 212');
  });

  test('«Моя заметка» сохраняется и удаляется; действие ICS указывает на файл пары', async ({
    page,
  }) => {
    await page.goto('/schedule?event=sch-pi21-1');
    const dialog = page.getByTestId('event-details-panel');
    // 10с — гидрация панели под нагрузкой параллельного прогона двух проектов
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // состав: домашнее задание, материалы, преподаватель с email и справочником
    await expect(dialog).toContainText('Подготовить вопросы к коллоквиуму');
    await expect(dialog).toContainText('Конспект лекции №7, слайды в библиотеке');
    await expect(dialog.getByRole('link', { name: 'Петров Пётр Петрович' })).toHaveAttribute(
      'href',
      '/directory',
    );
    await expect(dialog.getByText('p.petrov@example.edu')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Написать' })).toHaveAttribute(
      'href',
      'mailto:p.petrov@example.edu',
    );
    await expect(dialog.getByRole('link', { name: 'Добавить в календарь' })).toHaveAttribute(
      'href',
      '/api/schedule/sch-pi21-1/ics',
    );

    // заметка: сохранить → сервер вернул сохранённый текст в редактор
    // (revalidate перерисовывает панель заметкой из слоя данных; server action
    // при параллельном прогоне двух проектов бывает нетороплив — таймаут 15с)
    const textarea = dialog.getByRole('textbox');
    await textarea.fill('Принести конспект и ноутбук');
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog.getByText('Заметка сохранена')).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole('textbox')).toHaveValue('Принести конспект и ноутбук');
    // удаление возвращает пустой редактор
    await dialog.getByRole('button', { name: 'Удалить' }).click();
    await expect(dialog.getByRole('textbox')).toHaveValue('', { timeout: 10_000 });
  });
});

test.describe('mobile 360 — нижний лист из мобильного вида', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  // сессия приходит из worker-scoped storageState — повторный вход не нужен

  test('клик по карточке пары открывает нижний лист, отмена видна составом, Esc возвращает фокус, без гор. скролла', async ({
    page,
  }) => {
    await page.goto('/schedule');

    const card = page.getByTestId('day-card-sch-pi21-5');
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/event=sch-pi21-5/);
    const dialog = page.getByTestId('event-details-panel');
    // 10с — гидрация панели под нагрузкой параллельного прогона двух проектов
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText('Физика');
    await expect(dialog).toContainText('Причина: Лаборатория закрыта');
    await expect(dialog).toContainText('Что делать: Занятие будет восполнено 20 ноября, ауд. 212');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    // фокус возвращает эффект закрытия панели — ждём, а не читаем мгновенно
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.getAttribute('data-event-id') ?? null),
        { timeout: 10_000 },
      )
      .toBe('sch-pi21-5');
    await expect(page).not.toHaveURL(/event=/);
  });

  test('онлайн-пара: ссылка на встречу вместо «Как пройти»', async ({ page }) => {
    await page.goto('/schedule?event=sch-pi21-6');
    const dialog = page.getByTestId('event-details-panel');
    // 10с — гидрация панели под нагрузкой параллельного прогона двух проектов
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText('онлайн');
    const meeting = dialog.getByRole('link', { name: 'Ссылка на онлайн-встречу' });
    await expect(meeting).toHaveAttribute('href', 'https://meet.example.edu/hist-seminar');
    await expect(dialog.getByRole('button', { name: 'Как пройти' })).toHaveCount(0);
  });
});

test.describe('прямой URL — uniform 404 на чужую и несуществующую пару', () => {
  // сессия приходит из worker-scoped storageState — повторный вход не нужен

  test('чужая пара (группа ЭК-11) → 404', async ({ page }) => {
    await page.goto('/schedule?event=sch-ek11-1');
    // 10с — рендер not-found под нагрузкой параллельного прогона двух проектов
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('event-details-panel')).toHaveCount(0);
  });

  test('несуществующий id → тот же 404 (не раскрывает существование)', async ({ page }) => {
    await page.goto('/schedule?event=no-such-pair');
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('event-details-panel')).toHaveCount(0);
  });
});

test.describe('ICS одной пары — роут GET /api/schedule/[id]/ics', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  // сессия приходит из worker-scoped storageState — повторный вход не нужен

  // Ревью DIG-24 r2: роут не имел поведенческих тестов (только чистый
  // toEventIcsInput и href кнопки) — прецедент покрытия: e2e/session.spec.ts
  // (ICS сессии: 200 + text/calendar + VEVENT + attachment; 404).

  test('своя пара: 200, text/calendar, VCALENDAR с VEVENT пары, вложение', async ({ page }) => {
    const response = await page.request.get('/api/schedule/sch-pi21-1/ics');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('END:VEVENT');
    expect(body).toContain('END:VCALENDAR');
    // UID одной пары — по контракту delta-спеки
    expect(body).toContain('UID:event-sch-pi21-1@digital-deanery');
    expect(body).toContain('DTSTART:');
    // SUMMARY = «<тип>: <дисциплина>» (sch-pi21-1 — лекция «Информатика»),
    // LOCATION = аудитория
    expect(body).toContain('SUMMARY:Лекция: Информатика');
    expect(body).toContain('LOCATION:ауд. 301');
    const disposition = response.headers()['content-disposition'] ?? '';
    expect(disposition).toContain('attachment');
    // файл персональный — не кэшируется
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('чужая пара (ЭК-11) и несуществующий id — единый 404 JSON', async ({ page }) => {
    for (const id of ['sch-ek11-1', 'no-such-pair']) {
      const response = await page.request.get(`/api/schedule/${id}/ics`);
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    }
  });
});

test.describe('ширина 720 px (<768) — панель остаётся нижним листом', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 as runner');

  test('720×800: панель во всю ширину окна, а не правая колонка 420 px', async ({ page }) => {
    // В диапазоне 640–767 страница показывает мобильный вид (md-hidden),
    // и по delta-спеке панель обязана оставаться нижним листом до 768 px.
    await page.setViewportSize({ width: 720, height: 800 });
    await page.goto('/schedule?event=sch-pi21-5');
    const dialog = page.getByTestId('event-details-panel');
    // 10с — гидрация панели под нагрузкой параллельного прогона двух проектов
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(
      box!.width,
      'панель должна быть нижним листом на всю ширину 720 px, а не правой колонкой',
    ).toBe(720);
    expect(box!.x).toBe(0);
  });
});
