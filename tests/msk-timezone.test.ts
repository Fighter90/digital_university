// DIG-79 — BUG-02 + BUG-12: время прототипа везде по Europe/Moscow.
//
// Боль из QA-регресса 18.11.2026: прод-сервер (UTC) рендерил «10:00–11:30»
// на дашборде, пока расписание (форматтер с явной зоной) показывало
// «13:00–14:30»; приветствие было «Доброе утро» в 14:52 МСК; в консоли —
// React #418 (сервер и браузер считали настенное время в разных зонах).
//
// Контракт: session-format / notification-view / ics / quiet-hours берут
// настенные компоненты в ЯВНОЙ зоне Europe/Moscow (конвенция проекта —
// schedule-time.ts, dashboard-format.ts, request-labels.ts), поэтому одна
// и та же фиксированная дата даёт одинаковую строку и на «сервере», и в
// «браузере» — при любом поясе процесса. Тест принудительно ставит
// process.env.TZ (UTC = прод-сервер; America/New_York = «другой» клиент)
// и требует московские строки везде: реализация на «локальных» методах
// Date падает уже на первом кейсе.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  formatNotificationTime,
  groupNotificationsByDay,
  toNotificationFeedItem,
  type NotificationFeedItem,
} from '@/lib/notification-view';
import { formatSessionDate, formatSessionTime, seasonTitleOf } from '@/lib/session-format';
import { icsDateTime } from '@/lib/ics';
import { isWithinQuietHours } from '@/lib/quiet-hours';

const ROOT = resolve(__dirname, '..');
const compose = () => readFileSync(resolve(ROOT, 'deploy/docker-compose.yml'), 'utf8');

// 18 ноября 2026, 10:00 UTC = 13:00 МСК (симптом QA: «10:00» против «13:00»).
const AT_1300_MSK = new Date('2026-11-18T10:00:00.000Z');
// 30 ноября 2026, 21:30 UTC = 1 декабря, 00:30 МСК (граница суток и месяца).
const AT_DEC1_0030_MSK = new Date('2026-11-30T21:30:00.000Z');

const SAVED_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'UTC';
});

afterAll(() => {
  if (SAVED_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = SAVED_TZ;
});

describe('session-format: настенное время по Москве (BUG-02)', () => {
  // TZ процесса = UTC («прод-сервер»): 10:00 UTC обязано показать 13:00 МСК.
  it('время экзамена 10:00 UTC рендерится как 13:00 МСК (UTC-сервер давал 10:00)', () => {
    expect(formatSessionTime(AT_1300_MSK)).toBe('13:00');
  });

  it('граница суток: 21:30 UTC 30 ноября — это «1 декабря» по Москве', () => {
    expect(formatSessionDate(AT_DEC1_0030_MSK)).toBe('1 декабря');
  });

  it('сезон сессии определяется московским месяцем (ноябрь 30/21:30 UTC → зимняя)', () => {
    expect(seasonTitleOf(AT_DEC1_0030_MSK)).toBe('Зимняя сессия');
  });

  it('и «в другом браузере» (America/New_York) — те же строки', () => {
    process.env.TZ = 'America/New_York';
    expect(formatSessionTime(AT_1300_MSK)).toBe('13:00');
    expect(formatSessionDate(AT_DEC1_0030_MSK)).toBe('1 декабря');
  });
});

describe('notification-view: HH:MM и группы дней по Москве (BUG-12, React #418)', () => {
  it('время уведомления 10:00 UTC рендерится как 13:00 МСК', () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    expect(formatNotificationTime(AT_1300_MSK, now)).toBe('13:00');
  });

  it('уведомление 00:30 МСК нынешних суток попадает в «Сегодня», а не «Вчера»', () => {
    const created = AT_DEC1_0030_MSK; // 1 декабря, 00:30 МСК
    const now = new Date('2026-12-01T12:00:00.000Z'); // 1 декабря, 15:00 МСК
    const item: NotificationFeedItem = toNotificationFeedItem({
      id: 'n1',
      studentId: 'st-anna',
      type: 'SYSTEM',
      title: 't',
      body: 'b',
      isRead: false,
      important: false,
      actionLabel: null,
      link: null,
      createdAt: created,
    });
    const groups = groupNotificationsByDay([item], now);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('today');
  });

  it('SSR (UTC) и гидрация (NY) дают байт-в-байт одну строку — корень #418 устранён', () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    const iso = AT_1300_MSK.toISOString();
    process.env.TZ = 'UTC';
    const serverView = formatNotificationTime(iso, now);
    process.env.TZ = 'America/New_York';
    const clientView = formatNotificationTime(new Date(iso), now);
    expect(serverView).toBe(clientView);
    expect(clientView).toBe('13:00');
  });
});

describe('ics: плавающее DTSTART по Москве', () => {
  it('10:00 UTC записывается как 13:00 московского дня', () => {
    expect(icsDateTime(AT_1300_MSK)).toBe('20261118T130000');
  });

  it('граница суток: 21:30 UTC 30 ноября — 1 декабря 00:30', () => {
    expect(icsDateTime(AT_DEC1_0030_MSK)).toBe('20261201T003000');
  });
});

describe('quiet-hours: минута суток по Москве', () => {
  const quiet = { enabled: true, from: '22:00', to: '08:00' };

  it('00:30 МСК (21:30 UTC) внутри окна 22:00–08:00', () => {
    expect(isWithinQuietHours(quiet, new Date('2026-11-18T21:30:00.000Z'))).toBe(true);
  });

  it('14:52 МСК (11:52 UTC) вне окна', () => {
    expect(isWithinQuietHours(quiet, new Date('2026-11-18T11:52:00.000Z'))).toBe(false);
  });
});

describe('compose: контейнер приложения живёт по Москве (BUG-02, первопричина)', () => {
  it('сервис app объявляет TZ=Europe/Moscow (db уже имеет; app — нет)', () => {
    const c = compose();
    // Вырезаем блок сервиса app (от «  app:» до следующего сервиса верхнего уровня).
    const appBlock = c.slice(c.indexOf('\n  app:'), c.indexOf('\n  caddy:'));
    expect(appBlock).toMatch(/TZ:\s*Europe\/Moscow/);
  });
});

afterEach(() => {
  process.env.TZ = 'UTC';
});
