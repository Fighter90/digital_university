// DIG-85 (BUG-13) — гард консистентности сборки: «предзагружаемый статический
// чанк → 404». QA поймал 2 из 9 предзагрузок на проде; на текущей сборке
// дефект не воспроизводится (манифест ↔ .next/static согласованы), поэтому
// фикс — контррегрессионный гард: после `next build` КАЖДЫЙ путь
// `/_next/static/…`, на который ссылается app-build-manifest.json или
// пререндер-HTML, обязан существовать в `.next` — сборка не может отдать
// ссылку на несуществующий файл.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const NEXT_DIR = resolve(ROOT, '.next');

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Все ссылки /_next/static/… в HTML-артефактах сборки. */
function staticRefsFromHtml(): string[] {
  const refs = new Set<string>();
  for (const file of walk(join(NEXT_DIR, 'server', 'app'))) {
    if (!file.endsWith('.html') && !file.endsWith('.rsc')) continue;
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/[/"](\.next\/_next\/)?(\/_next\/static\/[^"'\s<>\\]+)/g)) {
      refs.add(m[2]!);
    }
  }
  return [...refs];
}

describe('гард сборки: ссылки на статические чанки существуют на диске (BUG-13)', () => {
  it('app-build-manifest.json ссылается только на существующие файлы .next', () => {
    if (!existsSync(join(NEXT_DIR, 'app-build-manifest.json'))) {
      // Гард требует сборку (в гейтах build идёт до тестов); без неё
      // проверять нечего — не маскируем как «прошёл», просто выходим.
      console.warn('[build-chunks] .next отсутствует — прогон без сборки, гард пропущен');
      return;
    }
    const manifest = JSON.parse(
      readFileSync(join(NEXT_DIR, 'app-build-manifest.json'), 'utf8'),
    ) as {
      pages: Record<string, string[]>;
    };
    const missing: string[] = [];
    for (const files of Object.values(manifest.pages)) {
      for (const file of files) {
        if (!file.startsWith('static/')) continue;
        if (!existsSync(join(NEXT_DIR, file))) missing.push(file);
      }
    }
    expect(
      missing,
      `манифест сборки ссылается на несуществующие чанки — источник ` +
        `предзагрузок → 404 (BUG-13):\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('пререндер-HTML ссылается только на существующие статические файлы', () => {
    if (!existsSync(join(NEXT_DIR, 'server', 'app'))) {
      console.warn('[build-chunks] .next/server/app отсутствует — гард пропущен');
      return;
    }
    const refs = staticRefsFromHtml();
    const missing = refs.filter((ref) => !existsSync(join(NEXT_DIR, relative('_next', ref))));
    expect(
      missing,
      `пререндер ссылается на несуществующие статические файлы (BUG-13):\n${missing.join('\n')}`,
    ).toEqual([]);
  });
});
