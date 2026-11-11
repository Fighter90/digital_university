# Деплой: ostrovok.store

## Цель

Прототип доступен из России без VPN по адресам:
- https://ostrovok.store
- https://www.ostrovok.store (редирект на основной)

## Сервер

| Параметр | Значение |
|---|---|
| Провайдер | Timeweb Cloud, VM «Digital University» (id 9566609) |
| IP | 186.243.219.107 |
| ОС | Ubuntu 26.04, 1 vCPU, 889 МБ RAM + **swap 2G** |
| Доступ | `ssh -i ~/.ssh/dig_deploy root@186.243.219.107` (пароль как резерв) |
| Каталог | `/opt/digital-university` |
| Стек | Docker 29 + Compose 2.40 |

## DNS (Timeweb Cloud API, домен ostrovok.store, id 25218071)

| Запись | Тип | Значение | TTL |
|---|---|---|---|
| ostrovok.store | A | 186.243.219.107 | 600 |
| www.ostrovok.store | A | 186.243.219.107 | 600 |

Управление: `PATCH/POST https://api.timeweb.cloud/api/v1/domains/ostrovok.store/dns-records`,
токен в `TIMEWEB_API_KEY` (окружение). MX/TXT Timeweb не трогаем.

## TLS

**Caddy** в docker-compose получает сертификат Let's Encrypt по HTTP-01
автоматически (A-записи смотрят на сервер). Ручных действий не требуется;
продление автоматическое.

## Как деплоит рой

`scripts/swarm/deploy.sh` (вызывается оркестратором с флагом `--deploy`):
rsync репозитория → `.env.production` → `docker compose build/up` →
health-check `/api/health`.

Вручную: `bash scripts/swarm/deploy.sh`.

## Локально в Docker (та же команда, что и на проде)

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml up --build
```

Кабинет: http://localhost:3000, health: `/api/health`, наружу — Caddy на 80/443.
Состав стека (`deploy/docker-compose.yml`): `app` — Next.js standalone,
`db` — PostgreSQL 16 с volume `db-data`, `caddy` — reverse proxy
(авто-HTTPS: локально `SITE_ADDRESS=:80`, прод — `ostrovok.store`,
`www.` редиректится на основной). Миграции Prisma применяются при старте
контейнера (`deploy/docker-entrypoint.sh`); до DIG-18 схемы нет — контейнер
стартует без миграций. App публикуется только на `127.0.0.1:3000` (его
проверяет деплой), db — только на loopback; публичный вход — Caddy.

### Переменные окружения

Шаблон — `.env.example` (комментарии внутри). Реальные значения — только в
`.env`/`.env.production` и в секретах хостинга. Ключевые:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | строка Prisma; внутри compose хост — `db` |
| `POSTGRES_*` | имя/пользователь/пароль БД (пароль — без дефолтов в проде) |
| `SESSION_SECRET` | подпись httpOnly cookie-сессий (`openssl rand -base64 32`) |
| `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_API_KEY` | AI-ассистент, ключ только серверный |
| `APP_URL` | публичный адрес сайта |
| `ICS_TOKEN_SECRET` | подпись ссылок на .ics-подписки |
| `SMTP_*` | письма о заявках и уведомлениях |
| `SITE_ADDRESS` / `SITE_ADDRESS_WWW` | домены Caddy (пустыми не оставлять — комментировать) |
| `APP_PORT` / `CADDY_*_PORT` | порты на хосте |

Секреты никогда не называть с префиксом `NEXT_PUBLIC_` — Next.js встраивает
такие переменные в клиентский бандл. Проверка после сборки (совпадений быть
не должно):

```bash
grep -rlE 'change-me|SESSION_SECRET|LLM_API_KEY|ICS_TOKEN_SECRET' .next/static
```

Скан секретов по репозиторию — gitleaks в CI (`.github/workflows/gitleaks.yml`).

## Секреты

- `.env` и `.env.production` в git **не попадают** (см. `.gitignore`).
- На сервере секреты — `/opt/digital-university/.env`.
- Ключи TimeWeb/Linear/SSH — только в окружении рабочей машины (`~/.zshrc`).
