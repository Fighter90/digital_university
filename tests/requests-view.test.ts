// DIG-32 — чистая логика экрана «Мои заявки»: единый словарь статусов,
// корзины фильтров со счётчиками, поиск по номеру/названию, сортировка
// «Нужна доработка наверх», степпер «Подана → … → Выдана», строка
// следующего действия и кнопка действия. Модуль lib/requests-view.ts —
// без серверных импортов (используется и сервером, и клиентом).
import { describe, expect, it } from 'vitest';

import {
  REQUEST_FILTERS,
  filterRequests,
  legacyTypeIcon,
  nextActionLine,
  requestAction,
  requestFilterCounts,
  requestIconKindForTypeCode,
  requestPipelineStep,
  requestStepperStates,
  unifyRequestStatus,
  type RequestCardView,
} from '@/lib/requests-view';
import { REQUEST_STATUS_LABELS } from '@/lib/request-labels';
import { CANONICAL_REQUEST_STATUS_LABELS } from '@/lib/request-machine';

const d = (iso: string): Date => new Date(iso);

const card = (overrides: Partial<RequestCardView> & Pick<RequestCardView, 'id' | 'status'>): RequestCardView => ({
  number: 'ЗД-2026-000001',
  title: 'Справка об обучении · для банка',
  typeName: 'Справка об обучении',
  iconKind: 'certificate',
  createdAtISO: '2026-11-10T10:00:00.000Z',
  createdAtLabel: '10 ноября, 13:00',
  readyByISO: null,
  readyByLabel: null,
  updatedAtISO: '2026-11-10T10:00:00.000Z',
  action: null,
  pipelineStep: 1,
  nextAction: 'Ожидает приёма деканатом',
  reason: null,
  isFix: false,
  ...overrides,
});

