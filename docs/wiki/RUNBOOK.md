# Runbook эксплуатации

## Деплой (ручной)
```bash
git worktree add /tmp/deploy origin/main
rsync -az --delete --exclude .git --exclude node_modules --exclude .next \
  --exclude .env --exclude .task-board --exclude test-results \
  --exclude playwright-report ./ $DIG_SERVER_USER@$DIG_SERVER_HOST:/opt/digital-university/ \
  -e "ssh -i ~/.ssh/dig_deploy -o IdentitiesOnly=yes"
ssh … "cd /opt/digital-university && docker compose -f deploy/docker-compose.yml build app"
ssh … "… up -d --force-recreate app"
ssh … "… --profile tools run --rm tools sh -c 'pnpm exec prisma migrate deploy'"
curl https://ostrovok.store/api/health   # {"ok":true,"authStore":"prisma"}
```
`--exclude .env` обязателен: серверные секреты не перетираются.

## Секреты сервера (/opt/digital-university/.env, chmod 600)
> Адрес сервера и ключи не публикуются в репозитории: экспортируйте `DIG_SERVER_HOST` / `DIG_SERVER_USER` / держите ключ `~/.ssh/dig_deploy` вне git.
- `DATABASE_URL=postgresql://university:seedpass@db:5432/university`
- `AUTH_SECRET` — HMAC role-hint. **Без него staff получает 403 (fail-closed)!**
- `OPENROUTER_API_KEY` — плавающий AI-ассистент (RAG по справке).

## Сид демо-данных
```bash
ssh … "cd /opt/digital-university && docker compose … --profile tools run --rm tools \
  sh -c 'echo \"DATABASE_URL=\$DATABASE_URL\" > /app/.env && pnpm db:seed'"
```
Идемпотентный wipe & rebuild. Prisma-конфиг читает .env ФАЙЛ, не переменную окружения.

## Регресс прода
```bash
PLAYWRIGHT_BASE_URL=https://ostrovok.store npx playwright test \
  e2e/prod-crawl.spec.ts e2e/prod-auth.spec.ts --project=desktop-1440
```
Отчёт краулера: test-results/dig-60-crawl-report-<project>.json (138 поверхностей).

## Известные инциденты
- **AUTH_SECRET отсутствовал** → staff 403 (fail-closed). Фикс: добавить секрет, рестарт app.
- **TZ-флейк grades** (полночь МСК): «20↔21 ноября» — фикстура детерминирована (2099-10-20).
- **build-lock** — serialized build; параллельные агенты не должны ломать distDir.
- **Rate-limit GLM 5h** — executor code=null; оркестратор: cooldown + повторы + «using done».
