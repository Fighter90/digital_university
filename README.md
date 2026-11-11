# Цифровой деканат — личный кабинет студента

> **Концепт для конкурса** «Цифровой деканат будущего». Прототип, не
> официальный сервис. Все данные вымышленные, логотип вуза не используется.

Личный кабинет студента, где всё, что связано с учёбой, — в одном месте:
расписание, успеваемость, заявки и справки, уведомления, обращения в деканат.
С современного телефона и с компьютера. Код пишут ИИ-агенты (рои OpenCode),
человек ставит задачи и принимает merge.

## Обязательное ядро

| Раздел | Задача Linear | Экран Figma |
|---|---|---|
| Вход и профиль | DIG-18, DIG-19, DIG-11 | 01, 22 |
| Расписание (день/неделя/месяц, переносы) | DIG-21, DIG-22, DIG-23, DIG-24 | 03–04 |
| Успеваемость (зачётка, сессия, «как у меня дела») | DIG-25, DIG-26, DIG-27, DIG-28 | 05–07 |
| Заявки и справки (заказ онлайн, статусы) | DIG-29, DIG-30, DIG-31, DIG-32, DIG-33, DIG-47 | 08–11, 26 |
| Уведомления и объявления | DIG-34, DIG-35, DIG-36 | 12–14 |

Дополнительно: справочник, FAQ, обращения, предложения руководству, финансы,
доп. образование, мероприятия, поиск ⌘K, **AI-ассистент кабинета**, кабинет
сотрудника деканата. Полная карта — `docs/figma-screens.md`.

## Стек

Next.js 15 (App Router, TypeScript) · Prisma + PostgreSQL · Tailwind CSS
(дизайн-токены, Inter) · NextAuth (bcrypt-хэши) · Vitest + Playwright ·
Docker Compose + Caddy (авто-TLS) · Linear + GitHub + OpenCode.

## Быстрый старт (3 команды)

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Приложение: http://localhost:3000. Требования: Node 22 LTS, pnpm 10 (`corepack enable`).

Проверки: `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest unit + swarm) ·
`pnpm e2e` (Playwright: desktop-1440 и mobile-360×800). БД (Prisma/PostgreSQL) и
вход подключаются в следующих задачах — скаффолд работает без них.

## Тестовые аккаунты (вымышленные)

| Логин | Пароль | Кто |
|---|---|---|
| `student1` | (см. комментарий к работе) | студент 2 курса, ИТ-факультет |
| `student2` | (см. комментарий к работе) | студент 1 курса, другой набор данных |
| `staff` | (см. комментарий к работе) | сотрудник деканата |

Аккаунты создаются сидом `prisma/seed.ts`. Данные студентов не пересекаются.

## Рой ИИ-агентов

Задачи Linear (команда DIG, метка `swarm`) рой проходит сам:

```
pick → claim → executor (GLM) → гейты → reviewer → security → documenter → PR
```

- Архитектура и уроки: [`scripts/swarm/README.md`](scripts/swarm/README.md)
- Диаграмма процесса (для PDF): [`docs/ai-process.md`](docs/ai-process.md)
- Журнал циклов: [`docs/ai-log/`](docs/ai-log/)
- Запуск: `node scripts/swarm/orchestrator.mjs --max 1` (подробности в `AGENTS.md`)

## Деплой

https://ostrovok.store — Timeweb Cloud VM + Docker Compose + Caddy (авто-TLS).
Детали: [`docs/deploy.md`](docs/deploy.md). Команда: `bash scripts/swarm/deploy.sh`.

## Безопасность

- Только свои данные: фильтрация по сессии на сервере, тесты на IDOR.
- Пароли — только bcrypt-хэши, вход ограничен rate-limit'ом.
- Секреты — в окружении, `.env` не в git; в браузер не попадают.
- Простыми словами: [`docs/security.md`](docs/security.md).

## Документы

`docs/architecture.md` · `docs/sdd/SDD-GUIDE.md` (OpenSpec) · `CHANGELOG.md` ·
вики GitHub. Вопросы по правилам для агентов — `AGENTS.md`.
