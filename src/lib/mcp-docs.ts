// DIG-73 — контент страницы документации MCP (/mcp, аналог linear.app/docs/mcp).
//
// Чистый модуль без React и серверных импортов (как lib/help-content):
// единый источник правды для страницы и юнит-тестов. Всё содержимое
// ВЫМЫШЛЕННОЕ (конкурсный прототип, AGENTS.md); реальных ключей нет —
// в конфиг-сниппете подставляется плейсхолдер <ВАШ_ТОКЕН>, а сам токен
// владелец выпускает во вкладке «Настройка MCP» (/settings?tab=mcp).

import { DEANERY_MCP_TOOLS, MCP_ENDPOINT_PATH, MCP_SERVER_NAME } from '@/lib/mcp-protocol';
import type { Locale } from '@/lib/i18n';

/**
 * Плейсхолдер токена в конфиг-сниппете. Реальный токен НИКОГДА не
 * подставляется в разметку и в буфер обмена: plaintext хранится только
 * в памяти владельца (показывается один раз при выпуске в настройках).
 */
export const MCP_CONFIG_TOKEN_PLACEHOLDER = '<ВАШ_ТОКЕН>';

/** Путь до подробной инструкции в справке (/guide, раздел id «mcp»). */
export const MCP_GUIDE_ANCHOR = '/guide#mcp';

/** Ссылка на вкладку «Настройка MCP» (выпуск/перевыпуск токена). */
export const MCP_SETTINGS_HREF = '/settings?tab=mcp';

/**
 * Готовый JSON-конфиг MCP-клиента (Claude Desktop, Cursor и любой другой
 * клиент с транспортом mcp-remote). Детерминированный: URL подставляется
 * из заголовков запроса, токен — всегда плейсхолдер. Локаль выбирает
 * плейсхолдер (RU «<ВАШ_ТОКЕН>» — канон, EN «<YOUR_TOKEN>»).
 */
export function buildMcpConfigSnippet(url: string, locale: Locale = 'ru'): string {
  const placeholder = mcpConfigTokenPlaceholder(locale);
  return JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          command: 'npx',
          args: [
            '-y',
            'mcp-remote',
            url,
            '--header',
            `Authorization: Bearer ${placeholder}`,
          ],
        },
      },
    },
    null,
    2,
  );
}

// ── Секции страницы ─────────────────────────────────────────────────────────

/** «Что такое MCP» — абзацы. */
export const MCP_DOCS_WHAT_IS: readonly string[] = [
  'MCP (Model Context Protocol) — открытый протокол, по которому любой AI-ассистент (Claude, ChatGPT, Cursor) может securely читать ваши данные деканата: вы один раз выдаёте персональный токен — и спрашиваете ассистента обычными фразами.',
  `Сервер деканата живёт по адресу ${MCP_ENDPOINT_PATH} внутри кабинета и отдаёт только ваши данные: ассистент ходит на сервер с вашим токеном, а сервер проверяет владельца по хэшу токена при каждом вызове.`,
  'Это концепт для конкурса: все данные вымышленные, реальных систем вуза за сервером нет.',
];

/** «Безопасность» — абзацы. */
export const MCP_DOCS_SECURITY: readonly string[] = [
  'Токен персонален: это ключ доступа к вашим данным. Храните его как пароль и не пересылайте в чатах и на скриншотах.',
  'Токен можно отозвать в любой момент: «Перевыпустить» во вкладке «Настройка MCP» — прежний токен перестаёт работать сразу, в хранилище остаётся только SHA-256-хэш.',
  'Доступ read-only: ассистент читает расписание, оценки и уведомления, но не может ничего изменить в кабинете.',
  'Владелец видит только своё: каждый вызов инструмента скоуплен владельцем токена — чужие студенты и сотрудники через MCP недостижимы (IDOR исключён).',
];

/** Шаги подключения (по аналогии с linear.app/docs/mcp). */
export const MCP_DOCS_STEPS: readonly { title: string; text: string }[] = [
  {
    title: 'Выпустите персональный токен',
    text: 'Вкладка «Настройка MCP» → «Создать токен». Полный токен показывается один раз — скопируйте его сразу; в системе остаётся только хэш и маска вида demo-mcp…XXXX.',
  },
  {
    title: 'Скопируйте JSON-конфиг',
    text: 'Ниже готовый сниппет для Claude Desktop, Cursor и любого MCP-клиента: нажмите «Скопировать конфиг» и замените <ВАШ_ТОКЕН> на свой токен.',
  },
  {
    title: 'Спросите ассистента',
    text: 'Перезапустите клиент и задайте вопрос из примеров ниже — ассистент вызовет инструмент сервера и ответит вашими данными.',
  },
];

/** Примеры вопросов ассистенту (все отвечаются инструментами сервера). */
export const MCP_EXAMPLE_QUESTIONS: readonly string[] = [
  'Что у меня по расписанию сегодня?',
  'Какие у меня последние оценки?',
  'Есть ли непрочитанные уведомления?',
];

