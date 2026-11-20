import { expect, test, type Page } from '@playwright/test';

import { decodeQrMatrix } from '../tests/helpers/qr-decode';

// DIG-33 — e2e экрана «Карточка заявки» (Figma «06 · Заявки — карточка»).
//
// Анна — read-only сценарии: шапка (номер с копированием, пилюля,
// степпер, срок, «Ведёт»), форма исправления, параметры и вложения,
// таймлайн истории с «МСК», блок готового документа, чужой «ЗД-…» → 404.
// Илья — мутации: исправление доработки (возврат в работу + событие),
// отмена, «Задать вопрос», «Отправить на почту» (DIG-111: без кальки
// «email»). Мутации статуса живут
// только на seeded-заявках Ильи и только в проекте desktop-1440 (один
// воркер), чтобы гонки параллельных проектов не ломали друг друга;
// мобильный 360 px полностью покрывают read-only сценарии и юнит-тесты
// машины состояний DIG-30.

const YEAR = new Date().getFullYear();
const ILYA_READY = `ЗД-${YEAR}-000004`;
const ILYA_DEFER = `ЗД-${YEAR}-000005`;
const ILYA_PAPER = `ЗД-${YEAR}-000006`;

async function signIn(page: Page, login: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  if (next === '/requests') {
    await expect(page).toHaveURL(/\/requests$/);
  } else {
    await expect(page.getByTestId('canonical-request-card')).toBeVisible();
  }
}

/**
 * DIG-82 — «сканирование» QR из PDF (имитация камеры телефона): из
 * контент-стрима извлекаются квадратные модули-прямоугольники; группы
 * одинаковых квадратов по очереди собираются в матрицу и декодируются
 * (проверка BCH + Рида–Соломона автоматически отбрасывает не-QR группы,
 * например одиночные точки векторного шрифта).
 */
function decodePdfQr(pdfBytes: Buffer): string | null {
  const text = pdfBytes.toString('latin1');
  const rects = [...text.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    w: m[3],
    h: m[4],
  }));
  const groups = new Map<string, { x: number; y: number }[]>();
  for (const r of rects) {
    if (r.w !== r.h) continue;
    const arr = groups.get(r.w) ?? [];
    arr.push({ x: r.x, y: r.y });
    groups.set(r.w, arr);
  }
  const candidates = [...groups.entries()]
    .filter(([, arr]) => arr.length >= 200)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [dim, squares] of candidates) {
    const modulePt = Number(dim);
    if (!Number.isFinite(modulePt) || modulePt <= 0) continue;
    const x0 = Math.min(...squares.map((s) => s.x));
    const y0 = Math.min(...squares.map((s) => s.y));
    const cols = Math.round((Math.max(...squares.map((s) => s.x)) - x0) / modulePt) + 1;
    const rows = Math.round((Math.max(...squares.map((s) => s.y)) - y0) / modulePt) + 1;
    if (cols !== rows || cols < 21 || cols > 45) continue;
    const matrix: boolean[][] = Array.from({ length: rows }, () =>
      new Array<boolean>(cols).fill(false),
    );
    for (const s of squares) {
      const col = Math.round((s.x - x0) / modulePt);
      const row = Math.round((s.y - y0) / modulePt);
      matrix[row]![col] = true;
    }
    // PDF-координаты (y вверх) → матрица энкодера (y вниз): переворот строк.
    const decoded = decodeQrMatrix(matrix.slice().reverse()) ?? decodeQrMatrix(matrix);
    if (decoded) return decoded;
  }
  return null;
}

