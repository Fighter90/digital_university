#!/usr/bin/env node
// DIG-111/DIG-123 — аудит переводов RU↔EN: парность ключей, паритет
// плейсхолдеров, кириллица в EN, латинские кальки в RU, артефакты строк
// (двойные пробелы, незакрытые плейсхолдеры). Результат пишется в
// TRANSLATION-AUDIT.md в корне репозитория вместе с глоссарием терминов.
//
// Запуск: node scripts/i18n-audit.mjs
// Код выхода: 0 — расхождений нет, 1 — есть (скрипт можно вешать на гейт).
// Те же правила продублированы рантайм-тестом tests/i18n-audit.test.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const RU_FILE = resolve(ROOT, 'src/lib/i18n/ru.ts');
const EN_FILE = resolve(ROOT, 'src/lib/i18n/en.ts');
const OUT_FILE = resolve(ROOT, 'TRANSLATION-AUDIT.md');

// Словари — плоские литералы 'ключ': 'значение' без экранирования кавычек
// (проверено grep'ом), поэтому достаточно парсера по регулярному выражению.
function parseDict(file) {
  const src = readFileSync(file, 'utf8');
  const map = new Map();
  const re = /'([A-Za-z0-9._]+)':\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(src))) map.set(m[1], m[2]);
  return map;
}

const ru = parseDict(RU_FILE);
const en = parseDict(EN_FILE);

const placeholders = (value) => (value.match(/\{[A-Za-z0-9._]+\}/g) ?? []).sort();
const withoutPlaceholders = (value) => value.replace(/\{[A-Za-z0-9._]+\}/g, ' ');
const latinWords = (value) =>
  (withoutPlaceholders(value).match(/[A-Za-z][A-Za-z-]*/g) ?? []).map((w) => w.replace(/-+$/, ''));

// ── разрешённая латынь в RU (синхронизировано с tests/i18n-audit.test.ts) ──
const ALLOWED_LATIN_RU = new Set([
  'AI', 'ai', 'MCP', 'JSON', 'QR', 'PDF', 'XLSX', 'MD', 'md', 'ID', 'id', 'IP',
  'N', 'ECTS', 'GPA', 'MSK', 'SLA', 'URL', 'API', 'DIG',
  'Model', 'Context', 'Protocol',
  'Apple', 'Calendar', 'ChatGPT', 'Claude', 'Cursor', 'Desktop', 'Excel',
  'GitHub', 'Google', 'Linear', 'Markdown', 'Telegram', 'WhatsApp', 'Push',
  'Speech', 'Web', 'Bearer', 'Authorization', 'argon',
  'Settings', 'Connectors', 'Add', 'custom', 'connector',
  'tools', 'list', 'read-only', 'docs', 'grading', 'deep', 'demo',
  'Command', 'K', 'Language', 'English',
]);

// ── проверки ──────────────────────────────────────────────────────────────
const findings = { parity: [], placeholders: [], braces: [], cyrEn: [], calquesRu: [], artifacts: [] };

const ruKeys = [...ru.keys()].sort();
const enKeys = [...en.keys()].sort();
for (const k of ruKeys) if (!en.has(k)) findings.parity.push(`ключ есть в RU, нет в EN: ${k}`);
for (const k of enKeys) if (!ru.has(k)) findings.parity.push(`ключ есть в EN, нет в RU: ${k}`);

for (const [k, ruValue] of ru) {
  const enValue = en.get(k);
  if (enValue === undefined) continue;
  if (placeholders(ruValue).join(',') !== placeholders(enValue).join(','))
    findings.placeholders.push(
      `${k}: RU[${placeholders(ruValue).join(',')}] EN[${placeholders(enValue).join(',')}]`,
    );
  for (const [name, value] of [['ru', ruValue], ['en', enValue]]) {
    if (/\{|\}/.test(withoutPlaceholders(value)))
      findings.braces.push(`${name}:${k} — незакрытая/лишняя фигурная скобка: ${value.slice(0, 90)}`);
    if (/[^ ]  +[^ ]/.test(value))
      findings.artifacts.push(`${name}:${k} — двойной пробел: ${value.slice(0, 90)}`);
  }
}

for (const [k, value] of en) {
  if (k.startsWith('locale.')) continue; // осознанно двуязычные ключи (spec cabinet-i18n)
  if (/[А-Яа-яЁё]/.test(value)) findings.cyrEn.push(`${k} = ${value.slice(0, 90)}`);
}

for (const [k, value] of ru) {
  for (const w of latinWords(value)) {
    if (!ALLOWED_LATIN_RU.has(w)) findings.calquesRu.push(`${k}: слово «${w}» — ${value.slice(0, 80)}`);
  }
}

// ── отчёт ─────────────────────────────────────────────────────────────────
const total =
  findings.parity.length +
  findings.placeholders.length +
  findings.braces.length +
  findings.cyrEn.length +
  findings.calquesRu.length +
  findings.artifacts.length;

const list = (title, items, note) =>
  [
    `### ${title} — ${items.length === 0 ? '✅ ок' : `⚠️ ${items.length}`}`,
    note ? `${note}\n` : '',
    ...(items.length ? items.map((x) => `- ${x}`) : []),
  ]
    .filter(Boolean)
    .join('\n');

