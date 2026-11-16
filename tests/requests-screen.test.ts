// DIG-32 — агрегатор экрана «Мои заявки» на РЕАЛЬНЫХ демо-данных.
//
// Приёмка задачи: ни одной заявки с обезличенным названием; статусы —
// только из единого словаря (8 значений канона); «Нужна доработка» с
// причиной из задачи; пилюли-корзины Анны покрыты всеми статусами;
// сотруднику список недоступен ([] + аудит ROLE_MISMATCH).
import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { seedDemoData } from '@/server/data/demo-seed';
import { toDataCtx } from '@/server/data/context';
import { getRequestsScreen } from '@/server/data/requests-screen';
import { CANONICAL_REQUEST_STATUSES } from '@/lib/request-machine';
import { requestFilterCounts, filterRequests } from '@/lib/requests-view';
import type { DataCtx } from '@/server/data/types';
import type { AuthUser } from '@/server/auth/types';

const stubAuthStore = { selection: { kind: 'memory', store: {}, rateLimiter: {} } } as never;

let db: MemoryDataDb;
let anna: DataCtx;
let maria: DataCtx;

const asUser = (id: string, login: string, role: AuthUser['role']): AuthUser =>
  ({ id, login, role, displayName: login }) as AuthUser;

beforeEach(async () => {
  db = createMemoryDataDb();
  await seedDemoData(db, stubAuthStore);
  const annaCtx = await toDataCtx(asUser('auth-anna', 'anna.smirnova', 'STUDENT'), db);
  const mariaCtx = await toDataCtx(asUser('auth-dean', 'dean.kovaleva', 'STAFF'), db);
  if (!annaCtx || !mariaCtx) throw new Error('demo ctx missing');
  anna = annaCtx;
  maria = mariaCtx;
});

describe('getRequestsScreen — демо-данные Анны', () => {
  it('все пилюли покрыты: Все=5, В работе=2, Нужно действие=1, Готовы=1, Архив=1', async () => {
    const { cards } = await getRequestsScreen(db, anna);
    expect(cards).toHaveLength(5);

    const counts = requestFilterCounts(cards);
    expect(counts.ALL).toBe(5);
    expect(counts.IN_WORK).toBe(2); // ЗД-диплом SUBMITTED + общежитие IN_PROGRESS
    expect(counts.NEEDS_ACTION).toBe(1); // «для военкомата» NEEDS_FIX
    expect(counts.READY).toBe(1); // «для банка» READY
    expect(counts.ARCHIVE).toBe(1); // налоговая ISSUED
  });

  it('«Нужна доработка» с причиной из задачи — строка и статус канона', async () => {
    const { cards } = await getRequestsScreen(db, anna);
    const fix = cards.find((card) => card.status === 'NEEDS_FIX');
    expect(fix).toBeDefined();
    expect(fix!.title).toBe('Справка об обучении · для военкомата');
    expect(fix!.nextAction).toBe('Нужна доработка: Укажите ФИО латиницей');
    expect(fix!.action).toBe('FIX');
    expect(fix!.isFix).toBe(true);
    expect(filterRequests(cards, 'ALL', '')[0]!.id).toBe(fix!.id); // всегда наверху
  });

  it('готовая заявка ведёт к скачиванию PDF и строке готовности', async () => {
    const { cards } = await getRequestsScreen(db, anna);
    const ready = cards.find((card) => card.status === 'READY');
    expect(ready).toBeDefined();
    expect(ready!.action).toBe('DOWNLOAD');
    expect(ready!.nextAction).toBe('Документ готов к скачиванию');
    expect(ready!.readyByISO).toBeNull(); // SLA-обещание готовым не показывается
  });

  it('движущиеся по конвейеру канонические заявки обещают «Готовность до …»', async () => {
    const { cards } = await getRequestsScreen(db, anna);
    for (const card of cards) {
      if (!['SUBMITTED', 'ACCEPTED', 'IN_PROGRESS'].includes(card.status)) continue;
      if (card.number.startsWith('ЗД-')) {
        // Канонические: SLA по etaDays типа из словаря.
        expect(card.nextAction, card.number).toMatch(/^Готовность до \d{1,2} \S+$/);
        expect(card.readyByISO).not.toBeNull();
      } else {
        // Legacy (SR-…) SLA не имеет — понятная очередь вместо пустой строки.
        expect(card.readyByISO, card.number).toBeNull();
        expect(card.nextAction.length, card.number).toBeGreaterThan(0);
      }
    }
  });

  it('приёмка: ни одной заявки с обезличенным названием', async () => {
    const { cards } = await getRequestsScreen(db, anna);
    for (const card of cards) {
      // Название отличается от голого имени типа и несёт конкретику.
      expect(card.title, card.number).not.toBe(card.typeName);
      expect(card.title.trim().length, card.number).toBeGreaterThan(card.typeName.length);
    }
    // Канонические — всегда «тип · ключевой параметр».
    for (const card of cards) {
      if (card.number.startsWith('ЗД-')) expect(card.title, card.number).toContain(' · ');
    }
  });

  it('приёмка: статусы — только из единого словаря (8 значений канона)', async () => {
    const { cards } = await getRequestsScreen(db, anna);
    for (const card of cards) {
      expect(CANONICAL_REQUEST_STATUSES, card.number).toContain(card.status);
    }
  });

  it('SLA считается в рабочих днях от подачи (тип словаря), не от выдуманной константы', async () => {
    const { cards } = await getRequestsScreen(db, anna);
    const diploma = cards.find((card) => card.title.startsWith('Дубликат диплома'))!;
    expect(diploma).toBeDefined();
    const ready = new Date(diploma.readyByISO!);
    const created = new Date(diploma.createdAtISO);
    // etaDays=5: разница календарная, но ни готовность, ни подача — не выходные.
    expect(ready.getTime()).toBeGreaterThan(created.getTime());
    expect([6, 0]).not.toContain(ready.getDay());
  });
});

describe('getRequestsScreen — Илья и сотрудник', () => {
  it('Илья видит только свои заявки в едином словаре (legacy SR- + канон ЗД-)', async () => {
    const ilyaCtx = await toDataCtx(asUser('auth-ilya', 'ilya.petrov', 'STUDENT'), db);
    if (!ilyaCtx) throw new Error('ilya ctx missing');
    const { cards } = await getRequestsScreen(db, ilyaCtx);
    // DIG-33: +3 канонические заявки Ильи (READY мгновенная, NEEDS_FIX,
    // SUBMITTED бумажная) — мир мутационных e2e карточки.
    expect(cards).toHaveLength(6);
    const legacy = cards.filter((card) => card.number.startsWith('SR-'));
    expect(legacy).toHaveLength(3);
    for (const card of legacy) {
      expect(CANONICAL_REQUEST_STATUSES).toContain(card.status);
    }
    // REJECTED остался в архиве с причиной отказа.
    const rejected = legacy.find((card) => card.status === 'REJECTED')!;
    expect(rejected).toBeDefined();
    expect(rejected.nextAction).toContain('Перенос невозможен');
    expect(rejected.action).toBeNull();
  });

  it('сотруднику — пусто и с аудитом ROLE_MISMATCH на каждом чтении', async () => {
    const { cards } = await getRequestsScreen(db, maria);
    expect(cards).toEqual([]);
    const denied = db
      .auditEvents()
      .filter((event) => event.reason === 'ROLE_MISMATCH' && event.resourceRef === 'list');
    expect(denied.length).toBeGreaterThanOrEqual(2); // канон + legacy
  });
});
