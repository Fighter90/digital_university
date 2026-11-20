// DIG-114/115 — сборка руководств пользователя и администратора (DOCX + PDF).
//
// Пайплайн (повторяет подход docs/submission/digital-deanery-process.pdf):
//   md → pandoc (gfm→html) → HTML-шаблон (Inter, A4, дизайн-токены проекта)
//   → inline base64-скриншоты → pandoc html→docx + playwright page.pdf()
//
// Запуск из корня репозитория:  node docs/guides/build-guides.mjs
// Требования: pandoc, playwright + chromium (npx playwright install chromium).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = resolve(ROOT, 'docs');
const OUT = resolve(DOCS, 'guides');
const TMP = resolve(OUT, '.build');

const DOCS_LIST = [
  {
    md: 'user-guide-ru.md',
    slug: 'user-guide-ru',
    lang: 'ru',
    shots: 'shots/ru',
    title: 'Цифровой деканат — Руководство пользователя',
    subtitle: 'Личный кабинет студента · все экраны, пошагово, со скриншотами',
    header: 'Руководство пользователя · Цифровой деканат',
    badge: 'Концепт для конкурса',
    docLang: 'RU',
  },
  {
    md: 'user-guide-en.md',
    slug: 'user-guide-en',
    lang: 'en',
    shots: 'shots/en',
    title: 'Digital Deanery — User Guide',
    subtitle: 'The student portal · every screen, step by step, with screenshots',
    header: 'User Guide · Digital Deanery',
    badge: 'A hackathon concept prototype',
    docLang: 'EN',
  },
  {
    md: 'admin-guide-ru.md',
    slug: 'admin-guide-ru',
    lang: 'ru',
    shots: null,
    title: 'Цифровой деканат — Руководство администратора',
    subtitle: 'Деплой, секреты, сид, бэкап, инциденты, MCP-токены',
    header: 'Руководство администратора · Цифровой деканат',
    badge: 'Концепт для конкурса',
    docLang: 'RU',
  },
  {
    md: 'admin-guide-en.md',
    slug: 'admin-guide-en',
    lang: 'en',
    shots: null,
    title: 'Digital Deanery — Administrator Guide',
    subtitle: 'Deployment, secrets, seed, backup, incidents, MCP tokens',
    header: 'Administrator Guide · Digital Deanery',
    badge: 'A hackathon concept prototype',
    docLang: 'EN',
  },
];

const TODAY = new Date().toISOString().slice(0, 10);

