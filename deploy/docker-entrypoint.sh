#!/bin/sh
# deploy/docker-entrypoint.sh — DIG-7.
# При старте контейнера: применяет миграции Prisma (когда появятся схема и
# миграции, DIG-18+), затем запускает Next.js standalone (server.js).
set -e

if [ -f prisma/schema.prisma ] && [ -d prisma/migrations ]; then
  if [ -x node_modules/.bin/prisma ]; then
    echo '==> prisma migrate deploy'
    node_modules/.bin/prisma migrate deploy
  else
    echo 'WARN: prisma CLI не найден в образе — миграции пропущены (см. DIG-18)' >&2
  fi
fi

exec node server.js
