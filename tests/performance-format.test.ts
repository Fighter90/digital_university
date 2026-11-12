// DIG-26 — presentation-слой экрана «Успеваемость: сводка».
// Красная фаза: контракт чистых помощников зафиксирован ДО реализации
// (модуля src/lib/performance-format.ts ещё нет).
//
// Покрывается:
//  - параметр семестра (?semester=YYYY-FALL|YYYY-SPRING): кодирование, парсинг
//    мусора → null;
//  - пилюли семестров: семестры с оценками + текущий, сортировка по убыванию;
//  - фильтрация дисциплин по семестру (безоценочные остаются в текущем);
//  - семестровый GPA (итог ?? накопленная, вес — кредиты) и дельта к
//    предыдущему семестру;
//  - карточки дисциплин: крупная оценка, уровень и СЛОВЕСНАЯ подпись
//    (цвет — не единственный носитель смысла), «из возможных», бейдж
//    допуска к экзамену (есть / нет / экзамен сдан / без экзамена);
//  - светофор: долги > риски > всё хорошо > нет оценок — с фразой и действием;
//  - пустой семестр: подсказка «первая контрольная» из будущих сессий группы;
//  - долги: бейдж статуса и фраза даты пересдачи;
//  - тултип-тексты для сокращений (GPA, кредит, перцентиль).
import { describe, expect, it } from 'vitest';

import {
  CREDITS_HINT,
  CREDITS_SHORT_HINT,
  GPA_HINT,
  PERCENTILE_HINT,
  activeDebts,
  admissionBadgeStatus,
  buildSemesterPills,
  debtBadge,
  debtDatePhrase,
  disciplinesForSemester,
  emptySemesterNote,
  levelBarClass,
  levelTextClass,
  nextAssessment,
  parseSemesterParam,
  semesterDelta,
  semesterGpaOf,
  semesterParam,
  semesterShortLabel,
  toDisciplineCards,
  trafficLight,
  trafficBadgeStatus,
} from '@/lib/performance-format';
import type { DisciplinePerformance, DebtItem } from '@/server/data/performance';
import type { ExamSessionRow } from '@/server/data/types';

const FALL_26 = { startYear: 2026, term: 'FALL' } as const;
const SPRING_25 = { startYear: 2025, term: 'SPRING' } as const;

function disc(overrides: Partial<DisciplinePerformance>): DisciplinePerformance {
  return {
    disciplineCode: 'X',
    disciplineName: 'Дисциплина',
    credits: 4,
    teacherName: 'Преподаватель Препод Преподович',
    semester: FALL_26,
    semesterLabel: 'Осенний семестр 2026/27',
    accumulated: null,
    minGuaranteed: null,
    maxPossible: null,
    finalGrade: null,
    gradedElements: 0,
    totalElements: 3,
    isComplete: false,
    creditEarned: false,
    hasExamElement: true,
    examGraded: false,
    ...overrides,
  };
}

function debt(overrides: Partial<DebtItem>): DebtItem {
  return {
    disciplineCode: 'X',
    disciplineName: 'Дисциплина',
    retakeDate: new Date(2026, 10, 19, 9, 0),
    daysLeft: 7,
    status: 'ASSIGNED',
    ...overrides,
  };
}

/** Оценка сессии группы для подсказки «первая контрольная». */
function exam(kind: ExamSessionRow['kind'], date: Date, name = 'Базы данных'): ExamSessionRow {
  return {
    id: `exm-${kind}-${date.getTime()}`,
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: name,
    kind,
    date,
    startsAt: date,
    room: '301',
    note: null,
  };
}

describe('DIG-26 — параметр и подписи семестра', () => {
  it('semesterParam кодирует ключ в ?semester=YYYY-TERM', () => {
    expect(semesterParam(FALL_26)).toBe('2026-FALL');
    expect(semesterParam(SPRING_25)).toBe('2025-SPRING');
  });

  it('parseSemesterParam читает валидный параметр, мусор и пустоту → null', () => {
    expect(parseSemesterParam('2026-FALL')).toEqual(FALL_26);
    expect(parseSemesterParam('2025-SPRING')).toEqual(SPRING_25);
    expect(parseSemesterParam('junk')).toBeNull();
    expect(parseSemesterParam('2026-AUTUMN')).toBeNull();
    expect(parseSemesterParam('')).toBeNull();
    expect(parseSemesterParam(undefined)).toBeNull();
  });

  it('короткая подпись пилюли: «Осень 26/27», «Весна 25/26»', () => {
    expect(semesterShortLabel(FALL_26)).toBe('Осень 26/27');
    expect(semesterShortLabel(SPRING_25)).toBe('Весна 25/26');
  });

  it('пилюли: семестры с оценками + текущий (даже пустой), по убыванию', () => {
    const pills = buildSemesterPills(
      [
        disc({ semester: SPRING_25, accumulated: 80, finalGrade: 80 }),
        disc({ semester: null, accumulated: null }),
      ],
      FALL_26,
    );
    expect(pills.map((p) => p.key)).toEqual(['2026-FALL', '2025-SPRING']);
    expect(pills[0]!.label).toBe('Осенний семестр 2026/27');
    expect(pills[1]!.short).toBe('Весна 25/26');
  });
});

