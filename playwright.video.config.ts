import { defineConfig, devices } from '@playwright/test';

// Видео-прогон: запись экрана всех сцен (1080p апскейл на этапе ffmpeg).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    viewport: { width: 1440, height: 900 },
  },
  outputDir: process.env.VIDEO_OUTDIR ?? '/tmp/video-raw',
});
