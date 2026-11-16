// DIG-45 — скоуп серверного поиска searchCabinet (IDOR-контракт).
// На memory-db с фиксированными номерами заявок пиним: свои заявки по номеру
// и названию, чужой номер не находится, дисциплины и преподаватели — своей
// группы, «Люди» — только уже видимые студенту имена, сотруднику — нет
// студенческих групп. Плюс приёмка по производительности (< 200 мс).
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import { searchCabinet } from '@/server/data/search';
import type { AuthUser } from '@/server/auth/types';
import type { DataCtx } from '@/server/data/types';

const ANNA_NUMBER = 'SR-2026-A1B2C';
const ILYA_NUMBER = 'SR-2026-Z9Y8X';

const annaUser: AuthUser = { id: 'auth-anna', login: 'anna', role: 'STUDENT' };
const ilyaUser: AuthUser = { id: 'auth-ilya', login: 'ilya', role: 'STUDENT' };
const mariaUser: AuthUser = { id: 'auth-maria', login: 'maria', role: 'STAFF' };

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

const groupOf = (result: Awaited<ReturnType<typeof searchCabinet>>, kind: string) =>
  result.groups.find((g) => g.kind === kind) ?? null;

beforeAll(async () => {
  db = createMemoryDataDb();
  db.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna',
        fullName: 'Анна Ковалёва',
        email: 'anna@example.edu',
        groupName: 'ПИ-21',
        course: 2,
        faculty: 'ИТ',
        program: 'Прикладная информатика',
        programCode: '09.03.04',
        studyForm: 'очная',
        funding: 'бюджет',
        gradebookNumber: '20231234',
      },
      {
        id: 'st-ilya',
        login: 'ilya',
        fullName: 'Илья Смирнов',
        email: 'ilya@example.edu',
        groupName: 'ЭК-11',
        course: 1,
        faculty: 'ЭК',
        program: 'Экономика',
        programCode: '38.03.01',
        studyForm: 'очная',
        funding: 'контракт',
        gradebookNumber: '20254567',
      },
    ],
    staff: [
      {
        id: 'stf-maria',
        login: 'maria',
        fullName: 'Мария Петрова',
        position: 'Специалист деканата',
        email: 'maria@example.edu',
        faculty: 'ИТ',
      },
    ],
    requests: [
      {
        id: 'req-anna-1',
        studentId: 'st-anna',
        number: ANNA_NUMBER,
        type: 'CERTIFICATE',
        title: 'Справка об обучении для налоговой',
        status: 'COMPLETED',
        assignee: 'Мария Петрова',
        resultNote: null,
        createdAt: new Date('2026-11-01T10:00:00Z'),
        updatedAt: new Date('2026-11-02T12:00:00Z'),
      },
      {
        id: 'req-ilya-1',
        studentId: 'st-ilya',
        number: ILYA_NUMBER,
        type: 'STATEMENT',
        title: 'Заявление на академический отпуск',
        status: 'SUBMITTED',
        assignee: null,
        resultNote: null,
        createdAt: new Date('2026-11-03T10:00:00Z'),
        updatedAt: new Date('2026-11-04T12:00:00Z'),
      },
    ],
    requestEvents: [],
    disciplines: [
      {
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-PROG',
        disciplineName: 'Программирование',
        credits: 6,
        teacherName: 'Иванова Ирина Игоревна',
      },
      {
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-INFO',
        disciplineName: 'Информатика',
        credits: 4,
        teacherName: 'Петров Пётр Петрович',
      },
      {
        groupName: 'ЭК-11',
        disciplineCode: 'EK11-MATH',
        disciplineName: 'Математический анализ',
        credits: 5,
        teacherName: 'Кузнецова Ксения Кирилловна',
      },
    ],
  });
  anna = (await toDataCtx(annaUser, db))!;
  ilya = (await toDataCtx(ilyaUser, db))!;
  maria = (await toDataCtx(mariaUser, db))!;
});

