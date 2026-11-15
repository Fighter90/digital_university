// DIG-59 — страница AI-ассистента ведёт на подробную справку (docs/assistant.md).
import { describe, expect, it } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import { ASSISTANT_DOC_URL, DOCS_BASE_URL } from '@/lib/docs-links';
import AiAssistantPage from '@/app/(cabinet)/ai-assistant/page';

async function renderPage(): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(AiAssistantPage as unknown as ComponentType),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

describe('/ai-assistant — справка ассистента (DIG-59)', () => {
  it('renders the placeholder title and a link to docs/assistant.md', async () => {
    const html = await renderPage();
    expect(html).toContain('AI-ассистент');
    expect(html).toContain(`href="${ASSISTANT_DOC_URL}"`);
    expect(html).toContain(DOCS_BASE_URL);
    // Ссылка внешняя: открывается в новой вкладке, кабинет остаётся открытым.
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
  });
});
