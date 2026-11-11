import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
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
