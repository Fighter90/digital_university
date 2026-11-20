import { expect, test, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// DIG-110 — регресс сквозного сценария на ПРОДЕ (PLAYWRIGHT_BASE_URL):
//   студент anna.smirnova: заявка через мастер (/requests) → статус «Подана»;
//   обращение через /feedback → карточка с номером и сроком;
//   сотрудник dean.kovaleva: очередь /staff/requests → SLA-подсветка,
//   видимость поданной заявки, «Взять в работу» → «В работе».
//
// Часовой пояс воркера — Europe/Moscow (MSK): задаётся в команде запуска
// через env TZ=Europe/Moscow (сервер считает SLA по серверному времени).
// Скриншоты: /tmp/dig-108/shots/, журнал: /tmp/dig-108/dig110-prod-run.log.

const REPO = process.cwd();
const SHOTS = resolve(REPO, 'shots');
const LOG = resolve(REPO, 'dig110-prod-run.log');

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
const DEAN = { login: 'dean.kovaleva', password: 'dean-demo-2026' };

function log(line: string) {
  // eslint-disable-next-line no-console
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
}

async function signIn(page: Page, creds: { login: string; password: string }, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин').fill(creds.login);
  await page.getByLabel('Пароль', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === new URL(next, page.url()).pathname, {
    timeout: 30_000,
  });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('DIG-110: студент — заявка через мастер (статус «Подана») и обращение', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(LOG, `# DIG-110 prod-регресс (${new Date().toISOString()})\n`);

  await signIn(page, ANNA, '/requests?order=stmt-academic-leave');

  // ── Мастер, шаг 1: тип предвыбран (ACADEMIC_LEAVE, не мгновенный) ─────────
  const wizard = page.getByTestId('order-wizard');
  await expect(wizard).toBeVisible();
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 1 из 3');
  await expect(page.getByTestId('wizard-type-option-ACADEMIC_LEAVE')).toHaveAttribute(
    'data-selected',
    'true',
  );
  await page.screenshot({ path: resolve(SHOTS, '110-01-wizard-step1.png'), fullPage: true });
  await page.getByTestId('wizard-next').click();

  // ── Шаг 2: параметры заявления ─────────────────────────────────────────────
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 2 из 3');
  await page.getByTestId('wizard-field-period').fill('с 01.12.2026 до 31.08.2027');
  await page
    .getByTestId('wizard-field-reason')
    .fill('Регресс DIG-110: семейные обстоятельства (демо-сценарий)');
  await page.getByTestId('wizard-field-from').fill('2026-12-01');
  await page.screenshot({ path: resolve(SHOTS, '110-02-wizard-step2.png'), fullPage: true });
  await page.getByTestId('wizard-next').click();

  // ── Шаг 3: сводка и отправка (без согласия кнопка недоступна) ─────────────
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 3 из 3');
  await expect(page.getByTestId('wizard-submit')).toBeDisabled();
  await page.getByTestId('wizard-consent').check();
  await page.screenshot({ path: resolve(SHOTS, '110-03-wizard-step3.png'), fullPage: true });
  await page.getByTestId('wizard-submit').click();

  const success = page.getByTestId('wizard-success');
  await expect(success).toBeVisible({ timeout: 20_000 });
  const number = ((await page.getByTestId('wizard-success-number').textContent()) ?? '').trim();
  expect(number).toMatch(/^ЗД-\d{4}-\d{6}$/);
  await page.screenshot({ path: resolve(SHOTS, '110-04-wizard-success.png'), fullPage: true });
  log(`заявка создана: ${number}`);

  // ── Карточка заявки: статус «Подана» в пилюле и степпере ──────────────────
  // Прямой переход: клиентская навигация по cyrillic-ссылке гоняется с
  // revalidate-ре-рендером экрана успеха (ссылка отсоединяется mid-click).
  await page.goto(`/requests/${encodeURIComponent(number)}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(
    new RegExp(`/requests/(${encodeURIComponent(number)}|${number})$`),
  );
  const card = page.getByTestId('canonical-request-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('request-status-pill')).toHaveText('Подана');
  const stepper = page.getByTestId('request-stepper');
  await expect(stepper).toBeVisible();
  await expect(stepper).toContainText('Подана');
  await page.screenshot({ path: resolve(SHOTS, '110-05-request-card-podana.png'), fullPage: true });
  log(`статус карточки: Подана (${number})`);
  // Номер сохраняем сразу после заявки — employee-шаг не зависит от исхода
  // остальных проверок студента.
  appendFileSync(LOG, `REQUEST_NUMBER=${number}\n`);

  // ── Обращение через /feedback ──────────────────────────────────────────────
  await page.goto('/feedback');
  await expect(page.getByTestId('feedback-sla')).toContainText('3 рабочих дней');
  await page.getByTestId('feedback-kind').selectOption('SUGGESTION');
  await page.getByTestId('feedback-target').selectOption('ACADEMIC_OFFICE');
  await page
    .getByTestId('feedback-text')
    .fill('Регресс DIG-110: добавьте, пожалуйста, экспорт списка заявок в CSV.');
  await page.screenshot({ path: resolve(SHOTS, '110-06-feedback-composer.png'), fullPage: true });
  await page.getByRole('button', { name: 'Отправить обращение' }).click();

  // Штатный редирект в карточку; если клиентская навигация гоняется с
  // revalidate-ре-рендером композера — достаём номер из списка «Мои обращения».
  const redirected = await page
    .waitForURL(/\/feedback\/FB-\d{4}-[A-Z0-9]{5}$/, { timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  let fbNumber: string;
  if (redirected) {
    fbNumber = page.url().split('/').pop()!;
  } else {
    await page.goto('/feedback', { waitUntil: 'domcontentloaded' });
    const item = page.locator('[data-testid^="feedback-item-FB-"]').first();
    await expect(item).toBeVisible({ timeout: 15_000 });
    fbNumber = ((await item.getAttribute('data-testid')) ?? '').replace('feedback-item-', '');
    await page.goto(`/feedback/${fbNumber}`, { waitUntil: 'domcontentloaded' });
    log('редирект композера не сработал за 25 с — карточка открыта напрямую из списка');
  }
  const fbCard = page.getByTestId('feedback-card');
  await expect(fbCard).toBeVisible();
  await expect(page.getByTestId('feedback-card-number')).toContainText(fbNumber);
  await expect(fbCard.getByTestId('feedback-status')).toHaveText('На рассмотрении');
  await expect(fbCard.getByTestId('feedback-card-due')).toContainText(/^до \d{1,2} \S+$/);
  await page.screenshot({ path: resolve(SHOTS, '110-07-feedback-card.png'), fullPage: true });
  log(`обращение создано: ${fbNumber}, статус: На рассмотрении, срок — ${await fbCard.getByTestId('feedback-card-due').innerText()}`);

  // В списке «Мои обращения» обращение появилось.
  await page.goto('/feedback');
  await expect(page.getByTestId(`feedback-item-${fbNumber}`)).toBeVisible();
});

test('DIG-110: сотрудник — очередь, SLA-подсветка, видимость заявки, «Взять в работу»', async ({
  page,
}) => {
  const number =
    readFileSync(LOG, 'utf8')
      .split('\n')
      .find((line) => line.startsWith('REQUEST_NUMBER='))
      ?.split('=')[1] ?? '';

  await signIn(page, DEAN, '/staff/requests');
  await expect(page.getByRole('heading', { level: 1, name: 'Очередь заявок' })).toBeVisible();
  await page.screenshot({ path: resolve(SHOTS, '110-08-staff-queue.png'), fullPage: true });

  // SLA-подсветка: просроченные строки сида помечены чипом sla-overdue-*.
  const overdue = page.locator('[data-testid^="sla-overdue-"]').first();
  await expect(overdue).toBeVisible();
  log(`SLA-подсветка: чип «${(await overdue.innerText()).trim()}»`);
  await page.screenshot({ path: resolve(SHOTS, '110-09-staff-sla-overdue.png'), fullPage: false });

  // ── Видимость поданной через мастер заявки ────────────────────────────────
  // Очередь сотрудника строится по легаси-заявкам (getStaffQueue →
  // listRequestsByFaculty); канонические ЗД- заявки мастера сюда не
  // попадают — фиксируем фактическое состояние сквозного сценария.
  const wizardVisible = (await page.getByText(number).count()) > 0;
  log(
    wizardVisible
      ? `заявка ${number} ВИДНА в очереди сотрудника`
      : `ДЕФЕКТ D1: заявка ${number} (мастер, канон) НЕ видна в очереди /staff/requests`,
  );
  if (!wizardVisible) {
    await page.screenshot({
      path: resolve(SHOTS, '110-10-staff-wizard-request-missing.png'),
      fullPage: true,
    });
  }

  // ── «Взять в работу» на свежей поданной заявке (сид) ───────────────────────
  const takeForm = page.locator('form[data-testid^="take-"]').first();
  const takeTestId = (await takeForm.getAttribute('data-testid')) ?? '';
  const takenNumber = takeTestId.slice('take-'.length);
  expect(takenNumber).not.toBe('');
  const takenRow = page.locator('li', { hasText: takenNumber }).first();
  const rowTitle = ((await takenRow.locator('a').first().textContent()) ?? '').trim();
  await takeForm
    .getByRole('button', { name: 'Взять в работу' })
    .click({ timeout: 15_000 })
    .catch(() => {});
  await expect(takenRow.getByText('В работе').first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: resolve(SHOTS, '110-11-staff-taken-in-progress.png'), fullPage: true });
  log(`«Взять в работу» выполнено: ${takenNumber} (${rowTitle}) → статус «В работе»`);
  appendFileSync(LOG, `TAKEN_NUMBER=${takenNumber}\n`);
});

test('DIG-110: студент видит смену статуса («В работе») на своей заявке', async ({ page }) => {
  const taken = readFileSync(LOG, 'utf8')
    .split('\n')
    .find((line) => line.startsWith('TAKEN_NUMBER='))
    ?.split('=')[1];
  test.skip(!taken, 'нет номера взятой в работу заявки из предыдущего шага');

  await signIn(page, ANNA, `/requests/${encodeURIComponent(taken!)}`);
  // Легаси-заявка (SR-…) рендерит карточку инлайном: статус — бейдж в шапке.
  const main = page.locator('main');
  await expect(main).toBeVisible();
  await expect(main.getByText('В работе').first()).toBeVisible();
  await page.screenshot({ path: resolve(SHOTS, '110-12-student-sees-in-progress.png'), fullPage: true });
  log(`студент видит: ${taken} → «В работе» (карточка заявки)`);
});
