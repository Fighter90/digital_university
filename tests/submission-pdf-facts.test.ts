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
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

// ─── Раунд 3 (замечания ревью): титул PDF обещает «все цитаты дословные» и
// «проверяемые цифры» — проверяем и это. Цитаты сверяются с их источниками в
// репо; цифры задач/PR меняются каждый день, поэтому прибивается дата среза
// и согласованность формулировок внутри документа, а не конкретное число.

describe('submission PDF quotes vs sources (DIG-122, round 3)', () => {
  const html = read('docs/submission/process.html');
  // Текстовая версия HTML: без тегов и с обычными пробелами — так цитаты
  // сравниваются с их источниками независимо от вёрстки панели.
  const textOf = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const text = textOf(html);

  it('DIG-76 prompt header is quoted in full (title from Linear task)', () => {
    // Полное название задачи из Linear: «…хотя /events работает — подключить
    // реальные данные». Обрыв заголовка без «…» выдавал выдержку за цитату.
    expect(html, 'заголовок задачи DIG-76 доведён до конца названия').toContain(
      'хотя /events работает — подключить реальные данные',
    );
  });

  it('reviewer checklist quotes match .opencode/agent/reviewer.md verbatim', () => {
    const reviewer = read('.opencode/agent/reviewer.md');
    const mustQuote = [
      'неверные ключи',
      'Тесты осмысленные, не тавтология',
      'и содержание не приписывают диффу того, чего в нём нет',
    ];
    for (const quote of mustQuote) {
      expect(reviewer.includes(quote), `источник reviewer.md содержит «${quote}»`).toBe(true);
      expect(html, `PDF цитирует reviewer.md дословно: «${quote}»`).toContain(quote);
    }
  });

  it('security checklist quotes match .opencode/agent/security.md verbatim', () => {
    const security = read('.opencode/agent/security.md');
    const mustQuote = ['Чужую заявку/профиль', 'защита от перебора', 'с пользовательским вводом'];
    for (const quote of mustQuote) {
      expect(security.includes(quote), `источник security.md содержит «${quote}»`).toBe(true);
      expect(html, `PDF цитирует security.md дословно: «${quote}»`).toContain(quote);
    }
  });

  it('Higgsfield hero prompt is quoted in full (tail present in assets.md)', () => {
    // В assets.md промпт оформлен markdown-цитатой («> » + переносы) —
    // склеиваем строки цитаты и сворачиваем пробелы для сравнения.
    const flatten = (s: string) => s.replace(/\n>\s?/g, ' ').replace(/\s+/g, ' ');
    const assets = flatten(read('docs/ai-log/assets.md'));
    const htmlFlat = flatten(html);
    const tail = 'no text, no letters, no watermark, clean minimal education app style.';
    expect(assets.includes(tail), 'assets.md содержит концовку hero-промпта').toBe(true);
    expect(htmlFlat, 'PDF цитирует hero-промпт до конца (дословно)').toContain(tail);
  });

  it('git log quotes in section 5.3 are verbatim or honestly ellipsized', () => {
    // f010348: полный subject из реального git log обязан быть в панели.
    const subject = execFileSync('git', ['log', '--format=%s', '-1', 'f010348'], {
      encoding: 'utf8',
    }).trim();
    expect(subject).toContain('(статьи/предметы)');
    expect(html, 'subject f010348 цитируется дословно').toContain(subject);
    // c2a331a: subject длинный — обрыв допустим, но только с честным «…».
    const c2 = execFileSync('git', ['log', '--format=%s', '-1', 'c2a331a'], {
      encoding: 'utf8',
    }).trim();
    const head = c2.slice(0, c2.indexOf('— ссылка над шапкой'));
    expect(html, 'начало subject c2a331a дословно').toContain(head);
    expect(html, 'обрыв subject c2a331a помечен «…», а не молчаливым сокращением').toContain(
      'футере… (#81)',
    );
  });

  it('Linear/PR counters carry an explicit as-of date and are consistent in-document', () => {
    // Цифры задач/PR живут (оркестратор закрывает задачи ежедневно), поэтому
    // в PDF обязана стоять дата среза «на 20.11» рядом с каждой цифрой, а
    // формулировки в таблице инструментов и на странице цифр — совпадать.
    expect(html, 'дата среза счётчиков указана').toContain('на 20.11');
    expect(html, 'страница цифр: закрыто задач — то же число, что в таблице').toMatch(
      /<div class="n">104<\/div><div class="l">задач закрыто/,
    );
    expect(html, 'таблица инструментов согласована со страницей цифр (закрыто)').toContain(
      '104 закрыто',
    );
    expect(html, 'таблица инструментов согласована со страницей цифр (PR)').toMatch(
      /<div class="n">86<\/div><div class="l">PR слито/,
    );
    expect(html, 'счётчик PR с датой среза в таблице инструментов').toContain('86 слито на 20.11');
  });

  it('meta-verdict clerk quote in 3.4 matches orchestrator.mjs verbatim', () => {
    const orch = read('scripts/swarm/orchestrator.mjs');
    const quote =
      'называет ли анализ блокирующие дефекты (логика, безопасность, ' +
      'выход за рамки задачи, сломанные тесты) или это одобряющее ревью';
    expect(orch.includes(quote), 'источник orchestrator.mjs содержит цитату').toBe(true);
    expect(text, 'PDF цитирует VERDICT CLERK дословно (с полным перечислением)').toContain(quote);
  });

  it('OOM-kill panel (5.4) quotes dig-50 log verbatim, author notes are outside the panel', () => {
    const log = read('docs/ai-log/2026-11-11-dig-50.md');
    const mustQuote = [
      "убит OOM-kill'ем машины, работа спасена из дерева",
      '3 раунда: RETURN×2 → ACCEPT',
      'Студент не мог войти на прод: приложение жило на memory-сторе',
      'чужие заявки отдают 404',
    ];
    for (const quote of mustQuote) {
      expect(log.includes(quote), `журнал dig-50 содержит «${quote}»`).toBe(true);
      expect(text, `панель 5.4 цитирует журнал дословно: «${quote}»`).toContain(quote);
    }
    // Авторская сводка про reflog-rescue — вне панели, со ссылкой на источники.
    expect(text, 'урок reflog-rescue вынесен из дословной панели').toContain('Урок роя');
    expect(text, 'указан источник механики (swarm README)').toContain('scripts/swarm/README.md');
  });

  it('login-hero size in the caption equals the real file size (rounded KB)', () => {
    const kb = Math.round(
      statSync(resolve(process.cwd(), 'public/illustrations/login-hero.webp')).size / 1024,
    );
    expect(html, `подпись называет реальный размер файла (${kb} КБ)`).toMatch(
      new RegExp(`login-hero\\.webp — сгенерировано[^<]*${kb} КБ`),
    );
  });
});
