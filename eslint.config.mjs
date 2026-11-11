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
    // src/generated/** — код, генерируемый Prisma (DIG-9/DIG-10); не линтуем и не коммитим.
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'src/generated/**',
    ],
  },
  {
    // DIG-12 — изоляция данных: Prisma разрешён только внутри src/server/.
    // Страницы, компоненты и lib читают данные исключительно через
    // src/server/data/*, поэтому прямой импорт клиента там запрещён правилом.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@prisma/client',
                '@prisma/client/*',
                '@prisma/adapter-*',
                '@prisma/adapter-*/*',
              ],
              message:
                'Prisma доступен только внутри src/server/ (DIG-12): страницы и компоненты читают данные через src/server/data/*.',
            },
            {
              group: [
                'generated/prisma',
                'generated/prisma/*',
                '**/generated/prisma',
                '**/generated/prisma/*',
              ],
              message:
                'Сгенерированный Prisma-клиент доступен только внутри src/server/ (DIG-12): используйте src/server/data/*.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
