// DIG-46 — контракт чистого движка AI-ассистента (src/lib/assistant-engine).
// Приёмка: 4 подсказки задачи распознаются точно; «БД» находится по
// инициалам; «получить 8» = 80 из 100, «получить 85» — как есть; отказ на
// чужие данные и на не-учёбу — вежливый и с примером; источники под ответом;
// калькулятор считает needForTargetPure на фикстуре Анны (Проект 85 · 0,3,
// Тест 2 0,2 и Экзамен 0,5 не сданы): цель 80 недостижима (максимум 76),
// цель 70 — нужно 88 из 100; сотруднику данные-интенты вежливо отказывают.
import { describe, expect, it } from 'vitest';

import {
  ASSISTANT_HINTS,
  buildAssistantReply,
  detectAssistantIntent,
  matchDiscipline,
  resolveExamTarget,
  type AssistantContext,
  type AssistantDiscipline,
  type AssistantLesson,
} from '@/lib/assistant-engine';

function lesson(partial: Partial<AssistantLesson>): AssistantLesson {
  return {
    timeLabel: '12:00–13:30',
    discipline: 'Программирование',
    kindLabel: 'Лабораторная',
    roomLabel: 'ауд. 405',
    teacher: 'Иванова Ирина Игоревна',
    isMoved: false,
    isCancelled: false,
    isOnline: false,
    ...partial,
  };
}

function discipline(partial: Partial<AssistantDiscipline>): AssistantDiscipline {
  return {
    code: 'PI21-DB',
    name: 'Базы данных',
    teacherName: 'Соколов Сергей Сергеевич',
    accumulated: 25.5,
    maxPossible: 75.5,
    plan: [
      {
        code: 'PI21-DB-P1',
        name: 'Проект',
        kindLabel: 'Проект',
        weightPercent: 30,
        maxScore: 100,
        graded: true,
        score: 85,
      },
      {
        code: 'PI21-DB-T2',
        name: 'Тест 2',
        kindLabel: 'Тест',
        weightPercent: 20,
        maxScore: 100,
        graded: false,
        score: null,
      },
      {
        code: 'PI21-DB-EX',
        name: 'Экзамен',
        kindLabel: 'Экзамен',
        weightPercent: 50,
        maxScore: 100,
        graded: false,
        score: null,
      },
    ],
    exam: {
      code: 'PI21-DB-EX',
      name: 'Экзамен',
      weightPercent: 50,
      maxScore: 100,
      graded: false,
      score: null,
    },
    ...partial,
  };
}

const annaDisciplines: AssistantDiscipline[] = [
  discipline({}),
  discipline({
    code: 'PI21-INFO',
    name: 'Информатика',
    teacherName: 'Петров Пётр Петрович',
    accumulated: 26.4,
    maxPossible: 100,
    plan: [
      {
        code: 'PI21-INFO-T1',
        name: 'Тест 1',
        kindLabel: 'Тест',
        weightPercent: 30,
        maxScore: 100,
        graded: true,
        score: 88,
      },
      {
        code: 'PI21-INFO-K',
        name: 'Коллоквиум',
        kindLabel: 'Тест',
        weightPercent: 30,
        maxScore: 100,
        graded: false,
        score: null,
      },
    ],
    exam: {
      code: 'PI21-INFO-EX',
      name: 'Экзамен',
      weightPercent: 40,
      maxScore: 100,
      graded: false,
      score: null,
    },
  }),
];

const anna: AssistantContext = {
  role: 'STUDENT',
  firstName: 'Анна',
  fullName: 'Анна Смирнова',
  groupLabel: 'ПИ-21',
  tomorrow: {
    dateKey: '2026-11-12',
    dateLabel: 'четверг, 12 ноября',
    events: [
      lesson({
        timeLabel: '12:00–13:30',
        discipline: 'Программирование',
        kindLabel: 'Лабораторная',
        roomLabel: 'ауд. 405',
        isMoved: true,
      }),
      lesson({
        timeLabel: '16:00–17:30',
        discipline: 'Базы данных',
        kindLabel: 'Консультация',
        roomLabel: 'ауд. 212',
        teacher: 'Соколов Сергей Сергеевич',
      }),
    ],
  },
  nextStudyDayLabel: null,
  disciplines: annaDisciplines,
};

