# LICENSES — сторонние материалы и лицензии проекта

Проект — конкурсный прототип «Цифровой деканат»: все прямые зависимости — с
разрешающими лицензиями (**MIT / Apache-2.0 / ISC / BSD-2-Clause**), copyleft
(GPL и родственное) **не используется**. Шрифты — **SIL OFL 1.1**. Данные
таблицы собраны по `license`-полю установленных пакетов (pnpm), дата
ревизии — 2026-11-20 (DIG-123). Быстрая проверка:
`node -e "console.log(require('./node_modules/<пакет>/package.json').license)"`.

## Runtime-зависимости

| Пакет | Лицензия | Использовано для |
|---|---|---|
| next | MIT | фреймворк: App Router, RSC, server actions, next/font |
| react / react-dom | MIT | UI-рантайм |
| zod | MIT | валидация входа server actions / API-роутов |
| @base-ui/react | MIT | безстилевые примитивы для shadcn/ui |
| class-variance-authority | Apache-2.0 | варианты (variants) компонентов shadcn/ui |
| cn | MIT | утилита merge классов для shadcn/ui |
| lucide-react | ISC | иконки интерфейса (stroke 1.8, дизайн-система DIG-13) |
| tw-animate-css | MIT | анимации Tailwind v4 (шаблон shadcn) |
| shadcn | MIT | пакет стилей shadcn (`shadcn/tailwind.css` в globals.css) |
| @node-rs/argon2 | MIT | хэширование паролей argon2id (параметры OWASP) |
| @prisma/client | Apache-2.0 | ORM: доступ к PostgreSQL |
| @prisma/adapter-pg | Apache-2.0 | driver adapter Prisma ↔ node-postgres |
| @prisma/client-runtime-utils | Apache-2.0 | рантайм-утилиты сгенерированного клиента Prisma |

## Dev-зависимости (в поставку приложения не входят)

| Пакет | Лицензия | Использовано для |
|---|---|---|
| typescript | Apache-2.0 | строгая типизация |
| prisma | Apache-2.0 | CLI: схема, миграции, генерация клиента |
| tailwindcss / @tailwindcss/postcss | MIT | стили и дизайн-токены |
| eslint / eslint-config-next / @eslint/eslintrc / eslint-plugin-react-hooks | MIT | линтинг |
| prettier | MIT | форматирование (lint-staged) |
| husky / lint-staged | MIT | git-хуки: формат + линт перед коммитом |
| vitest | MIT | unit-тесты |
| @playwright/test | Apache-2.0 | e2e (desktop 1440 / mobile 360) |
| @testing-library/react / jest-dom / dom | MIT | рендер-тесты компонентов |
| jsdom | MIT | DOM-окружение для vitest |
| tsx | MIT | запуск prisma/seed.ts |
| dotenv | BSD-2-Clause | загрузка `.env` (секреты вне git) |
| @types/node / @types/react / @types/react-dom | MIT | типы |

## Шрифты

| Шрифт | Лицензия | Использовано для |
|---|---|---|
| Inter | SIL OFL 1.1 | шрифт интерфейса (next/font/google, как в макетах Figma; латиница + кириллица, веса 400–800) |

OFL разрешает бесплатное коммерческое использование и встраивание (субсеты
Next.js); сам шрифт в git не копируется — тянется Google Fonts через
`next/font` при сборке.

## Иконки и изображения

| Материал | Лицензия | Использовано для |
|---|---|---|
| lucide-react | ISC | все иконки интерфейса |
| Иллюстрации, OG-превью, логотип (`public/…`, `docs/ai-log/assets-src/…`) | собственность проекта | сгенерированы нейросетями по собственным промптам / отрисованы вручную — см. THIRD_PARTY_LICENSES.md, раздел «Сгенерированные изображения» |

## Собственный код вместо библиотек (лицензионная гигиена)

| Модуль | Что вместо | Почему |
|---|---|---|
| `src/lib/pdf/pdf-writer.ts` | pdfkit / jsPDF | свой минимальный PDF-писатель (DIG-27): ноль зависимостей, детерминированный вывод |
| `src/lib/xlsx/xlsx-writer.ts` | exceljs / SheetJS | свой XLSX-писатель (OOXML) без внешних пакетов (DIG-101) — **exceljs в проекте не используется** |
| `src/lib/ru-translit.ts` | библиотеки транслитерации | собственные правила транслита имён/номеров заявок |

## Системные утилиты

| Утилита | Лицензия | Статус |
|---|---|---|
| ffmpeg (LGPL/GPL, сборка) | — | **системная**, в рантайме и сборке проекта не участвует, в поставку не входит |
| say (TTS macOS) | — проприетарная ОС | **системная**, аналогично: не используется кодом проекта |

## Транзитивные зависимости

Транзитивный граф наследует те же семейства разрешающих лицензий (MIT /
Apache-2.0 / ISC / BSD); полный список — `pnpm list --depth Infinity`.
Копилефт-пакеты в дереве отсутствуют; при добавлении новой зависимости
проверять `license`-поле — GPL/AGPL запрещены правилами проекта.

См. также: [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) —
сгенерированные изображения и ассеты бренда; [LICENSE](./LICENSE) —
лицензия кода проекта.
