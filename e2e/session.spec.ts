import { expect, test, type Page } from '@playwright/test';

// DIG-28 — e2e «Сессия» (чёрный ящик): таймлайн со статусами допуска,
// запись на пересдачу (заявка + уведомление), консультации, экспорт ICS,
// роли (сотрудник/аноним) и адаптив 360 px.

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

test.describe('DIG-28: сессия — студент', () => {
  test('шапка, таймлайн со статусами и причина недопуска', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/session');
    await expect(page).toHaveURL(/\/grades\/session$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Сессия' })).toBeVisible();

    // Шапка: название сезона выводится из дат (не хардкод) + отсчёт + календарь.
    await expect(page.getByTestId('session-title')).toContainText(/сессия/i);
    await expect(page.getByTestId('session-countdown')).toBeVisible();
    const ics = page.getByTestId('session-ics');
    await expect(ics).toBeVisible();
    await expect(ics).toHaveAttribute('href', '/api/session/ics');

    // Таймлайн: зачёт «Базы данных» не допущен с причиной и действием.
    const item = page.getByTestId('exam-item-exm-pi21-3');
    await expect(item).toBeVisible();
    await expect(item).toContainText('Базы данных');
    await expect(item).toContainText('Зачёт');
    await expect(item).toContainText('Не допущен');
    await expect(item.getByTestId('admission-reason')).toContainText('Не сдано:');
    await expect(item.getByTestId('admission-action')).toHaveAttribute('href', '/grades/PI21-DB');

    // Допуск и оценка — на зачёте/экзамене Ильи (см. сценарий ниже), у Анны —
    // пересдача не в таймлайне, а в блоке пересдач.
    await expect(page.getByTestId('session-timeline')).toBeVisible();
    await expect(page.getByTestId('session-timeline')).not.toContainText('Пересдача коллоквиума');
  });

  test('пересдача: «Записаться» создаёт заявку и уведомление', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/session');

    const retake = page.getByTestId('retake-item-exm-pi21-4');
    await expect(retake).toBeVisible();
    await expect(retake).toContainText('Информатика');

    // Тест идемпотентен: если заявка уже создана прошлым прогоном, остаётся
    // только проверить бейдж и заявку в «Моих заявках».
    const requested = retake.getByTestId('retake-requested');
    if ((await retake.getByTestId('retake-signup').count()) > 0) {
      const signup = retake.getByTestId('retake-signup');
      await expect(signup).toBeVisible();
      await signup.click();
      await expect(requested).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(requested).toBeVisible();
    }
    const href = await requested.getAttribute('href');
    expect(href).toMatch(/^\/requests\/SR-\d{4}-[A-Z0-9]{5}$/);

    // Заявка появилась в «Моих заявках» (лента уведомлений — экран DIG-35,
    // само уведомление REQUEST покрыто юнит-контрактом слоя данных).
    await page.goto('/requests');
    await expect(page.getByText('Запись на пересдачу — Информатика').first()).toBeVisible();

    // Обратно на «Сессию»: прошедшая пересдача (Дискретная математика,
    // «закрыто») — запись закрыта.
    await page.goto('/grades/session');
    const pastRetake = page.getByTestId('retake-item-exm-pi21-6');
    await expect(pastRetake).toBeVisible();
    await expect(pastRetake.getByTestId('retake-signup')).toHaveCount(0);
    await expect(pastRetake).toContainText('Пересдача уже состоялась');

    // Повторный визит на экран: кнопка уже не показывается (идемпотентность).
    await page.goto('/grades/session');
    const retakeAgain = page.getByTestId('retake-item-exm-pi21-4');
    await expect(retakeAgain.getByTestId('retake-requested')).toBeVisible();
    await expect(retakeAgain.getByTestId('retake-signup')).toHaveCount(0);
  });

  test('консультации и экспорт всей сессии в календарь', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/session');

    // Консультации из расписания (kind CONSULTATION).
    const consult = page.getByTestId('session-consultations');
    await expect(consult).toBeVisible();
    await expect(consult).toContainText('Консультации');
    await expect(consult).toContainText('Программирование');

    // ICS: текстовый календарь с событиями сессии.
    const response = await page.request.get('/api/session/ics');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('DTSTART:');
    const disposition = response.headers()['content-disposition'] ?? '';
    expect(disposition).toContain('attachment');
  });

  test('360 px: все блоки сессии читаются на мобильном', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/session');

    await expect(page.getByTestId('session-title')).toBeVisible();
    await expect(page.getByTestId('session-timeline')).toBeVisible();
    await expect(page.getByTestId('exam-item-exm-pi21-3')).toBeVisible();
    await expect(page.getByTestId('retake-item-exm-pi21-4')).toBeVisible();
    await expect(page.getByTestId('session-consultations')).toBeVisible();
    // Горизонтальной прокрутки нет.
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(1);
  });
});

test.describe('DIG-28: сессия — статусы и роли', () => {
  test('Илья: «Сдано · 74» и «Допущен» на своих контрольных', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, 'ilya.petrov', 'ilya-demo-2026', '/grades/session');

    // Экзамен по матанализу уже оценён.
    const math = page.getByTestId('exam-item-exm-ek11-1');
    await expect(math).toBeVisible();
    await expect(math).toContainText('Сдано · 74');

    // Зачёт по экономике: неоценён только экзамен → «Допущен».
    const econ = page.getByTestId('exam-item-exm-ek11-2');
    await expect(econ).toBeVisible();
    await expect(econ).toContainText('Допущен');
    await expect(econ).not.toContainText('Не допущен');
  });

  test('сотруднику: страница-заглушка и единый 404 на ICS', async ({ page }) => {
    await signIn(page, 'dean.kovaleva', 'dean-demo-2026', '/grades/session');
    await expect(page.getByRole('heading', { level: 1, name: 'Сессия' })).toBeVisible();
    await expect(page.getByText('Экран доступен студентам')).toBeVisible();
    await expect(page.getByTestId('session-timeline')).toHaveCount(0);

    const ics = await page.request.get('/api/session/ics');
    expect(ics.status()).toBe(404);
  });

  test('аноним — редирект на вход', async ({ page }) => {
    await page.goto('/grades/session');
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
