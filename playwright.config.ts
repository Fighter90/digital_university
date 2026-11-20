import { defineConfig, devices } from '@playwright/test';

// DIG-6: e2e в двух обязательных профилях — desktop 1440 и mobile 360 (мин. ширина проекта).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-360',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, isMobile: true },
    },
  ],
  // PLAYWRIGHT_BASE_URL → тестируем внешний стенд (прод-туннель), свой
  // сервер не поднимаем; иначе — локальная прод-сборка, как раньше.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // DIG-72 (round 1): e2e никогда не ходят в реальный OpenRouter —
        // сервер стартует с ПУСТЫМ ключом, action отвечает детерминированным
        // fallback-режимом (подсказка из справки). Ключ из локального .env
        // в прогон e2e не попадает.
        env: {
          ...process.env,
          OPENROUTER_API_KEY: '',
          // Round 3 DIG-48: полный e2e делает ~189 логинов с одного IP за окно
          // 30/15 мин — без флага лимитер режет хвост прогона (10/10 staff-cabinet).
          // Флаг живёт ТОЛЬКО в этом e2e-сервере; прод не выставляет его.
          E2E_RATE_LIMIT_BYPASS: '1',
        },
        // DIG-12 (round 2): e2e must verify the PRODUCTION contract. In
        // `next dev` (Turbopack) a notFound() page streams the not-found UI with
        // an HTTP 200 (dev-only artifact, flaky between runs), while the built
        // server answers the real, deterministic 404. Building here also
        // guarantees the suite never depends on a stale/mixed .next state.
        command: 'pnpm build && pnpm start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
