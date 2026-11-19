# DIG-50 — delta: deployment — Prisma-клиент в standalone-образе

## ADDED Requirements

### Requirement: Generated Prisma-клиент попадает в Docker-образ

Сгенерированный клиент Prisma (`src/generated/prisma`) ДОЛЖЕН (MUST)
попадать в runner-стадию Docker-образа явной COPY; `outputFileTracingIncludes`
НЕ используется (ломает turbopack-standalone в Next 15.5.29 — теряются
ssr-чанки); пин закреплён в `tests/docker.test.ts`.

#### Scenario: контейнер стартует с Prisma-клиентом

- **WHEN** собирается образ и запускается контейнер с `DATABASE_URL`
- **THEN** generated-клиент присутствует в runner-стадии (COPY), сервер
  отвечает без ошибок отсутствующих ssr-чанков; тест
  `tests/docker.test.ts` фиксирует контракт
