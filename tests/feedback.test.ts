// DIG-40 — контракт канала обратной связи «Предложение или жалоба
// руководству» (red-first). Приёмка: пункт меню с понятным названием
// (покрыт в cabinet-shell), типы Предложение/Жалоба/Благодарность, адресаты
// Деканат/Учебный офис/Руководство программы/Руководство вуза, анонимное
// обращение НЕ хранит связь с пользователем (ни в хранилище, ни в ответах),
// после отправки — номер и срок ответа, публичная лента решённых предложений.
import { beforeAll, describe, expect, it } from 'vitest';

import {
  ANONYMOUS_EXPLANATION_OFF,
  ANONYMOUS_EXPLANATION_ON,
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_RESPONSE_DAYS,
  FEEDBACK_RESPONSE_PROMISE,
  FEEDBACK_TARGETS,
  FEEDBACK_TARGET_LABELS,
  FEEDBACK_VIEW_STATUS_LABELS,
  feedbackViewStatus,
  formatFeedbackDueAt,
} from '@/lib/feedback';
import {
  createFeedback,
  getFeedbackPage,
  getFeedbackSentView,
  openFeedbackCard,
} from '@/server/data/feedback';
import {
  isValidFeedbackNumber,
  newFeedbackNumber,
  normalizeFeedbackNumber,
  FEEDBACK_NUMBER_PATTERN,
} from '@/server/data/feedback-number';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { addWorkingDays } from '@/lib/request-sla';
import type { DataCtx, FeedbackRow } from '@/server/data/types';

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

const at = (minutes: number): Date => new Date(2026, 10, 16, 10, minutes, 0);

const feedbackSeed = (overrides: Partial<FeedbackRow> = {}): FeedbackRow => ({
  id: 'fb-seed',
  studentId: 'st-anna',
  number: 'FB-2026-AAA01',
  kind: 'SUGGESTION',
  target: 'DEANERY',
  status: 'NEW',
  text: 'Добавьте фильтр по корпусу в расписание',
  attachments: [],
  isAnonymous: false,
  publishedOutcome: null,
  createdAt: at(-30),
  dueAt: addWorkingDays(at(-30), FEEDBACK_RESPONSE_DAYS),
  updatedAt: at(-30),
  ...overrides,
});

beforeAll(() => {
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
    feedback: [
      // Подписанные обращения владельцев.
      feedbackSeed({
        id: 'fb-anna-1',
        number: 'FB-2026-AAA01',
        createdAt: at(-30),
        updatedAt: at(-30),
      }),
      feedbackSeed({
        id: 'fb-anna-2',
        number: 'FB-2026-BBB02',
        kind: 'GRATITUDE',
        target: 'PROGRAM_MANAGEMENT',
        status: 'ANSWERED',
        text: 'Спасибо за консультации перед сессией',
        createdAt: at(-50),
        updatedAt: at(-20),
      }),
      feedbackSeed({
        id: 'fb-ilya-1',
        studentId: 'st-ilya',
        number: 'FB-2026-CCC03',
        kind: 'COMPLAINT',
        target: 'UNIVERSITY_MANAGEMENT',
        text: 'Проектор в ауд. 12 не работает',
        createdAt: at(-40),
        updatedAt: at(-40),
      }),
      // Анонимное обращение: НИКАКОЙ связи с пользователем.
      feedbackSeed({
        id: 'fb-anon-1',
        studentId: null,
        isAnonymous: true,
        number: 'FB-2026-DDD04',
        target: 'ACADEMIC_OFFICE',
        createdAt: at(-25),
        updatedAt: at(-25),
      }),
      // Публичная лента решённых предложений: общая, без авторов.
      feedbackSeed({
        id: 'fb-out-1',
        studentId: null,
        isAnonymous: true,
        number: 'FB-2026-OUT01',
        status: 'RESOLVED',
        text: 'Сделайте запись к специалисту деканата из кабинета',
        publishedOutcome: 'Запись появилась в разделе «Связь с деканатом»',
        createdAt: at(-5000),
        updatedAt: at(-1000),
      }),
      feedbackSeed({
        id: 'fb-out-2',
        studentId: null,
        isAnonymous: true,
        number: 'FB-2026-OUT02',
        status: 'RESOLVED',
        target: 'ACADEMIC_OFFICE',
        text: 'Показывайте срок готовности справок при заказе',
        publishedOutcome: 'Срок готовности виден при заказе заявки',
        createdAt: at(-4000),
        updatedAt: at(-900),
      }),
      feedbackSeed({
        id: 'fb-out-3',
        studentId: null,
        isAnonymous: true,
        number: 'FB-2026-OUT03',
        target: 'UNIVERSITY_MANAGEMENT',
        status: 'RESOLVED',
        text: 'Добавьте фильтр по корпусу в расписание',
        publishedOutcome: 'В расписании появился выбор корпуса',
        createdAt: at(-3000),
        updatedAt: at(-800),
      }),
    ],
  });

  anna = {
    userId: 'auth-anna',
    login: 'anna',
    role: 'STUDENT',
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  };
  ilya = {
    ...anna,
    userId: 'auth-ilya',
    login: 'ilya',
    studentId: 'st-ilya',
    groupName: 'ЭК-11',
    faculty: 'ЭК',
  };
  maria = {
    ...anna,
    userId: 'auth-dean',
    login: 'maria',
    role: 'STAFF',
    studentId: null,
    groupName: null,
  };
});

