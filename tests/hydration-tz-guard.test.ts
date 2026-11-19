// DIG-85 (BUG-12) — гард остатка React #418 (гидрация, таймзона).
//
// Корень закрыт DIG-79 (TZ=Europe/Moscow на контейнере + MSK-явное
// форматирование, tests/msk-timezone.test.ts). Этот сканер не даёт корню
// вернуться: в клиентских компонентах ('use client') форматирование даты
// во время рендера обязано задавать явный timeZone. Intl.DateTimeFormat
// без timeZone и toLocaleTimeString/DateString/String берут ЗОНУ БРАУЗЕРА —
// сервер (MSK) и клиент (любая зона) дают разный текст → React #418.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const SRC_DIRS = ['src/components', 'src/app'];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(tsx|ts)$/.test(entry)) yield full;
  }
}

function isClientFile(source: string): boolean {
  // Директива может идти после комментария-шапки; ищем в первых 400 символах.
  return /(^|\n)\s*'use client';?/.test(source.slice(0, 400));
}

/** Нарушения в одном файле: [строка, описание]. */
function naiveDateFormatting(source: string): Array<[number, string]> {
  const violations: Array<[number, string]> = [];
  const lines = source.split('\n');

  // 1) Intl.DateTimeFormat без timeZone в опциях (опции без вложенных скобок
  //    — формат, используемый в кодовой базе; закрытая скобка вызова).
  const intl = /new Intl\.DateTimeFormat\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = intl.exec(source)) !== null) {
    if (!/timeZone\s*:/.test(m[1] ?? '')) {
      const line = source.slice(0, m.index).split('\n').length;
      violations.push([line, 'Intl.DateTimeFormat без timeZone']);
    }
  }

  // 2) Date.prototype.toLocale*String — всегда по зоне браузера.
  lines.forEach((line, i) => {
    if (/\.(toLocaleTimeString|toLocaleDateString|toLocaleString)\(/.test(line)) {
      violations.push([i + 1, 'Date.toLocale*String без явной зоны']);
    }
  });

  return violations;
}

describe('гард гидрации: клиентские компоненты форматируют время по Москве (BUG-12)', () => {
  it("в 'use client'-файлах нет Intl.DateTimeFormat без timeZone и toLocale*String", () => {
    const offenders: string[] = [];
    for (const dir of SRC_DIRS) {
      for (const file of walk(resolve(ROOT, dir))) {
        const source = readFileSync(file, 'utf8');
        if (!isClientFile(source)) continue;
        for (const [line, what] of naiveDateFormatting(source)) {
          offenders.push(`${relative(ROOT, file)}:${line} — ${what}`);
        }
      }
    }
    expect(
      offenders,
      `клиентские компоненты форматируют даты по зоне браузера — это корень ` +
        `React #418 (сервер MSK ≠ клиент):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