// ── DIG-88 — EN-версии текстов страницы /mcp ────────────────────────────────
// RU-константы — канон (страница и тесты); EN — параллельные тексты, выбор
// по локали cookie du-locale. Плейсхолдер токена тоже локализуется: в
// конфиг-сниппете на EN — <YOUR_TOKEN> (никаких реальных ключей в обоих).

/** EN-плейсхолдер токена в конфиг-сниппете. */
export const MCP_CONFIG_TOKEN_PLACEHOLDER_EN = '<YOUR_TOKEN>';

const MCP_DOCS_WHAT_IS_EN: readonly string[] = [
  'MCP (Model Context Protocol) is an open protocol that lets any AI assistant (Claude, ChatGPT, Cursor) securely read your deanery data: you issue a personal token once — and then ask the assistant in plain phrases.',
  `The deanery server lives at ${MCP_ENDPOINT_PATH} inside the cabinet and returns only your own data: the assistant calls the server with your token, and the server verifies the owner by the token hash on every call.`,
  'This is a contest concept: all data is fictional and there are no real university systems behind the server.',
];

const MCP_DOCS_SECURITY_EN: readonly string[] = [
  'The token is personal: it is the access key to your data. Treat it like a password and never forward it in chats or screenshots.',
  'You can revoke the token at any time: “Re-issue” in the “MCP setup” tab — the old token stops working immediately, and only the SHA-256 hash stays in storage.',
  'Access is read-only: the assistant reads your schedule, grades and notifications but cannot change anything in the cabinet.',
  'You see only your own data: every tool call is scoped to the token’s owner — other students and staff are unreachable through MCP (IDOR excluded).',
];

const MCP_DOCS_STEPS_EN: readonly { title: string; text: string }[] = [
  {
    title: 'Issue a personal token',
    text: 'The “MCP setup” tab → “Create token”. The full token is shown once — copy it right away; only the hash and a mask like demo-mcp…XXXX stay in the system.',
  },
  {
    title: 'Copy the JSON config',
    text: 'Below is a ready snippet for Claude Desktop, Cursor and any MCP client: click “Copy config” and replace <YOUR_TOKEN> with your token.',
  },
  {
    title: 'Ask the assistant',
    text: 'Restart the client and ask one of the example questions below — the assistant calls a server tool and answers with your data.',
  },
];

const MCP_EXAMPLE_QUESTIONS_EN: readonly string[] = [
  'What is on my schedule today?',
  'What are my latest grades?',
  'Do I have any unread notifications?',
];

/** EN-тексты каталога инструментов (id совпадают с DEANERY_MCP_TOOLS). */
const MCP_TOOL_TEXTS_EN: Record<string, { title: string; description: string }> = {
  my_schedule_today: {
    title: 'My schedule for today',
    description:
      'The student’s classes for today (Moscow time): time, discipline, class type, room, teacher. Reschedules and cancellations are marked; an empty day means “no classes”.',
  },
  my_grades: {
    title: 'My grades',
    description:
      'The student’s latest grades for assessment elements: discipline, element, score out of the maximum, weight and date. Returns up to 20 recent grades and a total counter.',
  },
  my_unread: {
    title: 'My unread notifications',
    description:
      'Unread cabinet notifications: category, title, short text and time. Returns up to 10 recent ones and a total unread counter.',
  },
};

/** Плейсхолдер токена по локали (RU — канон «<ВАШ_ТОКЕН»). */
export function mcpConfigTokenPlaceholder(locale: Locale = 'ru'): string {
  return locale === 'en' ? MCP_CONFIG_TOKEN_PLACEHOLDER_EN : MCP_CONFIG_TOKEN_PLACEHOLDER;
}

/** «Что такое MCP» по локали (RU — канон). */
export function mcpDocsWhatIs(locale: Locale = 'ru'): readonly string[] {
  return locale === 'en' ? MCP_DOCS_WHAT_IS_EN : MCP_DOCS_WHAT_IS;
}

/** «Безопасность» по локали. */
export function mcpDocsSecurity(locale: Locale = 'ru'): readonly string[] {
  return locale === 'en' ? MCP_DOCS_SECURITY_EN : MCP_DOCS_SECURITY;
}

/** Шаги подключения по локали. */
export function mcpDocsSteps(locale: Locale = 'ru'): readonly { title: string; text: string }[] {
  return locale === 'en' ? MCP_DOCS_STEPS_EN : MCP_DOCS_STEPS;
}

/** Примеры вопросов по локали. */
export function mcpExampleQuestions(locale: Locale = 'ru'): readonly string[] {
  return locale === 'en' ? MCP_EXAMPLE_QUESTIONS_EN : MCP_EXAMPLE_QUESTIONS;
}

/** Локализованный каталог инструментов сервера (RU — канон без изменений). */
export function mcpToolCatalog(
  locale: Locale = 'ru',
): readonly { name: string; title: string; description: string }[] {
  return DEANERY_MCP_TOOLS.map((tool) => {
    if (locale !== 'en') return { name: tool.name, title: tool.title, description: tool.description };
    const en = MCP_TOOL_TEXTS_EN[tool.name];
    return en
      ? { name: tool.name, title: en.title, description: en.description }
      : { name: tool.name, title: tool.title, description: tool.description };
  });
}
