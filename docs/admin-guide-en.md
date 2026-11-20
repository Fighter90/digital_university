# Administrator Guide (EN)

> For the administrator of the «Digital Deanery» stand (https://ostrovok.store): deployment, secrets, operations, diagnostics, backup, security, MCP tokens.
>
> **A hackathon concept prototype** — a stand on fictional data; the production stand exists to demonstrate the concept to the jury. Every chapter follows the same structure: **purpose**, **step-by-step procedure**, **verification**.

## Table of contents

1. [Infrastructure](#1-infrastructure)
2. [Secrets (.env)](#2-secrets-env)
3. [Deployment (rsync + docker compose)](#3-deployment-rsync--docker-compose)
4. [Migrations & seed](#4-migrations--seed)
5. [Operations: restart, logs, health](#5-operations-restart-logs-health)
6. [Backup & restore](#6-backup--restore)
7. [MCP tokens](#7-mcp-tokens)
8. [Operational security](#8-operational-security)
9. [Incidents & diagnostics](#9-incidents--diagnostics)
10. [Monitoring](#10-monitoring)
11. [Updating the stand](#11-updating-the-stand)
12. [Prototype limitations](#12-prototype-limitations)

## 1. Infrastructure

**Purpose.** Understand what the stand consists of and where everything lives — before touching anything.

| Parameter | Value |
|---|---|
| Hosting | Timeweb Cloud VM «Digital University» (id 9566609), Ubuntu, 1 vCPU / 889 MB RAM + 2G swap, Docker 29 + Compose 2.40 |
| Domain | https://ostrovok.store (Caddy auto-HTTPS, HTTP-01) |
| Directory | `/opt/digital-university` |
| Access key | `~/.ssh/dig_deploy` (`DIG_DEPLOY_KEY`); **the server address and keys are not published** — export `DIG_SERVER_HOST` / `DIG_SERVER_USER` |
| Containers | `app` (Next.js standalone, health `/api/health`), `db` (PostgreSQL 16, 127.0.0.1 only), `caddy` (TLS + reverse proxy), `tools` (profile: full node_modules + pnpm for migrations/seed) |

Topology and DNS-record details — `docs/deploy.md` (the canonical source).

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

ostrovok.store is managed via the Timeweb Cloud API (`PATCH/POST https://api.timeweb.cloud/api/v1/domains/ostrovok.store/dns-records`, domain id 25218071); the token lives in `TIMEWEB_API_KEY` (the environment, not the repository). The A records of the domain and www point at the server; MX/TXT are untouched.

## 2. Secrets (.env)

**Purpose.** All stand secrets live only in the server `.env`; the repository carries only `.env.example` with variable names and no values.

**Step by step — create/update a secret.**

1. Connect to the server: `ssh -i ~/.ssh/dig_deploy "$DIG_SERVER_USER@$DIG_SERVER_HOST"`.
2. Open the file: `nano /opt/digital-university/.env` (permissions must be `chmod 600`).
3. Generate `AUTH_SECRET` if needed: `openssl rand -base64 32`.
4. Add/change the variable (see table 1.1) and save.
5. Apply: `docker compose -f deploy/docker-compose.yml up -d --force-recreate app` — env_file is read **at container creation**, so recreation is mandatory.
6. Verify health: `curl https://ostrovok.store/api/health` → `{"ok":true,"authStore":"prisma"}`.

**Verification:** `git grep` over the repository finds no secret values; `ssh … "ls -l /opt/digital-university/.env"` shows `-rw-------` (600).

**Rules.**

- Never rsync a local `.env` to the server — the `--exclude .env` rsync flag is mandatory.
- Keys (Timeweb/SSH/OpenRouter) live only in the operator's machine environment; never in code, logs or commits.
- `AUTH_SECRET` rotation is safe: it invalidates only role-hint cookies (users re-login); session tokens do not depend on the secret.

## 3. Deployment (rsync + docker compose)

**Purpose.** The manual procedure of shipping the current repository state to the stand: a clean tree → rsync → build → container recreation → migrations → health.

**Step by step (the full cycle):**

1. Create a clean tree: `git worktree add /tmp/deploy origin/main && cd /tmp/deploy` (working from a clean state protects against a dirty tree).
2. Sync files to the server (`.env` excluded — server secrets are not overwritten):

   ```bash
   rsync -az --delete \
     --exclude .git --exclude node_modules --exclude .next --exclude .env \
     --exclude .task-board --exclude test-results --exclude playwright-report \
     ./ "$DIG_SERVER_USER@$DIG_SERVER_HOST:/opt/digital-university/" \
     -e "ssh -i ~/.ssh/dig_deploy -o IdentitiesOnly=yes"
   ```

3. Build the image (3–15 min; 10–15 under load — run in the background with a log `> /tmp/prod-build.log 2>&1`):

   ```bash
   ssh … "cd /opt/digital-university && \
     docker compose -f deploy/docker-compose.yml build app"
   ```

4. Recreate the container: `ssh … "… up -d --force-recreate app"`.
5. Apply migrations if any (section 4).
6. Verify health: `curl https://ostrovok.store/api/health` → `{"ok":true,"authStore":"prisma"}`.
7. A smoke pass: `/login` 200; cabinet routes return 307 to `/login?next=…` without a session.

**Verification:** health is green; a student login lands on /dashboard; a staff login lands on /staff.

**Important rules:**

- The `--exclude .env` rsync flag is **mandatory** — server secrets must not be overwritten.
- `rsync --delete` removes everything on the server that is absent locally — never deploy from a dirty tree.
- A build under load can take 10–15 minutes; run it in the background with a log.
- After any `.env` change — `up -d --force-recreate` (env_file is read when the container is created).

## 4. Migrations & seed

**Purpose.** The DB schema is applied by Prisma migrations; the demo data is recreated by an idempotent seed (wipe & rebuild).

**Step by step — migrations:**

1. Run the tools container (the `tools` profile carries full node_modules + pnpm):

   ```bash
   ssh … "… --profile tools run --rm tools sh -c 'pnpm exec prisma migrate deploy'"
   ```

2. Migrations under `prisma/migrations/*` are applied in order; a clean status prints «No pending migrations».

**Step by step — the demo data seed:**

1. Run:

   ```bash
   ssh … "… --profile tools run --rm tools sh -c \
     'echo \"DATABASE_URL=\$DATABASE_URL\" > /app/.env && pnpm db:seed'"
   ```

2. The seed recreates the fictional data: students, schedule, grades, requests, tickets, certificates, MSP startups, events, DPO programs, notifications, and the demo users with jury passwords.
3. The seed is idempotent (wipe & rebuild) — safe to run repeatedly. **Caution:** user data and sessions are wiped; everyone signs in again.

**Verification:** the `anna.smirnova` login works; /dashboard serves the seeded data; «No pending migrations» in the migrate deploy output.

**Nuance:** the Prisma config reads the `.env` **file** in the cwd — hence `echo "DATABASE_URL=$DATABASE_URL" > /app/.env` inside the tools container first.

## 5. Operations: restart, logs, health

**Purpose.** Everyday operations: container restarts, reading logs, liveness checks, memory and disk.

| Task | Command |
|---|---|
| App logs | `ssh … "cd /opt/… && docker compose -f deploy/docker-compose.yml logs app --since 30m"` |
| Restart app | `… up -d --force-recreate app` |
| Restart the whole stack | `… down && … up -d` (a brief downtime) |
| Health | `curl https://ostrovok.store/api/health` → `{"ok":true,"authStore":"prisma"}` |
| Memory | `docker stats` (889 MB RAM + 2G swap; watch builds — OOM possible) |
| Disk | `docker system df`; cleanup — `docker image prune` |
| Build without cache | `build --no-cache` (10–20 min; run in background with a log) |

**Step by step — a routine app restart:**

1. `ssh … "cd /opt/digital-university && docker compose -f deploy/docker-compose.yml up -d --force-recreate app"`.
2. After 5–10 seconds — the health check (item 2 above).
3. If health is not green — read the logs (`logs app --since 5m`) and see section 9.

## 6. Backup & restore

**Purpose.** Protection against data loss: a daily pg_dump of the DB and a verified restore procedure.

### 6.1. Database backup (step by step)

1. Take the dump:

   ```bash
   ssh … "cd /opt/digital-university && \
     docker compose -f deploy/docker-compose.yml exec -T db \
     pg_dump -U university university" > backup-$(date +%F).sql
   ```

2. Make sure the file is not empty and contains `COPY`/`INSERT` sections (`head -50 backup-YYYY-MM-DD.sql`).
3. Keep at least 7 days (the prototype's recommendation); set up a daily cron on the operator machine.

The backup contains fictional data and demo password hashes — not secret, but do not publish it.

### 6.2. Restore (step by step)

1. Load the dump into the DB:

   ```bash
   cat backup-YYYY-MM-DD.sql | ssh … "cd /opt/… && docker compose -f deploy/docker-compose.yml exec -T db \
     psql -U university -d university"
   ```

2. Recreate the app: `up -d --force-recreate app`.
3. Verify health and a demo-account login.

### 6.3. Secrets (recovery)

Recovered from this guide (section 2): `AUTH_SECRET` — `openssl rand -base64 32`; `OPENROUTER_API_KEY` — from your OpenRouter account; the DB password — from the server `.env` (the last known copy).

## 7. MCP tokens

**Purpose.** Personal tokens for connecting the portal to external AI assistants (Claude, Cursor, Codex, etc.) via the stand's MCP server. The full reference — `docs/mcp.md`.

**How it works:**

- Endpoint: `https://ostrovok.store/api/mcp` — Streamable HTTP (JSON-RPC 2.0, MCP `2025-06-18`), authentication `Authorization: Bearer <token>`.
- The token is personal: the format is `demo-mcp-<43 base64url characters>`, 24 random bytes (192 bits of entropy).
- Only the **SHA-256 hash** is stored (the same primitive as for cookie sessions); the plaintext is shown to the owner **exactly once** after issuance; the settings tab shows only a preview (`demo-mcp-…XXXX`).
- Every call is scoped to the token owner (IDOR is impossible by construction); the server is **read-only**: no writes.

**Step by step — a user issues a token:**

1. Sign in (e.g. with the demo account `anna.smirnova`).
2. **Settings → the «MCP setup» tab**.
3. «Issue a token» — copy the value (it will never be shown again).
4. Copy the ready JSON config for your client right from the page (a button per client).
5. Connect (Claude Code): `claude mcp add --transport http deanery https://ostrovok.store/api/mcp --header "Authorization: Bearer <TOKEN>"`; verification — `/mcp` in the session shows connected.

**Step by step — revocation/re-issue:**

1. User: the same tab — the re-issue button (`rotateOwnMcpToken`): the old hash is removed, the new plaintext is shown once.
2. Administrator during an incident: revoke all tokens at once by resetting the hash fields in the DB, or have each user re-issue; cabinet sessions are not managed by MCP tokens.

**Verification:** a request without a token returns `401` with the JSON-RPC error `-32001` and `WWW-Authenticate: Bearer realm="digital-deanery-mcp"`; with a token — `tools/list` returns the read tools (schedule, grades, notifications).

## 8. Operational security

**Purpose.** Standing rules that must never be violated during any operation.

- Postgres binds **127.0.0.1** — the DB is unreachable from outside; never add `0.0.0.0` to ports.
- Server `.env` chmod 600; never rsync a local `.env` to the server (the `--exclude .env` flag is mandatory).
- `AUTH_SECRET` rotation: changing it invalidates only role-hint cookies (users re-login); session tokens do not depend on the secret.
- Denial audit — the `AuditLog` table (OWNERSHIP_DENIED / OUTSIDE_FACULTY / ROLE_MISMATCH / NOT_FOUND); spotting anomalies:

  ```sql
  SELECT reason, count(*) FROM "AuditLog" GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
  ```

- AI keys (`OPENROUTER_API_KEY`) are never logged; the repo grep audit for the real OpenRouter key prefix is empty.
- MCP tokens: only a SHA-256 hash in the DB, the plaintext is never persisted (see section 7).
- Repository hygiene: delete merged branches; the branch-head SHAs live in `docs/BRANCHES-ARCHIVE.md`.

## 9. Incidents & diagnostics

**Purpose.** Typical symptoms, causes and first actions; scenarios involving the Timeweb Cloud API and restarts.

### 9.1. The symptom matrix

| Symptom | Cause | Action |
|---|---|---|
| Login redirects to /login?next=… without an error | the per-IP rate limit (30/15 min) is exhausted | wait out the 15-minute window; use different IPs for tests |
| Staff gets 403 on /staff* | no `AUTH_SECRET` → the role hint is fail-closed | add the secret, `up -d --force-recreate` |
| `/api/staff/requests/…/certificate` → 404 on an issued certificate | the status is outside the canon (ISSUED\|COMPLETED) | verify the request status; the fix is applied (ISSUED\|COMPLETED) |
| production build «exit code 1» | contention over .next-build.lock / OOM | build sequentially; run `docker compose build app` in background with a log; watch swap |
| vitest test=fail on «Nov 20/21» | the MSK-midnight TZ flake | fixed with a deterministic fixture (2099-10-20); do not reintroduce noon-less Date.now() fixtures |
| «Executable doesn't exist» in Playwright | Playwright updated | `npx playwright install chromium` on the operator's machine |
| `/api/health` unreachable, the container is alive | an upstream/route failure | `docker compose logs app --since 10m`; restart `up -d --force-recreate app` |
| The server does not respond on SSH and 443 | the Timeweb host/hypervisor | scenario 9.2 (Timeweb Cloud API / panel) |
| The site fails on DNS/certificate | a DNS-record problem | scenario 9.3 (the Timeweb DNS API) |

### 9.2. «Host unreachable» — Timeweb Cloud (step by step)

1. Confirm the scale: `ssh` unreachable, `curl https://ostrovok.store/api/health` timing out from different networks.
2. Open the Timeweb Cloud panel (Servers → «Digital University», id 9566609) and check the VM status and the CPU/RAM graphs.
3. Restart the VM: **panel → «Restart»**, or via the Timeweb Cloud API with the `TIMEWEB_API_KEY` token (server management at `api.timeweb.cloud/api/v1/servers/…`); as a last resort — «Shut down → Start».
4. After the boot: `ssh` → `docker compose -f deploy/docker-compose.yml ps` — all containers `Up`; if needed `up -d` (compose restarts the fallen ones).
5. Health: `curl https://ostrovok.store/api/health` → `{"ok":true,…}`; a smoke pass of the key pages (section 11, item 3).
6. If the VM does not come up — a support ticket to Timeweb with the server id; after recovery verify the freshness of the DB backup (section 6).

### 9.3. A DNS incident — the Timeweb DNS API (step by step)

1. Check resolution: `dig ostrovok.store A +short` — it must return the server's A record.
2. If the records drifted — via the API: `PATCH/POST https://api.timeweb.cloud/api/v1/domains/ostrovok.store/dns-records` (domain id 25218071, the `TIMEWEB_API_KEY` token); the A records of the domain and www — to the server address, MX/TXT untouched.
3. Wait out the TTL; repeat `dig` and the health check.
4. A TLS incident: Caddy renews the certificate automatically once DNS is fixed; if needed restart `caddy` (`up -d --force-recreate caddy`).

**The general order for any incident:** record the symptom → health/logs → the minimal action (a container restart) → escalation (the VM via Timeweb) → restore from backup (the last resort) → a note in `docs/ai-log`/notes.

## 10. Monitoring

**Purpose.** Learn about a problem before the users do.

- **Health-check** `/api/health` — basic liveness (used by Caddy/upstream and e2e).
- External monitoring (UptimeRobot/Better Stack) — configure on `/api/health` with a 5-minute interval.
- Logs: `docker compose logs app` (Next.js stdout/stderr); the system journal — `journalctl -u docker`.
- Audit anomalies — see section 8 (AuditLog).

## 11. Updating the stand

**Purpose.** The regular «what ships → deploy → verify» cycle.

1. `git fetch origin && git log origin/main -3` — what will ship.
2. Deploy per section 3 (rsync → build → up → migrate → health).
3. Quick smoke: `/login` 200; a student login → /dashboard; a staff login → /staff; `/verify/unknown` → an honest 404.
4. Full regression — the «Roles × languages» matrix in the QA Regression wiki page.

## 12. Prototype limitations

- Domain data lives in process memory (memory-db): a restart resets to the seed; Prisma covers auth and is to be extended (DIG-10/50).
- A single server without horizontal scaling; multiple instances would require an external Postgres and a shared .next cache.
- The sign-in rate limit lives in process memory — a restart resets the counters.
