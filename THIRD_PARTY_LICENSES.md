# Сторонние лицензии

> Сводная таблица «пакет → лицензия → использовано для» по всем зависимостям,
> шрифтам, иконкам и системным утилитам — [LICENSES.md](./LICENSES.md)
> (DIG-123). Этот файл — про сгенерированные изображения и ассеты бренда.

Все прямые зависимости проекта — с разрешающими лицензиями (MIT / Apache-2.0 /
ISC / OFL для шрифтов). Данные собраны по `license`-полю установленных пакетов
(pnpm). Транзитивные зависимости наследуют те же семейства лицензий; полный
список — `pnpm list --depth Infinity`.

## Сгенерированные изображения (DIG-16)

Иллюстрации пустых состояний, hero входа, OG-превью, обложка PDF-описания и
иконки из логотипа — **собственная собственность проекта**, полностью
сгенерированы нейросетями для этого конкурсного концепта (промпты и исходники
— `docs/ai-log/assets.md`, `docs/ai-log/assets-src/`):

| Ассеты | Инструмент / модель | Условия |
|---|---|---|
| Иллюстрации (`public/illustrations/*`), OG `public/og.jpg`, обложка `public/brand/pdf-cover.jpg` | Recraft V4.1 Flash (генерация в Higgsfield-инфраструктуре) | По условиям Higgsfield/Recraft права на сгенерированные по промпту пользователя изображения передаются пользователю; использование — свободное, в рамках конкурса. Реальные вуз-бренды, товарные знаки и персоны в промптах не использовались. |
| Стиль-проба логотипа (`docs/ai-log/assets-src/higgsfield-probe-logo.webp`) | Higgsfield `z_image` | Те же условия; файл — исходник, в приложение не подключён. |
| Логотип (`public/brand/logo.svg`, компонент, иконки 48/180/192/512) | ручная векторная отрисовка по концепту пробы | Полностью собственная работа проекта. |

Реальные логотипы вузов и иные товарные знаки в ассетах не используются
(запрещено AGENTS.md). Все персонажи/сцены вымышленные.

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

> DIG-13: шрифт интерфейса — **Onest** (OFL 1.1, next/font/google); Inter из
> каркаса заменён. lucide-react (ISC) — иконки, stroke 1.8.

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
