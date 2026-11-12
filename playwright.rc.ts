import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e-rc',
  timeout: 60000,
  use: { baseURL: 'http://localhost:3311', screenshot: 'on' },
  webServer: {
    command: 'pnpm build && pnpm start --port 3311',
    port: 3311,
    timeout: 240000,
    reuseExistingServer: false,
  },
});
