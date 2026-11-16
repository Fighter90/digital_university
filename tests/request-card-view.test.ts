// DIG-33 — чистые помощники карточки заявки.
//
// Контракт: «Ведёт» — последний сотрудник в истории; ожидаемая дата —
// SLA типа от момента последнего «вперёд»-перехода (после доработки
// даты нет — обещание от непроверенных данных было бы ложью); секция
// параметров — labels из JSON-схемы типа + мета мастера с вложениями.
import { describe, expect, it } from 'vitest';

import {
  expectedReadyLabelFromEvents,
  formatAttachmentSize,
  lastStaffActorName,
  requestParamsRows,
  requestWizardView,
  type RequestTimelineEvent,
} from '@/lib/request-card-view';

const ev = (overrides: Partial<RequestTimelineEvent>): RequestTimelineEvent => ({
  id: 'e',
  actorRole: 'STUDENT',
  actorName: 'Анна Ковалёва',
  fromStatus: null,
  toStatus: 'SUBMITTED',
  comment: null,
  createdAt: new Date('2026-11-16T07:05:00.000Z'),
  ...overrides,
});

describe('lastStaffActorName: «Ведёт» по последнему STAFF-событию', () => {
  it('нет событий сотрудника — null (покажем «сотрудник деканата»)', () => {
    expect(
      lastStaffActorName([ev({}), ev({ id: 'e2', actorName: 'Деканат', actorRole: null })]),
    ).toBeNull();
  });

  it('берёт ПОСЛЕДНЕЕ событие сотрудника, а не первое', () => {
    expect(
      lastStaffActorName([
        ev({ id: 'e1', actorRole: 'STAFF', actorName: 'Мария Петрова', toStatus: 'ACCEPTED' }),
        ev({ id: 'e2', actorRole: 'STAFF', actorName: 'Ольга Иванова', toStatus: 'IN_PROGRESS' }),
        ev({ id: 'e3', actorRole: 'STUDENT' }),
      ]),
    ).toBe('Ольга Иванова');
  });
});

describe('expectedReadyLabelFromEvents: срок от последнего «вперёд»-перехода', () => {
  it('SUBMITTED + SLA 5 рабочих дней (пт 13 ноя → пт 20 ноя)', () => {
    const events = [ev({ createdAt: new Date('2026-11-13T08:40:00.000Z') })];
    expect(expectedReadyLabelFromEvents(events, 5)).toBe('Готовность до 20 ноября');
  });

  it('позже был ACCEPTED — срок считается от него, а не от подачи', () => {
    const events = [
      ev({ id: 'e1', createdAt: new Date('2026-11-13T08:40:00.000Z'), toStatus: 'SUBMITTED' }),
      ev({
        id: 'e2',
        actorRole: 'STAFF',
        actorName: 'Мария Петрова',
        createdAt: new Date('2026-11-16T07:05:00.000Z'),
        fromStatus: 'SUBMITTED',
        toStatus: 'ACCEPTED',
      }),
    ];
    // пн 16 ноя + 3 рабочих дня = чт 19 ноя.
    expect(expectedReadyLabelFromEvents(events, 3)).toBe('Готовность до 19 ноября');
  });

  it('NEEDS_FIX — даты нет (срок назовут после исправления)', () => {
    const events = [
      ev({ createdAt: new Date('2026-11-13T08:40:00.000Z') }),
      ev({
        id: 'e2',
        actorRole: 'STAFF',
        actorName: 'Мария Петрова',
        fromStatus: 'SUBMITTED',
        toStatus: 'NEEDS_FIX',
        comment: 'Укажите ФИО латиницей',
      }),
    ];
    expect(expectedReadyLabelFromEvents(events, 3)).toBeNull();
  });

  it('терминальные статусы и мгновенная READY — даты нет', () => {
    expect(expectedReadyLabelFromEvents([ev({ toStatus: 'READY' })], 1)).toBeNull();
    expect(expectedReadyLabelFromEvents([ev({ toStatus: 'CANCELLED' })], 1)).toBeNull();
    expect(expectedReadyLabelFromEvents([ev({ toStatus: 'SUBMITTED' })], null)).toBeNull();
  });
});

describe('requestParamsRows: поля формы типа без служебных ключей', () => {
  const formSchema = {
    keyField: 'purpose',
    fields: [
      {
        key: 'purpose',
        label: 'Назначение',
        type: 'enum',
        required: true,
        options: ['для банка', 'для военкомата'],
      },
    ],
  };

  it('label из схемы, мета мастера не протекает в параметры', () => {
    const rows = requestParamsRows(
      { purpose: 'для военкомата', wizard: '{"language":"RU"}' },
      formSchema,
    );
    expect(rows).toEqual([{ label: 'Назначение', value: 'для военкомата' }]);
  });

  it('без схемы — ключ как label', () => {
    expect(requestParamsRows({ purpose: 'для банка' }, null)).toEqual([
      { label: 'purpose', value: 'для банка' },
    ]);
  });
});

describe('requestWizardView: мета мастера и вложения', () => {
  const wizard = JSON.stringify({
    destination: 'В банк «Северный»',
    language: 'RU',
    copies: 2,
    delivery: 'PICKUP',
    comment: 'Нужно срочно',
    attachments: [
      { name: 'scan-passport.png', size: 1258291 },
      { name: 'statement.pdf', size: 2048 },
    ],
  });

  it('читает мету в человекочитаемые строки', () => {
    const view = requestWizardView({ wizard });
    expect(view).not.toBeNull();
    expect(view!.rows).toContainEqual({ label: 'Язык', value: 'Русский' });
    expect(view!.rows).toContainEqual({
      label: 'Куда предоставляется',
      value: 'В банк «Северный»',
    });
    expect(view!.rows).toContainEqual({ label: 'Экземпляров', value: '2' });
    expect(view!.rows).toContainEqual({ label: 'Способ получения', value: 'Забрать в деканате' });
    expect(view!.rows).toContainEqual({ label: 'Комментарий', value: 'Нужно срочно' });
    expect(view!.attachments).toEqual([
      { name: 'scan-passport.png', sizeLabel: '1,2 МБ' },
      { name: 'statement.pdf', sizeLabel: '2 КБ' },
    ]);
  });

  it('нет меты мастера — null (секция не показывается)', () => {
    expect(requestWizardView({ purpose: 'для банка' })).toBeNull();
    expect(requestWizardView({})).toBeNull();
  });

  it('битый JSON — null, а не дефолтные строки', () => {
    expect(requestWizardView({ wizard: 'не json' })).toBeNull();
  });

  it('пустые поля меты не рендерятся', () => {
    const view = requestWizardView({
      wizard: JSON.stringify({
        destination: '',
        language: 'EN',
        copies: 1,
        delivery: 'PDF_ONLINE',
        comment: '',
        attachments: [],
      }),
    });
    expect(view!.rows).toEqual([
      { label: 'Язык', value: 'English' },
      { label: 'Экземпляров', value: '1' },
      { label: 'Способ получения', value: 'PDF в кабинете' },
    ]);
    expect(view!.attachments).toEqual([]);
  });
});

describe('formatAttachmentSize: размеры файлов по-человечески', () => {
  it('Б / КБ / МБ с запятой', () => {
    expect(formatAttachmentSize(512)).toBe('512 Б');
    expect(formatAttachmentSize(2048)).toBe('2 КБ');
    expect(formatAttachmentSize(1258291)).toBe('1,2 МБ');
    expect(formatAttachmentSize(15 * 1024 * 1024)).toBe('15,0 МБ');
  });
});
