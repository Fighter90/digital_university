# Архитектура

## Слои

```
Браузер (моб. 360px / десктоп 1440px)
   │  httpOnly cookie-сессия
   ▼
Next.js 15 (App Router, RSC)
   ├─ src/app/(auth)/login         — вход (rate limit)
   ├─ src/app/(app)/…              — экраны кабинета (layout = Shell)
   ├─ src/server/actions/          — мутации, каждая проверяет владельца
   ├─ src/lib/auth.ts              — сессии, роли student|staff
   └─ src/lib/db.ts                — Prisma client (singleton)
   ▼
Prisma → PostgreSQL (docker)
```

## Ключевые решения

1. **RSC-first**: данные читаются на сервере — чужие данные физически не
   покидают сервер (основа защиты от IDOR).
2. **Server actions с проверкой сессии** — одна точка контроля доступа,
   повторяемая в каждом действии и покрытая тестами.
3. **Дизайн-токены** в `src/styles/tokens.css` — источник цветов/радиусов;
   компоненты не хардкодят значения (соответствие Figma).
4. **Shell-компонент** — шапка+меню как в макете «Shell · Кабинет»: одно
   место правды навигации; mobile-навигация (bottom tabs) в том же компоненте.
5. **Сиды вымышленных данных** (`prisma/seed.ts`) — детерминированные ФИО/группы;
   два студента и один сотрудник для жюри.
6. **AI-ассистент** (DIG-46) — карточки действий поверх данных кабинета;
   LLM-ключ только серверный, без прокидывания в браузер.

## Инфраструктура

- `deploy/docker-compose.yml`: app (Next standalone), postgres, caddy.
- Caddy: авто-TLS (HTTP-01) для ostrovok.store и www.
- Деплой: `scripts/swarm/deploy.sh` (rsync + compose up + health-check).
