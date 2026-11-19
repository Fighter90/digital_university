// Вспомогательный сканер DIG-89: находит видимую кириллицу (строковые
// литералы и JSX-текст) в исходниках, игнорируя комментарии. Только анализ,
// в гейтах не участвует.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CYR = /[А-Яа-яЁё]/;

function stripComments(src) {
  // Построчно: срезаем // до конца строки (но не внутри строк) — упрощённо:
  // сначала вырезаем блочные комментарии и /* */, затем line-комментарии,
  // содержимое строковых литералов не трогаем (в исходниках проекта в строках
  // "//" почти не встречается, а ложные срабатывания допустимы — ручная проверка).
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // line comments: строка, содержащая //, где перед // не начало строки-литерала —
  // упрощение: вырезаем // только если перед ним пробел или начало строки,
  // либо вся строка начинается с //
  out = out
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//')) return '';
      // убрать хвостовой комментарий после кода (частый случай: `code() // хвост`)
      const idx = line.search(/\/\/(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      if (idx > 0 && /\s/.test(line[idx - 1])) {
        const before = line.slice(0, idx);
        if (!before.includes('http://') && !before.includes('https://')) return before;
      }
      return line;
    })
    .join('\n');
  return out;
}

const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx" "prisma/seed.ts"', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const report = {};
for (const file of files) {
  if (file.startsWith('src/lib/i18n/')) continue;
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const code = stripComments(src);
  const lines = code.split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (CYR.test(line)) hits.push(`${i + 1}: ${line.trim().slice(0, 160)}`);
  });
  if (hits.length) report[file] = hits;
}

const arg = process.argv[2];
for (const [file, hits] of Object.entries(report)) {
  if (arg && !file.includes(arg)) continue;
  console.log(`\n== ${file} (${hits.length}) ==`);
  for (const h of hits) console.log('  ' + h);
}
