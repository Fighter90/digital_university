// DIG-59 (раунд 2, замечания ревью) — документация не расходится с кодом.
// Ревью сверило факты docs/* и README с реальным состоянием репозитория и
// вернуло расхождения: хэши паролей (argon2id, не bcrypt/NextAuth), пути
// слоёв (src/server/auth, src/server/data, (cabinet), globals.css), формат
// номера заявки (SR-… из request-number.ts, не ЗД-…), подписи UI в справке
// (кнопка «Нашли ошибку в данных?», категории каталога с «Помощь»,
// матрица уведомлений без «Системы», «Студенческий билет»).
// Тест закрепляет эти факты, чтобы документация не разошлась с кодом снова.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (repoPath: string): string => readFileSync(resolve(process.cwd(), repoPath), 'utf8');

describe('docs facts vs code (DIG-59, round 2)', () => {
  it('password hashing is argon2id — docs never claim bcrypt or NextAuth', () => {
    // Источник правды: собственная сессионная авторизация на argon2id.
    expect(read('src/server/auth/password.ts')).toContain('@node-rs/argon2');
    for (const doc of ['README.md', 'docs/help.md', 'docs/architecture.md']) {
      const text = read(doc);
      expect(text, `${doc}: «bcrypt» расходится с argon2id в src/server/auth`).not.toMatch(
        /bcrypt/i,
      );
      expect(
        text,
        `${doc}: NextAuth не используется — сессии свои (src/server/auth)`,
      ).not.toContain('NextAuth');
      expect(text, `${doc}: нет упоминания argon2id`).toContain('argon2id');
    }
  });

  it('architecture.md references only the real layer paths', () => {
    const arch = read('docs/architecture.md');
    for (const wrong of [
      'src/lib/auth.ts',
      'src/lib/db.ts',
      'src/styles/tokens.css',
      'src/app/(app)/',
    ]) {
      expect(arch, `architecture.md: несуществующий путь ${wrong}`).not.toContain(wrong);
    }
    for (const right of [
      'src/app/(auth)/login',
      'src/app/(cabinet)/',
      'src/server/actions/',
      'src/server/auth/',
      'src/server/data/',
      'src/app/globals.css',
    ]) {
      expect(arch, `architecture.md: нет реального пути ${right}`).toContain(right);
    }
  });

  it('request numbers are SR-… from request-number.ts, not sequential ЗД-…', () => {
    const code = read('src/server/data/request-number.ts');
    expect(code).toContain('SR-');
    const arch = read('docs/architecture.md');
    expect(arch, 'architecture.md: ссылка на источник формата номера').toContain(
      'src/server/data/request-number.ts',
    );
    expect(arch, 'architecture.md не приписывает приложению формат ЗД-…').not.toContain(
      'ЗД-<год>-<6 цифр>',
    );
    expect(read('docs/help.md'), 'help.md показывает видимый номер SR-…').toContain('SR-2026');
  });

  it('help.md uses the real UI wording (catalog categories, profile, notifications)', () => {
    const help = read('docs/help.md');
    // Категории каталога услуг — CATEGORY_LABELS из services-catalog.ts.
    expect(help, 'в перечне категорий каталога есть «Помощь»').toContain('Общежитие, Помощь');
    // Профиль: маска на студенческом билете (UI: «Студенческий билет»),
    // «Учебный год» (profile page).
    expect(help, 'упомянуто поле студенческого билета').toMatch(
      /студенческого билета|студенческий билет/i,
    );
    expect(help, 'нет устаревшей подписи «Сообщить об ошибке в данных»').not.toContain(
      'Сообщить об ошибке в данных',
    );
    expect(help, 'кнопка в профиле — «Нашли ошибку в данных?»').toContain('Нашли ошибку в данных?');
    // Матрица уведомлений: SYSTEM не входит в настраиваемые строки.
    expect(help, 'в матрице уведомлений нет строки «Система»').not.toMatch(/Дедлайны,\s*Система/);
  });

  it('assistant.md documents handoff params and the demo-only MCP catalog', () => {
    const assistant = read('docs/assistant.md');
    expect(assistant).toContain('?q=');
    expect(assistant).toContain('?intent=exam-prep');
    expect(assistant).toContain('unidemo://');
    expect(assistant).toContain('demo-ph-mcp-4f8k-2026');
    expect(assistant).toContain('DIG-46');
  });
});
