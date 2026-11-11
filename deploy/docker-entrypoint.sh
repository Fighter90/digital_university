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
    echo 'WARN: prisma CLI не найден в образе — миграции пропущены' >&2
  fi
fi

# SEED_ON_BOOT=1 — идемпотентный сид (wipe & rebuild, вымышленные данные).
# Данные студентов пересоздаются при каждом старте с этим флагом.
if [ "$SEED_ON_BOOT" = "1" ] && [ -f prisma/seed.ts ] && [ -x node_modules/.bin/tsx ]; then
  echo '==> prisma db seed (SEED_ON_BOOT=1)'
  node_modules/.bin/tsx prisma/seed.ts
fi

exec node server.js
