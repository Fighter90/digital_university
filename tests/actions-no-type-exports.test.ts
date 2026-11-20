// DIG-108 (регресс) — контракт «use server»-модулей: в файлах server actions
// запрещены `export type`-реэкспорты.
//
// Почему: Turbopack в `next dev` исполняет `export type { T };` как runtime-
// обращение к идентификатору в 'use server'-модуле и падает
// «ReferenceError: T is not defined» при загрузке bundles страниц, куда
// попадает action (DIG-108: /settings отвечал 500 в dev). Прод-сборка типы
// стирает, поэтому дефект всплывал только в dev — сама площадка этого не
// ловила. Контракт фиксируем статическим тестом: типы actions живут в
// серверных модулях данных/оркестраторов, а клиентские компоненты импортируют
// их напрямую из этих модулей (см. floating-assistant-popup.tsx).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTIONS_DIR = join(__dirname, '..', 'src', 'server', 'actions');

describe('«use server»-модули без export type-реэкспортов (dev/Turbopack падает на них)', () => {
  it('в src/server/actions/*.ts нет реэкспортов вида export type { T }', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(ACTIONS_DIR).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      if (!source.includes("'use server'")) continue;
      for (const [index, line] of source.split('\n').entries()) {
        // Опасна именно форма реэкспорта импортированного типа `export type { T };`
        // (Turbopack исполняет её в runtime → ReferenceError). Объявления-алиасы
        // `export type X = …` в dev работают и в контракт не входят.
        if (/^export\s+type\s*\{/.test(line.trim())) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders, `найдены export type-реэкспорты в 'use server'-файлах:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});
