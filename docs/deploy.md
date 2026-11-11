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

## Секреты

- `.env` и `.env.production` в git **не попадают** (см. `.gitignore`).
- На сервере секреты — `/opt/digital-university/.env`.
- Ключи TimeWeb/Linear/SSH — только в окружении рабочей машины (`~/.zshrc`).
