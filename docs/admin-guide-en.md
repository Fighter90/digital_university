# Administrator Guide (EN) — companion to docs/admin-guide-ru.md

> The English mirror of the administrator guide. The Russian version (`docs/admin-guide-ru.md`) is canonical. This file repeats the operational knowledge in English.

## 1. Infrastructure

| Parameter | Value |
|---|---|
| Hosting | Timeweb Cloud VM (Ubuntu, 1 vCPU / 889 MB RAM + 2G swap, Docker 29 + Compose 2.40) |
| Domain | https://ostrovok.store (Caddy auto-HTTPS, HTTP-01) |
| Directory | `/opt/digital-university` |
| Access key | `~/.ssh/dig_deploy` (`DIG_DEPLOY_KEY`); **the server address and keys are not published** — export `DIG_SERVER_HOST` / `DIG_SERVER_USER` |
| Containers | `app` (Next.js standalone, health `/api/health`), `db` (PostgreSQL 16, 127.0.0.1 only), `caddy` (TLS + reverse proxy), `tools` (profile: full node_modules + pnpm for migrations/seed) |

### 1.1. Environment (`/opt/digital-university/.env`, chmod 600)

| Variable | Purpose | If missing |
|---|---|---|
| `DATABASE_URL=postgresql://university:<db-password>@db:5432/university` | Prisma connection. Postgres is bound to 127.0.0.1 only | the app does not start |
| `AUTH_SECRET` | HMAC signature of the role-hint cookie (`__Host-role`) | **fail-closed**: everyone is treated as a student; `/staff` returns 403 to staff |
| `OPENROUTER_API_KEY` | The floating AI assistant (FAB → OpenRouter → RAG over the guide) | The assistant works in demo mode (guide chunks) |
| `APP_PORT` (optional) | The app port on the host (default 3000, bound to 127.0.0.1) | 3000 |
| `POSTGRES_PORT` (optional) | The Postgres port (default 5432, bound to 127.0.0.1) | 5432 |

**Real incident:** a missing `AUTH_SECRET` in the server `.env` made the staff cabinet unreachable (403 via fail-closed) — caught by the staff-cabinet regression, recorded here. Fix: add the variable, `up -d --force-recreate`.

### 1.2. DNS
ostrovok.store is managed via the Timeweb Cloud API (`PATCH/POST https://api.timeweb.cloud/api/v1/domains/ostrovok.store/dns-records`); the token lives in `TIMEWEB_API_KEY` (the environment, not the repository). The A records of the domain and www point at the server; MX/TXT are untouched.

## 2. Deployment (manual procedure)

```bash
git worktree add /tmp/deploy origin/main          # clean state
cd /tmp/deploy
rsync -az --delete \
  --exclude .git --exclude node_modules --exclude .next --exclude .env \
  --exclude .task-board --exclude test-results --exclude playwright-report \
  ./ "$DIG_SERVER_USER@$DIG_SERVER_HOST:/opt/digital-university/" \
  -e "ssh -i ~/.ssh/dig_deploy -o IdentitiesOnly=yes"

ssh … "cd /opt/digital-university && \
  docker compose -f deploy/docker-compose.yml build app"        # 3–15 min

ssh … "… up -d --force-recreate app"                            # recreate the container

ssh … "… --profile tools run --rm tools sh -c \
  'pnpm exec prisma migrate deploy'"                            # migrations (if any)
```

**Verification:** `curl https://ostrovok.store/api/health` → `{"ok":true,"authStore":"prisma"}`; then a smoke pass of the key pages (`/login` 200, cabinet routes 307 to /login?next=…).

**Important rules:**
- The `--exclude .env` rsync flag is **mandatory** — server secrets must not be overwritten.
- `rsync --delete` removes everything on the server that is absent locally — never deploy from a dirty tree.
- A build under load can take 10–15 minutes; run it in the background with a log (`> /tmp/prod-build.log 2>&1`).
- After any `.env` change — `up -d --force-recreate` (env_file is read when the container is created).

## 3. Migrations & seed

```bash
# schema migrations
ssh … "… --profile tools run --rm tools sh -c 'pnpm exec prisma migrate deploy'"

# demo data seed (idempotent wipe & rebuild)
ssh … "… --profile tools run --rm tools sh -c \
  'echo \"DATABASE_URL=\$DATABASE_URL\" > /app/.env && pnpm db:seed'"
```

