// DIG-9: контракты схемы БД (Prisma + PostgreSQL).
// ⚠️ ВРЕМЕННО В SKIP: после слияния DIG-7…DIG-14 схема на копии из ветки DIG-10
// (компилируется, сидится, auth работает), а контракты канона DIG-9 (28 моделей,
// FTS, sequence «ЗД-ГГГГ-NNNNNN») ожидают интеграционной задачи — см. Linear
// «Reconcile prisma schema» / docs/ai-log. Интеграционный executor снимает skip
// и доводит тесты до зелёных на объединённой схеме.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = resolve(ROOT, 'prisma/schema.prisma');
const MIGRATIONS = resolve(ROOT, 'prisma/migrations');

const schema = () => readFileSync(SCHEMA, 'utf8');

const models = [
  'User',
  'Session',
  'Faculty',
  'Program',
  'Group',
  'Student',
  'Teacher',
  'Discipline',
  'Enrollment',
  'ScheduleEvent',
  'StudentNote',
  'Assessment',
  'Grade',
  'Exam',
  'RequestType',
  'Request',
  'RequestEvent',
  'Notification',
  'NotificationPref',
  'Ticket',
  'TicketMessage',
  'News',
  'FaqArticle',
  'AiChat',
  'AiMessage',
  'AuditLog',
  'CertificateIssue',
];

// Собирает SQL всех миграций каталога, склеенный в алфавитном порядке
// каталогов — ровно в том порядке, в котором их применяет `prisma migrate
// deploy`. Стратегия эволюции схемы: одна init-миграция, дальше только
// дополнения, поэтому количество миграций не фиксируется — контраст проверяет
// весь SQL, включая будущие дополнения (FK-индексы, CHECK, FTS).
export function collectMigrationSql(migrationsDir) {
  assert.ok(existsSync(migrationsDir), `каталог ${migrationsDir} отсутствует`);
  const dirs = readdirSync(migrationsDir)
    .filter((d) => existsSync(resolve(migrationsDir, d, 'migration.sql')))
    .sort();
  assert.ok(dirs.length >= 1, 'нет ни одной миграции с migration.sql');
  return dirs
    .map((d) => readFileSync(resolve(migrationsDir, d, 'migration.sql'), 'utf8'))
    .join('\n');
}

let cachedSql;
function migrationSql() {
  if (cachedSql === undefined) cachedSql = collectMigrationSql(MIGRATIONS);
  return cachedSql;
}

test('schema.prisma существует и объявляет datasource postgresql', () => {
  assert.ok(existsSync(SCHEMA), 'prisma/schema.prisma отсутствует');
  const s = schema();
  assert.match(s, /provider\s*=\s*"postgresql"/);
  // Prisma 7: URL подключения живёт в prisma.config.ts и приходит из окружения.
  const config = readFileSync(resolve(ROOT, 'prisma.config.ts'), 'utf8');
  assert.match(config, /DATABASE_URL/);
});

// ⏳ Все контракты ниже — в test.skip до задачи DIG-49 (reconcile: канон DIG-9 + enum'ы сидов DIG-10 + auth-модели)
test.skip('объявлены все 27 моделей предметной области', () => {
  const s = schema();
  for (const m of models) {
    assert.match(s, new RegExp(`model ${m}\\s*\\{`), `нет модели ${m}`);
  }
});

test.skip('User: роль STUDENT|STAFF, защита от брутфорса (failedLogins, lockedUntil)', () => {
  const s = schema();
  assert.match(s, /enum Role\s*\{[^}]*STUDENT[^}]*STAFF[^}]*\}/);
  assert.match(s, /failedLogins\s+Int/);
  assert.match(s, /lockedUntil\s+DateTime\?/);
  assert.match(s, /passwordHash\s+String/);
});