/** Размер PNG из IHDR (после 8-байтовой сигнатуры: длина(4)+«IHDR»(4)+width(4)+height(4)). */
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** md → html fragment через pandoc (gfm: таблицы и GitHub-якоря, как в md-TOC). */
function mdToHtmlFragment(mdPath) {
  return execFileSync('pandoc', ['-f', 'gfm', '-t', 'html5', mdPath], {
    cwd: DOCS,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Инлайн img src → base64 data-URI; width-атрибут для вменяемого размера в DOCX. */
function inlineImages(html, shotsDir) {
  return html.replace(/<img src="([^"]+)" alt="([^"]*)"(.*?)\/?>/g, (m, src, alt, rest) => {
    const abs = resolve(DOCS, src);
    const buf = readFileSync(abs);
    const b64 = buf.toString('base64');
    const ext = src.slice(src.lastIndexOf('.') + 1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const { width } = pngSize(buf);
    const wAttr = shotsDir ? Math.min(600, width) : Math.min(600, width);
    return `<img src="data:${mime};base64,${b64}" alt="${alt}" width="${wAttr}"${rest}>`;
  });
}

function pageShell(doc, bodyHtml) {
  return `<!doctype html>
<html lang="${doc.lang}">
<head>
<meta charset="utf-8">
<title>${doc.title}</title>
<style>
  /* Дизайн-токены проекта (openspec/specs/design-system) */
  :root {
    --bg: #F7F7F7; --card: #FFFFFF; --border: #EBEBEB;
    --text: #222222; --muted: #6A6A6A; --faint: #9A9A9A;
    --accent: #FF385C;
  }
  @page { size: A4; }
  * { box-sizing: border-box; }
  html { font-size: 10.5pt; }
  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: var(--text); margin: 0; line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  /* Титульная страница */
  .cover {
    height: 257mm; display: flex; flex-direction: column;
    justify-content: center; padding: 0 18mm; page-break-after: always;
  }
  .cover .badge {
    display: inline-block; width: fit-content; padding: 6px 14px;
    border: 1.5px solid var(--accent); color: var(--accent);
    border-radius: 999px; font-size: 9.5pt; font-weight: 600;
    letter-spacing: .02em; margin-bottom: 22mm;
  }
  .cover h1.doc-title {
    font-size: 26pt; line-height: 1.2; margin: 0 0 6mm; font-weight: 800;
  }
  .cover .doc-subtitle { color: var(--muted); font-size: 12.5pt; margin: 0 0 14mm; }
  .cover .cover-rule {
    width: 64px; height: 5px; border-radius: 3px; margin-bottom: 14mm;
    background: linear-gradient(90deg, #E61E4D, #E31C5F, #D70466);
  }
  .cover .cover-meta { color: var(--faint); font-size: 9.5pt; line-height: 1.7; }
  /* Заголовки */
  h1 {
    font-size: 19pt; font-weight: 800; margin: 0 0 6mm; line-height: 1.25;
    break-after: avoid;
  }
  h2 {
    font-size: 14.5pt; font-weight: 700; margin: 0 0 4mm;
    padding-bottom: 2mm; border-bottom: 2px solid var(--border);
    break-before: page; break-after: avoid;
  }
  .content > h2:first-of-type { break-before: auto; }
  h3 { font-size: 11.5pt; font-weight: 700; margin: 6mm 0 2.5mm; break-after: avoid; }
  p { margin: 0 0 3mm; }
  blockquote {
    margin: 0 0 5mm; padding: 3mm 5mm; background: var(--bg);
    border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0;
    color: var(--muted); font-size: 9.5pt;
  }
  blockquote p { margin: 0 0 2mm; } blockquote p:last-child { margin: 0; }
  ul, ol { margin: 0 0 3.5mm; padding-left: 7mm; }
  li { margin-bottom: 1.2mm; }
  strong { font-weight: 700; }
  code {
    font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 8.6pt;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 4px; padding: 0.4mm 1.4mm;
  }
  pre {
    background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 3.5mm 4mm; margin: 0 0 4mm; overflow-x: hidden;
    white-space: pre-wrap; word-break: break-all; break-inside: avoid;
  }
  pre code { background: none; border: none; padding: 0; font-size: 8.4pt; }
  /* Таблицы */
  table {
    width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 9pt;
    break-inside: avoid;
  }
  th {
    text-align: left; background: var(--bg); font-weight: 700;
    padding: 2mm 2.5mm; border: 1px solid var(--border);
  }
  td { padding: 2mm 2.5mm; border: 1px solid var(--border); vertical-align: top; }
  /* Скриншоты */
  figure, p:has(> img:only-child) { margin: 4mm 0 4.5mm; text-align: center; break-inside: avoid; }
  img {
    max-width: 100%; height: auto; border: 1px solid var(--border);
    border-radius: 8px;
  }
  em:only-child { color: var(--faint); font-size: 8.8pt; font-style: normal; display: block; margin-top: 1.5mm; }
  p > em:only-child { text-align: center; }
  hr { border: none; border-top: 1px solid var(--border); margin: 5mm 0; }
  a { color: inherit; text-decoration: none; }
</style>
</head>
<body>
  <div class="cover">
    <div class="badge">${doc.badge}</div>
    <h1 class="doc-title">${doc.title}</h1>
    <p class="doc-subtitle">${doc.subtitle}</p>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      https://ostrovok.store<br>
      Версия документа: ${TODAY} · Язык: ${doc.docLang}<br>
      Все данные стенда вымышленные. Прототип для конкурса «Цифровой деканат».
    </div>
  </div>
  <main class="content">
${bodyHtml}
  </main>
</body>
</html>`;
}

async function buildPdf(htmlPath, outPath, headerText) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '18mm', left: '16mm', right: '16mm' },
      displayHeaderFooter: true,
      headerTemplate: `<div style="width:100%; font-family:Inter,Arial,sans-serif; font-size:8px; color:#9A9A9A; padding:0 16mm; display:flex; justify-content:space-between;">
        <span>${headerText}</span><span>Концепт для конкурса</span></div>`,
      footerTemplate: `<div style="width:100%; font-family:Inter,Arial,sans-serif; font-size:8px; color:#9A9A9A; padding:0 16mm; display:flex; justify-content:space-between;">
        <span>https://ostrovok.store</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    await page.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const results = [];

  for (const doc of DOCS_LIST) {
    const mdPath = resolve(DOCS, doc.md);
    let fragment = mdToHtmlFragment(mdPath);
    fragment = inlineImages(fragment, doc.shots);
    const htmlPath = resolve(TMP, `${doc.slug}.html`);
    writeFileSync(htmlPath, pageShell(doc, fragment), 'utf8');

    const docxPath = resolve(OUT, `${doc.slug}.docx`);
    execFileSync('pandoc', ['-f', 'html', '-t', 'docx', htmlPath, '-o', docxPath], {
      cwd: DOCS,
      maxBuffer: 64 * 1024 * 1024,
    });

    const pdfPath = resolve(OUT, `${doc.slug}.pdf`);
    await buildPdf(htmlPath, pdfPath, doc.header);

    results.push({ slug: doc.slug, docx: docxPath, pdf: pdfPath });
    console.log(`built: ${doc.slug}.docx + ${doc.slug}.pdf`);
  }

  console.log('\nSummary:');
  for (const r of results) {
    for (const p of [r.docx, r.pdf]) {
      const size = readFileSync(p).length;
      console.log(`  ${p.replace(ROOT + '/', '')} — ${(size / 1024 / 1024).toFixed(2)} MB`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