describe('DIG-26 — фильтр семестра и семестровый GPA', () => {
  const spring = disc({
    disciplineCode: 'PI21-ALG',
    credits: 5,
    semester: SPRING_25,
    accumulated: 86.5,
    finalGrade: 87,
  });
  const fall = disc({ disciplineCode: 'PI21-INFO', credits: 4, accumulated: 48.9 });
  const noGrades = disc({ disciplineCode: 'PI21-HIST', semester: null, accumulated: null });
  const all = [spring, fall, noGrades];

  it('безоценочная дисциплина (семестр неизвестен) остаётся в текущем семестре', () => {
    expect(disciplinesForSemester(all, FALL_26, FALL_26).map((d) => d.disciplineCode)).toEqual([
      'PI21-INFO',
      'PI21-HIST',
    ]);
    expect(disciplinesForSemester(all, SPRING_25, FALL_26).map((d) => d.disciplineCode)).toEqual([
      'PI21-ALG',
    ]);
  });

  it('семестровый GPA — средневзвешенное кредитами по правилу «итог ?? накопленная»', () => {
    // (87·5 + 74·4) / 9 = 81.22
    expect(
      semesterGpaOf([
        spring,
        disc({
          disciplineCode: 'PI21-DISC',
          credits: 4,
          semester: SPRING_25,
          accumulated: 74.2,
          finalGrade: 74,
        }),
      ]),
    ).toBe(81.22);
    expect(semesterGpaOf([noGrades])).toBeNull();
    expect(semesterGpaOf([])).toBeNull();
  });

  it('дельта — к предыдущему семестру с короткой подписью; нет данных → null', () => {
    const delta = semesterDelta([spring, fall], FALL_26);
    // осень 27.14 (48.9·4+14·6)/… — считаем точно: только fall+spring в выборке
    expect(delta).not.toBeNull();
    expect(delta?.prevLabel).toBe('Весна 25/26');
    expect(delta?.value).toBeCloseTo(semesterGpaOf([fall])! - semesterGpaOf([spring])!, 2);

    // предыдущий семестр пуст → дельты нет
    expect(semesterDelta([spring], SPRING_25)).toBeNull();
  });
});