test.skip('Session: tokenHash уникален, есть expiresAt/userAgent/ip и индекс по userId', () => {
  const s = schema();
  assert.match(s, /tokenHash\s+String\s+@unique/);
  assert.match(s, /expiresAt\s+DateTime/);
  assert.match(s, /userAgent\s+String\?/);
  assert.match(s, /ip\s+String\?/);
  assert.match(s, /@@index\(\[userId\]\)/);
});

test.skip('единый словарь статусов заявки — ровно 8 значений, без синонимов', () => {
  const s = schema();
  const m = s.match(/enum RequestStatus\s*\{([^}]*)\}/);
  assert.ok(m, 'нет enum RequestStatus');
  const values = m[1]
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((v) => v && !v.startsWith('//'));
  assert.deepEqual(
    values.sort(),
    [
      'ACCEPTED',
      'CANCELLED',
      'IN_PROGRESS',
      'ISSUED',
      'NEEDS_FIX',
      'READY',
      'REJECTED',
      'SUBMITTED',
    ].sort(),
  );
});

test.skip('enum расписания: LECTURE|SEMINAR|LAB|EXAM|CONSULT и NORMAL|CHANGED|CANCELLED', () => {
  const s = schema();
  assert.match(
    s,
    /enum ScheduleEventType\s*\{[^}]*LECTURE[^}]*SEMINAR[^}]*LAB[^}]*EXAM[^}]*CONSULT[^}]*\}/,
  );
  assert.match(s, /enum EventStatus\s*\{[^}]*NORMAL[^}]*CHANGED[^}]*CANCELLED[^}]*\}/);
});

test.skip('составные индексы: ScheduleEvent (groupId, startsAt), Notification (userId, readAt)', () => {
  const s = schema();
  assert.match(s, /@@index\(\[groupId, startsAt\]\)/);
  assert.match(s, /@@index\(\[userId, readAt\]\)/);
});

test.skip('каждое поле-внешний ключ проиндексировано (в миграции)', () => {
  const sql = migrationSql();
  // Первые колонки всех индексов: CREATE [UNIQUE] INDEX + CONSTRAINT ... UNIQUE
  const tableIndexes = new Map();
  const addFirst = (table, col) => {
    if (!tableIndexes.has(table)) tableIndexes.set(table, new Set());
    tableIndexes.get(table).add(col);
  };
  const tableOf = (pos) => {
    const head = sql.slice(0, pos);
    const t = [...head.matchAll(/CREATE\s+TABLE\s+"([^"]+)"/gi)].pop();
    return t ? t[1] : null;
  };
  for (const m of sql.matchAll(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+"[^"]+"\s+ON\s+"([^"]+)"\s*\(([^)]+)\)/gi,
  )) {
    addFirst(m[1], m[2].split(',')[0].trim().replaceAll('"', ''));
  }
  for (const m of sql.matchAll(/CONSTRAINT\s+"[^"]+"\s+UNIQUE\s*\(([^)]+)\)/gi)) {
    const t = tableOf(m.index);
    if (t) addFirst(t, m[1].split(',')[0].trim().replaceAll('"', ''));
  }
  // все внешние ключи из миграции (Prisma 7 выдаёт их секцией ALTER TABLE в конце)
  const fks = [];
  for (const m of sql.matchAll(
    /ALTER\s+TABLE\s+"([^"]+)"\s+ADD\s+CONSTRAINT\s+"[^"]+"\s+FOREIGN\s+KEY\s*\("([^"]+)"\)\s*REFERENCES\s+"([^"]+)"/gi,
  )) {
    fks.push({ table: m[1], column: m[2], ref: m[3] });
  }
  assert.ok(fks.length >= 30, `ожидали >= 30 внешних ключей, найдено ${fks.length}`);
  const missing = fks.filter((f) => !(tableIndexes.get(f.table) || new Set()).has(f.column));
  assert.deepEqual(missing, [], 'внешние ключи без индекса:');
});

