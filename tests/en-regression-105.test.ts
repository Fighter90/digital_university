// DIG-105 — регресс качества EN (ручной свип против прода ostrovok.store).
// Три EN-дефекта, найденных свипом; каждый закрыт минимальным фиксом:
//  1) Ночное приветствие EN «Good night» — калька прощания (в английском
//     «Good night» — только прощание); естественный EN — «Good evening».
//  2) «Requests in work … pick-up» (настройки, сотрудник) — калька «в работе»
//     плюс дефис, не как на дашборде («ready for pickup»). Норма —
//     «Requests in progress» / «pickup».
//  3) Старые уведомления в EN датированы «18.11» — русским форматом DD.MM
//     (formatNotificationTime не принимал локаль). EN-норма — «Nov 18».
// RU-канон («Доброй ночи», «Заявки в работе», «DD.MM») не меняется —
// проверки на канон ниже фиксируют это.
import { describe, expect, it } from 'vitest';

import { formatNotificationTime } from '@/lib/notification-view';
import { greetingFor } from '@/lib/dashboard-format';
import { en } from '@/lib/i18n/en';
import { ru as ruDict } from '@/lib/i18n/ru';

// 11 ноября 2026, 10:15 UTC = 13:15 МСК — старше «вчера» относительно NOW.
const OLDER = new Date('2026-11-11T10:15:00.000Z');
const NOW = new Date('2026-11-20T12:00:00.000Z'); // 20 ноября, 15:00 МСК
const NIGHT_MSK = new Date(Date.UTC(2026, 10, 20, 0, 30)); // 20 ноября, 03:30 МСК

describe('DIG-105: ночное приветствие EN', () => {
  it('EN ночью (00–05 МСК): не «Good night» (прощание), а «Good evening»', () => {
    const greeting = greetingFor(NIGHT_MSK, 'en');
    expect(greeting).not.toBe('Good night');
    expect(greeting).toBe('Good evening');
  });

  it('RU-канон не тронут: ночью — «Доброй ночи»', () => {
    expect(greetingFor(NIGHT_MSK)).toBe('Доброй ночи');
  });
});

describe('DIG-105: EN-словарь без кальки «in work»', () => {
  it('EN: виджеты настроек и заголовок сотрудника — «Requests in progress»', () => {
    expect(en['widgets.desc.requests']).toBe('Requests in progress and ready for pickup');
    expect(en['staff.home.requests.title']).toBe('Requests in progress');
    expect(en['dashboard.greeting.night']).toBe('Good evening');
  });

  it('RU-канон байт-в-байт: «Заявки в работе…», «Доброй ночи»', () => {
    expect(ruDict['widgets.desc.requests']).toBe('Заявки в работе и готовые к получению');
    expect(ruDict['staff.home.requests.title']).toBe('Заявки в работе');
    expect(ruDict['dashboard.greeting.night']).toBe('Доброй ночи');
  });
});

describe('DIG-105: EN-формат старых уведомлений', () => {
  it('EN: уведомление старше «вчера» — «Nov 11», а не «11.11»', () => {
    expect(formatNotificationTime(OLDER, NOW, 'en')).toBe('Nov 11');
  });

  it('EN: сегодня — те же HH:MM по Москве', () => {
    expect(
      formatNotificationTime(
        new Date('2026-11-18T10:15:00.000Z'),
        new Date('2026-11-18T12:00:00.000Z'),
        'en',
      ),
    ).toBe('13:15');
  });

  it('RU-канон: «11.11» без изменений (дефолтная локаль ru)', () => {
    expect(formatNotificationTime(OLDER, NOW)).toBe('11.11');
  });

  it('EN-формат короткого месяца + дня (без кириллицы и без точки-разделителя)', () => {
    expect(formatNotificationTime(OLDER, NOW, 'en')).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});
