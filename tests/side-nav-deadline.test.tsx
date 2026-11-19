// DIG-83 — BUG-06 (QA-регресс 18.11.2026): сайдбар «Ближайший дедлайн»
// показывал «осталось 9 дней» при реальных двух днях до 20 ноября,
// пока соседняя карточка «Дедлайны» на той же странице показывала
// корректное «осталось 2 дня».
//
// Контракт: срок карточки сайдбара считается той же логикой, что и у
// карточки «Дедлайны» дашборда (src/lib/dashboard-format.ts):
//   1) разница КАЛЕНДАРНЫХ дней (время суток не влияет);
//   2) подпись из общего daysLeftLabel (0 → «Сегодня», 1 → «Завтра»,
//      N → «осталось N дня/дней»).
// «Сегодня» фиксируется fake-таймерами; зона процесса принудительно
// UTC (прод-сервер) и America/New_York («другой браузер») — строки
// обязаны совпадать байт-в-байт (конвенция tests/msk-timezone.test.ts,
// корень BUG-02: SSR и гидрация считали настенное время по-разному).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// SideNav читает активный раздел через usePathname (next/navigation) —
// вне App Router мокаем на «Главную» (как в tests/unread-badge.test.tsx).
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}));

import { SideNav } from '@/components/shell/side-nav';

const SAVED_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'UTC';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.setSystemTime(new Date('2026-11-18T06:30:00.000Z'));
});

afterAll(() => {
  vi.useRealTimers();
  if (SAVED_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = SAVED_TZ;
});

/** Карточка «Ближайший дедлайн» из разметки сайдбара (полное меню ≥1024). */
function sidebarCard(nowUtcIso: string): string {
  vi.setSystemTime(new Date(nowUtcIso));
  return renderToStaticMarkup(<SideNav unreadCount={0} />);
}

describe('SideNav «Ближайший дедлайн»: срок считается динамически (BUG-06/DIG-83)', () => {
  it('18 ноября (09:30 МСК) — «осталось 2 дня», как в соседней карточке «Дедлайны»', () => {
    expect(sidebarCard('2026-11-18T06:30:00.000Z')).toContain('осталось 2 дня');
  });

  it('18 ноября поздно вечером (23:40 МСК) — по-прежнему «осталось 2 дня» (календарные дни)', () => {
    expect(sidebarCard('2026-11-18T20:40:00.000Z')).toContain('осталось 2 дня');
  });

  it('19 ноября — «Завтра», как в карточке «Дедлайны» (не «остался 1 день» сайдбара)', () => {
    expect(sidebarCard('2026-11-19T05:00:00.000Z')).toContain('Завтра');
    expect(sidebarCard('2026-11-19T05:00:00.000Z')).not.toContain('остался 1 день');
  });

  it('20 ноября (день дедлайна) — «Сегодня», а не «осталось 0 дня»', () => {
    expect(sidebarCard('2026-11-20T09:00:00.000Z')).toContain('Сегодня');
    expect(sidebarCard('2026-11-20T09:00:00.000Z')).not.toContain('осталось 0');
  });

  it('после дедлайна счётчик не уходит в минус и не ломает плюрализацию', () => {
    const html = sidebarCard('2026-11-25T12:00:00.000Z');
    expect(html).toContain('Сегодня');
    expect(html).not.toMatch(/осталось -\d+/);
    expect(html).not.toContain('осталось 0');
  });

  it('строка дедлайна байт-в-байт одинакова при TZ сервера (UTC) и клиента (New York)', () => {
    const now = '2026-11-18T20:40:00.000Z';
    process.env.TZ = 'UTC';
    const serverHtml = sidebarCard(now);
    process.env.TZ = 'America/New_York';
    const clientHtml = sidebarCard(now);
    expect(clientHtml).toContain('до 20 ноября · осталось 2 дня');
    expect(serverHtml).toContain('до 20 ноября · осталось 2 дня');
  });

  it('заголовок карточки и вымышленный дедлайн присутствуют (DIG-14 не сломан)', () => {
    const html = sidebarCard('2026-11-18T06:30:00.000Z');
    expect(html).toContain('Ближайший дедлайн');
    expect(html).toContain('Курсовая работа по базам данных');
  });
});
