# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile-settings.spec.ts >> settings: channel toggle persists, telegram/dark disabled, sessions + sign out
- Location: e2e/profile-settings.spec.ts:47:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Логин')

```

# Page snapshot

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2] [ref=e4]'
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | 
  3   | // DIG-19 — профиль и настройки: чёрный сценарий на реальном сервере.
  4   | // 1) Профиль показывает только СВОИ данные (ФИО/группа) и маскирует номер
  5   | //    зачётки до нажатия «Показать».
  6   | // 2) Настройки: переключение канала уведомлений сохраняется на сервере
  7   | //    (переживает перезагрузку), Telegram отключён («скоро»), тёмная тема
  8   | //    недоступна, активные сессии показывают устройство и обе кнопки выхода.
  9   | // Спека выполняется на обоих профилях конфигурации (1440 и 360) —
  10  | // адаптив 360 px проверяется автоматически.
  11  | 
  12  | async function signIn(page: Page, login: string, password: string, next: string) {
  13  |   await page.goto(`/login?next=${encodeURIComponent(next)}`);
> 14  |   await page.getByLabel('Логин').fill(login);
      |                                  ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  15  |   await page.getByLabel('Пароль').fill(password);
  16  |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  17  | }
  18  | 
  19  | test('profile: own data only, badge masked until «Показать», one error-report entry', async ({
  20  |   page,
  21  | }) => {
  22  |   await signIn(page, 'anna', 'demo-anna-2026', '/profile');
  23  |   await expect(page).toHaveURL(/\/profile$/);
  24  |   await expect(page.getByRole('heading', { level: 1, name: 'Профиль' })).toBeVisible();
  25  | 
  26  |   // Свои данные (Anna), а не Ильи.
  27  |   await expect(page.getByText('Анна Ковалёва').first()).toBeVisible();
  28  |   await expect(page.getByText('ПИ-21').first()).toBeVisible();
  29  |   const body = await page.locator('main').innerText();
  30  |   expect(body).not.toContain('Илья');
  31  |   expect(body).not.toContain('ЭК-11');
  32  | 
  33  |   // Зачётка маскирована, кнопка раскрывает и прячет значение.
  34  |   const badgeRow = page.locator('dd', { has: page.getByRole('button', { name: 'Показать' }) });
  35  |   await expect(badgeRow).toContainText('••••34');
  36  |   expect((await badgeRow.innerText()).replace(/\s/g, '')).not.toContain('20231234');
  37  |   await page.getByRole('button', { name: 'Показать' }).click();
  38  |   await expect(page.getByRole('button', { name: 'Скрыть' })).toBeVisible();
  39  |   expect(await badgeRow.innerText()).toContain('20231234');
  40  |   await page.getByRole('button', { name: 'Скрыть' }).click();
  41  |   await expect(badgeRow).toContainText('••••34');
  42  | 
  43  |   // «Нашли ошибку в данных?» — ровно одна точка входа.
  44  |   expect(await page.getByRole('button', { name: /Нашли ошибку в данных/ }).count()).toBe(1);
  45  | });
  46  | 
  47  | test('settings: channel toggle persists, telegram/dark disabled, sessions + sign out', async ({
  48  |   page,
  49  | }) => {
  50  |   await signIn(page, 'anna', 'demo-anna-2026', '/settings');
  51  |   await expect(page).toHaveURL(/\/settings$/);
  52  |   await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
  53  | 
  54  |   // Матрица: пять типов, Telegram во всех строках disabled.
  55  |   for (const type of ['Расписание', 'Дедлайны', 'Заявки', 'Оценки', 'Объявления']) {
  56  |     await expect(page.getByRole('table', { name: 'Каналы уведомлений' })).toContainText(type);
  57  |   }
  58  |   const telegramToggles = page.getByRole('switch', { name: /Telegram/ });
  59  |   await expect(telegramToggles).toHaveCount(5);
  60  |   for (let i = 0; i < 5; i += 1) {
  61  |     await expect(telegramToggles.nth(i)).toBeDisabled();
  62  |   }
  63  | 
  64  |   // Тумблер «Заявки — Email»: включаем (демо-сид у Анны этот канал не выключал),
  65  |   // перезагружаем страницу и убеждаемся, что выбор пережил перезагрузку.
  66  |   const requestsEmail = page.getByRole('switch', { name: 'Заявки — Email' });
  67  |   await expect(requestsEmail).toBeEnabled();
  68  |   const before = await requestsEmail.getAttribute('aria-checked');
  69  |   await requestsEmail.click();
  70  |   await expect(requestsEmail).toHaveAttribute(
  71  |     'aria-checked',
  72  |     before === 'true' ? 'false' : 'true',
  73  |   );
  74  |   await page.reload();
  75  |   await expect(page.getByRole('switch', { name: 'Заявки — Email' })).toHaveAttribute(
  76  |     'aria-checked',
  77  |     before === 'true' ? 'false' : 'true',
  78  |   );
  79  |   // возвращаем исходное состояние
  80  |   await page.getByRole('switch', { name: 'Заявки — Email' }).click();
  81  |   await page.reload();
  82  |   await expect(page.getByRole('switch', { name: 'Заявки — Email' })).toHaveAttribute(
  83  |     'aria-checked',
  84  |     before ?? 'true',
  85  |   );
  86  | 
  87  |   // Тема: «Тёмная» отключена с подписью «скоро».
  88  |   const dark = page.getByRole('radio', { name: /Тёмная/ });
  89  |   await expect(dark).toBeDisabled();
  90  |   await expect(page.getByText('скоро').first()).toBeVisible();
  91  | 
  92  |   // Активные сессии: устройство + время + маркер текущей.
  93  |   await expect(page.getByText('Активные сессии')).toBeVisible();
  94  |   await expect(page.getByText('Это устройство')).toBeVisible();
  95  | 
  96  |   // «Выйти на этом устройстве» — сессия закрывается, пользователь на /login.
  97  |   await page.getByRole('button', { name: 'Выйти на этом устройстве' }).click();
  98  |   await expect(page).toHaveURL(/\/login$/);
  99  | });
  100 | 
```