describe('lib/feedback — словари канала', () => {
  it('типы обращения из задачи: Предложение, Жалоба, Благодарность', () => {
    expect(FEEDBACK_KINDS).toEqual(['SUGGESTION', 'COMPLAINT', 'GRATITUDE']);
    expect(FEEDBACK_KIND_LABELS.SUGGESTION).toBe('Предложение');
    expect(FEEDBACK_KIND_LABELS.COMPLAINT).toBe('Жалоба');
    expect(FEEDBACK_KIND_LABELS.GRATITUDE).toBe('Благодарность');
  });

  it('адресаты из задачи: Деканат, Учебный офис, Руководство программы, Руководство вуза', () => {
    expect(FEEDBACK_TARGETS).toEqual([
      'DEANERY',
      'ACADEMIC_OFFICE',
      'PROGRAM_MANAGEMENT',
      'UNIVERSITY_MANAGEMENT',
    ]);
    expect(FEEDBACK_TARGET_LABELS.DEANERY).toBe('Деканат');
    expect(FEEDBACK_TARGET_LABELS.ACADEMIC_OFFICE).toBe('Учебный офис');
    expect(FEEDBACK_TARGET_LABELS.PROGRAM_MANAGEMENT).toBe('Руководство программы');
    expect(FEEDBACK_TARGET_LABELS.UNIVERSITY_MANAGEMENT).toBe('Руководство вуза');
  });

  it('статусы: три видимых значения, внутренние маппятся чистой функцией', () => {
    expect(feedbackViewStatus('NEW')).toBe('NEW');
    expect(feedbackViewStatus('IN_REVIEW')).toBe('NEW');
    expect(feedbackViewStatus('ANSWERED')).toBe('ANSWERED');
    expect(feedbackViewStatus('RESOLVED')).toBe('RESOLVED');
    expect(FEEDBACK_VIEW_STATUS_LABELS.NEW).toBe('На рассмотрении');
    expect(FEEDBACK_VIEW_STATUS_LABELS.ANSWERED).toBe('Отвечено');
    expect(FEEDBACK_VIEW_STATUS_LABELS.RESOLVED).toBe('Решено');
  });

  it('обещание срока ответа — 3 рабочих дня, dueAt считается по рабочим дням', () => {
    expect(FEEDBACK_RESPONSE_DAYS).toBe(3);
    expect(FEEDBACK_RESPONSE_PROMISE).toContain('3 рабочих дней');
    // Пятница + 3 рабочих дня = среда (выходные пропускаются).
    const friday = new Date(2026, 10, 20, 12, 0); // 2026-11-20 — пятница
    const due = addWorkingDays(friday, FEEDBACK_RESPONSE_DAYS);
    expect(due.getDay()).not.toBe(0);
    expect(due.getDay()).not.toBe(6);
    expect(due.getDate()).toBe(25);
  });

  it('объяснения анонимности называют, что увидит адресат', () => {
    expect(ANONYMOUS_EXPLANATION_ON).toContain('без вашего имени');
    expect(ANONYMOUS_EXPLANATION_ON).toContain('не связано с вашим аккаунтом');
    expect(ANONYMOUS_EXPLANATION_OFF).toContain('имя');
  });

  it('срок ответа форматируется «до ДД месяца»', () => {
    expect(formatFeedbackDueAt(new Date(2026, 10, 25, 12, 0))).toBe('до 25 ноября');
  });
});

