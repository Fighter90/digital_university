// DIG-58 — каталог демо MCP-серверов цифрового ассистента.
//
// Чистый модуль (без React и серверных импортов): один реестр объединяет
// карточки-примеры, строки списка на вкладке «Настройка MCP» и справку.
//
// Всё содержимое ВЫМЫШЛЕННОЕ (конкурсный прототип, AGENTS.md):
//  - токены имеют префикс `demo-` и ни к чему не подходят (реальных ключей нет);
//  - deep-ссылки используют фиктивную схему `unidemo://` — они демонстрируют
//    UX установки (как у публичных MCP-страниц, например Product Hunt MCP),
//    но не ведут на реальные сервисы.

export type McpServerId = 'producthunt' | 'calendar' | 'deanery-api';

/** DIG-58 — состояние подключения одного демо MCP-сервера у студента. */
export interface McpServerState {
  id: McpServerId;
  connected: boolean;
}

export interface McpServerMeta {
  id: McpServerId;
  /** Название в списке и в карточке-примере. */
  name: string;
  /** Однострочное назначение (строка списка). */
  tagline: string;
  /** Карточка-пример: что даёт сервер (маркированный список). */
  benefits: string[];
  /** ВЫМЫШЛЕННЫЙ демонстрационный токен (копируется в инструкции). */
  demoToken: string;
  /** Фиктивная deep-ссылка установки (схема демо-прототипа). */
  deepLink: string;
}

/**
 * Каталог демо MCP-серверов ассистента. Порядок зафиксирован — он же
 * канонический порядок списка подключений в настройках.
 */
export const MCP_SERVERS: readonly McpServerMeta[] = [
  {
    id: 'producthunt',
    name: 'Product Hunt',
    tagline: 'Тренды продуктов и свежие запуски — прямо в ассистенте.',
    benefits: [
      'Подборка запусков дня по вашей теме (например, «EdTech»).',
      'Тренды недели: какие инструменты обсуждают студенты и стартапы.',
      'Идеи для курсовых и проектных работ на основе живых продуктов.',
    ],
    demoToken: 'demo-ph-mcp-4f8k-2026',
    deepLink: 'unidemo://mcp/install?server=producthunt',
  },
  {
    id: 'calendar',
    name: 'Календарь',
    tagline: 'Расписание и дедлайны — в вашем личном календаре.',
    benefits: [
      'Пары, зачёты и экзамены попадают в привычный календарь.',
      'Дедлайны работ видны рядом с личными делами недели.',
      'Напоминания приходят в тот канал, которым вы уже пользуетесь.',
    ],
    demoToken: 'demo-cal-mcp-9q2w-2026',
    deepLink: 'unidemo://mcp/install?server=calendar',
  },
  {
    id: 'deanery-api',
    name: 'Деканат-API',
    tagline: 'Данные деканата — для запросов цифрового ассистента.',
    benefits: [
      'Статусы заявок и справок ассистент отвечает как свои.',
      'Оценки и успеваемость — в диалоге, без перехода между экранами.',
      'Только ваши данные: доступ ограничен вашей сессией в кабинете.',
    ],
    demoToken: 'demo-dean-mcp-7x5c-2026',
    deepLink: 'unidemo://mcp/install?server=deanery-api',
  },
];

/** Канонический список подключений: все серверы отключены. */
export const DEFAULT_MCP_CONNECTIONS: McpServerState[] = MCP_SERVERS.map((server) => ({
  id: server.id,
  connected: false,
}));

/** Whitelist-проверка id из внешнего ввода (server action). */
export function isMcpServerId(value: unknown): value is McpServerId {
  return MCP_SERVERS.some((server) => server.id === value);
}

/** Метаданные сервера по id или null для неизвестного id. */
export function findMcpServer(id: string): McpServerMeta | null {
  return MCP_SERVERS.find((server) => server.id === id) ?? null;
}

/**
 * Достраивает полный список подключений по каталогу: известные id берут
 * сохранённый флаг, остальное — дефолт (отключено), мусор отбрасывается.
 * Порядок результата — канонический порядок каталога.
 */
export function normalizeMcpConnections(rows: unknown): McpServerState[] {
  const saved = Array.isArray(rows) ? rows : [];
  const connectedById = new Map<McpServerId, boolean>();
  for (const row of saved) {
    if (!row || typeof row !== 'object') continue;
    const { id, connected } = row as { id?: unknown; connected?: unknown };
    if (!isMcpServerId(id)) continue;
    connectedById.set(id, connected === true);
  }
  return MCP_SERVERS.map((server) => ({
    id: server.id,
    connected: connectedById.get(server.id) ?? false,
  }));
}

/**
 * Иммутабельно переключает флаг одного сервера. Неизвестный id игнорируется
 * (список не меняется) — вызывать после валидации `isMcpServerId`.
 */
export function setMcpConnected(
  states: readonly McpServerState[],
  id: McpServerId,
  connected: boolean,
): McpServerState[] {
  return states.map((state) => (state.id === id ? { ...state, connected } : state));
}

// ── Справка вкладки «Настройка MCP» ─────────────────────────────────────────

/** «Как работает MCP» — абзацы. */
export const MCP_HELP_HOW: readonly string[] = [
  'MCP (Model Context Protocol) — открытый протокол, по которому цифровой ассистент кабинета получает данные внешних сервисов: каталог продуктов, календарь, API деканата.',
  'Каждый сервер — отдельный источник: его можно подключить и отключить независимо. Ассистент обращается только к подключённым серверам и только с вашим токеном.',
  'В этом прототипе всё работает на вымышленных данных: подключение показывает UX, но не создаёт сетевых соединений.',
];

