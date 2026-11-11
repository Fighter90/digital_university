import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// DIG-50 — e2e прод-сборки на prisma-store (DATABASE_URL → PostgreSQL).
//
// Приёмка задачи: на прод-сборке (`pnpm build && pnpm start`) вход выполняется
// под сидом БД (anna.smirnova / anna-demo-2026) → /dashboard, кука
// __Host-session выставлена, шапка показывает реального пользователя (не стаб
// «Анна Студентова»), и сессии разных пользователей изолированы (ilya ≠ anna).
//
// Спека активна только когда сервер работает на prisma-store (видно из
// /api/health → authStore). На memory-store (локальный запуск без DATABASE_URL)
// аккаунтов сида не существует — тесты честно пропускаются, а не падают.
//
// Лимиты сервера (30 попыток/15 мин на IP, блокировка после 5 неудач) общие
// для всех воркеров: реальная пара «вход/изоляция» собрана в desktop-серию,
// чтобы не драться за один аккаунт с мобильным воркером.

type Health = { ok: boolean; authStore?: 'prisma' | 'memory' };

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
const ILYA = { login: 'ilya.petrov', password: 'ilya-demo-2026' };
const SUBMIT = { name: 'Войти', exact: true } as const;

async function storeKind(request: APIRequestContext) {
  const res = await request.get('/api/health');
  const health = (await res.json()) as Health;
  return health.authStore ?? 'memory';
}

async function signIn(page: Page, creds: { login: string; password: string }, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Логин').fill(creds.login);
  await page.getByLabel('Пароль', { exact: true }).fill(creds.password);
  await page.getByRole('button', SUBMIT).click();
}

test.describe('DIG-50: prod build on the prisma store — desktop-1440', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');
  test.describe.configure({ mode: 'serial' });

  // Skip-хук общий для серии: на memory-store сид БД не активен.
  test.beforeEach(async ({ request }, testInfo) => {
    testInfo.skip(
      (await storeKind(request)) !== 'prisma',
      'DIG-50 spec requires the prisma auth store (DATABASE_URL)',
    );
  });

  test('вход под сидом БД попадает на /dashboard с __Host-session', async ({ page }) => {
    await signIn(page, ANNA, '/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);

    const session = await page.context().cookies();
    const host = session.find((c) => c.name === '__Host-session');
    expect(host, 'кука __Host-session обязана быть выставлена').toBeTruthy();
    expect(host!.httpOnly, 'токен сессии недоступен из JS').toBe(true);
    expect(host!.sameSite).toBe('Lax');

    // Реальный пользователь вместо стаба «Анна Студентова»: меню аватара
    // раскрывает личность сессии (профиль владельца логина из слоя данных).
    await expect(page.getByText('Студентова')).toHaveCount(0);
    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    const menu = page.getByRole('menu', { name: 'Меню пользователя' });
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Анна Ковалёва');
  });

  test('изоляция: сессия Ильи — не сессия Анны, чужой номер заявки даёт 404', async ({
    page,
    browser,
  }) => {
    // Анна входит и читает номер СВОЕЙ заявки (номер случаен за этот запуск).
    await signIn(page, ANNA, '/requests');
    await expect(page).toHaveURL(/\/requests$/);
    const annaCookie = (await page.context().cookies()).find((c) => c.name === '__Host-session')!;
    const ownHref = await page
      .locator('main a[href^="/requests/SR-"]')
      .first()
      .getAttribute('href');
    const annaNumber = ownHref!.split('/').pop()!;
    expect(annaNumber).toMatch(/^SR-\d{4}-[A-Z0-9]{5}$/);

    // Илья входит в отдельном контексте: токен сессии свой, личность своя.
    const ilya = await browser.newContext();
    const ilyaPage = await ilya.newPage();
    await signIn(ilyaPage, ILYA, '/requests');
    await expect(ilyaPage).toHaveURL(/\/requests$/);
    const ilyaCookie = (await ilyaPage.context().cookies()).find(
      (c) => c.name === '__Host-session',
    )!;
    expect(ilyaCookie.value, 'у каждого пользователя своя сессия').not.toBe(annaCookie.value);
    expect(ilyaCookie.value).toBeTruthy();

    // Чужая (Анна) заявка для Ильи — равномерный 404: страница и API.
    const res = await ilyaPage.goto(`/requests/${annaNumber}`);
    expect(res?.status()).toBe(404);
    const api = await ilyaPage.request.get(`/api/requests/${annaNumber}`);
    expect(api.status()).toBe(404);
    expect(await api.json()).toEqual({ error: 'not_found' });

    // Список Ильи не содержит номер Анны.
    const ilyaNumbers = await ilyaPage
      .locator('main a[href^="/requests/SR-"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    for (const href of ilyaNumbers) expect(href).not.toContain(annaNumber);

    await ilya.close();
  });
});
