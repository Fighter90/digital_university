# Delta: repo-scaffold (DIG-6)

## ADDED Requirements

### Requirement: Инструментарий качества репозитория

Проект ДОЛЖЕН предоставлять воспроизводимый каркас разработки: Next.js 15
App Router, TypeScript strict, ESLint, Prettier, Vitest, Playwright (профили
desktop-1440 и mobile-360), Zod, husky+lint-staged, pnpm на Node 22.

#### Scenario: команды разработчика работают

- **WHEN** в корне репозитория выполняют `pnpm install`, затем `pnpm dev`,
  `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm build`
- **THEN** каждая команда завершается без ошибок (e2e поднимает dev-сервер сам).

### Requirement: Каркас маршрутов и плашка концепта

Приложение ДОЛЖНО иметь route-группы из задачи: `(auth)/login`, `(cabinet)/…`,
`api/…`, и глобальную плашку «Концепт для конкурса» на каждой странице.

#### Scenario: плашка видна на любом маршруте

- **WHEN** пользователь открывает `/`, `/login` или `/dashboard`
- **THEN** сверху видна плашка «Концепт для конкурса, не официальный сервис вуза».

#### Scenario: health-check API

- **WHEN** выполняется `GET /api/health`
- **THEN** ответ `200` с телом `{ "ok": true }`.

### Requirement: Открытость для жюри

Репозиторий ДОЛЖЕН содержать лицензию MIT, THIRD_PARTY_LICENSES.md с
разрешающими лицензиями всех новых зависимостей и README с плашкой
«Концепт для конкурса» и запуском в 3 команды (pnpm).

#### Scenario: README соответствует критерию приёмки

- **WHEN** жюри открывает README и блок быстрого старта
- **THEN** видит плашку «Концепт для конкурса» и ровно 3 команды: `pnpm install`,
  `cp .env.example .env`, `pnpm dev`.
