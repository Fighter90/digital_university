import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    // Машина под нагрузкой роя (параллельные executor'ы): тесты с build/lint
    // внутри — тяжёлые; 5s по умолчанию нестабильно (урок 2026-11-11).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  esbuild: {
    // Страницы Next.js пишутся с автоматическим JSX-рантаймом (tsconfig jsx:
    // preserve), а vitest по умолчанию применяет классический — без этого
    // поведенческие render-тесты падают с «React is not defined».
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