describe('unifyRequestStatus — единый словарь на входе в экран', () => {
  it('канонические статусы проходят без изменений', () => {
    expect(unifyRequestStatus('SUBMITTED')).toBe('SUBMITTED');
    expect(unifyRequestStatus('ACCEPTED')).toBe('ACCEPTED');
    expect(unifyRequestStatus('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(unifyRequestStatus('READY')).toBe('READY');
    expect(unifyRequestStatus('ISSUED')).toBe('ISSUED');
    expect(unifyRequestStatus('NEEDS_FIX')).toBe('NEEDS_FIX');
    expect(unifyRequestStatus('REJECTED')).toBe('REJECTED');
    expect(unifyRequestStatus('CANCELLED')).toBe('CANCELLED');
  });

  it('легаси-значения отображаются на канон (карта миграции DIG-49)', () => {
    expect(unifyRequestStatus('COMPLETED')).toBe('ISSUED');
    expect(unifyRequestStatus('NEEDS_REVISION')).toBe('NEEDS_FIX');
  });
});

describe('метки статусов — только единый словарь', () => {
  it('метки канона в request-labels совпадают с lib/request-machine', () => {
    for (const status of Object.keys(CANONICAL_REQUEST_STATUS_LABELS) as Array<
      keyof typeof CANONICAL_REQUEST_STATUS_LABELS
    >) {
      expect(REQUEST_STATUS_LABELS[status]).toBe(CANONICAL_REQUEST_STATUS_LABELS[status]);
    }
  });

  it('легаси-метки сохранены для старых экранов, но экран их не использует', () => {
    expect(REQUEST_STATUS_LABELS.COMPLETED).toBe('Выполнена');
    expect(REQUEST_STATUS_LABELS.NEEDS_REVISION).toBe('Требует правок');
  });
});

describe('корзины фильтров и счётчики', () => {
  const cards: RequestCardView[] = [
    card({ id: 'a', status: 'SUBMITTED' }),
    card({ id: 'b', status: 'ACCEPTED', createdAtISO: '2026-11-09T10:00:00.000Z' }),
    card({ id: 'c', status: 'IN_PROGRESS', createdAtISO: '2026-11-08T10:00:00.000Z' }),
    card({ id: 'f', status: 'NEEDS_FIX', createdAtISO: '2026-11-07T10:00:00.000Z' }),
    card({ id: 'r', status: 'READY', createdAtISO: '2026-11-06T10:00:00.000Z' }),
    card({ id: 'i', status: 'ISSUED', createdAtISO: '2026-11-05T10:00:00.000Z' }),
    card({ id: 'x', status: 'REJECTED', createdAtISO: '2026-11-04T10:00:00.000Z' }),
    card({ id: 'z', status: 'CANCELLED', createdAtISO: '2026-11-03T10:00:00.000Z' }),
  ];

  it('пилюли: Все · В работе · Нужно действие · Готовы · Архив', () => {
    expect(REQUEST_FILTERS.map((f) => f.key)).toEqual([
      'ALL',
      'IN_WORK',
      'NEEDS_ACTION',
      'READY',
      'ARCHIVE',
    ]);
    expect(REQUEST_FILTERS.map((f) => f.label)).toEqual([
      'Все',
      'В работе',
      'Нужно действие',
      'Готовы',
      'Архив',
    ]);
  });

  it('счётчики: корзины не пересекаются и в сумме дают «Все»', () => {
    const counts = requestFilterCounts(cards);
    expect(counts.ALL).toBe(8);
    expect(counts.IN_WORK).toBe(3); // SUBMITTED + ACCEPTED + IN_PROGRESS
    expect(counts.NEEDS_ACTION).toBe(1); // NEEDS_FIX
    expect(counts.READY).toBe(1);
    expect(counts.ARCHIVE).toBe(3); // ISSUED + REJECTED + CANCELLED
    expect(counts.IN_WORK + counts.NEEDS_ACTION + counts.READY + counts.ARCHIVE).toBe(counts.ALL);
  });
});

describe('фильтрация и сортировка', () => {
  const cards: RequestCardView[] = [
    card({ id: 'old-sub', status: 'SUBMITTED', createdAtISO: '2026-11-01T10:00:00.000Z', number: 'ЗД-2026-000010' }),
    card({ id: 'new-sub', status: 'SUBMITTED', createdAtISO: '2026-11-10T10:00:00.000Z', number: 'ЗД-2026-000012' }),
    card({ id: 'fix', status: 'NEEDS_FIX', createdAtISO: '2026-10-20T10:00:00.000Z', number: 'ЗД-2026-000003' }),
    card({ id: 'ready', status: 'READY', createdAtISO: '2026-11-09T10:00:00.000Z', number: 'ЗД-2026-000011' }),
    card({ id: 'issued', status: 'ISSUED', createdAtISO: '2026-11-02T10:00:00.000Z', number: 'SR-2026-A1B2C' }),
  ];

  it('NEEDS_FIX всегда наверху «Все», остальные — по свежести', () => {
    const visible = filterRequests(cards, 'ALL', '');
    expect(visible.map((c) => c.id)).toEqual(['fix', 'new-sub', 'ready', 'issued', 'old-sub']);
  });

  it('NEEDS_FIX наверху и в корзине «В работе» — нет, корзины не пересекаются', () => {
    expect(filterRequests(cards, 'IN_WORK', '').map((c) => c.id)).toEqual(['new-sub', 'old-sub']);
    expect(filterRequests(cards, 'NEEDS_ACTION', '').map((c) => c.id)).toEqual(['fix']);
    expect(filterRequests(cards, 'READY', '').map((c) => c.id)).toEqual(['ready']);
    expect(filterRequests(cards, 'ARCHIVE', '').map((c) => c.id)).toEqual(['issued']);
  });

  it('поиск по фрагменту номера без учёта регистра', () => {
    expect(filterRequests(cards, 'ALL', '000011').map((c) => c.id)).toEqual(['ready']);
    expect(filterRequests(cards, 'ALL', 'зд-2026')).toHaveLength(4);
    expect(filterRequests(cards, 'ALL', 'SR-2026').map((c) => c.id)).toEqual(['issued']);
  });

  it('поиск по подстроке названия, пробелы схлопываются', () => {
    const withTitle = card({
      id: 't',
      status: 'NEEDS_FIX',
      title: 'Справка об обучении · для военкомата',
      createdAtISO: '2026-11-11T10:00:00.000Z',
    });
    expect(filterRequests([withTitle, ...cards], 'ALL', '  военкомат  ').map((c) => c.id)).toEqual(['t']);
    expect(filterRequests([withTitle, ...cards], 'ALL', 'справка об')[0].id).toBe('t');
  });

  it('без совпадений — пустой массив', () => {
    expect(filterRequests(cards, 'ALL', 'стипендия')).toEqual([]);
  });
});

describe('степпер «Подана → Принята → В работе → Готова → Выдана»', () => {
  it('текущий шаг по статусу', () => {
    expect(requestPipelineStep('SUBMITTED')).toBe(1);
    expect(requestPipelineStep('ACCEPTED')).toBe(2);
    expect(requestPipelineStep('IN_PROGRESS')).toBe(3);
    expect(requestPipelineStep('READY')).toBe(4);
    expect(requestPipelineStep('ISSUED')).toBe(5);
  });

  it('вне конвейера: NEEDS_FIX ждёт студента на шаге 1, REJECTED/CANCELLED — null', () => {
    expect(requestPipelineStep('NEEDS_FIX')).toBe(1);
    expect(requestPipelineStep('REJECTED')).toBeNull();
    expect(requestPipelineStep('CANCELLED')).toBeNull();
  });

  it('состояния шагов: пройденные done, текущий current, READY — ready', () => {
    expect(requestStepperStates('ACCEPTED')).toEqual([
      'done',
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(requestStepperStates('READY')).toEqual(['done', 'done', 'done', 'ready', 'pending']);
    expect(requestStepperStates('ISSUED')).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(requestStepperStates('NEEDS_FIX')).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });
});

describe('строка следующего действия', () => {
  it('SLA: «Готовность до 14 ноября»', () => {
    const line = nextActionLine({
      status: 'ACCEPTED',
      readyBy: d('2026-11-14T15:00:00.000Z'),
      reason: null,
      updatedAt: d('2026-11-10T10:00:00.000Z'),
    });
    expect(line).toBe('Готовность до 14 ноября');
  });

  it('NEEDS_FIX — причина доработки', () => {
    expect(
      nextActionLine({
        status: 'NEEDS_FIX',
        readyBy: null,
        reason: 'Укажите ФИО латиницей',
        updatedAt: d('2026-11-10T10:00:00.000Z'),
      }),
    ).toBe('Нужна доработка: Укажите ФИО латиницей');
  });

  it('REJECTED — причина отказа', () => {
    expect(
      nextActionLine({
        status: 'REJECTED',
        readyBy: null,
        reason: 'Приказ уже утверждён',
        updatedAt: d('2026-11-10T10:00:00.000Z'),
      }),
    ).toBe('Отклонено: Приказ уже утверждён');
  });

  it('READY / ISSUED / CANCELLED', () => {
    expect(
      nextActionLine({ status: 'READY', readyBy: null, reason: null, updatedAt: d('2026-11-10T10:00:00.000Z') }),
    ).toBe('Документ готов к скачиванию');
    expect(
      nextActionLine({ status: 'ISSUED', readyBy: null, reason: null, updatedAt: d('2026-11-12T14:00:00.000Z') }),
    ).toContain('Выдан');
    expect(
      nextActionLine({ status: 'CANCELLED', readyBy: null, reason: null, updatedAt: d('2026-11-12T14:00:00.000Z') }),
    ).toContain('Отменена');
  });

  it('без SLA — понятная очередь вместо пустой строки', () => {
    expect(
      nextActionLine({ status: 'SUBMITTED', readyBy: null, reason: null, updatedAt: d('2026-11-10T10:00:00.000Z') }),
    ).toBe('Ожидает приёма деканатом');
    expect(
      nextActionLine({ status: 'IN_PROGRESS', readyBy: null, reason: null, updatedAt: d('2026-11-10T10:00:00.000Z') }),
    ).toBe('Деканат готовит документ');
  });
});

describe('кнопка действия по статусу (машина состояний DIG-30)', () => {
  it('READY — скачать, NEEDS_FIX — исправить, до IN_PROGRESS — отменить', () => {
    expect(requestAction('READY')).toBe('DOWNLOAD');
    expect(requestAction('NEEDS_FIX')).toBe('FIX');
    expect(requestAction('SUBMITTED')).toBe('CANCEL');
    expect(requestAction('ACCEPTED')).toBe('CANCEL');
  });

  it('после IN_PROGRESS отмена запрещена, терминальные — без действий', () => {
    expect(requestAction('IN_PROGRESS')).toBeNull();
    expect(requestAction('ISSUED')).toBeNull();
    expect(requestAction('REJECTED')).toBeNull();
    expect(requestAction('CANCELLED')).toBeNull();
  });
});

describe('иконки типов — никакой абстракции «другое» для документа', () => {
  it('канонический тип по префиксу кода', () => {
    expect(requestIconKindForTypeCode('CERT_ENROLLMENT')).toBe('certificate');
    expect(requestIconKindForTypeCode('GRADES_EXTRACT')).toBe('grades');
    expect(requestIconKindForTypeCode('DIPLOMA_COPY')).toBe('diploma');
    expect(requestIconKindForTypeCode('ACADEMIC_LEAVE')).toBe('statement');
    expect(requestIconKindForTypeCode('UNKNOWN_KIND')).toBe('certificate');
  });

  it('легаси-тип', () => {
    expect(legacyTypeIcon('CERTIFICATE')).toBe('certificate');
    expect(legacyTypeIcon('STATEMENT')).toBe('statement');
    expect(legacyTypeIcon('PRACTICE')).toBe('practice');
    expect(legacyTypeIcon('DORMITORY')).toBe('dormitory');
    expect(legacyTypeIcon('OTHER')).toBe('other');
  });
});
