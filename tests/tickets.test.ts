// DIG-39 — контракт чистого модуля обращений (src/lib/tickets.ts).
// Приёмка: ровно 5 тем с точными метками задачи («Учебный план», «Оценки»,
// «Перевод», «Академический отпуск», «Другое»); маппинг внутренних статусов
// канонической схемы в три видимых («Открыто», «Ждём вас», «Решено»);
// подпись менеджера «Менеджер программы»; обещание «Обычно отвечаем в
// течение 1 рабочего дня»; formatTicketTime (сегодня → «ЧЧ:ММ», вчера →
// «Вчера», иначе дата); shortPreview со свёрткой пробелов.
import { describe, expect, it } from 'vitest';

import {
  FAQ_HINT_TITLE,
  MANAGER_ROLE_LABEL,
  RESPONSE_PROMISE,
  shortPreview,
  ticketViewStatus,
  TICKET_SUBJECT_LABELS,
  TICKET_SUBJECTS,
  TICKET_VIEW_STATUS_LABELS,
  formatTicketTime,
} from '@/lib/tickets';

// Детерминированное «сейчас»: 2026-11-16 12:30 локального времени.
const NOW = new Date(2026, 10, 16, 12, 30, 0);

describe('TICKET_SUBJECTS — темы обращения из задачи', () => {
  it('ровно пять тем с точными метками', () => {
    expect(TICKET_SUBJECTS).toHaveLength(5);
    expect([...TICKET_SUBJECTS]).toEqual([
      'CURRICULUM',
      'GRADES',
      'TRANSFER',
      'ACADEMIC_LEAVE',
      'OTHER',
    ]);
    expect(TICKET_SUBJECT_LABELS.CURRICULUM).toBe('Учебный план');
    expect(TICKET_SUBJECT_LABELS.GRADES).toBe('Оценки');
    expect(TICKET_SUBJECT_LABELS.TRANSFER).toBe('Перевод');
    expect(TICKET_SUBJECT_LABELS.ACADEMIC_LEAVE).toBe('Академический отпуск');
    expect(TICKET_SUBJECT_LABELS.OTHER).toBe('Другое');
  });
});

describe('ticketViewStatus — маппинг канона в три видимых статуса', () => {
  it('OPEN и IN_PROGRESS → «Открыто»', () => {
    expect(ticketViewStatus('OPEN')).toBe('OPEN');
    expect(ticketViewStatus('IN_PROGRESS')).toBe('OPEN');
    expect(TICKET_VIEW_STATUS_LABELS.OPEN).toBe('Открыто');
  });

  it('ANSWERED → «Ждём вас» (ответ менеджера ждёт студента)', () => {
    expect(ticketViewStatus('ANSWERED')).toBe('WAITING_STUDENT');
    expect(TICKET_VIEW_STATUS_LABELS.WAITING_STUDENT).toBe('Ждём вас');
  });

  it('RESOLVED и CLOSED → «Решено»', () => {
    expect(ticketViewStatus('RESOLVED')).toBe('RESOLVED');
    expect(ticketViewStatus('CLOSED')).toBe('RESOLVED');
    expect(TICKET_VIEW_STATUS_LABELS.RESOLVED).toBe('Решено');
  });

  it('маппинг полон: каждое внутреннее значение даёт видимый статус', () => {
    const statuses = ['OPEN', 'IN_PROGRESS', 'ANSWERED', 'RESOLVED', 'CLOSED'] as const;
    for (const status of statuses) {
      expect(TICKET_VIEW_STATUS_LABELS[ticketViewStatus(status)]).toBeTruthy();
    }
  });
});

describe('константы чата', () => {
  it('подпись роли менеджера и обещание срока — дословно из задачи', () => {
    expect(MANAGER_ROLE_LABEL).toBe('Менеджер программы');
    expect(RESPONSE_PROMISE).toBe('Обычно отвечаем в течение 1 рабочего дня');
    expect(FAQ_HINT_TITLE).toBe('Возможно, это ответ на ваш вопрос');
  });
});

describe('formatTicketTime — сегодня / вчера / дата', () => {
  it('сегодня → «ЧЧ:ММ»', () => {
    const today = new Date(2026, 10, 16, 9, 5, 0);
    expect(formatTicketTime(today, NOW)).toBe('09:05');
  });

  it('вчера → «Вчера»', () => {
    const yesterday = new Date(2026, 10, 15, 18, 45, 0);
    expect(formatTicketTime(yesterday, NOW)).toBe('Вчера');
  });

  it('раньше вчера → дата без года в том же году', () => {
    const earlier = new Date(2026, 10, 3, 8, 0, 0);
    expect(formatTicketTime(earlier, NOW)).toMatch(/3 нояб\./);
  });

  it('вчерашняя ночь через полночь — «Вчера» (граница календарного дня)', () => {
    const lateNight = new Date(2026, 10, 15, 23, 59, 0);
    const earlyMorning = new Date(2026, 10, 16, 0, 1, 0);
    expect(formatTicketTime(lateNight, NOW)).toBe('Вчера');
    expect(formatTicketTime(earlyMorning, NOW)).toBe('00:01');
  });
});

describe('shortPreview — последний ответ в списке', () => {
  it('свёртка пробелов и переносов', () => {
    expect(shortPreview('  Привет!  \n  Как  дела?  ')).toBe('Привет! Как дела?');
  });

  it('длинный текст обрезается с многоточием', () => {
    const long = 'Добрый день! Уточните, пожалуйста, статус моей заявки на академический отпуск.';
    const preview = shortPreview(long, 30);
    expect(preview.length).toBeLessThanOrEqual(30);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('короткий текст возвращается целиком без многоточия', () => {
    expect(shortPreview('Спасибо!', 30)).toBe('Спасибо!');
  });

  it('пустой и whitespace-only ввод → пустая строка', () => {
    expect(shortPreview('')).toBe('');
    expect(shortPreview('   \n\t ')).toBe('');
  });
});