const staff: AssistantContext = {
  ...anna,
  role: 'STAFF',
  firstName: 'Мария',
  fullName: 'Мария Ковалёва',
  groupLabel: null,
  tomorrow: null,
  nextStudyDayLabel: null,
  disciplines: [],
};

describe('подсказки задачи', () => {
  it('ровно 4 подсказки с точными текстами', () => {
    expect(ASSISTANT_HINTS).toHaveLength(4);
    expect([...ASSISTANT_HINTS]).toEqual([
      'Что у меня завтра?',
      'Сколько нужно на экзамене по БД, чтобы получить 8?',
      'Закажи справку для военкомата',
      'Как оформить академический отпуск?',
    ]);
  });

  it('каждая подсказка даёт содержательный ответ с источником и карточкой', () => {
    for (const hint of ASSISTANT_HINTS) {
      const reply = buildAssistantReply(hint, anna);
      expect(reply.text.length).toBeGreaterThan(30);
      expect(reply.cards.length).toBeGreaterThanOrEqual(1);
      expect(reply.sources.length).toBeGreaterThanOrEqual(1);
      expect(reply.text).not.toMatch(/\bsorry\b/i);
    }
  });
});

describe('распознавание намерений', () => {
  it('«Что у меня завтра?» — намерение tomorrow-schedule', () => {
    expect(detectAssistantIntent('Что у меня завтра?')).toBe('tomorrow-schedule');
    expect(detectAssistantIntent('какие завтра пары')).toBe('tomorrow-schedule');
    expect(detectAssistantIntent('Расписание на завтра')).toBe('tomorrow-schedule');
  });

  it('«Сколько нужно на экзамене по БД, чтобы получить 8?» — exam-target с целью 80', () => {
    expect(detectAssistantIntent('Сколько нужно на экзамене по БД, чтобы получить 8?')).toBe(
      'exam-target',
    );
    expect(resolveExamTarget('Сколько нужно на экзамене по БД, чтобы получить 8?')).toBe(80);
    expect(resolveExamTarget('сколько нужно на экзамене, чтобы получить 85')).toBe(85);
    expect(resolveExamTarget('Что нужно на экзамене по программированию?')).toBe(80);
  });

  it('цель масштабируется только из десятибалльной шкалы', () => {
    expect(resolveExamTarget('чтобы получить 9')).toBe(90);
    expect(resolveExamTarget('чтобы получить 3')).toBe(30);
    expect(resolveExamTarget('чтобы получить 72 балла')).toBe(72);
    expect(resolveExamTarget('чтобы получить 100')).toBe(100);
  });

  it('«Закажи справку для военкомата» — order-defer-certificate', () => {
    expect(detectAssistantIntent('Закажи справку для военкомата')).toBe('order-defer-certificate');
    expect(detectAssistantIntent('нужна справка для отсрочки от армии')).toBe(
      'order-defer-certificate',
    );
  });

  it('«Как оформить академический отпуск?» — faq-academic-leave', () => {
    expect(detectAssistantIntent('Как оформить академический отпуск?')).toBe('faq-academic-leave');
    expect(detectAssistantIntent('академический отпуск: как взять?')).toBe('faq-academic-leave');
  });

  it('просьба показать чужие данные распознаётся раньше остальных', () => {
    expect(detectAssistantIntent('Покажи оценки Ильи Смирнова')).toBe('foreign-data');
    expect(detectAssistantIntent('покажи зачётку другого студента')).toBe('foreign-data');
    expect(detectAssistantIntent('какие долги у Полины Егоровой?')).toBe('foreign-data');
    expect(detectAssistantIntent('расписание другой группы')).toBe('foreign-data');
  });

  it('не-учебные вопросы — off-topic', () => {
    expect(detectAssistantIntent('Какая погода в Москве?')).toBe('off-topic');
    expect(detectAssistantIntent('напиши рецепт борща')).toBe('off-topic');
    expect(detectAssistantIntent('посоветуй фильм на вечер')).toBe('off-topic');
  });

  it('непонятная формулировка — unknown, а не отказ', () => {
    expect(detectAssistantIntent('сколько мне ещё учиться')).toBe('unknown');
  });
});