test('шапка карточки: номер, срок, «Ведёт», степпер, история в МСК', async ({ page }) => {
  await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/requests');
  await page.locator('[data-request-status="NEEDS_FIX"] a').first().click();
  await expect(page).toHaveURL(/\/requests\/%D0%97%D0%94-\d{4}-\d{6}$/);

  await expect(page.getByTestId('request-status-pill')).toHaveText('Нужна доработка');
  await expect(page.getByTestId('copy-request-number')).toBeVisible();

  // Часовой пояс: все метки времени заявки — в одной зоне «МСК».
  const timestamps = page.getByTestId('request-timestamp');
  const count = await timestamps.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < count; i += 1) {
    await expect(timestamps.nth(i)).toContainText('МСК');
  }

  // История — вертикальный таймлайн с причиной сотрудника.
  const history = page.getByTestId('request-history-item');
  await expect(history).toHaveCount(2);
  await expect(history.nth(1)).toContainText('Подана → Нужна доработка');
  await expect(history.nth(1)).toContainText('Укажите ФИО латиницей');
});

test('кнопка «Копировать» кладёт номер заявки в буфер обмена', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/requests');
  await page.locator('[data-request-status="NEEDS_FIX"] a').first().click();
  await expect(page).toHaveURL(/\/requests\/%D0%97%D0%94-\d{4}-\d{6}$/);

  const number = decodeURIComponent(page.url().split('/').pop()!);
  await page.getByTestId('copy-request-number').click();
  await expect(page.getByTestId('copy-request-number')).toContainText('Скопировано');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(number);
});

test('доработка: причина, форма исправления прямо в карточке', async ({ page }) => {
  await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/requests');
  await page.locator('[data-request-status="NEEDS_FIX"] a').first().click();

  await expect(page.getByTestId('request-fix-alert')).toContainText('Укажите ФИО латиницей');
  await expect(page.getByTestId('request-fix-comment')).toBeVisible();
  await expect(page.getByTestId('request-resubmit')).toBeVisible();
});

test('параметры заявки и вложения из меты мастера', async ({ page }) => {
  await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/requests');
  await page.locator('[data-request-status="NEEDS_FIX"] a').first().click();

  await expect(page.getByTestId('request-params')).toContainText('Назначение');
  await expect(page.getByTestId('request-params')).toContainText('Язык');
  await expect(page.getByTestId('request-attachments')).toContainText('scan-passport.png');
  await expect(page.getByTestId('request-attachments')).toContainText('МБ');
});

