import { expect, test, type Page } from '@playwright/test';

// DIG-32 — e2e экрана «Мои заявки» (Figma «06 · Заявки — мои заявки»).
// Полностью читательный сценарий: ничего не мутирует (отмена/повторная
// подача покрыты юнит-тестами машины состояний), чтобы не мешать
// параллельным проектам 1440/360 и спеке изоляции данных на том же сиде.
//
// Приёмка: пилюли со счётчиками (Все · В работе · Нужно действие ·
// Готовы · Архив), «Нужна доработка» всегда наверху и выделена, поиск
// по номеру/названию, кнопка «Скачать PDF» готовой заявки, клик по
// карточке → «Карточка заявки», компактный степпер на 360 px.

async function signIn(page: Page) {
  await page.goto(`/login?next=${encodeURIComponent('/requests')}`);
  await page.getByLabel('Логин').fill('anna.smirnova');
  await page.getByLabel('Пароль', { exact: true }).fill('anna-demo-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/requests$/);
}

const PILLS = ['Все', 'В работе', 'Нужно действие', 'Готовы', 'Архив'] as const;
const PILL_COUNTS: Record<(typeof PILLS)[number], string> = {
  Все: '5',
  'В работе': '2',
  'Нужно действие': '1',
  Готовы: '1',
  Архив: '1',
};

test('пилюли со счётчиками, «Нужна доработка» наверху, поиск и скачивание PDF', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Мои заявки' })).toBeVisible();

  // Пилюли-фильтры со счётчиками (сумма корзин = «Все»).
  const filters = page.getByTestId('requests-filters');
  for (const pill of PILLS) {
    const button = filters.getByRole('button', { name: pill, exact: true });
    await expect(button, `счётчик пилюли «${pill}»`).toContainText(PILL_COUNTS[pill]);
  }

  const cards = page.getByTestId('request-card');
  await expect(cards).toHaveCount(5);

  // «Нужна доработка» — первая карточка, выделена и с причиной из задачи.
  const fixCard = page.locator('[data-request-status="NEEDS_FIX"]');
  await expect(cards.first()).toHaveAttribute('data-request-status', 'NEEDS_FIX');
  await expect(fixCard).toContainText('Справка об обучении · для военкомата');
  await expect(fixCard).toContainText('Нужна доработка: Укажите ФИО латиницей');
  await expect(fixCard.getByTestId('request-action-fix')).toBeVisible();

  // Готовая заявка: строка готовности и кнопка «Скачать PDF».
  const readyCard = page.locator('[data-request-status="READY"]');
  await expect(readyCard).toHaveCount(1);
  await expect(readyCard).toContainText('Документ готов к скачиванию');
  const downloadHref = await readyCard.getByTestId('request-action-download').getAttribute('href');
  expect(downloadHref).toMatch(/^\/api\/requests\/(%D0%97%D0%94|ЗД)-\d{4}-\d{6}\/document$/);

  // Документ отдаётся владельцем по ссылке (PDF).
  const pdf = await page.request.get(downloadHref!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');

  // Поиск по названию: одна карточка; пустой результат даёт сброс.
  const search = page.getByTestId('requests-search');
  await search.fill('военкомат');
  await expect(cards).toHaveCount(1);
  await search.fill('стипендия-нет-такой');
  await expect(page.getByTestId('requests-reset')).toBeVisible();
  await page.getByTestId('requests-reset').click();
  await expect(cards).toHaveCount(5);

  // Поиск по фрагменту номера: канон «ЗД-» и legacy «SR-».
  await search.fill('зд-2026');
  await expect(cards).toHaveCount(3);
  await search.fill('sr-2026');
  await expect(cards).toHaveCount(2);
  await search.fill('');

  // Пилюля «Готовы» фильтрует список до одной готовой.
  await filters.getByRole('button', { name: 'Готовы', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-request-status', 'READY');
  await filters.getByRole('button', { name: 'Все', exact: true }).click();
  await expect(cards).toHaveCount(5);
});

test('клик по карточке открывает «Карточку заявки» (ЗД-…)', async ({ page }) => {
  await signIn(page);

  // Клик по подложке карточки «Нужна доработка» (не по кнопке «Исправить»).
  await page.locator('[data-request-status="NEEDS_FIX"] a').first().click();
  await expect(page).toHaveURL(/\/requests\/%D0%97%D0%94-\d{4}-\d{6}$/);

  const card = page.getByTestId('canonical-request-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('request-status-pill')).toHaveText('Нужна доработка');
  await expect(page.getByTestId('request-fix-alert')).toContainText(
    'Нужна доработка: Укажите ФИО латиницей',
  );
  // Действия студента по машине состояний DIG-30.
  await expect(page.getByTestId('request-resubmit')).toBeVisible();

  // История заявки: подача и возврат на доработку.
  const history = page.getByTestId('request-history-item');
  await expect(history).toHaveCount(2);
  await expect(history.nth(1)).toContainText('Подана → Нужна доработка');

  // Legacy-карточка (SR-…) тоже кликается в свою карточку.
  await page.goto('/requests');
  const legacyHref = await page.locator('a[href^="/requests/SR-"]').first().getAttribute('href');
  const legacyNumber = legacyHref!.split('/').pop()!;
  await page.locator(`a[href="/requests/${legacyNumber}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/requests/${legacyNumber}$`));
  // Карточка legacy-заявки показывает её номер (детальный экран DIG-12).
  await expect(page.locator('section')).toContainText(legacyNumber);
});

test('готовая заявка открывается в карточке со скачиванием PDF', async ({ page }) => {
  await signIn(page);
  await page.locator('[data-request-status="READY"] a').first().click();
  await expect(page).toHaveURL(/\/requests\/%D0%97%D0%94-\d{4}-\d{6}$/);
  await expect(page.getByTestId('request-status-pill')).toHaveText('Готова');
  await expect(page.getByTestId('request-document-pdf')).toBeVisible();

  const href = await page.getByTestId('request-document-pdf').getAttribute('href');
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
});

test('степпер отзывчив: компактный на 360 px, полный — от 640 px', async ({ page }) => {
  await signIn(page);
  const compact = page.getByTestId('request-stepper-compact');
  const full = page.getByTestId('request-stepper');
  const isMobile = test.info().project.name === 'mobile-360';

  // NEEDS_FIX: шаг 1 «Подана»; READY: шаг 4 «Готова».
  if (isMobile) {
    await expect(compact.first()).toBeVisible();
    await expect(compact.first()).toContainText('Шаг 1 из 5 · Подана');
    const readyCompact = page
      .locator('[data-request-status="READY"]')
      .getByTestId('request-stepper-compact');
    await expect(readyCompact).toContainText('Шаг 4 из 5 · Готова');
    await expect(full.first()).not.toBeVisible();
  } else {
    await expect(full.first()).toBeVisible();
    await expect(full.first()).toContainText('Подана');
    await expect(full.first()).toContainText('Выдана');
    await expect(compact.first()).not.toBeVisible();
  }
});