const report = `# TRANSLATION-AUDIT — аудит переводов RU↔EN (DIG-111 / DIG-123)

> Дата: ${new Date().toISOString().slice(0, 10)} · скрипт: \`node scripts/i18n-audit.mjs\`
> · рантайм-дубль правил: \`tests/i18n-audit.test.ts\`. Код выхода ${total ? '1' : '0'} =
> ${total ? 'есть расхождения' : 'словари консистентны'}.

## Сводка

| Проверка | Результат |
|---|---|
| Парность ключей RU↔EN | ${ru.size} ключей в каждом словаре, расхождений: ${findings.parity.length} |
| Паритет плейсхолдеров \`{name}\` | ${findings.placeholders.length} расхождений |
| Незакрытые/лишние фигурные скобки | ${findings.braces.length} |
| Кириллица в EN | ${findings.cyrEn.length} (кроме осознанно двуязычных \`locale.*\`) |
| Латинские кальки в RU | ${findings.calquesRu.length} (кроме разрешённой латыни) |
| Артефакты (двойные пробелы) | ${findings.artifacts.length} |

## Детали

${list('Парность ключей', findings.parity)}

${list('Паритет плейсхолдеров', findings.placeholders)}

${list('Незакрытые плейсхолдеры / фигурные скобки', findings.braces)}

${list('Кириллица в EN-значениях', findings.cyrEn, 'Исключение по спеке cabinet-i18n: ключи `locale.*` двуязычны намеренно — переключатель локали находят на обоих языках (`locale.switchAria` = «Interface language / Язык интерфейса», самоназвание кнопки «Русский»).')}

${list('Латинские слова-кальки в RU-значениях', findings.calquesRu, 'Правило DIG-111: «логин» (кириллицей) — ок, «login» (латиницей) — нет. Разрешённая латынь — ниже, в глоссарии исключений.')}

${list('Артефакты строк', findings.artifacts, 'Двойные пробелы внутри значения. Одиночные ведущие/хвостовые пробелы — легитимные склейки строк (« · суффикс», «из {amount}») и не считаются артефактом.')}

## Глоссарий терминов (канон RU → EN)

| RU | EN | Комментарий |
|---|---|---|
| заявка | request | вся навигация и статусы; «заявление» (документ-ходатайство) — application, слово statement в EN-словаре не используется |
| заявление | application | \`staff.type.STATEMENT\` = «Application», мастер: «Order a certificate or application» |
| справка | certificate | «Order a certificate», «Certificate ready»; выписка из зачётки — transcript |
| зачётка | gradebook | «Gradebook», «Gradebook number»; дисциплина в таблице — discipline |
| выписка | transcript | «Academic transcript» |
| деканат | deanery | «Digital Deanery», «Message the deanery»; без «dean's office» |
| обращение | appeal / message | очередь сотрудника — appeal, сообщение студента в деканат — message/ticket |
| МСП | SME | \`menu.msp\` = «SME», \`msp.title\` = «SME — the student startup catalog» (не «Startups») |
| ДПО | continuing education | \`title.dpo\` = \`menu.dpo\` = «Continuing education» (не «Extra education») |
| пересдача | retake | «The retake is today» |
| средний балл | GPA | «Overall GPA», «Group ranking» |
| семестр | semester | «Fall semester 2026/27» |
| пара | class | «No classes today» |
| почта (email) | email | RU-подписи — «Почта», «эл. почта»; слово «email» в RU-строках не используется (калька) |

## Глоссарий исключений: разрешённая латынь в RU

- **Акронимы и стандарты:** AI/ai (демо-теги), MCP, JSON, QR, PDF, XLSX, MD/md,
  ID/id (argon2id), IP, N, ECTS, GPA, MSK, SLA, URL, API, DIG (номера задач).
- **Имя протокола:** Model Context Protocol (Model, Context, Protocol).
- **Продукты/сервисы:** Apple Calendar, Google Calendar, ChatGPT, Claude,
  Claude Desktop, Cursor, Excel, GitHub, Linear, Markdown, Telegram, WhatsApp,
  Push, Speech (Web Speech API), Web.
- **Технические термины:** Bearer, Authorization, argon (argon2id), read-only,
  tools/list (метод MCP), deep-ссылка, demo-токен.
- **Путь настройки в самом клиенте Claude/ChatGPT** (английский UI внешнего
  приложения): Settings → Connectors → Add custom connector.
- **Горячая клавиша:** Command+K.
- **Двуязычная подпись переключателя локали** (spec cabinet-i18n): Language,
  English.

## Исправлено в рамках DIG-111/DIG-123

- RU-кальки: «Отправить на email» → «Отправить на почту»; «ФИО, email или
  телефон…» → «ФИО, эл. почта или телефон…»; «Email виден преподавателям» →
  «Эл. почта видна преподавателям»; канал «Email» → «Почта»;
  «visa-центров — со суммой» → «визовых центров — с суммой».
- EN-терминология: \`menu.msp\` «Startups» → «SME»; \`menu.dpo\` «Extra
  education» → «Continuing education»; «заявление» — везде application
  (убраны statement/request-смешения в \`requests.subtitle\`,
  \`empty.requestsDesc\`, \`finance.action.materialAid.desc\`).
- Артефакты: двойные пробелы в \`transcript.groupCourse\` и
  \`transcript.semesterLine\` (RU и EN, строки выписки PDF) → одиночные.
`;

writeFileSync(OUT_FILE, report, 'utf8');
console.log(
  `i18n-audit: parity=${findings.parity.length} placeholders=${findings.placeholders.length} ` +
    `braces=${findings.braces.length} cyrEn=${findings.cyrEn.length} ` +
    `calquesRu=${findings.calquesRu.length} artifacts=${findings.artifacts.length} ` +
    `→ ${resolve(ROOT, OUT_FILE).replace(`${ROOT}/`, '')}`,
);
process.exit(total ? 1 : 0);
