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
<<<<<<< HEAD
=======
    // src/generated/** — код, генерируемый Prisma (DIG-9/DIG-10); не линтуем и не коммитим.
>>>>>>> origin/main
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
<<<<<<< HEAD
      // prisma generated client (DIG-10) и SQL-миграции не линтятся
      'src/generated/**',
      'prisma/migrations/**',
=======
      'src/generated/**',
>>>>>>> origin/main
    ],
  },
];

export default eslintConfig;
