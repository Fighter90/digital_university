# Tasks: Docker Compose — приложение, PostgreSQL, Caddy (DIG-7)

- [x] 1. Red-first: `tests/docker.test.ts` — контракт compose/Dockerfile/Caddyfile/
      `.env.example`/gitleaks падает на пустом `deploy/`.
- [x] 2. `deploy/docker-compose.yml`: сервисы `app`/`db`/`caddy`, PostgreSQL 16 с
      volume, healthcheck `pg_isready`, `depends_on: service_healthy`, app на
      `127.0.0.1:3000` (для health-check деплоя), caddy на 80/443 (+HTTP/3).
- [x] 3. `deploy/Dockerfile`: node:22-slim, corepack pnpm, `pnpm build`
      (standalone), runner без исходников, USER node, `HEALTHCHECK /api/health`.
- [x] 4. `deploy/docker-entrypoint.sh`: `prisma migrate deploy` при наличии схемы
      и миграций, затем `exec node server.js` (контейнер стартует и до DIG-18).
- [x] 5. `deploy/Caddyfile`: `reverse_proxy app:3000`, zstd/gzip, security-заголовки,
      адрес из `SITE_ADDRESS` (локально `:80`, прод — авто-TLS), www-редирект.
- [x] 6. `.env.example`: все переменные задачи + комментарии; секреты без
      `NEXT_PUBLIC_`; только плейсхолдеры.
- [x] 7. `next.config.ts`: `output: 'standalone'`; `.dockerignore` без `.env*`.
- [x] 8. `.github/workflows/gitleaks.yml` — скан секретов в CI.
- [x] 9. Документация: README «Запуск в Docker», docs/deploy.md (переменные,
      проверка клиентского бандла).
- [x] 10. Приёмка на живом стенде: `docker compose up` → app/db/caddy healthy,
      `{"ok":true}` на `:3000` и через Caddy `:80`, app под пользователем `node`,
      в `.next/static` нет значений переменных. Гейты зелёные.
