# Delta: deployment (DIG-7)

## ADDED Requirements

### Requirement: Окружение поднимается одной командой

Стек `deploy/docker-compose.yml` ДОЛЖЕН поднимать рабочий кабинет локально и на
проде: `app` (Next.js standalone из `deploy/Dockerfile`), `db` (PostgreSQL 16 с
постоянным volume), `caddy` (reverse proxy, автоматический HTTPS). Порядок
старта ДОЛЖЕН соблюдаться через healthcheck: db готова до старта app, app
здоров до старта caddy.

#### Scenario: compose up поднимает кабинет на localhost

- **WHEN** разработчик выполняет `cp .env.example .env`, затем
  `docker compose -f deploy/docker-compose.yml up --build`
- **THEN** все три сервиса переходят в healthy, а `GET http://localhost:3000/api/health`
  возвращает `200 {"ok":true}` (в проде тот же ответ отдаёт Caddy на 80/443).

#### Scenario: БД переживает перезапуск

- **WHEN** контейнеры останавливают и запускают снова
- **THEN** данные PostgreSQL сохраняются (named volume `db-data`).

### Requirement: Миграции применяются при старте контейнера

Контейнер app ДОЛЖЕН применять миграции Prisma перед запуском сервера; до
появления схемы и миграций (DIG-18+) контейнер ОБЯЗАН стартовать без ошибок.

#### Scenario: миграции идут до сервера

- **WHEN** в репозитории есть `prisma/schema.prisma` и `prisma/migrations`,
  и контейнер app стартует
- **THEN** entrypoint выполняет `prisma migrate deploy` и только затем
  `node server.js`.

### Requirement: Секреты вне репозитория и вне клиентского бандла

Реальные значения секретов ДОЛЖНЫ существовать только в `.env`/`.env.production`
(вне git) и в секретах хостинга. Секреты НЕ ДОЛЖНЫ называться с префикса
`NEXT_PUBLIC_` и НЕ ДОЛЖНЫ попадать в контекст сборки образа.

#### Scenario: gitleaks в CI

- **WHEN** в коммит попадает секрет
- **THEN** workflow `.github/workflows/gitleaks.yml` помечает ветку красной.

#### Scenario: ключи LLM и сессий не попадают в браузер

- **WHEN** собирается production-бандл (`pnpm build` / образ)
- **THEN** в `.next/static` нет значений `SESSION_SECRET`, `LLM_API_KEY`,
  `ICS_TOKEN_SECRET`, `POSTGRES_PASSWORD` и имён секретных переменных.

#### Scenario: .env.example — только плейсхолдеры

- **WHEN** ревьюер открывает `.env.example`
- **THEN** все переменные задачи присутствуют с комментариями и плейсхолдерами
  без реальных ключей.

### Requirement: Healthcheck /api/health

Образ app ДОЛЖЕН содержать `HEALTHCHECK` на `GET /api/health`, по которому
compose и деплой-скрипт роя определяют готовность приложения.

#### Scenario: деплой ждёт здоровье приложения

- **WHEN** `scripts/swarm/deploy.sh` завершает `docker compose up`
- **THEN** он проверяет `http://localhost:3000/api/health` до признания деплоя
  успешным.

### Requirement: Caddy — reverse proxy с автоматическим HTTPS

Caddy ДОЛЖЕН проксировать публичный трафик на `app:3000` и автоматически
получать/продлевать сертификат Let's Encrypt для основного домена, заданного
через `SITE_ADDRESS`; www-домен (`SITE_ADDRESS_WWW`) ДОЛЖЕН редиректить на
основной. Локально (`SITE_ADDRESS=:80`) сайт ДОЛЖЕН работать без TLS.

#### Scenario: прод получает HTTPS автоматически

- **WHEN** на сервере в `.env` задано `SITE_ADDRESS=ostrovok.store` и
  `SITE_ADDRESS_WWW=www.ostrovok.store`, и стек запущен
- **THEN** Caddy сам получает сертификат (HTTP-01), `https://ostrovok.store`
  отвечает, а `www.ostrovok.store` редиректит на основной домен.