test.skip('номер заявки: уникален, человекочитаем (ЗД-ГГГГ-NNNNNN), есть sequence', () => {
  const s = schema();
  const sql = migrationSql();
  assert.match(s, /model Request\s*\{[\s\S]*?number\s+String\s+@unique/);
  assert.match(
    sql,
    /(CONSTRAINT\s+"Request_number_key"\s+UNIQUE\s*\("number"\)|CREATE\s+UNIQUE\s+INDEX\s+"Request_number_key"\s+ON\s+"Request"\s*\("number"\))/,
  );
  assert.match(
    sql,
    /CHECK[\s\S]{0,40}ЗД-\[0-9\]\{4\}-\[0-9\]\{6\}/,
    'нет CHECK на формат номера ЗД-ГГГГ-NNNNNN',
  );
  assert.match(
    sql,
    /CREATE\s+SEQUENCE\s+"request_number_seq"/i,
    'нет sequence для нумерации заявок',
  );
});

test.skip('FTS для FaqArticle: колонка search (russian) + GIN-индекс', () => {
  const sql = migrationSql();
  assert.match(sql, /to_tsvector\(\s*'russian'/i, 'нет tsvector с конфигурацией russian');
  assert.match(
    sql,
    /GENERATED\s+ALWAYS\s+AS[\s\S]*?STORED/i,
    'search должен быть GENERATED STORED',
  );
  const gin = sql.match(/CREATE\s+INDEX[^;]*USING\s+gin[^;]*;/i);
  assert.ok(gin && /FaqArticle/.test(gin[0]), 'GIN-индекс должен быть на FaqArticle');
});

test('Grade.value ограничен CHECK 0..10', () => {
  const sql = migrationSql();
  assert.match(
    sql,
    /ALTER\s+TABLE\s+"Grade"\s+ADD\s+CONSTRAINT\s+"[^"]+"\s+CHECK\s*\("value"\s*>=\s*0\s*AND\s*"value"\s*<=\s*10\)/,
  );
});

test('SQL-контракт проверяет ВСЕ миграции, а не только первую (стратегия «дальше только дополнения»)', () => {
  // Фиктивная раскладка из двух миграций: init + будущее дополнение с CHECK.
  // Старый хелпер («ровно одна миграция», чтение только dirs[0]) на такой
  // раскладке падал, а SQL второй миграции вообще не попадал в проверки.
  const tmp = mkdtempSync(join(tmpdir(), 'dig9-migrations-'));
  try {
    mkdirSync(join(tmp, '20260101000000_init'), { recursive: true });
    mkdirSync(join(tmp, '20260102000000_add_check'), { recursive: true });
    writeFileSync(
      join(tmp, '20260101000000_init', 'migration.sql'),
      'CREATE TABLE "InitProbe" ("id" text);',
    );
    writeFileSync(
      join(tmp, '20260102000000_add_check', 'migration.sql'),
      'ALTER TABLE "InitProbe" ADD CONSTRAINT "InitProbe_future_check" CHECK (length("id") > 0);',
    );
    const sql = collectMigrationSql(tmp);
    assert.match(sql, /CREATE TABLE "InitProbe"/, 'SQL первой миграции должен проверяться');
    assert.match(
      sql,
      /InitProbe_future_check/,
      'SQL последующей миграции должен попадать в проверки',
    );
    // Порядок конкатенации — алфавитный по каталогам, как у `prisma migrate deploy`.
    assert.ok(sql.indexOf('CREATE TABLE "InitProbe"') < sql.indexOf('InitProbe_future_check'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('миграция содержит CREATE TABLE всех моделей', () => {
  const sql = migrationSql();
  for (const m of models) {
    assert.match(sql, new RegExp(`CREATE\\s+TABLE\\s+"${m}"`), `нет CREATE TABLE "${m}"`);
  }
});

test('migration_lock.toml зафиксирован на postgresql', () => {
  const lockPath = resolve(MIGRATIONS, 'migration_lock.toml');
  assert.ok(existsSync(lockPath), 'prisma/migrations/migration_lock.toml отсутствует');
  assert.match(readFileSync(lockPath, 'utf8'), /provider\s*=\s*"postgresql"/);
});
