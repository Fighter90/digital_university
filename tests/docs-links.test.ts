// DIG-59 — контракт перекрёстных ссылок кабинета на документацию репозитория.
// Один источник ссылок — src/lib/docs-links.ts; каждый путь обязан указывать
// на реально существующий файл (docs не расходятся с кодом), README ведёт на
// справку студента и ассистента.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ASSISTANT_DOC_URL, DOCS_BASE_URL, DOCS_LINKS, type DocLink } from '@/lib/docs-links';

const readRepoFile = (repoPath: string): string =>
  readFileSync(resolve(process.cwd(), repoPath), 'utf8');

describe('docs-links (DIG-59)', () => {
  it('covers the three wiki documents: help, assistant, architecture', () => {
    expect(DOCS_LINKS.map((link) => link.id)).toEqual(['help', 'assistant', 'architecture']);
    expect(DOCS_LINKS.map((link) => link.repoPath)).toEqual([
      'docs/help.md',
      'docs/assistant.md',
      'docs/architecture.md',
    ]);
  });

  it('builds absolute public GitHub URLs on the default branch', () => {
    expect(DOCS_BASE_URL).toBe('https://github.com/Fighter90/digital_university/blob/main');
    for (const link of DOCS_LINKS) {
      expect(link.href).toBe(`${DOCS_BASE_URL}/${link.repoPath}`);
    }
    expect(ASSISTANT_DOC_URL).toBe(`${DOCS_BASE_URL}/docs/assistant.md`);
  });

  it.each(DOCS_LINKS as readonly DocLink[])(
    '$repoPath exists on disk and keeps the concept banner',
    (link) => {
      expect(existsSync(resolve(process.cwd(), link.repoPath)), `${link.repoPath} missing`).toBe(
        true,
      );
      const text = readRepoFile(link.repoPath);
      expect(text, `${link.repoPath} без плашки «Концепт для конкурса»`).toContain(
        'Концепт для конкурса',
      );
    },
  );

  it('help.md explains the core student scenarios', () => {
    const help = readRepoFile('docs/help.md');
    for (const topic of [
      'Вход',
      'Расписание',
      'Оценки',
      'Заявки',
      'Уведомления',
      'справк', // справка / справки (с QR)
      '/verify/',
      'Подана',
      'Требует правок',
    ]) {
      expect(help, `help.md: нет раздела про «${topic}»`).toContain(topic);
    }
  });

  it('assistant.md documents capabilities, limits and the MCP catalog', () => {
    const assistant = readRepoFile('docs/assistant.md');
    for (const topic of [
      'Product Hunt',
      'Календарь',
      'Деканат-API',
      'demo-', // демонстрационные токены
      '?q=', // хэндофф из поиска/FAQ
      'Ограничения',
    ]) {
      expect(assistant, `assistant.md: нет раздела про «${topic}»`).toContain(topic);
    }
  });

  it('README links the wiki and the screenshots', () => {
    const readme = readRepoFile('README.md');
    for (const needle of [
      'docs/help.md',
      'docs/assistant.md',
      'docs/architecture.md',
      'docs/security.md',
      'design/screenshots/design-full-desktop-1440.png',
      'design/screenshots/design-full-mobile-360.png',
    ]) {
      expect(readme, `README: нет ссылки на ${needle}`).toContain(needle);
    }
    // Плашка конкурса сохранена в начале README.
    expect(readme).toContain('Концепт для конкурса');
  });
});
