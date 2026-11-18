// DIG-59 — перекрёстные ссылки из кабинета на документацию репозитория.
//
// Документация живёт в docs/ и версионируется вместе с кодом; репозиторий
// публичный, поэтому экраны кабинета ссылаются на GitHub (ветка main).
// Один модуль — один источник правды: карточка «Справка и документация»
// в настройках, справка MCP и страница AI-ассистента берут ссылки отсюда,
// а тест (tests/docs-links.test.ts) гарантирует, что файлы существуют.

/** База публичных ссылок на документацию (ветка main). */
export const DOCS_BASE_URL = 'https://github.com/Fighter90/digital_university/blob/main';

export type DocLinkId = 'help' | 'assistant' | 'architecture';

export interface DocLink {
  id: DocLinkId;
  /** Название в карточке «Справка и документация». */
  title: string;
  /** Однострочное описание — что читатель найдёт в документе. */
  description: string;
  /** Путь файла в репозитории (существование закреплено тестом). */
  repoPath: string;
  /** Абсолютная ссылка для <a href>. */
  href: string;
}

const docLink = (id: DocLinkId, title: string, description: string, repoPath: string): DocLink => ({
  id,
  title,
  description,
  repoPath,
  href: `${DOCS_BASE_URL}/${repoPath}`,
});

/** Каталог документации для карточки «Справка и документация» (порядок канонический). */
export const DOCS_LINKS: readonly DocLink[] = [
  docLink(
    'help',
    'Справка студента',
    'Вход, расписание, оценки, заявки, уведомления и справки с проверкой подлинности — как всё работает.',
    'docs/help.md',
  ),
  docLink(
    'assistant',
    'Цифровой ассистент',
    'Возможности, примеры запросов, ограничения и MCP-интеграции (Product Hunt и другие).',
    'docs/assistant.md',
  ),
  docLink(
    'architecture',
    'Архитектура',
    'Next.js 15, Prisma, слои данных и безопасность — как устроен прототип.',
    'docs/architecture.md',
  ),
];

/** Ссылка на справку ассистента — для страницы /ai-assistant и справки MCP. */
export const ASSISTANT_DOC_URL =
  DOCS_LINKS.find((link) => link.id === 'assistant')?.href ?? `${DOCS_BASE_URL}/docs/assistant.md`;
