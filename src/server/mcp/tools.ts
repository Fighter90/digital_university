// DIG-64 — исполнение инструментов демо-MCP-сервера на data-слое.
//
// Каждый вызов получает ctx, построенный из персонального токена владельца
// (resolveMcpDemoToken), и читает данные ТОЛЬКО через скоупленные функции
// слоя данных (getToday / listGrades / listNotifications — у каждого свой
// скоуп): чужие студенты через токен недостижимы, IDOR исключён.

import { getToday, listGrades, listNotifications } from '@/server/data';
import { formatGrades, formatScheduleToday, formatUnread } from '@/lib/mcp-format';
import type { McpToolName } from '@/lib/mcp-protocol';
import type { DataDb } from '@/server/data/port';
import type { DataCtx } from '@/server/data/types';

/** Инструмент → человекочитаемый текст ответа (для ассистента). */
export async function runDeaneryTool(
  name: McpToolName,
  db: DataDb,
  ctx: DataCtx,
  now: Date,
): Promise<string> {
  switch (name) {
    case 'my_schedule_today':
      return formatScheduleToday(await getToday(db, ctx, now), now);
    case 'my_grades':
      return formatGrades(await listGrades(db, ctx));
    case 'my_unread':
      return formatUnread(await listNotifications(db, ctx));
  }
}
