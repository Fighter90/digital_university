// DIG-24 — вью-модель панели «Детали пары» (чистые функции, без серверных
// импортов). Контракт состава панели Figma «04 · Расписание — детали пары»:
// шапка (тип/название/дата/время), блок переноса «Было: … → Стало: …» с
// причиной и автором, блок отмены с причиной и «что делать», аудитория и
// корпус, онлайн-ссылка, преподаватель с email и ссылкой на справочник,
// домашнее задание и материалы, сборка ICS-входа одной пары.
import { describe, expect, it } from 'vitest';

import { toEventDetailsView, toEventIcsInput, type EventDetailsView } from '@/lib/event-details';
import { fromMoscowWallClock } from '@/lib/schedule-time';
import type { ScheduleEventRow } from '@/server/data/types';

/** 2026-11-11 — среда (см. формат «Среда, 11 ноября»). */
function row(overrides: Partial<ScheduleEventRow> = {}): ScheduleEventRow {
  const startsAt = overrides.startsAt ?? fromMoscowWallClock(2026, 11, 11, 12, 0);
  return {
    id: 'sch-x',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: startsAt,
    startsAt,
    endsAt: overrides.endsAt ?? fromMoscowWallClock(2026, 11, 11, 13, 30),
    kind: 'LAB',
    room: '305',
    teacherName: 'Иванова Ирина Игоревна',
    status: 'SCHEDULED',
    note: null,
    ...overrides,
  };
}

describe('toEventDetailsView: шапка панели', () => {
  it('тип занятия, название, дата «Среда, 11 ноября» и время «12:00–13:30»', () => {
    const view = toEventDetailsView(row());
    expect(view.kindLabel).toBe('Лабораторная');
    expect(view.discipline).toBe('Программирование');
    expect(view.disciplineCode).toBe('PI21-PROG');
    expect(view.dateLabel).toBe('Среда, 11 ноября');
    expect(view.timeLabel).toBe('12:00–13:30');
    expect(view.stripeClass).toContain('bg-lesson-lab');
  });

  it('аудитория и корпус: «ауд. 305», корпус из строки, фолбэк — «Главный корпус»', () => {
    expect(toEventDetailsView(row()).roomLabel).toBe('ауд. 305');
    expect(toEventDetailsView(row()).buildingLabel).toBe('Главный корпус');
    expect(toEventDetailsView(row({ building: 'Лабораторный корпус' })).buildingLabel).toBe(
      'Лабораторный корпус',
    );
    // онлайн-пара: подпись «онлайн» и ссылка проходят в панель
    const online = toEventDetailsView(
      row({ room: 'Онлайн', onlineUrl: 'https://meet.example/hist-11-15' }),
    );
    expect(online.roomLabel).toBe('онлайн');
    expect(online.onlineUrl).toBe('https://meet.example/hist-11-15');
  });
});

describe('toEventDetailsView: перенос', () => {
  it('ROOM_CHANGED: «Было: ауд. 214, 11:10» → «Стало: ауд. 305, 11:10», причина и автор', () => {
    const view = toEventDetailsView(
      row({
        status: 'ROOM_CHANGED',
        room: '305',
        previousRoom: '214',
        previousStartsAt: fromMoscowWallClock(2026, 11, 11, 11, 10),
        changeNote: 'Аудитория занята факультетским мероприятием',
        changeAuthor: 'Мария Петрова (деканат)',
      }),
    );
    expect(view.status).toBe('MOVED');
    expect(view.isMoved).toBe(true);
    expect(view.move?.wasLabel).toBe('ауд. 214, 11:10');
    expect(view.move?.nowLabel).toBe('ауд. 305, 12:00');
    expect(view.move?.reason).toBe('Аудитория занята факультетским мероприятием');
    expect(view.move?.authorLabel).toBe('Мария Петрова (деканат)');
  });

  it('TIME_CHANGED: было только время, стало аудитория и новое время', () => {
    const view = toEventDetailsView(
      row({
        status: 'TIME_CHANGED',
        startsAt: fromMoscowWallClock(2026, 11, 11, 12, 30),
        previousStartsAt: fromMoscowWallClock(2026, 11, 11, 11, 10),
        changeNote: 'Лектор в командировке',
      }),
    );
    expect(view.move?.wasLabel).toBe('11:10');
    expect(view.move?.nowLabel).toBe('ауд. 305, 12:30');
    // автор не задан — подпись «деканат» (изменения вносит только деканат)
    expect(view.move?.authorLabel).toBe('деканат');
  });

  it('перенос без previousStartsAt: «Было: ауд. 214» (без времени)', () => {
    const view = toEventDetailsView(
      row({ status: 'ROOM_CHANGED', room: '305', previousRoom: '214' }),
    );
    expect(view.move?.wasLabel).toBe('ауд. 214');
    expect(view.move?.nowLabel).toBe('ауд. 305, 12:00');
  });

  it('у обычной пары блока переноса нет', () => {
    const view = toEventDetailsView(row());
    expect(view.move).toBeNull();
    expect(view.cancel).toBeNull();
    expect(view.status).toBe('SCHEDULED');
  });
});

