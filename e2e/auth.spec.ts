import { expect, test } from '@playwright/test';

// DIG-11 — auth behaviours that do not need the database yet:
// middleware gating of the cabinet and the login screen contract
// (labels, disabled «Госуслуги (демо)» button, concept banner).

test('protected cabinet redirects an anonymous visitor to /login with next', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Вход в кабинет');
});

test('login form is functional: labels, autocomplete, demo Gosuslugi button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Логин')).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'password');

  const gosuslugi = page.getByRole('button', { name: /Госуслуги/ });
  await expect(gosuslugi).toBeVisible();
  await expect(gosuslugi).toBeDisabled();
  await expect(gosuslugi).toContainText('демо');

  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeEnabled();
});

test('wrong credentials report the uniform error without revealing the cause', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('no-such-user');
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  const alert = page.locator('main').getByRole('alert');
  await expect(alert).toContainText('Неверный логин или пароль');
  await expect(alert).not.toContainText('no-such-user');
});

// ── DIG-18 — экран входа (Figma «02 · Вход») ────────────────────────────────
//
// Лимиты сервера (DIG-11) живут в одном процессе и не сбрасываются между
// воркерами: лимитер 30 попыток / 15 мин на IP и блокировка аккаунта после
// 5 неудач. Поэтому тесты, которые реально входят или «закрывают» аккаунт,
// собраны в desktop-серию (мобильный воркер идёт параллельно и пропускает
// её), чтобы не уронить друг друга и соседние спеки.

const ANNA_CHIP = 'Анна Ковалёва · ПИ-21';
const ILYA_CHIP = 'Илья Смирнов · ЭК-11';
const STAFF_CHIP = 'Сотрудник деканата';
const SUBMIT = { name: 'Войти', exact: true } as const;

test.describe('DIG-18: экран входа — оба вьюпорта', () => {
  test('chips «Тестовые аккаунты» подставляют логин и пароль одним кликом', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();

    await page.getByRole('button', { name: ANNA_CHIP }).click();
    await expect(page.getByLabel('Логин')).toHaveValue('anna.smirnova');
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('anna-demo-2026');

    await page.getByRole('button', { name: STAFF_CHIP }).click();
    await expect(page.getByLabel('Логин')).toHaveValue('dean.kovaleva');
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('dean-demo-2026');
  });

  test('кнопка «показать пароль» переключает видимость и aria-pressed', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel('Пароль', { exact: true });
    const toggle = page.getByRole('button', { name: 'Показать пароль' });

    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Скрыть пароль' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Скрыть пароль' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('«Забыли пароль?» ведёт на публичную заглушку про восстановление через деканат', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Забыли пароль?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Восстановление пароля' }),
    ).toBeVisible();
    await expect(page.getByText(/через деканат/)).toBeVisible();
    await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();

    await page.getByRole('link', { name: /Вернуться ко входу/ }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('неверный пароль реального аккаунта — та же единая ошибка', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: ANNA_CHIP }).click();
    await page.getByLabel('Пароль', { exact: true }).fill('совсем-не-пароль');
    await page.getByRole('button', SUBMIT).click();
    const alert = page.locator('main').getByRole('alert');
    await expect(alert).toContainText('Неверный логин или пароль');
  });

  test('?next= возвращает пользователя на целевой экран после входа', async ({ page }) => {
    await page.goto('/grades'); // middleware → /login?next=%2Fgrades
    await expect(page).toHaveURL(/\/login\?next=%2Fgrades$/);
    await page.getByRole('button', { name: ANNA_CHIP }).click();
    await page.getByRole('button', SUBMIT).click();
    await expect(page).toHaveURL(/\/grades$/);
  });
});

test.describe('DIG-18: реальные входы и блокировка — desktop-1440 (общий стейт сервера)', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  // fullyParallel запускает тесты одного файла в разных воркерах, а стейт
  // лимитера/блокировки общий: успешный вход maria из «вход каждым» сбросил
  // бы счётчик неудач «блокировки». Сериализуем группу.
  test.describe.configure({ mode: 'serial' });

  test('вход каждым тестовым аккаунтом попадает в кабинет (Enter в поле пароля)', async ({
    page,
  }) => {
    for (const chip of [ANNA_CHIP, ILYA_CHIP, STAFF_CHIP]) {
      await page.context().clearCookies();
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: chip }).click();
      await page.getByLabel('Пароль', { exact: true }).press('Enter');
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Кабинет студента' })).toBeVisible();
    }
  });

  test('после 5 неудачных попыток аккаунт блокируется на 15 минут (даже с верным паролем)', async ({
    page,
  }) => {
    await page.goto('/login');
    const alert = page.locator('main').getByRole('alert');

    // До блокировки (если сервер свежий) — до 6 неудачных попыток; на
    // переиспользованном сервере dean.kovaleva уже заблокирована — тогда сразу
    // сообщение. (DIG-50: единые креды demo-набора и сида БД.)
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.getByLabel('Логин').fill('dean.kovaleva');
      await page.getByLabel('Пароль', { exact: true }).fill(`не-пароль-${attempt}`);
      await page.getByRole('button', SUBMIT).click();
      const text = (await alert.textContent()) ?? '';
      if (text.includes('15 минут')) break;
    }

    await expect(alert).toContainText('Слишком много попыток, попробуйте через 15 минут');

    // Верный пароль тоже не пускает: блокировка действует независимо от пароля.
    await page.getByLabel('Логин').fill('dean.kovaleva');
    await page.getByLabel('Пароль', { exact: true }).fill('dean-demo-2026');
    await page.getByRole('button', SUBMIT).click();
    await expect(alert).toContainText('Слишком много попыток, попробуйте через 15 минут');
  });

  test('1440 px: разделённый экран с коралловой иллюстрацией', async ({ page }) => {
    await page.goto('/login');
    const hero = page.getByTestId('login-hero');
    await expect(hero).toBeVisible();
    const box = await hero.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(700); // ~половина экрана
  });
});

test.describe('DIG-18: мобильный 360 px', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test('иллюстрация скрыта, форма на весь экран, поля 48 px', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-hero')).toBeHidden();

    const submit = page.getByRole('button', SUBMIT);
    await expect(submit).toBeVisible();
    await expect(submit).toBeInViewport();

    for (const label of ['Логин', 'Пароль']) {
      const box = await page.getByLabel(label, { exact: label === 'Пароль' }).boundingBox();
      expect(box?.height, `поле «${label}» должно быть 48 px`).toBe(48);
    }
  });
});
