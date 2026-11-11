# Сторонние лицензии

Все прямые зависимости проекта — с разрешающими лицензиями (MIT / Apache-2.0 /
ISC / OFL для шрифтов). Данные собраны по `license`-полю установленных пакетов
(pnpm). Транзитивные зависимости наследуют те же семейства лицензий; полный
список — `pnpm list --depth Infinity`.

## Runtime-зависимости

| Пакет | Лицензия | Назначение |
|---|---|---|
| next | MIT | фреймворк (App Router, RSC, server actions) |
| react / react-dom | MIT | UI-рантайм |
| zod | MIT | валидация входных данных (server actions / API) |
| @base-ui/react | MIT | безстилевые примитивы для shadcn/ui |
| class-variance-authority | Apache-2.0 | варианты компонентов shadcn/ui |
| cn | MIT | утилита cn (merge классов) для shadcn/ui |
| lucide-react | ISC | иконки shadcn/ui |
| tw-animate-css | MIT | анимации Tailwind v4 (шаблон shadcn) |
| shadcn | MIT | пакет стилей shadcn (`shadcn/tailwind.css` в globals.css) |
| @node-rs/argon2 | MIT | хэширование паролей argon2id (DIG-11, параметры OWASP) |
| Inter | OFL 1.1 | шрифт (next/font/google, как в макетах Figma) |

## Dev-зависимости

| Пакет | Лицензия | Назначение |
|---|---|---|
| typescript | Apache-2.0 | типизация (strict) |
| tailwindcss / @tailwindcss/postcss | MIT | стили, дизайн-токены |
| eslint / eslint-config-next / @eslint/eslintrc | MIT | линтинг |
| prettier | MIT | форматирование (lint-staged) |
| husky / lint-staged | MIT | git-хуки: формат+линт перед коммитом |
| vitest | MIT | unit-тесты |
| @playwright/test | Apache-2.0 | e2e (desktop 1440 / mobile 360) |
| @types/node / @types/react / @types/react-dom | MIT | типы |