describe('feedback-number — публичный номер FB-ГГГГ-XXXXX', () => {
  it('формат и детерминированная генерация', () => {
    expect(FEEDBACK_NUMBER_PATTERN.test('FB-2026-AB12C')).toBe(true);
    expect(FEEDBACK_NUMBER_PATTERN.test('TS-2026-AB12C')).toBe(false);
    const seeded = () => 0;
    expect(newFeedbackNumber(seeded, new Date(2026, 10, 16))).toBe('FB-2026-AAAAA');
  });

  it('нормализация ввода и валидация', () => {
    expect(normalizeFeedbackNumber(' #fb-2026-ab12c ')).toBe('FB-2026-AB12C');
    expect(isValidFeedbackNumber('FB-2026-AB12C')).toBe(true);
    expect(isValidFeedbackNumber('мусор')).toBe(false);
  });
});

describe('слой данных feedback — список и лента', () => {
  it('список owner-scoped: Анна видит только свои, анонимные не видны никому', async () => {
    const page = await getFeedbackPage(db, anna);
    expect(page.items.map((f) => f.number).sort()).toEqual(['FB-2026-AAA01', 'FB-2026-BBB02']);
    expect(page.items[0]?.number).toBe('FB-2026-BBB02'); // свежие сверху

    const ilyaPage = await getFeedbackPage(db, ilya);
    expect(ilyaPage.items.map((f) => f.number)).toEqual(['FB-2026-CCC03']);
    expect(ilyaPage.items[0]?.kind).toBe('COMPLAINT');
  });

  it('публичная лента: ровно решённые предложения с результатом, без авторов', async () => {
    const page = await getFeedbackPage(db, anna);
    expect(page.feed.map((f) => f.number).sort()).toEqual([
      'FB-2026-OUT01',
      'FB-2026-OUT02',
      'FB-2026-OUT03',
    ]);
    for (const item of page.feed) {
      expect(item.outcome.length).toBeGreaterThan(0);
      expect(item).not.toHaveProperty('studentId');
    }
  });

  it('сотруднику список недоступен: пусто + аудит ROLE_MISMATCH', async () => {
    const page = await getFeedbackPage(db, maria);
    expect(page.items).toEqual([]);
    expect(page.feed).toEqual([]);
    expect(
      db.auditEvents().some((e) => e.resourceType === 'feedback' && e.reason === 'ROLE_MISMATCH'),
    ).toBe(true);
  });
});

