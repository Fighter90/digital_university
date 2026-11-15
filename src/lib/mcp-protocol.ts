// DIG-64 — чистый слой демо-MCP-сервера деканата: каталог инструментов и
// JSON-RPC 2.0 диспетчер (транспорт Streamable HTTP: POST + application/json).
//
// Модуль без React и без серверных импортов — используется API-роутом и
// покрыт юнит-тестами (tests/mcp-server.test.ts). Спецификация MCP:
// initialize → tools/list → tools/call; сообщения без id (уведомления)
// отвечают HTTP 202 без тела; ошибки протокола — JSON-RPC error objects
// (-32601 метод, -32602 параметры, -32700 неразбираемый JSON).

export const MCP_ENDPOINT_PATH = '/api/mcp';
export const MCP_SERVER_NAME = 'digital-deanery';
export const MCP_SERVER_TITLE = 'MCP-сервер цифрового деканата (демо)';
export const MCP_SERVER_VERSION = '1.0.0';
/** Последняя поддержанная версия протокола MCP (Meta-версия даты). */
export const MCP_DEFAULT_PROTOCOL_VERSION = '2025-06-18';
export const MCP_SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
];

/** Инструкция для ассистента: кто мы и какие инструменты даём. */
export const MCP_SERVER_INSTRUCTIONS =
  'Демо-MCP-сервер цифрового деканата (вымышленные данные). Отвечай на ' +
  'вопросы студента по его расписанию, оценкам и уведомлениям, вызывая ' +
  'инструменты; ответы уже содержат человекочитаемый текст.';

export type McpToolName = 'my_schedule_today' | 'my_grades' | 'my_unread';

