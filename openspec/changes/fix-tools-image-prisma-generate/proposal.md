# Proposal: fix-tools-image-prisma-generate

## Зачем
Деплой 20.11 упал на шаге seed: `Unknown argument 'teacherEmail'` в
`tx.scheduleEvent.createMany()`. Причина: в `deploy/Dockerfile.tools`
`prisma generate` выполнялся ДО `COPY . .`, а rsync приносит gitignored
`src/generated/prisma` (клиент, сгенерированный ранее на машине разработчика)
и затирает результат generate — tools-контейнер (migrate+seed) работал по
протухшему клиенту, не знающему свежих полей схемы.

## Что меняется
- `deploy/Dockerfile.tools`: `RUN pnpm exec prisma generate` перенесён ПОСЛЕ
  `COPY . .` — клиент всегда генерируется по актуальной схеме независимо от
  состояния локальной машины.
- Локально перегенерирован `src/generated/prisma` (gitignored, в git не
  попадает — страховка для rsync).

## Non-goals
- Схема БД, миграции, сам seed — не меняются.
- Основной `deploy/Dockerfile` уже корректен (generate после COPY).
