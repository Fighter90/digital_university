// DIG-30 — расчётная дата готовности заявки по SLA типа.
// etaDays считается в РАБОЧИХ днях: суббота и воскресенье пропускаются,
// время суток сохраняется. Формат для уведомлений — «до 14 ноября».
import { describe, expect, it } from 'vitest';
import { addWorkingDays, formatReadyBy, slaReadyDate } from '@/lib/request-sla';

const d = (iso: string) => new Date(iso);

describe('slaReadyDate: рабочие дни через выходные (DIG-30)', () => {
  it('понедельник +1 → вторник', () => {
    // 2026-11-09 — понедельник.
    expect(addWorkingDays(d('2026-11-09T10:00:00'), 1).toISOString()).toBe(
      d('2026-11-10T10:00:00').toISOString(),
    );
  });

  it('пятница +1 → понедельник, +2 → вторник', () => {
    // 2026-11-13 — пятница; 14–15 — выходные.
    expect(addWorkingDays(d('2026-11-13T10:00:00'), 1)).toEqual(d('2026-11-16T10:00:00'));
    expect(addWorkingDays(d('2026-11-13T10:00:00'), 2)).toEqual(d('2026-11-17T10:00:00'));
  });

  it('суббота +1 → понедельник (старт из выходного)', () => {
    expect(addWorkingDays(d('2026-11-14T12:30:00'), 1)).toEqual(d('2026-11-16T12:30:00'));
  });

  it('неделя целиком (+5 от понедельника) → следующий понедельник', () => {
    expect(addWorkingDays(d('2026-11-09T09:00:00'), 5)).toEqual(d('2026-11-16T09:00:00'));
  });

  it('slaReadyDate: null для отсутствующего/отрицательного SLA, 0 — тот же момент', () => {
    const now = d('2026-11-13T10:00:00');
    expect(slaReadyDate(now, null)).toBeNull();
    expect(slaReadyDate(now, undefined)).toBeNull();
    expect(slaReadyDate(now, -1)).toBeNull();
    expect(slaReadyDate(now, 0)).toEqual(now);
    expect(slaReadyDate(now, 5)).toEqual(d('2026-11-20T10:00:00'));
  });
});

describe('formatReadyBy: текст для уведомления', () => {
  it('формат «день месяц-словом»', () => {
    expect(formatReadyBy(d('2026-11-14T00:00:00'))).toBe('14 ноября');
    expect(formatReadyBy(d('2026-11-20T18:00:00'))).toBe('20 ноября');
  });
});