describe('матчинг дисциплин', () => {
  it('«БД» находится по инициалам названия', () => {
    const db = matchDiscipline('Сколько нужно на экзамене по БД?', anna.disciplines);
    expect(db?.code).toBe('PI21-DB');
  });

  it('полное название и код дисциплины тоже матчатся', () => {
    expect(matchDiscipline('экзамен по базам данных', anna.disciplines)?.code).toBe('PI21-DB');
    expect(matchDiscipline('что нужно на экзамене по PI21-INFO', anna.disciplines)?.code).toBe(
      'PI21-INFO',
    );
  });

  it('неизвестная дисциплина — null', () => {
    expect(matchDiscipline('экзамен по квантовой механике', anna.disciplines)).toBeNull();
  });
});

describe('ответ-расписание', () => {
  it('карточка мини-расписания с событиями завтра и переносом', () => {
    const reply = buildAssistantReply('Что у меня завтра?', anna);
    const card = reply.cards[0]!;
    expect(card.type).toBe('schedule');
    if (card.type !== 'schedule') return;
    expect(card.dateLabel).toContain('четверг, 12 ноября');
    expect(card.events).toHaveLength(2);
    expect(card.events[0]?.discipline).toBe('Программирование');
    expect(card.events[0]?.isMoved).toBe(true);
    expect(card.href).toBe('/schedule?view=day&date=2026-11-12');
    expect(reply.sources).toEqual(['расписание']);
    expect(reply.text).toContain('2 пары');
  });

  it('если завтра пар нет — показывается ближайший учебный день', () => {
    const reply = buildAssistantReply('Что у меня завтра?', {
      ...anna,
      tomorrow: {
        dateKey: '2026-11-12',
        dateLabel: 'четверг, 12 ноября',
        events: [],
      },
      nextStudyDayLabel: 'пятница, 13 ноября',
    });
    expect(reply.text).toContain('пар нет');
    expect(reply.text).toContain('пятница, 13 ноября');
    expect(reply.sources).toEqual(['расписание']);
  });

  it('вне семестра — честный ответ без выдуманных пар', () => {
    const reply = buildAssistantReply('Что у меня завтра?', {
      ...anna,
      tomorrow: null,
      nextStudyDayLabel: null,
    });
    expect(reply.cards).toHaveLength(0);
    expect(reply.text).toContain('не нашла пар');
  });
});

describe('ответ-калькулятор (фикстура Анны, Базы данных)', () => {
  it('цель 80: честно объясняет недостижимость и максимум 76', () => {
    const reply = buildAssistantReply('Сколько нужно на экзамене по БД, чтобы получить 8?', anna);
    expect(reply.sources).toEqual(['зачётка', 'план контроля']);
    expect(reply.text).toContain('25,5');
    expect(reply.text).toContain('76');
    expect(reply.text).toContain('недостижим');
    const card = reply.cards[0]!;
    expect(card.type).toBe('calculator');
    if (card.type !== 'calculator') return;
    expect(card.disciplineCode).toBe('PI21-DB');
    expect(card.disciplineName).toBe('Базы данных');
    expect(card.initialTarget).toBe(80);
    expect(card.exam?.maxScore).toBe(100);
  });

  it('цель 70: нужно 88 из 100 на экзамене', () => {
    const reply = buildAssistantReply('сколько нужно на экзамене по БД, чтобы получить 7', anna);
    expect(reply.text).toContain('88');
    expect(reply.text).not.toContain('недостижим');
  });

  it('цель 90 по Информатике: расчёт по её плану', () => {
    const reply = buildAssistantReply(
      'Сколько нужно на экзамене по Информатике, чтобы получить 9?',
      anna,
    );
    const card = reply.cards[0]!;
    if (card.type !== 'calculator') return expect.unreachable('card must be calculator');
    expect(card.disciplineCode).toBe('PI21-INFO');
    // Тест 1 88 · вес 0,3 → накоплено 26,4; несданный Коллоквиум 0,3 считается нулём,
    // экзамен 0,4: (89,5 − 26,4)·100/40 = 158 > 100 → недостижимо.
    expect(reply.text).toContain('недостижим');
  });
});

