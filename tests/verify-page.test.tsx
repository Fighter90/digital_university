// DIG-47 — контракт публичной страницы проверки справки (SSR-разметка).
// Приёмка: три статуса документа, маскированное ФИО, никаких лишних
// данных, подсказка «Как проверить документ», плашка «Концепт для
// конкурса». Красная фаза: контракт зафиксирован ДО реализации.
import { describe, expect, it } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import { VerifyResultView } from '@/components/verify/verify-result';

async function renderView(props: Record<string, unknown>): Promise<string> {
  const View = VerifyResultView as unknown as ComponentType<Record<string, unknown>>;
  const { prelude } = await prerenderToNodeStream(createElement(View, props));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

const ISSUED_AT = new Date(2026, 10, 1, 12, 0, 0);

describe('verify-result: статус «Документ действителен»', () => {
  const html = () =>
    renderView({
      state: 'VALID',
      documentType: 'Справка об обучении',
      issuedAt: ISSUED_AT,
      holderName: 'Ковалёва А.',
    });

  it('зелёный статус и поля документа', async () => {
    const out = await html();
    expect(out).toContain('Документ действителен');
    expect(out).toContain('Справка об обучении');
    expect(out).toContain('Ковалёва А.');
    expect(out).toContain('1 ноября 2026');
    expect(out).toContain('data-testid="verify-status"');
    expect(out).toContain('data-testid="verify-type"');
    expect(out).toContain('data-testid="verify-holder"');
  });

  it('зелёная палитра статуса', async () => {
    const out = await html();
    expect(out).toMatch(/green-\d+/);
  });

  it('подсказка «Как проверить документ» (плашка концепта — в корневом layout, e2e)', async () => {
    const out = await html();
    expect(out).toContain('Как проверить документ');
  });

  it('полное имя никогда не рендерится (маска приходит из слоя данных)', async () => {
    const out = await html();
    expect(out).not.toContain('Анна');
  });
});

describe('verify-result: статус «Отозван»', () => {
  it('красный статус, поля документа остаются видимыми', async () => {
    const out = await renderView({
      state: 'REVOKED',
      documentType: 'Справка об обучении',
      issuedAt: ISSUED_AT,
      holderName: 'Смирнов И.',
    });
    expect(out).toContain('Отозван');
    expect(out).toMatch(/red-\d+/);
    expect(out).toContain('Справка об обучении');
    expect(out).toContain('Смирнов И.');
    expect(out).toContain('Документ был выдан, но отозван деканатом');
  });
});

describe('verify-result: статус «Документ не найден»', () => {
  it('нейтральный статус без каких-либо полей документа', async () => {
    const out = await renderView({
      state: 'NOT_FOUND',
      code: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ',
    });
    expect(out).toContain('Документ не найден');
    expect(out).not.toContain('data-testid="verify-type"');
    expect(out).not.toContain('data-testid="verify-holder"');
    expect(out).not.toContain('Справка');
  });

  it('невалидный код не отличается от отсутствующего', async () => {
    const a = await renderView({ state: 'NOT_FOUND', code: 'hello' });
    const b = await renderView({
      state: 'NOT_FOUND',
      code: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ',
    });
    expect(a).toBe(b);
  });
});

describe('verify-result: превышен лимит попыток', () => {
  it('нейтральное сообщение без статуса документа', async () => {
    const out = await renderView({ state: 'RATE_LIMITED' });
    expect(out).toContain('Слишком много попыток');
    expect(out).not.toContain('data-testid="verify-type"');
    // Не раскрывает, существует ли документ.
    expect(out).not.toContain('Справка об обучении');
  });
});