describe('toEventDetailsView: отмена', () => {
  it('причина из note, «что делать» из changeNote', () => {
    const view = toEventDetailsView(
      row({
        status: 'CANCELLED',
        note: 'Лаборатория закрыта',
        changeNote: 'Занятие будет восполнено 20 ноября, ауд. 212',
      }),
    );
    expect(view.status).toBe('CANCELLED');
    expect(view.isCancelled).toBe(true);
    expect(view.cancel?.reason).toBe('Лаборатория закрыта');
    expect(view.cancel?.makeupLabel).toBe('Занятие будет восполнено 20 ноября, ауд. 212');
    expect(view.move).toBeNull();
  });

  it('без восполнения makeupLabel — null (строку не рисуем)', () => {
    const view = toEventDetailsView(row({ status: 'CANCELLED', note: 'Лаборатория закрыта' }));
    expect(view.cancel?.makeupLabel).toBeNull();
  });
});

describe('toEventDetailsView: преподаватель, домашка, примечание', () => {
  it('email преподавателя и ссылка на карточку справочника', () => {
    const view = toEventDetailsView(row({ teacherEmail: 'i.ivanova@deanery.example' }));
    expect(view.teacherName).toBe('Иванова Ирина Игоревна');
    expect(view.teacherEmail).toBe('i.ivanova@deanery.example');
    expect(view.teacherCardHref).toBe('/directory');
    expect(view.mailtoHref).toBe('mailto:i.ivanova@deanery.example');
  });

  it('домашнее задание и материалы проходят как есть (могут отсутствовать)', () => {
    const withHw = toEventDetailsView(
      row({ homework: 'Задача 7 до следующей пары', materials: 'Конспект лекции №7' }),
    );
    expect(withHw.homework).toBe('Задача 7 до следующей пары');
    expect(withHw.materials).toBe('Конспект лекции №7');
    const without = toEventDetailsView(row());
    expect(without.homework).toBeNull();
    expect(without.materials).toBeNull();
  });

  it('примечание деканата обычной пары видно (info-строка панели)', () => {
    expect(toEventDetailsView(row({ note: 'Перед зачётом' })).deaneryNote).toBe('Перед зачётом');
    // у переноса/отмены note уходит в причину, а не в info-строку
    expect(
      toEventDetailsView(row({ status: 'CANCELLED', note: 'Лаборатория закрыта' })).deaneryNote,
    ).toBeNull();
  });

  it('ICS-ссылка панели и UID события стабильны', () => {
    const view = toEventDetailsView(row({ id: 'sch-pi21-4' }));
    expect(view.icsHref).toBe('/api/schedule/sch-pi21-4/ics');
    const ics = toEventIcsInput(view);
    expect(ics.uid).toBe('event-sch-pi21-4@digital-deanery');
    expect(ics.title).toBe('Лабораторная: Программирование');
    expect(ics.startsAt).toBe(view.startsAt);
    expect(ics.endsAt).toBe(view.endsAt);
  });

  it('ICS: локация «ауд. 305, Лабораторный корпус» либо «Онлайн»', () => {
    const room = toEventIcsInput(toEventDetailsView(row({ building: 'Лабораторный корпус' })));
    expect(room.location).toBe('ауд. 305, Лабораторный корпус');
    const online = toEventIcsInput(
      toEventDetailsView(row({ room: 'Онлайн', onlineUrl: 'https://meet.example/x' })),
    );
    expect(online.location).toBe('Онлайн');
  });

  it('ICS: описание несёт преподавателя и статус (перенос/отмена)', () => {
    const moved = toEventIcsInput(
      toEventDetailsView(
        row({ status: 'ROOM_CHANGED', previousRoom: '214', changeNote: 'Аудитория занята' }),
      ),
    );
    expect(moved.description).toContain('Преподаватель: Иванова Ирина Игоревна');
    expect(moved.description).toContain('перенесена');
    expect(moved.description).toContain('Аудитория занята');
    const cancelled = toEventIcsInput(
      toEventDetailsView(row({ status: 'CANCELLED', note: 'Лаборатория закрыта' })),
    );
    expect(cancelled.description).toContain('отменена');
    expect(cancelled.description).toContain('Лаборатория закрыта');
    const plain = toEventIcsInput(toEventDetailsView(row()));
    expect(plain.description).toBe('Преподаватель: Иванова Ирина Игоревна');
  });
});

/**
 * Структурная страховка вью-модели: скалярные поля — только строки/boolean/null;
 * время (startsAt/endsAt) — Date (RSC сериализует Date между сервером и
 * клиентом, панель форматирует его заранее в dateLabel/timeLabel); вложенные
 * блоки переноса/отмены — объект или null.
 */
describe('toEventDetailsView: сериализуемость', () => {
  it('панель получает RSC-сериализуемые поля: строки/boolean/null, Date времени, объекты блоков', () => {
    const view: EventDetailsView = toEventDetailsView(
      row({ status: 'ROOM_CHANGED', previousRoom: '214', changeAuthor: 'Мария Петрова' }),
    );
    for (const [key, value] of Object.entries(view)) {
      if (key === 'startsAt' || key === 'endsAt') {
        expect(value, `${key} должен быть Date`).toBeInstanceOf(Date);
        continue;
      }
      if (key === 'move' || key === 'cancel') {
        expect(value === null || typeof value === 'object', `${key} — объект или null`).toBe(true);
        continue;
      }
      expect(
        ['string', 'boolean'].includes(typeof value) || value === null,
        `неожиданный тип поля ${key}: ${String(typeof value)}`,
      ).toBe(true);
    }
  });
});