describe('ответ-заявка', () => {
  it('черновик заявки с подтверждением, ассистент сам не отправляет', () => {
    const reply = buildAssistantReply('Закажи справку для военкомата', anna);
    const card = reply.cards[0]!;
    expect(card.type).toBe('order');
    if (card.type !== 'order') return;
    expect(card.serviceId).toBe('cert-defer');
    expect(card.serviceTitle).toBe('Справка для отсрочки от армии');
    expect(card.confirmLabel).toBe('Подтвердить и отправить');
    expect(card.notice).toContain('не отправляю');
    expect(reply.text).toContain('подтвержд');
    expect(reply.sources).toEqual(['каталог сервисов']);
  });

  it('сотруднику заявка недоступна', () => {
    const reply = buildAssistantReply('Закажи справку для военкомата', staff);
    expect(reply.cards).toHaveLength(0);
    expect(reply.text).toContain('студент');
  });
});

describe('ответ-FAQ', () => {
  it('ссылка на базу знаний (/help): карточка самодостаточна, ссылка не 404', () => {
    const reply = buildAssistantReply('Как оформить академический отпуск?', anna);
    const card = reply.cards[0]!;
    expect(card.type).toBe('faq');
    if (card.type !== 'faq') return;
    // Регресс: карточка ссылалась на /faq/akademicheskiy-otpusk — маршрут
    // удалён в DIG-38 (FAQ переехал в /help), клик по карточке давал 404.
    // База знаний без отдельной статьи об отпуске — ведём в корень /help.
    expect(card.articleHref).toBe('/help');
    expect(card.bullets.length).toBeGreaterThanOrEqual(3);
    expect(reply.sources).toEqual(['база знаний FAQ']);
  });
});

describe('отказы', () => {
  it('чужие данные: отказ + пример, никаких чужих данных в тексте', () => {
    const reply = buildAssistantReply('Покажи оценки Ильи Смирнова', anna);
    expect(reply.cards).toHaveLength(0);
    expect(reply.sources).toHaveLength(0);
    expect(reply.text).toContain('только ваши');
    expect(reply.text).toContain('Что у меня завтра');
    expect(reply.text).not.toContain('Илья');
    expect(reply.text).not.toContain('74');
  });

  it('не-учебный вопрос: отказ + пример учебного вопроса', () => {
    const reply = buildAssistantReply('Какая погода в Москве?', anna);
    expect(reply.cards).toHaveLength(0);
    expect(reply.text).toContain('учёб');
    expect(reply.text).toMatch(/Что у меня завтра|экзамене/);
  });

  it('непонятный вопрос — мягкая подсказка с примерами', () => {
    const reply = buildAssistantReply('сколько мне ещё учиться', anna);
    expect(reply.text).toContain('Пока я понимаю не все формулировки');
    expect(reply.text).toContain('Что у меня завтра');
  });

  it('сотруднику данные-интенты недоступны, FAQ работает', () => {
    const scheduleReply = buildAssistantReply('Что у меня завтра?', staff);
    expect(scheduleReply.text).toContain('студент');
    expect(scheduleReply.cards).toHaveLength(0);

    const examReply = buildAssistantReply(
      'Сколько нужно на экзамене по БД, чтобы получить 8?',
      staff,
    );
    expect(examReply.text).toContain('студент');
    expect(examReply.cards).toHaveLength(0);

    const faqReply = buildAssistantReply('Как оформить академический отпуск?', staff);
    expect(faqReply.cards[0]?.type).toBe('faq');
  });
});
