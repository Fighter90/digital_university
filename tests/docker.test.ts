// DIG-7 — Docker Compose (app + PostgreSQL 16 + Caddy) и переменные окружения.
// Пинит инфраструктурный контракт: compose-стек, миграции на старте контейнера,
// healthcheck /api/health, .env.example без секретов и без NEXT_PUBLIC_‑секретов,
// отсутствие секретов в клиентском бандле (серверные имена env), gitleaks в CI.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const mustExist = (p: string) => expect(existsSync(resolve(ROOT, p)), `missing: ${p}`).toBe(true);

const compose = () => read('deploy/docker-compose.yml');
const dockerfile = () => read('deploy/Dockerfile');
const caddyfile = () => read('deploy/Caddyfile');
const entrypoint = () => read('deploy/docker-entrypoint.sh');
const envExample = () => read('.env.example');
const dockerignore = () => read('.dockerignore');

describe('infrastructure files', () => {
  it('ships compose, Dockerfile, Caddyfile, entrypoint, .env.example, .dockerignore', () => {
    mustExist('deploy/docker-compose.yml');
    mustExist('deploy/Dockerfile');
    mustExist('deploy/Caddyfile');
    mustExist('deploy/docker-entrypoint.sh');
    mustExist('.env.example');
    mustExist('.dockerignore');
  });

  it('uses the deploy/ layout expected by scripts/swarm/deploy.sh (deploy/docker-compose.yml)', () => {
    const deploy = read('scripts/swarm/deploy.sh');
    expect(deploy).toContain('deploy/docker-compose.yml');
    expect(deploy).toContain('/api/health');
  });
});

