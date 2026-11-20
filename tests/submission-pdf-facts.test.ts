// DIG-122 (раунд 2, замечания ревью) — PDF «Описание процесса создания»:
// каждое «проверяемое» утверждение должно быть реально проверяемым.
// Ревью споткнулось о три факта:
//   1) salvage-коммиты ecfe95e/39253ac не видны в `git log` — это висячие
//      объекты после reflog-restore; документ обязан давать команду проверки;
//   2) в каталоге docs/ai-log 81 запись, а в PDF заявлено «77 циклов» —
//      формула подсчёта должна быть написана в самом документе;
//   3) заявление «11 стр.» должно совпадать с реальным числом страниц PDF
//      (mdls/Spotlight врут — проверять по объектам /Type /Page).
// Тест прибивает эти факты, чтобы PDF и описания не разошлись с репозиторием.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const read = (repoPath: string): string => readFileSync(resolve(process.cwd(), repoPath), 'utf8');

// Файлы циклов = *.md в docs/ai-log без служебных (шаблон, README, описатель ассетов).
const NON_CYCLE_MD = new Set(['_TEMPLATE.md', 'README.md', 'assets.md']);

describe('submission PDF facts vs repo (DIG-122, round 2)', () => {
  it('salvage commits exist as git objects AND the PDF explains how to verify them', () => {
    // Источник правды: сами объекты git — коммит с этим хэшем существует.
    for (const hash of ['ecfe95e', '39253ac']) {
      const type = execFileSync('git', ['cat-file', '-t', hash], {
        encoding: 'utf8',
      }).trim();
      expect(type, `объект git ${hash} существует и является коммитом`).toBe('commit');
    }
    const html = read('docs/submission/process.html');
    expect(html, 'PDF упоминает оба salvage-коммита').toContain('ecfe95e');
    expect(html, 'PDF упоминает оба salvage-коммита').toContain('39253ac');
    // Ревью: в git log их нет (висячие) — документ обязан это квалифицировать
    // и дать команду проверки, иначе жюри сочтёт цифру непроверяемой.
    expect(html, 'квалификация «висячие» рядом с salvage-коммитами').toContain('висяч');
    expect(html, 'команда проверки salvage-коммита').toContain('git cat-file -p ecfe95e');
  });

  it('ai-log cycle count in the PDF matches the actual directory (formula stated)', () => {
    const entries = readdirSync(resolve(process.cwd(), 'docs/ai-log'));
    const cycles = entries.filter((f) => f.endsWith('.md') && !NON_CYCLE_MD.has(f)).length;
    const html = read('docs/submission/process.html');
    // Формула подсчёта в блоке «Где проверить»: «<всего> записей = <N> файлов циклов + …».
    expect(html, 'указано общее число записей каталога').toContain(`${entries.length} запис`);
    expect(html, 'формула: файлов циклов ровно столько, сколько в каталоге').toContain(
      `= ${cycles} файлов циклов`,
    );
    // Статистика на странице «Цифры проекта» называет реальное число.
    expect(html, `статистика «файлов циклов» = ${cycles}`).toContain(
      `<div class="n">${cycles}</div><div class="l">файлов циклов в журнале docs/ai-log`,
    );
  });

  it('claimed page count (11) equals the real number of pages in the built PDF', () => {
    const pdf = readFileSync(
      resolve(process.cwd(), 'docs/submission/digital-deanery-process.pdf'),
      'latin1',
    );
    const pages = [...pdf.matchAll(/\/Type\s*\/Page[^s]/g)].length;
    expect(pages, 'реальное число страниц PDF').toBe(11);
    expect(read('docs/submission/COMMENT.md'), 'COMMENT.md заявляет 11 стр.').toContain('11 стр.');
    expect(read('docs/SUBMISSION.md'), 'SUBMISSION.md заявляет 11 стр.').toMatch(/11\s*стр/);
  });
});
