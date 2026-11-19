# Proposal: Docker Compose — приложение, PostgreSQL, Caddy (DIG-7)

## Зачем

Локальное и продовое окружение должны подниматься одной командой: жюри и
разработчики запускают прототип без ручной настройки, а деплой роя
(`scripts/swarm/deploy.sh`) выполняет ровно тот же compose-стек на сервере.
Без контейнеризации прод на ostrovok.store (Caddy + авто-TLS) держать негде.

## Что

- `deploy/docker-compose.yml`: `app` (Next.js standalone), `db` (PostgreSQL 16,
  named volume), `caddy` (reverse proxy, автоматический HTTPS Let's Encrypt,
  www-редирект в проде).
- `.env.example` со всеми переменными (DATABASE_URL, SESSION_SECRET,
  LLM_PROVIDER/LLM_API_KEY/LLM_BASE_URL, APP_URL, ICS_TOKEN_SECRET, SMTP\_\*,
  POSTGRES\_\*, порты/адреса Caddy) и комментариями. Реальные значения —
  только в `.env` (вне git) и в секретах хостинга.
- `deploy/Dockerfile`: многоступенчатая сборка standalone-бэкенда, не-root
  пользователь, `HEALTHCHECK /api/health`.
- Миграции Prisma применяются при старте контейнера
  (`deploy/docker-entrypoint.sh` → `prisma migrate deploy` до запуска сервера).
- Gitleaks в CI (`.github/workflows/gitleaks.yml`) — приёмка «в репозитории
  нет секретов».
- `next.config.ts`: `output: 'standalone'` (образ собирается из
  самодостаточного сервера).
- `.dockerignore` — `.env*`, `node_modules`, `.next` не попадают в контекст
  сборки.

## Non-goals

- Схема Prisma, сиды и сами миграции — DIG-18+ (entrypoint уже готов, до
  появления `prisma/schema.prisma` и `prisma/migrations` миграции пропускаются).
- Авторизация, реальные ключи LLM/SMTP — свои задачи; здесь только подводка
  переменных.
- Мониторинг, бэкапы БД, CI-сборка образа — за рамками задачи.
- Изменения `scripts/swarm/` (инфраструктура роя не трогается).
