#!/usr/bin/env node
// Сборка PDF «Описание процесса создания» из process.html (DIG-122).
// Запуск из корня репозитория: node docs/submission/build-pdf.mjs
// Требует Chromium для Playwright (уже стоит для e2e). Шрифты Inter — docs/submission/fonts/.
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const require = createRequire(import.meta.url);

async function main() {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.goto('file://' + resolve(here, 'process.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  mkdirSync(repoRoot + '/docs/submission', { recursive: true });
  const out = resolve(here, 'digital-deanery-process.pdf');
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  console.log('OK:', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