describe('docker-compose: services app / db (PostgreSQL 16) / caddy', () => {
  it('defines all three services', () => {
    const c = compose();
    for (const service of ['  app:', '  db:', '  caddy:']) {
      expect(c, `service "${service.trim()}" missing`).toContain(service);
    }
  });

  it('db: postgres 16 image with a named volume for data', () => {
    const c = compose();
    expect(c).toMatch(/postgres:16/);
    expect(c).toMatch(/db-data:\/var\/lib\/postgresql\/data/);
    expect(c).toMatch(/^volumes:/m);
    expect(c).toMatch(/\n\s+db-data:/);
  });

  it('db: healthcheck via pg_isready (app starts only after db is healthy)', () => {
    const c = compose();
    expect(c).toMatch(/pg_isready/);
    expect(c).toMatch(/condition:\s*service_healthy/);
  });

  it('app: built from local Dockerfile, reachable on localhost:3000 for health-check', () => {
    const c = compose();
    expect(c).toMatch(/dockerfile:\s*deploy\/Dockerfile/);
    // deploy.sh curls http://localhost:3000/api/health on the server — port must be published
    // on loopback only (public traffic goes through Caddy).
    expect(c).toMatch(/127\.0\.0\.1:\$\{APP_PORT:-3000\}:3000/);
  });

  it('app: runs with NODE_ENV=production and listens on all interfaces inside the container', () => {
    const c = compose();
    expect(c).toMatch(/NODE_ENV:\s*production/);
    expect(c).toMatch(/HOSTNAME:\s*0\.0\.0\.0/);
  });

  it('caddy: reverse proxy on 80/443 with persistent data volumes and mounted Caddyfile', () => {
    const c = compose();
    expect(c).toMatch(/caddy:2-alpine/);
    expect(c).toMatch(/'?\$\{CADDY_HTTP_PORT:-80\}'?:80/);
    expect(c).toMatch(/'?\$\{CADDY_HTTPS_PORT:-443\}'?:443/);
    expect(c).toMatch(/\.\/Caddyfile:\/etc\/caddy\/Caddyfile:ro/);
    expect(c).toMatch(/caddy-data:\/data/);
  });

  it('env files are wired with required:false (compose works before the first cp .env.example .env)', () => {
    const c = compose();
    expect(c).toMatch(/required:\s*false/);
  });

  it('compose contains no hardcoded secrets — secrets come only from env interpolation or env_file', () => {
    const c = compose();
    const literalSecret =
      /^\s*(?:[A-Z0-9_]*(_PASSWORD|_SECRET|_KEY|_TOKEN|_PASS)):\s*(?!\$\{)(?!\s*$)\S+/gm;
    const offenders = c.match(literalSecret) ?? [];
    expect(offenders, `hardcoded secrets in compose: ${offenders.join('; ')}`).toEqual([]);
    expect(c).not.toMatch(/POSTGRES_HOST_AUTH_METHOD:\s*trust/i);
  });
});

describe('Dockerfile: standalone build, migrations on start, healthcheck', () => {
  it('builds Next.js standalone output on Node 22', () => {
    const d = dockerfile();
    expect(d).toMatch(/FROM node:22/);
    expect(d).toMatch(/output:\s*standalone|\.next\/standalone/);
    expect(d).toMatch(/\.next\/static/);
    expect(d).toMatch(/public/);
  });

  it('runs migrations via deploy/docker-entrypoint.sh when prisma schema exists', () => {
    const d = dockerfile();
    expect(d).toMatch(/ENTRYPOINT|CMD/);
    expect(d).toMatch(/docker-entrypoint\.sh/);
    const sh = entrypoint();
    expect(sh).toMatch(/prisma migrate deploy|prisma\/migrations/);
    expect(sh).toMatch(/exec node server\.js/);
    // контейнер обязан стартовать даже до появления схемы БД (DIG-18+)
    expect(sh).toMatch(/schema\.pris/);
  });

  it('healthchecks /api/health (task requirement)', () => {
    const d = dockerfile();
    expect(d).toMatch(/HEALTHCHECK/);
    expect(d).toContain('/api/health');
  });

  it('does not run as root', () => {
    expect(dockerfile()).toMatch(/^USER\s+\S+/m);
  });
});

describe('Caddyfile: reverse proxy + automatic HTTPS', () => {
  it('proxies to the app service inside the compose network', () => {
    expect(caddyfile()).toMatch(/reverse_proxy\s+app:3000/);
  });

  it('site address and www redirect are driven by env (local :80 by default, prod ostrovok.store)', () => {
    const c = caddyfile();
    expect(c).toMatch(/\{\$SITE_ADDRESS::80\}/);
    expect(c).toMatch(/\{\$SITE_ADDRESS_WWW/);
    expect(c).toMatch(/redir\s+https:\/\/\{\$SITE_ADDRESS\}\{uri\}/);
  });

  it('keeps compression and security headers, does not leak Server header', () => {
    const c = caddyfile();
    expect(c).toMatch(/encode\s+zstd\s+gzip/);
    expect(c).toMatch(/Strict-Transport-Security/);
    expect(c).toMatch(/X-Content-Type-Options/);
    expect(c).toMatch(/X-Frame-Options/);
    expect(c).toMatch(/Referrer-Policy/);
    expect(c).toMatch(/-\s*Server/);
  });
});

describe('.env.example: all variables, no secrets, no NEXT_PUBLIC_ secrets', () => {
  const requiredVars = [
    'APP_URL',
    'APP_PORT',
    'SITE_ADDRESS',
    // SITE_ADDRESS_WWW может быть закомментирована (локально) — это корректно
    'CADDY_HTTP_PORT',
    'CADDY_HTTPS_PORT',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'DATABASE_URL',
    'SESSION_SECRET',
    'LLM_PROVIDER',
    'LLM_BASE_URL',
    'LLM_API_KEY',
    'ICS_TOKEN_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
  ];

  it('lists every variable from the task (LLM, sessions, ICS, SMTP, Postgres, app, caddy)', () => {
    const env = envExample();
    for (const v of requiredVars) {
      expect(env, `variable ${v} missing from .env.example`).toMatch(new RegExp(`^${v}=`, 'm'));
    }
  });

  it('documents that real values live only in .env / hosting secrets', () => {
    expect(envExample()).toMatch(/\.env/);
    expect(envExample()).toMatch(/NEXT_PUBLIC_/); // предупреждение про префикс присутствует
  });

  it('never names a secret with the NEXT_PUBLIC_ prefix (that is how secrets leak into the bundle)', () => {
    const env = envExample();
    const names = env
      .split('\n')
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => l.split('=')[0]);
    const leaked = names.filter(
      (n) => /^NEXT_PUBLIC_/.test(n) && /SECRET|KEY|TOKEN|PASS|API/i.test(n),
    );
    expect(leaked, `NEXT_PUBLIC_ secrets: ${leaked.join(', ')}`).toEqual([]);
  });

  it('contains placeholder values only — no real-looking keys (gitleaks / review)', () => {
    const env = envExample();
    const suspicious = env
      .split('\n')
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => l.split('=').slice(1).join('='))
      .filter((v) => /^[A-Za-z0-9+/_=-]{40,}$/.test(v.trim()));
    expect(suspicious, `too-real values committed: ${suspicious.join(', ')}`).toEqual([]);
  });

  it('DATABASE_URL points at the compose db service for the container runtime', () => {
    expect(envExample()).toMatch(/DATABASE_URL=postgresql:\/\/.*@db:5432\//);
  });

  it('never ships site-address vars set-but-empty (empty value breaks Caddy site blocks)', () => {
    const env = envExample();
    const empty = ['SITE_ADDRESS', 'SITE_ADDRESS_WWW'].filter((v) =>
      new RegExp(`^${v}=$`, 'm').test(env),
    );
    expect(empty, `comment these out instead: ${empty.join(', ')}`).toEqual([]);
  });
});

describe('.dockerignore: secrets never enter the image build context', () => {
  it('excludes .env*, node_modules and .next', () => {
    const di = dockerignore();
    expect(di).toMatch(/^\.env$/m);
    expect(di).toMatch(/^\.env\.\*/m);
    expect(di).toMatch(/^node_modules/m);
    expect(di).toMatch(/^\.next/m);
  });
});

describe('secrets are server-only (acceptance: LLM/session keys never reach the client bundle)', () => {
  const serverOnlyEnv = [
    'SESSION_SECRET',
    'LLM_API_KEY',
    'ICS_TOKEN_SECRET',
    'SMTP_PASS',
    'DATABASE_URL',
    'POSTGRES_PASSWORD',
  ];

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return walk(p);
      return p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
    });

  it('no source file reachable from the client references server-only env directly', () => {
    const offenders: string[] = [];
    const srcDir = resolve(ROOT, 'src');
    for (const file of walk(srcDir)) {
      const content = readFileSync(file, 'utf8');
      for (const name of serverOnlyEnv) {
        if (
          new RegExp(`process\\.env\\.${name}`).test(content) &&
          /['"]use client['"]/.test(content)
        ) {
          offenders.push(`${file} references process.env.${name} in a client component`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('CI runs gitleaks over the repository (acceptance: no secrets in the repo)', () => {
    mustExist('.github/workflows/gitleaks.yml');
    const wf = read('.github/workflows/gitleaks.yml');
    expect(wf).toMatch(/gitleaks-action|gitleaks\/gitleaks/);
  });
});

describe('next.config: standalone output for the container image', () => {
  it('enables output: standalone (required by deploy/Dockerfile)', () => {
    expect(read('next.config.ts')).toMatch(/output:\s*'standalone'/);
  });
});
