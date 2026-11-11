# Proposal: repo scaffold (DIG-6)

## Зачем

Все остальные задачи роя опираются на единый каркас: Next.js 15 + TypeScript
strict + инструменты качества (lint/typecheck/unit/e2e) и структуру папок из
Linear-задачи DIG-6. Без него экраны, авторизация и БД не на что садятся.

## Что

- Next.js 15.5 (App Router, RSC), TypeScript `strict`, `src/`-структура, алиас `@/*`.
- Tailwind CSS 4 + shadcn/ui (инициализация последним CLI, без кастомизации — токены в DIG-13).
- ESLint 9 (flat), Prettier, lint-staged + husky (pre-commit).
- Vitest (unit, node-env) + Playwright (e2e: desktop-1440 и mobile-360×800).
- Zod для валидации. README с быстрым стартом из 3 команд (pnpm).
- LICENSE (MIT), THIRD_PARTY_LICENSES.md, плейсхолдеры `src/server/`, `prisma/`.
- Плашка «Концепт для конкурса» глобально в root layout (правило AGENTS.md).

## Non-goals

- Дизайн-токены, Shell, шрифтовые тонкости вёрстки — DIG-13/экранные задачи (здесь только Inter как базовый шрифт).
- Prisma-схема, сиды, авторизация, rate-limit — задачи DIG-18+ (папки-плейсхолдеры).
- Реальные экраны кабинета — DIG-21+.
