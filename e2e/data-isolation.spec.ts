import { expect, test, type Page } from '@playwright/test';

// DIG-12 — IDOR e2e: a student MUST NOT open another student's request,
// neither by page URL nor via the API. The scenario is fully black-box:
// Ilya signs in first, his request number is read from HIS OWN /requests
// list (numbers are random per boot), then Anna signs in and tries that
// number — the answer must be the uniform 404 in both surfaces.

async function signIn(page: Page, login: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

test('Anna gets a uniform 404 for Ilya’s request — page and API', async ({ browser }) => {
  const ilya = await browser.newContext();
  const ilyaPage = await ilya.newPage();
  await signIn(ilyaPage, 'ilya', 'demo-ilya-2026', '/requests');
  await expect(ilyaPage).toHaveURL(/\/requests$/);
  await expect(ilyaPage.getByRole('heading', { level: 1, name: 'Мои заявки' })).toBeVisible();

  // Илья видит только свои заявки и берём ПЕРВУЮ — её номер случайный за этот запуск.
  const ownCard = ilyaPage.locator('main a[href^="/requests/SR-"]').first();
  await expect(ownCard).toBeVisible();
  const ilyaNumber = (await ownCard.getAttribute('href'))!.split('/').pop()!;
  expect(ilyaNumber).toMatch(/^SR-\d{4}-[A-Z0-9]{5}$/);

  const anna = await browser.newContext();
  const annaPage = await anna.newPage();
  await signIn(annaPage, 'anna', 'demo-anna-2026', '/requests');
  await expect(annaPage).toHaveURL(/\/requests$/);

  // Список Анны не содержит заявок Ильи.
  const annaNumbers = await annaPage.locator('main a[href^="/requests/SR-"]').all();
  for (const card of annaNumbers) {
    const href = await card.getAttribute('href');
    expect(href).not.toContain(ilyaNumber);
  }

  // Подставленный адрес чужой заявки → 404 (единая страница, не 403, не редирект).
  const res = await annaPage.goto(`/requests/${ilyaNumber}`);
  expect(res?.status()).toBe(404);
  await expect(
    annaPage.getByRole('heading', { level: 1, name: 'Страница не найдена' }),
  ).toBeVisible();

  // То же для API: единый 404 JSON без раскрытия факта существования.
  const apiRes = await annaPage.request.get(`/api/requests/${ilyaNumber}`);
  expect(apiRes.status()).toBe(404);
  expect(await apiRes.json()).toEqual({ error: 'not_found' });

  // Несуществующий номер отвечает ровно так же (нет оракула существования).
  const missingRes = await annaPage.request.get('/api/requests/SR-2026-ZZZZZ');
  expect(missingRes.status()).toBe(404);
  expect(await missingRes.json()).toEqual({ error: 'not_found' });

  // Свою заявку Анна по-прежнему открывает (изоляция не сломала доступ).
  await annaPage.goto('/requests');
  const ownHref = await annaPage
    .locator('main a[href^="/requests/SR-"]')
    .first()
    .getAttribute('href');
  await annaPage.goto(ownHref!);
  await expect(annaPage.getByRole('heading', { level: 2, name: 'История заявки' })).toBeVisible();

  await ilya.close();
  await anna.close();
});

test('anonymous probing of a request number cannot even reach the data layer', async ({
  request,
}) => {
  const res = await request.get('/api/requests/SR-2026-AAAAA');
  // Middleware перенаправляет анонима на /login — данные не отдаются никому.
  expect(res.status()).toBeLessThan(400); // redirect chain result is the login page
  const body = await request.get('/api/requests/SR-2026-AAAAA', { maxRedirects: 0 });
  expect([302, 307]).toContain(body.status());
  expect(
    body
      .headersArray()
      .some((h) => h.name.toLowerCase() === 'location' && h.value.includes('/login')),
  ).toBe(true);
});