- Migrations under `prisma/migrations/*` are applied in order; a clean status prints «No pending migrations».
- The **seed** recreates the fictional data (students, schedule, grades, requests, tickets, certificates, MSP startups, events, DPO programs, notifications) and the demo users with jury passwords. It is idempotent (wipe & rebuild): sessions are wiped — users sign in again.
- The Prisma config reads the `.env` **file** in the cwd — hence `echo "DATABASE_URL=$DATABASE_URL" > /app/.env` inside the tools container first.

## 4. Operations cheat-sheet

| Task | Command |
|---|---|
| App logs | `ssh … "cd /opt/… && docker compose -f deploy/docker-compose.yml logs app --since 30m"` |
| Restart app | `… up -d --force-recreate app` |
| Health | `curl https://ostrovok.store/api/health` → `{"ok":true,"authStore":"prisma"}` |
| Memory | `docker stats` (889 MB RAM + 2G swap; watch builds — OOM possible) |
| Disk | `docker system df`; cleanup — `docker image prune` |
| Build without cache | `build --no-cache` (10–20 min; run in background with a log) |

## 5. Backup & restore

### 5.1. Database backup
```bash
ssh … "cd /opt/digital-university && \
  docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U university university" > backup-$(date +%F).sql
```
Keep at least 7 days. The backup contains fictional data and demo password hashes — not secret, but do not publish.

### 5.2. Restore
```bash
cat backup-YYYY-MM-DD.sql | ssh … "cd /opt/… && docker compose -f deploy/docker-compose.yml exec -T db \
  psql -U university -d university"
```
Then `up -d --force-recreate app` and a health check.

### 5.3. Secrets
Recovered from this guide (section 1.1): `AUTH_SECRET` — `openssl rand -base64 32`; `OPENROUTER_API_KEY` — from your OpenRouter account; the DB password — from the server `.env` (the last known copy).

## 6. Operational security

- Postgres binds **127.0.0.1** — the DB is unreachable from outside; never add `0.0.0.0` to ports.
- Server `.env` chmod 600; never rsync a local `.env` to the server (the `--exclude .env` flag is mandatory).
- `AUTH_SECRET` rotation: changing it invalidates only role-hint cookies (users re-login); session tokens do not depend on the secret.
- Denial audit — the `AuditLog` table: `SELECT reason, count(*) FROM "AuditLog" GROUP BY 1 ORDER BY 2 DESC LIMIT 10;` to spot anomalies.
- AI keys (`OPENROUTER_API_KEY`) are never logged; the repo grep audit for `sk-or-` is empty.
- Repository hygiene: delete merged branches; the branch-head SHAs live in `docs/BRANCHES-ARCHIVE.md`.

## 7. Typical incident diagnostics

| Symptom | Cause | Action |
|---|---|---|
| Login redirects to /login?next=… without an error | the per-IP rate limit (30/15 min) is exhausted | wait out the 15-minute window; use different IPs for tests |
| Staff gets 403 on /staff* | no `AUTH_SECRET` → the role hint is fail-closed | add the secret, `up -d --force-recreate` |
| `/api/staff/requests/…/certificate` → 404 on an issued certificate | the status is outside the canon (ISSUED\|COMPLETED) | verify the request status; the fix is applied (ISSUED\|COMPLETED) |
| production build «exit code 1» | contention over .next-build.lock / OOM | build sequentially; run `docker compose build app` in background with a log; watch swap |
| vitest test=fail on «Nov 20/21» | the MSK-midnight TZ flake | fixed with a deterministic fixture (2099-10-20); do not reintroduce noon-less Date.now() fixtures |
| «Executable doesn't exist» in Playwright | Playwright updated | `npx playwright install chromium` on the operator's machine |

## 8. Monitoring

- **Health-check** `/api/health` — basic liveness (used by Caddy/upstream and e2e).
- External monitoring (UptimeRobot/Better Stack) — configure on `/api/health` with a 5-minute interval.
- Logs: `docker compose logs app` (Next.js stdout/stderr); the system journal — `journalctl -u docker`.
- Audit anomalies — see section 6 (AuditLog).

## 9. Updating the stand

1. `git fetch origin && git log origin/main -3` — what will ship.
2. Deploy per section 2 (rsync → build → up → migrate → health).
3. Quick smoke: `/login` 200; a student login → /dashboard; a staff login → /staff; `/verify/unknown` → an honest 404.
4. Full regression — the «Roles × languages» matrix in the QA Regression wiki page.