describe('DIG-26 — карточки дисциплин', () => {
  it('завершённая: крупный итог, словесный уровень, «Экзамен сдан», без «из возможных»', () => {
    const [card] = toDisciplineCards([
      disc({
        disciplineCode: 'PI21-ALG',
        disciplineName: 'Алгоритмы и структуры данных',
        credits: 5,
        teacherName: 'Иванова Ирина Игоревна',
        semester: SPRING_25,
        accumulated: 86.5,
        maxPossible: 100,
        finalGrade: 87,
        gradedElements: 2,
        totalElements: 2,
        isComplete: true,
        creditEarned: true,
        examGraded: true,
      }),
    ]);
    expect(card?.isFinal).toBe(true);
    expect(card?.scoreLabel).toBe('87');
    expect(card?.level).toBe('good');
    expect(card?.levelWord).toBe('Отлично');
    expect(card?.admission).toBe('graded');
    expect(card?.admissionLabel).toBe('Экзамен сдан');
    expect(card?.maxPossibleLabel).toBeNull();
    expect(card?.href).toBe('/grades/gradebook?discipline=PI21-ALG');
    expect(card?.teacher).toBe('Иванова Ирина Игоревна');
  });

  it('в процессе: накопленная с десятичной, «из возможных», допуск есть когда не-экзаменационные сданы', () => {
    const [card] = toDisciplineCards([
      disc({
        disciplineCode: 'PI21-INFO',
        accumulated: 48.9,
        maxPossible: 88.9,
        gradedElements: 2,
        totalElements: 3,
      }),
    ]);
    expect(card?.isFinal).toBe(false);
    expect(card?.scoreLabel).toBe('48,9');
    expect(card?.maxPossibleLabel).toBe('из возможных 88,9');
    expect(card?.level).toBe('medium'); // порог ещё не гарантирован, шансы есть
    expect(card?.levelWord).toBe('Порог ещё не гарантирован');
    expect(card?.admission).toBe('admitted');
    expect(card?.admissionLabel).toBe('Допуск к экзамену есть');
  });

  it('риск: даже максимум не дотягивает до порога 60 — красный уровень со словами', () => {
    const [card] = toDisciplineCards([
      disc({ accumulated: 14, maxPossible: 54, gradedElements: 2, totalElements: 3 }),
    ]);
    expect(card?.level).toBe('risk');
    expect(card?.levelWord).toBe('Не дотянуть до порога');
  });

  it('порог уже набран в процессе → good «Порог уже набран»', () => {
    const [card] = toDisciplineCards([
      disc({ accumulated: 65, maxPossible: 100, gradedElements: 1, totalElements: 3 }),
    ]);
    expect(card?.level).toBe('good');
    expect(card?.levelWord).toBe('Порог уже набран');
  });

  it('не сданные не-экзаменационные элементы → «Допуска к экзамену нет»', () => {
    const [card] = toDisciplineCards([
      disc({ accumulated: 25.5, maxPossible: 95.5, gradedElements: 1, totalElements: 3 }),
    ]);
    expect(card?.admission).toBe('not-admitted');
    expect(card?.admissionLabel).toBe('Допуска к экзамену нет');
  });

  it('дисциплина без экзамена в плане — без бейджа допуска; без оценок — «Оценок ещё нет» и прочерк', () => {
    const cards = toDisciplineCards([
      disc({ disciplineCode: 'PI21-PROG', hasExamElement: false, accumulated: 14, maxPossible: 54 }),
      disc({ disciplineCode: 'PI21-HIST', hasExamElement: false, accumulated: null, semester: null }),
    ]);
    expect(cards[0]?.admission).toBeNull();
    expect(cards[0]?.admissionLabel).toBeNull();
    expect(cards[1]?.scoreLabel).toBe('—');
    expect(cards[1]?.level).toBeNull();
    expect(cards[1]?.levelWord).toBe('Оценок ещё нет');
    expect(cards[1]?.admission).toBeNull();
  });

  it('цвет никогда не один: для каждого уровня есть класс текста И класс полосы', () => {
    for (const level of ['good', 'medium', 'risk'] as const) {
      expect(levelTextClass(level)).toBeTruthy();
      expect(levelBarClass(level)).toBeTruthy();
    }
  });
});

describe('DIG-26 — светофор состояния', () => {
  const risky = disc({ accumulated: 14, maxPossible: 54 });
  const fine = disc({ accumulated: 90, maxPossible: 100 });
  const noGrades = disc({ accumulated: null, semester: null });

  it('активные долги — высший приоритет: «Есть долги», фраза с ближайшей пересдачей, действие к долгам', () => {
    const light = trafficLight([fine], [
      debt({ disciplineName: 'Программирование', status: 'OVERDUE', daysLeft: -3 }),
      debt({ disciplineName: 'Информатика', status: 'ASSIGNED' }),
    ]);
    expect(light.tone).toBe('debts');
    expect(light.title).toBe('Есть долги');
    expect(light.phrase).toContain('2');
    expect(light.phrase).toContain('Программирование');
    expect(light.actionHref).toBe('#debts');
    expect(light.actionLabel).toBeTruthy();
  });

  it('риски: дисциплина с недостижимым порогом → «Есть риски» с числом и действием', () => {
    const light = trafficLight([risky, fine], []);
    expect(light.tone).toBe('risk');
    expect(light.title).toBe('Есть риски');
    expect(light.phrase).toContain('1');
    expect(light.actionHref).toBe('/grades/session');
  });

  it('всё хорошо: оценки выше порога → «Всё хорошо»', () => {
    const light = trafficLight([fine], []);
    expect(light.tone).toBe('ok');
    expect(light.title).toBe('Всё хорошо');
    expect(light.actionHref).toBe('/grades/session');
  });

  it('семестр без оценок и без долгов → нейтральный «Оценок пока нет» без действия', () => {
    const light = trafficLight([noGrades], []);
    expect(light.tone).toBe('idle');
    expect(light.title).toBe('Оценок пока нет');
    expect(light.actionHref).toBeNull();
  });

  it('тон светофора имеет и статус бейджа (цвет + текст)', () => {
    expect(trafficBadgeStatus('ok')).toBe('success');
    expect(trafficBadgeStatus('risk')).toBe('warning');
    expect(trafficBadgeStatus('debts')).toBe('error');
    expect(trafficBadgeStatus('idle')).toBe('neutral');
  });
});

