# Руководство администратора (RU)

> Для администратора стенда «Цифровой деканат» (https://ostrovok.store): развёртывание, секреты, эксплуатация, диагностика, резервное копирование, безопасность.

## 1. Инфраструктура

| Параметр | Значение |
|---|---|
| Хостинг | Timeweb Cloud VM (Ubuntu, 1 vCPU / 889 МБ RAM + swap 2G, Docker 29 + Compose 2.40) |
| Домен | https://ostrovok.store (A-записи на сервер, TLS — Caddy auto-HTTPS, HTTP-01) |
| Каталог | `/opt/digital-university` |
| Ключ доступа | `~/.ssh/dig_deploy` (переменная `DIG_DEPLOY_KEY`); **адрес сервера и ключи не публикуются в репозитории** — экспортируйте `DIG_SERVER_HOST` / `DIG_SERVER_USER` |
| Контейнеры | `app` (Next.js standalone, health `/api/health`), `db` (PostgreSQL 16, только 127.0.0.1), `caddy` (TLS + reverse proxy), `tools` (профиль: полный node_modules + pnpm для миграций/сида) |

### 1.1. Переменные окружения (`/opt/digital-university/.env`, chmod 600)

| Переменная | Назначение | Если отсутствует |
|---|---|---|
| `DATABASE_URL=postgresql://university:<пароль>@db:5432/university` | Подключение Prisma. Postgres не проброшен наружу (127.0.0.1) | app не стартует |
| `AUTH_SECRET` | HMAC-подпись role-hint cookie (`__Host-role`) | **fail-closed**: все считаются студентами, `/staff` отдаёт 403 сотрудникам |
| `OPENROUTER_API_KEY` | Плавающий AI-ассистент (FAB → OpenRouter → RAG по справке) | Ассистент работает в демо-режиме (фрагменты справки) |
| `APP_PORT` (опц.) | Порт app на хосте (по умолчанию 3000, bind 127.0.0.1) | 3000 |
| `POSTGRES_PORT` (опц.) | Порт Postgres (по умолчанию 5432, bind 127.0.0.1) | 5432 |

**Инцидент из практики:** отсутствие `AUTH_SECRET` в серверном `.env` сделало кабинет сотрудника недоступным (403 по fail-closed) — найдено регрессом staff-cabinet, зафиксировано здесь. Фикс: добавить переменную, `up -d --force-recreate`.

### 1.2. Доступ к DNS
Домен ostrovok.store управляется через Timeweb Cloud API (`PATCH/POST https://api.timeweb.cloud/api/v1/domains/ostrovok.store/dns-records`); токен — в `TIMEWEB_API_KEY` (окружение, не в репозитории). A-записи домена и www смотрят на сервер; MX/TXT не трогаются.

## 2. Деплой (ручная процедура)

```bash
git worktree add /tmp/deploy origin/main          # чистое состояние
cd /tmp/deploy
rsync -az --delete \
  --exclude .git --exclude node_modules --exclude .next --exclude .env \
  --exclude .task-board --exclude test-results --exclude playwright-report \
  ./ "$DIG_SERVER_USER@$DIG_SERVER_HOST:/opt/digital-university/" \
  -e "ssh -i ~/.ssh/dig_deploy -o IdentitiesOnly=yes"

ssh … "cd /opt/digital-university && \
  docker compose -f deploy/docker-compose.yml build app"        # 3–15 мин

ssh … "… up -d --force-recreate app"                            # пересоздать контейнер

ssh … "… --profile tools run --rm tools sh -c \
  'pnpm exec prisma migrate deploy'"                            # миграции (если есть)
```

**Контроль:** `curl https://ostrovok.store/api/health` → `{"ok":true,"authStore":"prisma"}`; далее smoke-обход ключевых страниц (`/login` 200, кабинет-роуты 307 на /login?next=…).

**Важные правила:**
- `--exclude .env` в rsync **обязателен** — серверные секреты не перетираются.
- `rsync --delete` удаляет на сервере всё, чего нет локально — не деплойте из «мусорного» дерева.
- Build под нагрузкой может идти 10–15 минут; запускайте в фоне с логом (`> /tmp/prod-build.log 2>&1`).
- После правок `.env` — обязателен `up -d --force-recreate` (env_file читается при создании контейнера).

## 3. Миграции и сид

```bash
# миграции (схема)
ssh … "… --profile tools run --rm tools sh -c 'pnpm exec prisma migrate deploy'"

# сид демо-данных (идемпотентный wipe & rebuild)
ssh … "… --profile tools run --rm tools sh -c \
  'echo \"DATABASE_URL=\$DATABASE_URL\" > /app/.env && pnpm db:seed'"
```

- Миграции: `prisma/migrations/*` применяются по порядку; статус — `migrate deploy` пишет «No pending migrations».
- **Сид** пересоздаёт вымышленные данные (студенты, расписание, оценки, заявки, обращения, справки, стартапы МСП, мероприятия, ДПО, уведомления) и демо-пользователей с паролями жюри. Идемпотентен: можно запускать многократно. Внимание: wipe & rebuild — пользовательские данные сессии удаляются; входить заново.
- Prisma-конфиг читает `.env` **файл** в cwd — поэтому внутри tools-контейнера сначала `echo "DATABASE_URL=$DATABASE_URL" > /app/.env`.

## 4. Эксплуатация

| Задача | Команда/действие |
|---|---|
| Логи app | `ssh … "cd /opt/… && docker compose -f deploy/docker-compose.yml logs app --since 30m"` |
| Рестарт app | `… up -d --force-recreate app` |
| Health | `curl https://ostrovok.store/api/health` → `{"ok":true,"authStore":"prisma"}` |
| Память | `docker stats` (RAM 889 МБ + swap 2G; следить за build'ами — возможен OOM) |
| Место | `docker system df`; чистка — `docker image prune` |
| Пересборка без кэша | `build --no-cache` (10–20 мин; запускать в фоне с логом) |

## 5. Резервное копирование и восстановление

### 5.1. Бэкап БД
```bash
ssh … "cd /opt/digital-university && \
  docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U university university" > backup-$(date +%F).sql
```
Храните минимум 7 дней (рекомендация прототипа). Бэкап содержит вымышленные данные и хэши паролей демо-аккаунтов — не секретен, но не публикуйте.

### 5.2. Восстановление
```bash
cat backup-YYYY-MM-DD.sql | ssh … "cd /opt/… && docker compose -f deploy/docker-compose.yml exec -T db \
  psql -U university -d university"
```
После восстановления — `up -d --force-recreate app` и health-проверка.

### 5.3. Секреты
Восстанавливаются из этого руководства (раздел 1.1): `AUTH_SECRET` — `openssl rand -base64 32`; `OPENROUTER_API_KEY` — из личного кабинета OpenRouter; пароль БД — из серверного `.env` (последняя известная копия).

## 6. Безопасность эксплуатации

- Postgres bind **127.0.0.1** — снаружи БД недоступна; не добавляйте `0.0.0.0` в ports.
- Серверный `.env` chmod 600; никогда не rsync-те локальный `.env` на сервер (ключ `--exclude .env` обязателен).
- `AUTH_SECRET` вращается стандартно: смена инвалидирует только role-hint куки (пользователи перелогинятся); session-токены не зависят от секрета.
- Аудит отказов — таблица `AuditLog` (OWNERSHIP_DENIED / OUTSIDE_FACULTY / ROLE_MISMATCH / NOT_FOUND): просмотр аномалий — `SELECT reason, count(*) FROM "AuditLog" GROUP BY 1 ORDER BY 2 DESC LIMIT 10;`.
- Ключи AI (`OPENROUTER_API_KEY`) не логируются; grep-аудит репозитория по `sk-or-` — пуст.
- Репозиторий: удаляйте смерженные ветки; SHA голов — в `docs/BRANCHES-ARCHIVE.md`.

## 7. Диагностика типовых инцидентов

| Симптом | Причина | Действие |
|---|---|---|
| Логин редиректит на /login?next=… без ошибки | rate-limit 30/15 мин на IP исчерпан | подождать окно 15 мин; для тестов — разные IP |
| Сотрудник получает 403 на /staff* | нет `AUTH_SECRET` → role-hint fail-closed | добавить секрет, `up -d --force-recreate` |
| `/api/staff/requests/…/certificate` → 404 на выданной справке | status вне канона (ISSUED\|COMPLETED) | проверить статус заявки; фикc применён (ISSUED\|COMPLETED) |
| build на проде «exit code 1» | конкуренция за .next-build.lock / OOM | строить последовательно; `docker compose build app` в фоне с логом; следить за swap |
| vitest test=fail на «ноябрь 20/21» | TZ-флейк полуночи МСК | устранён детерминированной фикстурой (2099-10-20); не реинтродуцировать Date.now()-фикстуры без полудня |
| «Executable doesn't exist» в Playwright | обновился Playwright | `npx playwright install chromium` на машине оператора |

## 8. Мониторинг

- **Health-check** `/api/health` — базовая живость (используется Caddy/upstream и e2e).
- Внешний мониторинг (UptimeRobot/Better Stack) — настроить на `/api/health` с интервалом 5 мин.
- Логи: `docker compose logs app` (stdout/stderr Next.js); системный журнал — `journalctl -u docker`.
- Аномалии аудита — см. раздел 6 (AuditLog).

## 9. Обновление стенда

1. `git fetch origin && git log origin/main -3` — что войдёт.
2. Деплой по разделу 2 (rsync → build → up → migrate → health).
3. Быстрый smoke: `/login` 200; логин студента → /dashboard; логин сотрудника → /staff; `/verify/несуществующий` → честная 404.
4. Полный регресс — `docs/wiki/Регресс-QA-ru` (матрица «роли × языки»).

## 10. Ограничения прототипа

- Доменные данные — в памяти процесса (memory-db): рестарт сбрасывает к сиду; Prisma покрывает auth и будет расширен (DIG-10/50).
- Единый сервер без горизонтального масштабирования; для нескольких инстансов потребуется внешний Postgres и общий .next-кэш.
- Rate-limit входа хранится в памяти процесса — рестарт сбрасывает счётчики.
