import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // build-артефакты и сгенерированный код не линтуем (как .next/**):
    // .next-dev — артефакт e2e prod-сервера, src/generated — Prisma-клиент
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-dev/**',
      'src/generated/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
