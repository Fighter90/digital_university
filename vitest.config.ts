import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  // JSX-компоненты не импортируют React (автоматический рантайм Next.js 15),
  // поэтому тесты тоже собираются с jsx: automatic.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