describe('слой данных feedback — создание', () => {
  it('подписанное обращение: владелец записан, номер и срок ответа', async () => {
    const now = at(0);
    const result = await createFeedback(db, anna, {
      kind: 'SUGGESTION',
      target: 'DEANERY',
      text: 'Добавьте электронную очередь в деканат',
      attachments: ['скрин-очереди.png'],
      isAnonymous: false,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feedback.studentId).toBe('st-anna');
    expect(result.feedback.isAnonymous).toBe(false);
    expect(FEEDBACK_NUMBER_PATTERN.test(result.feedback.number)).toBe(true);
    expect(result.feedback.status).toBe('NEW');
    expect(result.feedback.dueAt).toEqual(addWorkingDays(now, FEEDBACK_RESPONSE_DAYS));
    expect(result.feedback.attachments).toEqual(['скрин-очереди.png']);
  });

  it('АНОНИМНОЕ обращение: связи с пользователем нет нигде (приёмка)', async () => {
    const result = await createFeedback(db, anna, {
      kind: 'COMPLAINT',
      target: 'UNIVERSITY_MANAGEMENT',
      text: 'Прошу обратить внимание на состояние аудиторий',
      attachments: [],
      isAnonymous: true,
      now: at(1),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ни в хранилище, ни в ответе слоя данных нет пользовательских полей.
    expect(result.feedback.studentId).toBeNull();
    expect(result.feedback.isAnonymous).toBe(true);
    const stored = await db.probeFeedbackByNumber(result.feedback.number);
    expect(stored?.studentId).toBeNull();
    // В список автора анонимное не попадает.
    const page = await getFeedbackPage(db, anna);
    expect(page.items.map((f) => f.number)).not.toContain(result.feedback.number);
  });

  it('белые списки, границы текста и лимиты вложений', async () => {
    const base = {
      kind: 'SUGGESTION' as const,
      target: 'DEANERY' as const,
      text: 'Нормальный текст обращения',
      attachments: [] as string[],
      isAnonymous: false,
    };
    await expect(
      createFeedback(db, anna, { ...base, kind: 'HACK' as never }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      createFeedback(db, anna, { ...base, target: 'RECTOR' as never }),
    ).resolves.toMatchObject({ ok: false });
    await expect(createFeedback(db, anna, { ...base, text: '   ' })).resolves.toMatchObject({
      ok: false,
    });
    await expect(
      createFeedback(db, anna, { ...base, text: 'x'.repeat(2001) }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      createFeedback(db, anna, {
        ...base,
        attachments: ['a.png', 'b.png', 'c.png', 'd.png'],
      }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      createFeedback(db, anna, { ...base, attachments: [`${'д'.repeat(81)}.png`] }),
    ).resolves.toMatchObject({ ok: false });
  });

  it('сотруднику создать нельзя: отказ + аудит ROLE_MISMATCH', async () => {
    const before = db.auditEvents().length;
    const result = await createFeedback(db, maria, {
      kind: 'SUGGESTION',
      target: 'DEANERY',
      text: 'Проверка',
      attachments: [],
      isAnonymous: false,
    });
    expect(result.ok).toBe(false);
    expect(db.auditEvents().length).toBeGreaterThan(before);
  });
});

describe('слой данных feedback — карточка по номеру', () => {
  it('своя карточка открывается, чужая и несуществующая — одинаковый null + аудит', async () => {
    const own = await openFeedbackCard(db, anna, 'FB-2026-AAA01');
    expect(own?.number).toBe('FB-2026-AAA01');

    const before = db.auditEvents().length;
    expect(await openFeedbackCard(db, anna, 'FB-2026-CCC03')).toBeNull(); // чужой
    expect(await openFeedbackCard(db, anna, 'FB-2026-ZZZ99')).toBeNull(); // несуществующий
    const events = db.auditEvents().slice(before);
    expect(events.map((e) => e.reason).sort()).toEqual(['NOT_FOUND', 'OWNERSHIP_DENIED']);
    for (const event of events) {
      expect(event.resourceType).toBe('feedback');
    }
  });

  it('карточка АНОНИМНОГО обращения не открывается никому — включая автора сессии', async () => {
    expect(await openFeedbackCard(db, anna, 'FB-2026-DDD04')).toBeNull();
    expect(await openFeedbackCard(db, ilya, 'FB-2026-DDD04')).toBeNull();
    const anon = db.auditEvents().filter((e) => e.resourceRef === 'FB-2026-DDD04');
    expect(anon.length).toBeGreaterThanOrEqual(2);
  });

  it('сотруднику карточка недоступна: ROLE_MISMATCH', async () => {
    expect(await openFeedbackCard(db, maria, 'FB-2026-AAA01')).toBeNull();
  });
});

describe('слой данных feedback — подтверждение по номеру', () => {
  it('минимальное представление: статус и срок, БЕЗ текста и пользовательских полей', async () => {
    const view = await getFeedbackSentView(db, 'FB-2026-DDD04');
    expect(view).not.toBeNull();
    expect(view?.number).toBe('FB-2026-DDD04');
    expect(view?.kind).toBe('SUGGESTION');
    expect(view?.target).toBe('ACADEMIC_OFFICE');
    expect(view?.status).toBe('NEW');
    expect(view?.isAnonymous).toBe(true);
    expect(view?.dueAt).toBeInstanceOf(Date);
    // Текст, вложения и любые пользовательские данные не покидают слой данных.
    expect(view).not.toHaveProperty('text');
    expect(view).not.toHaveProperty('attachments');
    expect(view).not.toHaveProperty('studentId');
  });

  it('несуществующий номер → null', async () => {
    expect(await getFeedbackSentView(db, 'FB-2026-ZZZ99')).toBeNull();
  });
});