export interface DeaneryMcpToolDef {
  name: McpToolName;
  /** Человекочитаемое имя («мои оценки»). */
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const NO_INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

/** Каталог инструментов демо-сервера. Порядок зафиксирован. */
export const DEANERY_MCP_TOOLS: readonly DeaneryMcpToolDef[] = [
  {
    name: 'my_schedule_today',
    title: 'Моё расписание на сегодня',
    description:
      'Пары студента на сегодняшний день (Москва): время, дисциплина, тип занятия, ' +
      'аудитория, преподаватель. Переносы и отмены помечены; пустой день — «пар нет».',
    inputSchema: NO_INPUT_SCHEMA,
  },
  {
    name: 'my_grades',
    title: 'Мои оценки',
    description:
      'Последние оценки студента за элементы контроля: дисциплина, элемент, балл ' +
      'из максимума, вес и дата. Возвращает до 20 свежих оценок и общий счётчик.',
    inputSchema: NO_INPUT_SCHEMA,
  },
  {
    name: 'my_unread',
    title: 'Мои непрочитанные уведомления',
    description:
      'Непрочитанные уведомления кабинета: категория, заголовок, краткий текст и ' +
      'время. Возвращает до 10 свежих и общий счётчик непрочитанных.',
    inputSchema: NO_INPUT_SCHEMA,
  },
];

/** Whitelist имени инструмента из внешнего ввода. */
export function isDeaneryMcpToolName(value: unknown): value is McpToolName {
  return DEANERY_MCP_TOOLS.some((tool) => tool.name === value);
}

/**
 * Согласование версии протокола: поддержанную версию клиента возвращаем как
 * есть, чужую/отсутствующую/мусорную — нашу последнюю (поведение по спеке).
 */
export function negotiateProtocolVersion(clientVersion: unknown): string {
  return typeof clientVersion === 'string' &&
    MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(clientVersion)
    ? clientVersion
    : MCP_DEFAULT_PROTOCOL_VERSION;
}

/**
 * Абсолютный URL эндпоинта из заголовков запроса (x-forwarded-host / host,
 * x-forwarded-proto). Готов к реверс-прокси Caddy (deploy/): proto без
 * заголовка — http (локальный запуск).
 */
export function buildMcpServerUrl(host: string, forwardedProto: string | null | undefined): string {
  const cleanHost = host.trim().replace(/\/+$/, '');
  const proto = forwardedProto?.trim().split(',')[0]?.trim();
  if (/^https?:\/\//i.test(cleanHost)) {
    return `${cleanHost.replace(/\/+$/, '')}${MCP_ENDPOINT_PATH}`;
  }
  return `${proto || 'http'}://${cleanHost}${MCP_ENDPOINT_PATH}`;
}

// ── JSON-RPC 2.0 ────────────────────────────────────────────────────────────

export interface McpHttpResponse {
  status: number;
  /** null — ответ без тела (202 для уведомлений). */
  body: unknown | null;
  headers: Record<string, string>;
}

export interface McpDispatchOptions {
  /** Исполнение инструмента (серверный слой данных под скоупом владельца). */
  runTool: (name: McpToolName, args: unknown) => Promise<string>;
}

interface JsonRpcMessage {
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const success = (id: unknown, result: unknown): McpHttpResponse => ({
  status: 200,
  body: { jsonrpc: '2.0', id, result },
  headers: { ...BASE_HEADERS },
});

const failure = (id: unknown, code: number, message: string, status = 200): McpHttpResponse => ({
  status,
  body: { jsonrpc: '2.0', id, error: { code, message } },
  headers: { ...BASE_HEADERS },
});

const notificationResponse = (): McpHttpResponse => ({
  status: 202,
  body: null,
  headers: { ...BASE_HEADERS, 'Cache-Control': 'no-store' },
});

/** Читает {method, params, id} из распарсенного тела; не-объект — null. */
function readMessage(raw: unknown): JsonRpcMessage | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { method } = raw as { method?: unknown };
  if (typeof method !== 'string' || method.length === 0) return null;
  return raw as JsonRpcMessage;
}

/**
 * Обрабатывает одно JSON-RPC сообщение MCP. Ошибки runTool не рвут протокол:
 * инструмент возвращает result с isError: true (контракт tools/call).
 */
export async function dispatchMcpJsonRpc(
  rawBody: unknown,
  options: McpDispatchOptions,
): Promise<McpHttpResponse> {
  const message = readMessage(rawBody);
  if (!message) {
    return failure(null, -32700, 'Parse error: ожидается одно JSON-RPC сообщение', 400);
  }
  const hasId = message.id !== undefined;
  const method = message.method as string;

  if (method === 'initialize') {
    const params = (message.params ?? {}) as { protocolVersion?: unknown };
    return success(message.id, {
      protocolVersion: negotiateProtocolVersion(params.protocolVersion),
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: MCP_SERVER_NAME, title: MCP_SERVER_TITLE, version: MCP_SERVER_VERSION },
      instructions: MCP_SERVER_INSTRUCTIONS,
    });
  }

  if (method === 'ping') {
    return success(message.id, {});
  }

  if (method === 'tools/list') {
    return success(message.id, { tools: DEANERY_MCP_TOOLS });
  }

  if (method === 'tools/call') {
    const params = (message.params ?? {}) as { name?: unknown; arguments?: unknown };
    if (!isDeaneryMcpToolName(params.name)) {
      return failure(message.id, -32602, `Unknown tool: ${String(params.name)}`);
    }
    const name = params.name;
    try {
      const text = await options.runTool(name, params.arguments);
      return success(message.id, {
        content: [{ type: 'text', text }],
        isError: false,
      });
    } catch {
      return success(message.id, {
        content: [
          {
            type: 'text',
            text: 'Ошибка: инструмент недоступен. Повторите запрос позже.',
          },
        ],
        isError: true,
      });
    }
  }

  if (!hasId) {
    // Уведомления (включая notifications/initialized) ответа не требуют.
    return notificationResponse();
  }
  return failure(message.id, -32601, `Method not found: ${method}`);
}

export type { JsonRpcMessage as McpJsonRpcMessage };