describe('приёмка: «номер заявки → заявка, ФИО → человек, «справка» → действие и статья»', () => {
  it('«справка» находит действие, статью FAQ и свою заявку Анны', async () => {
    const result = await searchCabinet(db, anna, 'справка');
    const actions = groupOf(result, 'action');
    expect(actions?.hits.some((h) => h.href === '/requests?order=cert-enrollment')).toBe(true);
    const faq = groupOf(result, 'faq');
    expect(faq?.hits.length ?? 0).toBeGreaterThan(0);
    const requests = groupOf(result, 'request');
    expect(requests?.hits.some((h) => h.href === `/requests/${ANNA_NUMBER}`)).toBe(true);
  });

  it('полный номер заявки находит заявку, частичный — тоже', async () => {
    const full = await searchCabinet(db, anna, ANNA_NUMBER);
    expect(groupOf(full, 'request')?.hits[0]?.href).toBe(`/requests/${ANNA_NUMBER}`);
    const partial = await searchCabinet(db, anna, 'SR-2026-A1B');
    expect(groupOf(partial, 'request')?.hits[0]?.href).toBe(`/requests/${ANNA_NUMBER}`);
    const hash = await searchCabinet(db, anna, `#${ANNA_NUMBER.toLowerCase()}`);
    expect(groupOf(hash, 'request')?.hits[0]?.href).toBe(`/requests/${ANNA_NUMBER}`);
  });

  it('ФИО преподавателя находит человека с честным переходом', async () => {
    const result = await searchCabinet(db, anna, 'Иванова');
    const people = groupOf(result, 'person');
    expect(people?.hits[0]?.title).toBe('Иванова Ирина Игоревна');
    expect(people?.hits[0]?.href).toBe('/schedule');
  });

  it('своё ФИО находит свой профиль (без чужих людей)', async () => {
    const result = await searchCabinet(db, anna, 'Анна Ковалёва');
    const people = groupOf(result, 'person');
    expect(people?.hits.map((h) => h.href)).toEqual(['/profile']);
  });

  it('ФИО исполнителя заявки (деканат) тоже находится', async () => {
    const result = await searchCabinet(db, anna, 'Мария Петрова');
    const people = groupOf(result, 'person');
    expect(people?.hits.some((h) => h.href === '/deanery')).toBe(true);
  });
});

describe('IDOR: чужие данные через поиск недостижимы', () => {
  it('Илья не находит заявку Анны ни по номеру, ни по названию', async () => {
    const byNumber = await searchCabinet(db, ilya, ANNA_NUMBER);
    expect(groupOf(byNumber, 'request')).toBeNull();
    const byTitle = await searchCabinet(db, ilya, 'налоговой');
    expect(groupOf(byTitle, 'request')).toBeNull();
    // но свою — находит
    const own = await searchCabinet(db, ilya, ILYA_NUMBER);
    expect(groupOf(own, 'request')?.hits[0]?.href).toBe(`/requests/${ILYA_NUMBER}`);
  });

  it('полный чужой номер попадает в AuditLog как OWNERSHIP_DENIED (DIG-45 р2)', async () => {
    const before = db.auditEvents().length;
    const result = await searchCabinet(db, ilya, ANNA_NUMBER);
    expect(groupOf(result, 'request')).toBeNull();
    const events = db.auditEvents();
    expect(events.length).toBe(before + 1);
    const event = events.at(-1)!;
    expect(event.reason).toBe('OWNERSHIP_DENIED');
    expect(event.outcome).toBe('DENIED');
    expect(event.resourceType).toBe('request');
    expect(event.resourceRef).toBe(ANNA_NUMBER);
    expect(event.actorLogin).toBe('ilya');
    // ответ снаружи тот же, что при несуществующем номере: групп заявок нет
    const missing = await searchCabinet(db, ilya, 'SR-2026-XXXXX');
    expect(groupOf(missing, 'request')).toBeNull();
  });

  it('частичный чужой номер и свой полный номер — без новых DENIED-записей', async () => {
    const before = db.auditEvents().filter((e) => e.outcome === 'DENIED').length;
    await searchCabinet(db, ilya, 'SR-2026-A1B');
    await searchCabinet(db, ilya, ILYA_NUMBER);
    await searchCabinet(db, anna, ANNA_NUMBER);
    expect(db.auditEvents().filter((e) => e.outcome === 'DENIED').length).toBe(before);
  });

  it('сотрудник с полным номером заявки студента — ROLE_MISMATCH в аудите', async () => {
    const before = db.auditEvents().length;
    const result = await searchCabinet(db, maria, ANNA_NUMBER);
    expect(groupOf(result, 'request')).toBeNull();
    const event = db.auditEvents().at(-1)!;
    expect(db.auditEvents().length).toBe(before + 1);
    expect(event.reason).toBe('ROLE_MISMATCH');
    expect(event.resourceRef).toBe(ANNA_NUMBER);
  });

  it('преподаватели чужой группы не находятся', async () => {
    const result = await searchCabinet(db, ilya, 'Иванова');
    expect(groupOf(result, 'person')).toBeNull();
    const own = await searchCabinet(db, ilya, 'Кузнецова');
    expect(groupOf(own, 'person')?.hits[0]?.href).toBe('/schedule');
  });

  it('дисциплины чужой группы не находятся', async () => {
    const result = await searchCabinet(db, ilya, 'программ');
    expect(groupOf(result, 'discipline')).toBeNull();
  });
});