/** «Безопасность токенов» — абзацы. */
export const MCP_HELP_TOKENS: readonly string[] = [
  'Токен — единственный ключ доступа сервера к ассистенту: храните его как пароль и не пересылайте в чатах и скриншотах.',
  'Токен привязан к вашей сессии в кабинете: отключение сервера в настройках сразу отзывает доступ, отдельного «отзыва» не требуется.',
  'В демо-режиме токены ненастоящие (пометка demo-): они не дают доступа к реальным сервисам и существуют только для показа интерфейса.',
];

/** «Пошаговая установка» — нумерованные шаги. */
export const MCP_INSTALL_STEPS: readonly string[] = [
  'Нажмите «Подключить» у нужного сервера — откроется инструкция.',
  'Откройте deep-ссылку из инструкции — клиент MCP предложит добавить сервер.',
  'Скопируйте демо-токен и вставьте его в поле авторизации клиента.',
  'Подтвердите добавление сервера в клиенте MCP.',
  'Вернитесь в кабинет и нажмите «Подключить сервер» — статус обновится и сохранится в настройках.',
];

/** «Частые ошибки» — вопрос/ответ. */
export const MCP_FAQ: readonly { q: string; a: string }[] = [
  {
    q: 'Клиент пишет «invalid token»',
    a: 'Проверьте, что скопирован токен именно этого сервера: у каждого сервера свой демо-токен, лишний пробел при копировании тоже ломает авторизацию.',
  },
  {
    q: 'Сервер подключён, но данных нет',
    a: 'Убедитесь, что статус в кабинете — «Подключён», и что клиент MCP действительно запущен. В демо-режиме данные вымышленные и генерируются прототипом.',
  },
  {
    q: 'После перезагрузки статус сбросился',
    a: 'Статус хранится в настройках вашего аккаунта. Если он сбросился, значит вход был выполнен под другим демо-пользователем — проверьте логин в правом верхнем углу.',
  },
  {
    q: 'Нужно ли отключать сервер перед новым токеном',
    a: 'Нет: нажмите «Отключить», затем «Подключить» — инструкция выдаст актуальный токен, и подключение можно повторить.',
  },
];


// DIG-89 — EN-слой демо-каталога MCP-серверов (по id; RU — канон).
const MCP_SERVERS_EN: Record<string, { name: string; tagline: string; benefits: string[] }> = {
  producthunt: {
    name: 'Product Hunt',
    tagline: 'Product trends and fresh launches — right in the assistant.',
    benefits: [
      'A curated list of the day’s launches for your topic (for example, “EdTech”).',
      'Weekly trends: which tools students and startups are discussing.',
      'Ideas for course and project work based on live products.',
    ],
  },
  calendar: {
    name: 'Calendar',
    tagline: 'Schedule and deadlines — in your personal calendar.',
    benefits: [
      'Classes, credits and exams land in your regular calendar.',
      'Assignment deadlines sit next to your personal week plans.',
      'Reminders arrive via the channel you already use.',
    ],
  },
  'deanery-api': {
    name: 'Deanery API',
    tagline: 'Deanery data — for digital assistant queries.',
    benefits: [
      'Request and certificate statuses answered by the assistant as its own.',
      'Grades and performance in the dialogue, no screen switching.',
      'Only your data: access is limited to your cabinet session.',
    ],
  },
};

/** EN-мета демо-сервера по id; неизвестный id — null. */
export function mcpServerEnMeta(id: string): {
  name: string;
  tagline: string;
  benefits: string[];
} | null {
  return MCP_SERVERS_EN[id] ?? null;
}

/** EN-контент справки MCP (abзацы/шаги/FAQ); RU-канон — константы выше. */
export const MCP_HELP_EN: {
  how: readonly string[];
  tokens: readonly string[];
  steps: readonly string[];
  faq: readonly { q: string; a: string }[];
} = {
  how: [
    'MCP (Model Context Protocol) is an open protocol through which the cabinet’s digital assistant gets data from external services: a product catalog, a calendar, the deanery API.',
    'Each server is a separate source: it can be connected and disconnected independently. The assistant talks only to connected servers and only with your token.',
    'In this prototype everything runs on fictional data: the connection demonstrates the UX but creates no network connections.',
  ],
  tokens: [
    'The token is the only key the server uses to reach the assistant: treat it like a password and never forward it in chats or screenshots.',
    'The token is tied to your cabinet session: disconnecting the server in settings revokes access immediately, no separate “revoke” step is needed.',
    'In demo mode tokens are fake (marked demo-): they grant no access to real services and exist only to show the interface.',
  ],
  steps: [
    'Press “Connect” next to the server you need — the instructions open.',
    'Open the deep link from the instructions — the MCP client will offer to add the server.',
    'Copy the demo token and paste it into the client’s authorization field.',
    'Confirm adding the server in your MCP client.',
    'Return to the cabinet and press “Connect server” — the status updates and is saved in settings.',
  ],
  faq: [
    {
      q: 'The client says “invalid token”',
      a: 'Check that you copied the token of this exact server: every server has its own demo token, and a stray space when copying also breaks authorization.',
    },
    {
      q: 'The server is connected but there is no data',
      a: 'Make sure the status in the cabinet is “Connected” and the MCP client is actually running. In demo mode the data is fictional and generated by the prototype.',
    },
    {
      q: 'The status reset after a reload',
      a: 'The status is stored in your account settings. If it reset, the sign-in happened under a different demo user — check the login in the top-right corner.',
    },
    {
      q: 'Should the server be disconnected before a new token',
      a: 'No: press “Disconnect”, then “Connect” — the instructions will issue the current token, and you can connect again.',
    },
  ],
};
