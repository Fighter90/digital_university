// DIG-111/DIG-123 — рантайм-аудит словарей RU/EN: парность ключей,
// паритет плейсхолдеров, кириллица в EN, латинские кальки в RU,
// двойные пробелы и незакрытые плейсхолдеры. Полный отчёт с глоссарием
// и списком исключений строит scripts/i18n-audit.mjs → TRANSLATION-AUDIT.md.
import { describe, expect, it } from 'vitest';

import { en } from '@/lib/i18n/en';
import { ru } from '@/lib/i18n/ru';

type Dict = Record<string, string>;

const asDict = (d: object): Dict => Object.fromEntries(Object.getOwnPropertyNames(d).map((k) => [k, (d as Dict)[k]]));

const RU_DICT = asDict(ru);
const EN_DICT = asDict(en);

/** Имена переменных интерполяции {name} в строке. */
const placeholders = (value: string): string[] => (value.match(/\{[A-Za-z0-9._]+\}/g) ?? []).sort();

/** Строка без плейсхолдеров (имена переменных — код, не текст). */
const withoutPlaceholders = (value: string): string => value.replace(/\{[A-Za-z0-9._]+\}/g, ' ');

/** Латинские слова (дефис внутри слова сохраняется: read-only). */
const latinWords = (value: string): string[] =>
  (withoutPlaceholders(value).match(/[A-Za-z][A-Za-z-]*/g) ?? []).map((w) => w.replace(/-+$/, ''));

/**
 * Разрешённая латынь в RU-словаре (DIG-111, глоссарий исключений —
 * полный список с категориями в TRANSLATION-AUDIT.md):
 *  - акронимы и стандарты: AI/ai (демо-теги), MCP, JSON, QR, PDF, XLSX,
 *    MD/md, ID/id (argon2id), IP, N, ECTS, GPA, MSK, SLA, URL, API,
 *    DIG (номера задач);
 *  - имя протокола: Model Context Protocol (Model, Context, Protocol);
 *  - имена продуктов/протоколов: Apple, Calendar, ChatGPT, Claude, Cursor,
 *    Desktop, Excel, GitHub, Google, Linear, Markdown, Telegram, WhatsApp,
 *    Push, Speech, Web, Bearer, Authorization, argon (argon2id);
 *  - путь настройки в САМОМ клиенте Claude/ChatGPT (английский UI внешнего
 *    приложения): Settings, Connectors, Add, custom, connector;
 *  - имена методов/файлов/токенов: tools, list, read-only, docs, grading,
 *    deep (deep-ссылка), demo (demo-токен);
 *  - горячая клавиша: Command, K;
 *  - осознанно двуязычная подпись переключателя локали (spec cabinet-i18n):
 *    Language, English.
 */
const ALLOWED_LATIN_RU = new Set([
  'AI',
  'ai',
  'MCP',
  'JSON',
  'QR',
  'PDF',
  'XLSX',
  'MD',
  'md',
  'ID',
  'id',
  'IP',
  'N',
  'ECTS',
  'GPA',
  'MSK',
  'SLA',
  'URL',
  'API',
  'DIG',
  'Model',
  'Context',
  'Protocol',
  'Apple',
  'Calendar',
  'ChatGPT',
  'Claude',
  'Cursor',
  'Desktop',
  'Excel',
  'GitHub',
  'Google',
  'Linear',
  'Markdown',
  'Telegram',
  'WhatsApp',
  'Push',
  'Speech',
  'Web',
  'Bearer',
  'Authorization',
  'argon',
  'Settings',
  'Connectors',
  'Add',
  'custom',
  'connector',
  'tools',
  'list',
  'read-only',
  'docs',
  'grading',
  'deep',
  'demo',
  'Command',
  'K',
  'Language',
  'English',
]);

describe('DIG-111 — парность словарей RU/EN', () => {
  it('наборы ключей совпадают 1:1 (рантайм, собственные свойства)', () => {
    const ruKeys = Object.getOwnPropertyNames(RU_DICT).sort();
    const enKeys = Object.getOwnPropertyNames(EN_DICT).sort();
    expect(enKeys).toEqual(ruKeys);
  });

  it('плейсхолдеры {name} одинаковы в обеих локалях', () => {
    const diffs: string[] = [];
    for (const [key, ruValue] of Object.entries(RU_DICT)) {
      const ruPh = placeholders(ruValue).join(',');
      const enPh = placeholders(EN_DICT[key] ?? '').join(',');
      if (ruPh !== enPh) diffs.push(`${key}: RU[${ruPh}] EN[${enPh}]`);
    }
    expect(diffs).toEqual([]);
  });

  it('незакрытых и лишних фигурных скобок нет в обеих локалях', () => {
    const broken: string[] = [];
    for (const [name, dict] of [['ru', RU_DICT], ['en', EN_DICT]] as const) {
      for (const [key, value] of Object.entries(dict)) {
        const leftover = withoutPlaceholders(value).replace(/[{}]/g, '');
        if (leftover !== withoutPlaceholders(value) || /\{|\}/.test(withoutPlaceholders(value))) {
          broken.push(`${name}:${key} = ${value.slice(0, 80)}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('DIG-111 — кириллица и кальки', () => {
  it('значения EN без кириллицы, кроме осознанно двуязычных ключей locale.*', () => {
    const cyr = /[А-Яа-яЁё]/;
    const hits: string[] = [];
    for (const [key, value] of Object.entries(EN_DICT)) {
      // spec cabinet-i18n «RU — канон без изменений»: ключи locale.*
      // двуязычны намеренно (переключатель локали находят на обоих языках).
      if (key.startsWith('locale.')) continue;
      if (cyr.test(value)) hits.push(`${key} = ${value.slice(0, 80)}`);
    }
    expect(hits).toEqual([]);
  });

  it('значения RU без латинских слов-калек (только разрешённая латынь)', () => {
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(RU_DICT)) {
      for (const word of latinWords(value)) {
        if (!ALLOWED_LATIN_RU.has(word)) offenders.push(`${key}: ${word} — ${value.slice(0, 70)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('DIG-123 — артефакты строк', () => {
  it('двойных пробелов внутри значений нет (обе локали)', () => {
    const hits: string[] = [];
    for (const [name, dict] of [['ru', RU_DICT], ['en', EN_DICT]] as const) {
      for (const [key, value] of Object.entries(dict)) {
        if (/[^ ]  +[^ ]/.test(value)) hits.push(`${name}:${key} = ${value.slice(0, 90)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('терминология МСП: EN — «SME» и в меню, и в заголовке раздела', () => {
    expect(EN_DICT['menu.msp']).toBe('SME');
    expect(EN_DICT['msp.title']).toContain('SME');
  });

  it('терминология ДПО: EN меню и заголовок — «Continuing education»', () => {
    expect(EN_DICT['menu.dpo']).toBe('Continuing education');
    expect(EN_DICT['title.dpo']).toBe('Continuing education');
  });

  it('терминология «заявление»: EN — application, слово statement не используется', () => {
    expect(EN_DICT['requests.subtitle']).not.toMatch(/statement/i);
    expect(EN_DICT['empty.requestsDesc']).not.toMatch(/statement/i);
    expect(EN_DICT['staff.type.STATEMENT']).toBe('Application');
    for (const [key, value] of Object.entries(EN_DICT)) {
      expect(value, key).not.toMatch(/statement/i);
    }
  });
});
