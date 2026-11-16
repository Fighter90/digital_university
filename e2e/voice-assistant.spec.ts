import { expect, test, type Page } from '@playwright/test';

// DIG-65 — «Прослушать день» и голосовой ввод (voice-AI, тренд Product
// Hunt): чёрный сценарий на реальном сервере.
//  1) вид «День» расписания показывает кнопку «Прослушать день»;
//  2) настройка «Озвучка и голосовой ввод» на вкладке «Вид» сохраняется:
//     выключение переживает перезагрузку, кнопка озвучки исчезает из
//     кабинета; включение возвращает её;
//  3) 360 px: страница расписания без горизонтального скролла с кнопкой.
//
// Спека выполняется на обоих профилях (desktop-1440 и mobile-360) и мутирует
// только поле voiceAssistant настроек СВОЕГО пользователя (тот же паттерн
// users-per-project, что в profile-settings / settings-mcp).
function voiceUser() {
  return test.info().project.name === 'mobile-360'
    ? { login: 'ilya.petrov', password: 'ilya-demo-2026' }
    : { login: 'anna.smirnova', password: 'anna-demo-2026' };
}

// Тесты файла мутируют одну настройку одного пользователя — только serial.
test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, login: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

const listenButton = (page: Page) => {
  // Обе кнопки (десктопный DayView и мобильный MobileSchedule) есть в DOM —
  // видимость управляется классами md: — локатор скоупится контейнером вида.
  const scope = test.info().project.name === 'mobile-360' ? 'mobile-schedule' : 'desktop-day';
  return page.getByTestId(scope).getByTestId('listen-day');
};
const voiceToggle = (page: Page) => page.getByRole('switch', { name: 'Озвучка и голосовой ввод' });

test('schedule: «Прослушать день» на виде «День», 360 px без горизонтального скролла', async ({
  page,
}) => {
  const { login, password } = voiceUser();
  await signIn(page, login, password, '/schedule?view=day');
  await expect(page).toHaveURL(/\/schedule\?view=day$/, { timeout: 15_000 });

  // Кнопка озвучки дня есть и в исходном состоянии не «нажата».
  await expect(listenButton(page)).toBeVisible({ timeout: 15_000 });
  await expect(listenButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(listenButton(page)).toContainText('Прослушать день');

  // 360 px: кнопка не ломает раскладку (на mobile-360 проверяется всегда,
  // на desktop — просто выполняется тот же инвариант).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('settings: выключение «Озвучка и голосовой ввод» сохраняется и скрывает кнопку', async ({
  page,
}) => {
  const { login, password } = voiceUser();
  await signIn(page, login, password, '/settings?tab=appearance');
  await expect(page).toHaveURL(/tab=appearance$/, { timeout: 15_000 });

  const toggle = voiceToggle(page);
  await expect(toggle).toBeVisible({ timeout: 15_000 });

  // Выключаем настройку — переключатель и статус меняются сразу.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });
  await expect(page.getByText(/Сохранено — голосовые функции обновлены/)).toBeVisible({
    timeout: 15_000,
  });

  // Сохранение переживает перезагрузку (строка настроек на сервере).
  await page.reload();
  await expect(page).toHaveURL(/tab=appearance$/, { timeout: 15_000 });
  await expect(voiceToggle(page)).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });

  // В кабинете кнопки озвучки больше нет.
  await page.goto('/schedule?view=day');
  await expect(listenButton(page)).toHaveCount(0);

  // …и микрофона голосового ввода в AI-гиде тоже (первый вход — панель
  // раскрывается сама; гид студента живёт вне <main>).
  await page.goto('/dashboard');
  const panel = page.getByTestId('ai-guide-panel');
  if (await panel.count()) {
    await expect(panel).toBeVisible({ timeout: 15_000 });
  } else {
    await page.getByTestId('ai-guide-pill').click();
    await expect(panel).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.getByTestId('ai-guide-input')).toBeVisible();
  await expect(page.getByTestId('voice-input')).toHaveCount(0);

  // Включаем обратно — кнопка и микрофон возвращаются (и после перезагрузки настроек).
  await page.goto('/settings?tab=appearance');
  await expect(page).toHaveURL(/tab=appearance$/, { timeout: 15_000 });
  await voiceToggle(page).click();
  await expect(voiceToggle(page)).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  await page.reload();
  await expect(voiceToggle(page)).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });

  await page.goto('/schedule?view=day');
  await expect(listenButton(page)).toBeVisible({ timeout: 15_000 });

  // Микрофон в раскрытом гиде снова есть (seen-флаг: открываем пилюлей).
  await page.goto('/dashboard');
  await page.getByTestId('ai-guide-pill').click();
  await expect(page.getByTestId('ai-guide-panel')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('voice-input')).toBeVisible();
});