describe('DIG-26 — пустой семестр и «первая контрольная»', () => {
  const now = new Date(2026, 10, 12, 9, 0);

  it('nextAssessment берёт ближайшую будущую не-пересдачу', () => {
    const nearest = nextAssessment(
      [
        exam('RETAKE', new Date(2026, 10, 13, 9)),
        exam('EXAM', new Date(2026, 11, 24, 10), 'Информатика'),
        exam('CREDIT', new Date(2026, 10, 14, 10)),
        exam('CREDIT', new Date(2026, 9, 1, 10)), // прошла — не годится
      ],
      now,
    );
    expect(nearest?.kindLabel).toBe('Зачёт');
    expect(nearest?.disciplineName).toBe('Базы данных');
    expect(nearest?.date).toEqual(new Date(2026, 10, 14, 10));
    expect(nextAssessment([], now)).toBeNull();
    expect(nextAssessment([exam('RETAKE', new Date(2026, 10, 13, 9))], now)).toBeNull();
  });

  it('подсказка пустого семестра называет первую контрольную; не текущий семестр — общая фраза', () => {
    const note = emptySemesterNote(
      { kindLabel: 'Зачёт', disciplineName: 'Базы данных', date: new Date(2026, 10, 14, 10) },
      true,
    );
    expect(note).toContain('Первая контрольная');
    expect(note).toContain('Базы данных');
    expect(note).toContain('14 ноября');
    expect(emptySemesterNote(null, true)).toContain('после первой контрольной');
    expect(emptySemesterNote(null, false)).toContain('после первой контрольной');
  });
});

describe('DIG-26 — долги', () => {
  it('activeDebts оставляет только незакрытые', () => {
    const items = [
      debt({ disciplineCode: 'A', status: 'OVERDUE' }),
      debt({ disciplineCode: 'B', status: 'ASSIGNED' }),
      debt({ disciplineCode: 'C', status: 'CLOSED' }),
    ];
    expect(activeDebts(items).map((d) => d.disciplineCode)).toEqual(['A', 'B']);
  });

  it('бейдж и фраза даты: назначенная и просроченная пересдача', () => {
    expect(debtBadge('ASSIGNED')).toEqual({ label: 'Назначена', badge: 'info' });
    expect(debtBadge('OVERDUE')).toEqual({ label: 'Просрочена', badge: 'error' });
    expect(debtBadge('CLOSED')).toEqual({ label: 'Закрыта', badge: 'success' });

    const assigned = debtDatePhrase(debt({ status: 'ASSIGNED', daysLeft: 7 }));
    expect(assigned).toContain('назначена');
    expect(assigned).toContain('19 ноября');
    expect(assigned).toContain('осталось 7 дней');

    const overdue = debtDatePhrase(
      debt({ status: 'OVERDUE', retakeDate: new Date(2026, 10, 9, 9), daysLeft: -3 }),
    );
    expect(overdue).toContain('была');
    expect(overdue).toContain('9 ноября');
    expect(overdue).toContain('не закрыт');
  });

  it('admissionBadgeStatus маппит состояния допуска в статусы бейджа', () => {
    expect(admissionBadgeStatus('graded')).toBe('success');
    expect(admissionBadgeStatus('admitted')).toBe('success');
    expect(admissionBadgeStatus('not-admitted')).toBe('warning');
  });
});

describe('DIG-26 — тултипы сокращений простыми словами', () => {
  it('GPA, кредит и перцентиль объяснены текстами без жаргона', () => {
    expect(GPA_HINT).toContain('GPA');
    expect(GPA_HINT).toContain('кредит');
    expect(CREDITS_HINT).toContain('240');
    expect(CREDITS_SHORT_HINT).toContain('Кредит');
    expect(PERCENTILE_HINT).toContain('группы');
    expect(PERCENTILE_HINT.toLowerCase()).toContain('средний балл');
  });
});
