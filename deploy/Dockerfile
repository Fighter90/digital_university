# DIG-7 — образ Next.js standalone для deploy/docker-compose.yml.
# Многоступенчатая сборка: deps → build → runner (без исходников и dev-инструментов).
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH="/pnpm:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
# generate в postinstall требует DATABASE_URL (prisma.config.ts fail-fast):
# в deps-стадии БД не нужна — генерим с плейсхолдером (соединения нет)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
COPY package.json pnpm-lock.yaml ./
# prisma generate (postinstall) читает схему — копируем её до install
COPY prisma/schema.prisma prisma/schema.prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# src/generated — gitignored (клиент Prisma): генерируем для typecheck/build
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm exec prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chmod=755 deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node

EXPOSE 3000

# Приёмка DIG-7: healthcheck /api/health (без curl/wget в образе — node fetch).
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
