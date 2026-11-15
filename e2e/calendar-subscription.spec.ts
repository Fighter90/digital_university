import { expect, test, type Page } from '@playwright/test';

// DIG-63 — живая ICS-подписка расписания и дедлайнов (чёрный ящик):
//  1) персональная подписанная ссылка рендерится на «Сессии» и стабильна
//     между визитами (календарь подписчика не ломается);
//  2) фид — валидный ICS (RFC 5545: CRLF, VCALENDAR/VEVENT, DTSTART),
//     события соответствуют расписанию группы и контрольным сессии
//     (экзамен + пересдача + консультация + пара), чужая группа не видна;
//  3) токен отзывается при выходе: прежняя ссылка отвечает 404 навсегда;
//  4) без токена — единый 404 (нет оракула), сотруднику карточка не
//     показывается.

const FEED_URL_PATTERN = /^https?:\/\/.+\/api\/calendar\/ics\?token=v1\./;

async function signIn(page: Page, login: string, password: string, next?: string) {
  const target = next ?? '/dashboard';
  await page.goto(`/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === new URL(target, page.url()).pathname, {
    timeout: 15_000,
  });
}

async function subscribeUrlOf(page: Page): Promise<string> {
  return page.getByTestId('calendar-subscribe-url').inputValue();
}

test.describe('DIG-63: ICS-подписка — студент', () => {
  test('фид валиден и события соответствуют расписанию и сессии', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/session');

    const url = await subscribeUrlOf(page);
    expect(url).toMatch(FEED_URL_PATTERN);

    // Повторный визит — та же ссылка (одна активная подписка на студента).
    await page.goto('/grades/session');
    await expect(page.getByTestId('calendar-subscribe-url')).toHaveValue(url);

    const response = await page.request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');

    const ics = await response.text();
    // Валидность: корневые свойства, только CRLF, сбалансированные VEVENT.
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(ics.match(/END:VEVENT/g)?.length);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThan(0);
    expect(ics).toContain('X-WR-CALNAME:Цифровой деканат · ПИ-21');

    // Соответствие расписанию группы ПИ-21: пара, консультация, перенос
    // и отменённая пара — и контрольные точки (экзамен, пересдача).
    expect(ics).toContain('UID:lesson-sch-pi21-1@digital-deanery');
    expect(ics).toContain('UID:lesson-sch-pi21-consult-prog@digital-deanery');
    expect(ics).toMatch(/SUMMARY:Лекция: Информатика/);
    expect(ics).toMatch(/SUMMARY:Консультация: Программирование/);
    expect(ics).toMatch(/SUMMARY:Отменена: Физика/);
    expect(ics).toMatch(/SUMMARY:Экзамен: Базы данных/);
    expect(ics).toMatch(/SUMMARY:Пересдача: Информатика/);
    // Перенос деканатом виден в описании события (живое обновление).
    expect(ics).toMatch(/Перенос: ауд\. 214 → 305/);
    expect(ics).toContain('UID:exam-exm-pi21-1@digital-deanery');
    expect(ics).toContain('UID:exam-exm-pi21-4@digital-deanery');

    // Изоляция: события другой группы в фиде Анны отсутствуют.
    expect(ics).not.toContain('Экономическая теория');
    expect(ics).not.toContain('exam-exm-ek11');
  });

  test('токен отзывается при выходе: прежняя ссылка умирает навсегда', async ({ page }) => {
    // Меню аватара на mobile-360 перекрыто контентом (давнее, см.
    // e2e/auth.spec.ts DIG-55) — поведение серверное, гоняем на desktop.
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    // Свой студент (Илья), чтобы параллельные тесты Анны не зависели от
    // этого отзыва: подписка одна на студента, logout убивает её строку.
    await signIn(page, 'ilya.petrov', 'ilya-demo-2026', '/grades/session');
    const url = await subscribeUrlOf(page);
    expect(url).toMatch(FEED_URL_PATTERN);
    expect((await page.request.get(url)).status()).toBe(200);

    // Выход через меню аватара (server action signOutAction; паттерн
    // auth-спеки: гидратация меню через toPass).
    const menuButton = page.getByRole('button', { name: 'Меню пользователя' });
    const menu = page.getByRole('menu', { name: 'Меню пользователя' });
    await expect(async () => {
      await menuButton.focus();
      await page.keyboard.press('Enter');
      await expect(menu).toBeVisible();
    }).toPass({ timeout: 15_000 });
    await page.getByRole('menuitem', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/\/login\?signedOut=1$/, { timeout: 15_000 });

    const revoked = await page.request.get(url);
    expect(revoked.status()).toBe(404);

    // Повторный вход: новая подписка; прежняя ссылка НЕ оживает.
    await signIn(page, 'ilya.petrov', 'ilya-demo-2026', '/grades/session');
    const fresh = await subscribeUrlOf(page);
    expect(fresh).not.toBe(url);
    expect((await page.request.get(url)).status()).toBe(404);
    expect((await page.request.get(fresh)).status()).toBe(200);
  });

  test('ссылка без валидного токена — единый 404 (аноним тоже)', async ({ request }) => {
    // Публичный путь (календарные клиенты без кук): мусор/подделка → 404.
    expect((await request.get('/api/calendar/ics')).status()).toBe(404);
    expect((await request.get('/api/calendar/ics?token=garbage')).status()).toBe(404);
    expect((await request.get('/api/calendar/ics?token=v1.abc.AAA')).status()).toBe(404);
  });

  test('360 px: карточка подписки читается на мобильном', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/session');

    const card = page.getByTestId('calendar-subscribe');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('calendar-subscribe-url')).toBeVisible();
    await expect(page.getByTestId('calendar-subscribe-copy')).toBeVisible();
    // Горизонтальной прокрутки нет.
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(1);
  });
});

test.describe('DIG-63: ICS-подписка — роли', () => {
  test('сотруднику карточка подписки не показывается', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, 'dean.kovaleva', 'dean-demo-2026', '/grades/session');
    await expect(page.getByText('Экран доступен студентам')).toBeVisible();
    await expect(page.getByTestId('calendar-subscribe')).toHaveCount(0);
  });
});