describe('скоуп остальных групп', () => {
  it('дисциплины своей группы ведут на карточку дисциплины', async () => {
    const result = await searchCabinet(db, anna, 'программ');
    const disciplines = groupOf(result, 'discipline');
    expect(disciplines?.hits[0]?.href).toBe('/grades/PI21-PROG');
    expect(disciplines?.hits[0]?.subtitle).toContain('Иванова');
  });

  it('разделы кабинета находятся по названию', async () => {
    const result = await searchCabinet(db, anna, 'уведомл');
    expect(groupOf(result, 'section')?.hits[0]?.href).toBe('/notifications');
    const settings = await searchCabinet(db, anna, 'настройки');
    expect(groupOf(settings, 'section')?.hits[0]?.href).toBe('/settings');
  });

  it('новости деканата и FAQ по «стипендия» находятся вместе', async () => {
    const result = await searchCabinet(db, anna, 'стипендия');
    expect(groupOf(result, 'news')?.hits.length ?? 0).toBeGreaterThan(0);
    expect(groupOf(result, 'faq')?.hits.length ?? 0).toBeGreaterThan(0);
  });

  it('запрос короче двух символов не даёт результатов', async () => {
    const result = await searchCabinet(db, anna, 'с');
    expect(result.groups).toEqual([]);
  });
});

describe('staff-скоуп: студенческих групп нет', () => {
  it('сотруднику не отдаются Дисциплины, Заявки, Люди', async () => {
    for (const q of ['справка', 'базы данных', 'Анна', 'SR-2026']) {
      const result = await searchCabinet(db, maria, q);
      expect(groupOf(result, 'discipline'), q).toBeNull();
      expect(groupOf(result, 'request'), q).toBeNull();
      expect(groupOf(result, 'person'), q).toBeNull();
    }
  });

  it('сотруднику доступны действия его роли и общие группы', async () => {
    const result = await searchCabinet(db, maria, 'расписания');
    expect(groupOf(result, 'action')?.hits[0]?.href).toBe('/schedule');
    const news = await searchCabinet(db, maria, 'стипендия');
    expect(groupOf(news, 'news')?.hits.length ?? 0).toBeGreaterThan(0);
    // студенческие справки сотруднику в действиях не показываются
    const cert = await searchCabinet(db, maria, 'справка');
    expect(groupOf(cert, 'action')).toBeNull();
  });
});

describe('производительность (приёмка < 200 мс)', () => {
  it('поиск «справка» на сидовых данных выполняется быстрее 200 мс', async () => {
    const started = performance.now();
    const result = await searchCabinet(db, anna, 'справка');
    const elapsed = performance.now() - started;
    expect(result.groups.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });

  it('поиск по номеру заявки — тоже быстрее 200 мс', async () => {
    const started = performance.now();
    await searchCabinet(db, anna, ANNA_NUMBER);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
