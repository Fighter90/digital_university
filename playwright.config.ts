import { defineConfig, devices } from '@playwright/test';

// DIG-6: e2e в двух обязательных профилях — desktop 1440 и mobile 360 (мин. ширина проекта).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
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
  webServer: {
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