test('готовый документ: превью, скачать, проверить подлинность, email', async ({ page }) => {
  await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/requests');
  await page.locator('[data-request-status="READY"] a').first().click();
  await expect(page).toHaveURL(/\/requests\/%D0%97%D0%94-\d{4}-\d{6}$/);
  await expect(page.getByTestId('request-status-pill')).toHaveText('Готова');

  // Превью — inline-версия PDF (на 360 px скрыта, но ссылка в DOM).
  const preview = page.getByTestId('request-document-preview');
  expect(await preview.getAttribute('data')).toMatch(/\/document\?inline=1$/);

  const download = await page.getByTestId('request-document-pdf').getAttribute('href');
  const pdf = await page.request.get(download!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect(pdf.headers()['content-disposition']).toContain('attachment');

  // DIG-82 (BUG-01): в PDF есть сканируемый QR, и он ведёт на карточку
  // проверки подлинности — цепочка «скачал → отсканировал → проверил».
  const pdfBody = Buffer.from(await pdf.body());
  const qrUrl = decodePdfQr(pdfBody);
  expect(qrUrl, 'QR в PDF обязан декодироваться в ссылку проверки').toMatch(/\/verify\//);

  const cardUrl = page.url();
  await page.goto(qrUrl!);
  await expect(page.getByTestId('verify-status')).toContainText('действителен');
  await expect(page.getByTestId('verify-type')).not.toBeEmpty();

  // Возврат в карточку — остальные элементы блока документа на месте.
  await page.goto(cardUrl);
  await expect(page.getByTestId('request-document-verify')).toHaveAttribute('href', '/verify');
  await expect(page.getByTestId('request-email-send')).toBeVisible();

  // Превью отдаёт тот же PDF, но inline.
  const inline = await page.request.get(`${download!}?inline=1`);
  expect(inline.status()).toBe(200);
  expect(inline.headers()['content-disposition']).toContain('inline');
});

test('чужой номер «ЗД-…» отвечает единым 404', async ({ page }) => {
  await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/requests');
  // Заявка Ильи существует, но не Анне: единый 404 без оракула существования.
  const res = await page.goto(`/requests/${encodeURIComponent(ILYA_DEFER)}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Страница не найдена' })).toBeVisible();
});

test('публичная страница /verify открывает ввод кода проверки', async ({ page }) => {
  await page.goto('/verify');
  await expect(page.getByTestId('verify-code-input')).toBeVisible();
  await page.getByTestId('verify-code-input').fill('abcd efgh jklm npqr stuv wxyz 2345 6777');
  await page.getByTestId('verify-code-submit').click();
  await expect(page).toHaveURL(/\/verify\/ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777$/);
});

test('«Отправить на почту» фиксирует отправку на адрес профиля', async ({ page }) => {
  await signIn(page, 'ilya.petrov', 'ilya-demo-2026', `/requests/${ILYA_READY}`);
  await page.getByTestId('request-email-send').click();
  await expect(page.getByTestId('request-email-success')).toContainText('ilya.petrov@example.edu');
});

test('«Задать вопрос по заявке» создаёт обращение с номером', async ({ page }) => {
  await signIn(page, 'ilya.petrov', 'ilya-demo-2026', `/requests/${ILYA_READY}`);
  await page.getByTestId('request-question-summary').click();
  await page.getByTestId('request-question-message').fill('Когда можно забрать документ?');
  await page.getByTestId('request-question-submit').click();
  await expect(page.getByTestId('request-question-success')).toBeVisible();
});

test('исправление доработки возвращает заявку в работу и пишет событие', async ({
  page,
}, testInfo) => {
  // Мутация статуса: один воркер desktop-1440; мобильный 360 покрывает чтение.
  test.skip(
    testInfo.project.name !== 'desktop-1440',
    'мутация статуса: один воркер, мобильный 360 покрывает чтение',
  );
  await signIn(page, 'ilya.petrov', 'ilya-demo-2026', `/requests/${ILYA_DEFER}`);
  await expect(page.getByTestId('request-status-pill')).toHaveText('Нужна доработка');

  await page.getByTestId('request-fix-comment').fill('Приложил скан заявления, подписал');
  await page.getByTestId('request-resubmit').click();

  // Заявка вернулась в конвейер: «Подана» + появился срок готовности.
  await expect(page.getByTestId('request-status-pill')).toHaveText('Подана');
  await expect(page.getByTestId('request-expected-ready')).toContainText('Готовность до');

  // Событие с текстом студента написано в историю.
  const history = page.getByTestId('request-history-item');
  await expect(history).toHaveCount(3);
  await expect(history.nth(2)).toContainText('Нужна доработка → Подана');
  await expect(history.nth(2)).toContainText('Приложил скан заявления, подписал');
});

test('«Отменить» доступно до «В работе» и отменяет заявку с событием', async ({
  page,
}, testInfo) => {
  // Мутация статуса: один воркер desktop-1440; мобильный 360 покрывает чтение.
  test.skip(
    testInfo.project.name !== 'desktop-1440',
    'мутация статуса: один воркер, мобильный 360 покрывает чтение',
  );
  await signIn(page, 'ilya.petrov', 'ilya-demo-2026', `/requests/${ILYA_PAPER}`);
  await expect(page.getByTestId('request-status-pill')).toHaveText('Подана');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('request-cancel').click();
  await expect(page.getByTestId('request-status-pill')).toHaveText('Отменена');

  const history = page.getByTestId('request-history-item');
  await expect(history).toHaveCount(2);
  await expect(history.nth(1)).toContainText('Подана → Отменена');
});
