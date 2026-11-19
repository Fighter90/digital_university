// DIG-46 — чистый движок AI-ассистента «Цифрового деканата» (клиентская
// половина концепта; серверный прокси к модели — отдельная задача
// agent:backend, интерфейс AssistantReply рассчитан на подмену источника).
//
// Модуль без React и серверных импортов: страница и плавающая панель
// передают сюда сериализуемый контекст сессии (AssistantContext строит
// слой данных, скоуп по владельцу), движок отвечает текстом + карточками
// действий + источниками. Никаких сетевых вызовов и случайности — ответ
// детерминирован (вопрос, контекст) → покрыт юнит-тестами.
//
// Правила отказов (задача DIG-46):
//  - просьбы показать чужие данные → вежливый отказ + пример допустимого
//    вопроса (никаких чужих данных в тексте);
//  - вопросы не про учёбу → отказ с объяснением и примером;
//  - непонятное → мягкая подсказка с примерами, не «ошибка».

import { needForTargetPure } from '@/lib/performance-math';
import type { Locale } from '@/lib/i18n';

// ── Контекст (сервер → клиент, сериализуемый) ───────────────────────────────

export interface AssistantLesson {
  timeLabel: string;
  discipline: string;
  kindLabel: string;
  roomLabel: string;
  teacher: string;
  isMoved: boolean;
  isCancelled: boolean;
  isOnline: boolean;
  /** «было: ауд. 310» для переносов. */
  previousRoomLabel?: string | null;
}

export interface AssistantPlanElement {
  code: string;
  name: string;
  kindLabel: string;
  weightPercent: number;
  maxScore: number;
  graded: boolean;
  score: number | null;
}

export interface AssistantExam {
  code: string;
  name: string;
  weightPercent: number;
  maxScore: number;
  graded: boolean;
  score: number | null;
}

export interface AssistantDiscipline {
  code: string;
  name: string;
  teacherName: string | null;
  /** Накопленная (%, вклад сданных элементов). */
  accumulated: number | null;
  /** Максимум возможного итога (все несданные — на максимум). */
  maxPossible: number | null;
  plan: AssistantPlanElement[];
  exam: AssistantExam | null;
}

export interface AssistantScheduleDay {
  /** Московский ключ дня «2026-11-13». */
  dateKey: string;
  /** «пятница, 13 ноября». */
  dateLabel: string;
  events: AssistantLesson[];
}

export interface AssistantContext {
  role: 'STUDENT' | 'STAFF';
  /** Первое слово ФИО владельца сессии: «Анна Смирнова» → «Анна». */
  firstName: string;
  /** Полное ФИО владельца сессии: EN-приветствие берёт словарь персон по нему
   * (DIG-124: PEOPLE_NAME_EN хранит полные имена, короткое «Анна» — нет). */
  fullName: string;
  groupLabel: string | null;
  /** Завтрашний московский день; null — вне семестра. */
  tomorrow: AssistantScheduleDay | null;
  /** «пятница, 13 ноября» — если завтра пар нет. */
  nextStudyDayLabel: string | null;
  /** Дисциплины с планом контроля (для калькулятора). */
  disciplines: AssistantDiscipline[];
}

// ── Ответы и карточки ───────────────────────────────────────────────────────

export type AssistantCard =
  | {
      type: 'schedule';
      title: string;
      dateLabel: string;
      events: AssistantLesson[];
      /** «Пар нет — свободный день» и т.п. */
      note: string | null;
      href: string;
    }
  | {
      type: 'calculator';
      title: string;
      disciplineCode: string;
      disciplineName: string;
      teacherName: string | null;
      accumulatedLabel: string;
      maxPossibleLabel: string | null;
      plan: AssistantPlanElement[];
      exam: AssistantExam | null;
      initialTarget: number;
    }
  | {
      type: 'order';
      serviceId: string;
      title: string;
      serviceTitle: string;
      benefit: string;
      etaLabel: string;
      formatLabel: string;
      requestTypeLabel: string;
      /** Черновик: ассистент сам ничего не отправляет. */
      notice: string;
      confirmLabel: string;
      /** Причина недоступности (сотрудник) — кнопка скрыта. */
      disabledReason: string | null;
    }
  | {
      type: 'faq';
      title: string;
      articleTitle: string;
      articleHref: string;
      bullets: string[];
    };

export interface AssistantReply {
  text: string;
  cards: AssistantCard[];
  /** Источник под ответом: «По данным: расписание, зачётка». */
  sources: string[];
}

export type AssistantIntent =
  | 'tomorrow-schedule'
  | 'exam-target'
  | 'order-defer-certificate'
  | 'faq-academic-leave'
  | 'foreign-data'
  | 'off-topic'
  | 'unknown';

/** Ровно 4 подсказки контекста из задачи DIG-46. */
export const ASSISTANT_HINTS: readonly string[] = [
  'Что у меня завтра?',
  'Сколько нужно на экзамене по БД, чтобы получить 8?',
  'Закажи справку для военкомата',
  'Как оформить академический отпуск?',
];

/** EN-подсказки (DIG-88): те же четыре намерения, английские формулировки. */
export const ASSISTANT_HINTS_EN: readonly string[] = [
  'What do I have tomorrow?',
  'How many points do I need on the Databases exam to get an 8?',
  'Order a certificate for the military enlistment office',
  'How do I take an academic leave?',
];

/** Подсказки контекста по локали (RU — канон). */
export function assistantHints(locale: Locale = 'ru'): readonly string[] {
  return locale === 'en' ? ASSISTANT_HINTS_EN : ASSISTANT_HINTS;
}

/** Услуга каталога, которую ассистент умеет предзаполнять. */
export const ASSISTANT_ORDER_SERVICE_ID = 'cert-defer';

// ── фразы отказов и источников (RU-канон + EN) ──────────────────────────────

const STAFF_ONLY_STUDENT_DATA =
  'Данные студента — расписание, зачётка и заявки — доступны только самому студенту. ' +
  'Как сотруднику деканата вам подскажу порядок действий и правила: например, ' +
  '«Как оформить академический отпуск?».';

const STAFF_ONLY_STUDENT_DATA_EN =
  'A student’s data — schedule, gradebook and requests — is visible only to the student themselves. ' +
  'As a deanery staff member I can help with procedures and rules: for example, ' +
  '“How do I take an academic leave?”.';

const FOREIGN_DATA_REFUSAL =
  'Показать могу только ваши данные — чужие зачётки и расписания я не открываю, ' +
  'это приватная информация. Зато могу помочь с вашими: например, «Что у меня завтра?» ' +
  'или «Сколько нужно на экзамене по БД, чтобы получить 8?».';

const FOREIGN_DATA_REFUSAL_EN =
  'I can only show your own data — I do not open other people’s gradebooks or schedules, ' +
  'that is private information. But I can help with yours: for example, “What do I have tomorrow?” ' +
  'or “How many points do I need on the Databases exam to get an 8?”.';

const OFF_TOPIC_REFUSAL =
  'Я ассистент цифрового деканата и помогаю только с учёбой: расписанием, оценками, ' +
  'заявками и правилами. С этим вопросом подсказать не смогу. А вот «Что у меня завтра?» ' +
  'или «Закажи справку для военкомата» — это ко мне.';

const OFF_TOPIC_REFUSAL_EN =
  'I am the digital deanery assistant and I only help with studies: schedules, grades, ' +
  'requests and rules. I cannot help with that one. But “What do I have tomorrow?” ' +
  'or “Order a certificate for the military enlistment office” — those are for me.';

const UNKNOWN_HINT =
  'Пока я понимаю не все формулировки. Попробуйте так: «Что у меня завтра?», ' +
  '«Сколько нужно на экзамене по БД, чтобы получить 8?», «Закажи справку для военкомата» ' +
  'или «Как оформить академический отпуск?».';

const UNKNOWN_HINT_EN =
  'I do not understand every phrasing yet. Try: “What do I have tomorrow?”, ' +
  '“How many points do I need on the Databases exam to get an 8?”, ' +
  '“Order a certificate for the military enlistment office” ' +
  'or “How do I take an academic leave?”.';

function staffOnlyPhrase(locale: Locale): string {
  return locale === 'en' ? STAFF_ONLY_STUDENT_DATA_EN : STAFF_ONLY_STUDENT_DATA;
}

function foreignDataPhrase(locale: Locale): string {
  return locale === 'en' ? FOREIGN_DATA_REFUSAL_EN : FOREIGN_DATA_REFUSAL;
}

function offTopicPhrase(locale: Locale): string {
  return locale === 'en' ? OFF_TOPIC_REFUSAL_EN : OFF_TOPIC_REFUSAL;
}

function unknownHintPhrase(locale: Locale): string {
  return locale === 'en' ? UNKNOWN_HINT_EN : UNKNOWN_HINT;
}

/** Источники под ответом по локали. */
function sourceLabel(kind: 'schedule' | 'gradebook' | 'plan' | 'catalog' | 'faq', locale: Locale): string {
  const ru: Record<typeof kind, string> = {
    schedule: 'расписание',
    gradebook: 'зачётка',
    plan: 'план контроля',
    catalog: 'каталог сервисов',
    faq: 'база знаний FAQ',
  };
  const en: Record<typeof kind, string> = {
    schedule: 'schedule',
    gradebook: 'gradebook',
    plan: 'assessment plan',
    catalog: 'service catalog',
    faq: 'FAQ knowledge base',
  };
  return locale === 'en' ? en[kind] : ru[kind];
}

// ── Распознавание ───────────────────────────────────────────────────────────

/** Данные-слова чужой просьбы: другой студент/группа или чужие показатели. */
const FOREIGN_DATA_RE =
  /(другого студента|другой группы|другого человека|других студентов|чуж(ие|ая|ую|ой)|одногруппник[а-яё]*|сокурсник[а-яё]*)/i;

/** Имена вымышленных однокурсников (данные только владельца — чужие не показываем). */
const FOREIGN_NAME_TOKENS = new Set([
  'ильи',
  'илью',
  'иля',
  'смирнов',
  'смирнова',
  'смирнову',
  'волков',
  'волкова',
  'волкову',
  'егоров',
  'егорова',
  'егорову',
  'полина',
  'полины',
  'полину',
  'федоров',
  'фёдоров',
  'федорова',
  'гусев',
  'гусева',
  'гусеву',
  'софия',
  'софии',
  'софью',
  'артем',
  'артём',
  'артема',
  'дмитрий',
  'дмитрия',
  'дмитрию',
]);

function questionWords(question: string): string[] {
  return ` ${question.toLowerCase().replace(/ё/g, 'е')} `
    .split(/[^a-zа-я0-9]+/i)
    .filter((w) => w.length > 0);
}

const OFF_TOPIC_RE =
  /(погод[а-яё]*|рецепт[а-яё]*|пицц[а-яё]*|футбол[а-яё]*|фильм[а-яё]*|кино|музык[а-яё]*|анекдот[а-яё]*|стих[а-яё]*|песн[а-яё]*|купить|продать|доставк[а-яё]*|такси|курс[а-яё]* (валют|доллара|евро)|weather|recipe|pizza|football|soccer|movie|film|music|joke|poem|song|buy|sell|delivery|taxi|exchange rate|currency|stock)/i;

// DIG-88 — EN-варианты распознавания: альтернативы ДОБАВЛЯЮТСЯ к русским
// (RU-поведение прежнее, покрывают юнит-тесты DIG-46).
const EXAM_TARGET_RE = /(сколько|какой балл|какой бал|что нужно|что получить|как набрать|how many|what score|what do i need|to get|do i need)/i;
const EXAM_WORD_RE = /(экзамен|экзамене|экзамена|экзамену|экз|exam|midterm|final)/i;
const TARGET_RE = /(?:получить|получить бы|на|чтобы получить|иметь|выход\w*|to get|need|score of)\s+(\d{1,3})/i;
const TARGET_GET_RE = /(?:получить|to get)\s+(\d{1,3})/i;

const ORDER_RE = /(закажи|заказать|оформи|оформить|подай|подать|нужна|нужно|сделай|order|arrange|apply|make|request)/i;
const DEFER_RE = /(военкомат|отсрочк\w*|армия|армии|military|enlistment|deferment|draft board|army)/i;

const ACADEMIC_LEAVE_RE = /(академ\w*\s*(отпуск|отпуску|отпуска)?|академич|academic\s*(leave|leave of absence)?|academic)/i;
const ACADEMIC_LEAVE_ACTION_RE = /(оформ|взять|как|что|порядок|услов|take|how|what|rules|arrange|procedure|apply)/i;

const TOMORROW_RE = /(завтра|tomorrow)/i;
const SCHEDULE_RE = /(пары|пар\?|расписани\w*|занятия|что у меня|какие|classes|class|schedule|timetable|lessons|what do i have)/i;

/** EN-слова чужой просьбы (RU-regex — FOREIGN_DATA_RE выше). */
const FOREIGN_DATA_RE_EN = /(other students?|another student|someone else|other people|classmates?|groupmates?|of my friend)/i;

/** Определяет намерение вопроса. Порядок важен: чужие данные — раньше остальных. */
export function detectAssistantIntent(question: string): AssistantIntent {
  const q = question.trim();
  if (!q) return 'unknown';
  const words = questionWords(q);
  const mentionsForeignName = words.some((w) => FOREIGN_NAME_TOKENS.has(w));
  if (FOREIGN_DATA_RE.test(q) || FOREIGN_DATA_RE_EN.test(q) || mentionsForeignName) {
    return 'foreign-data';
  }
  if (ACADEMIC_LEAVE_RE.test(q) && ACADEMIC_LEAVE_ACTION_RE.test(q)) {
    return 'faq-academic-leave';
  }
  if (ORDER_RE.test(q) && DEFER_RE.test(q)) return 'order-defer-certificate';
  if (EXAM_TARGET_RE.test(q) && EXAM_WORD_RE.test(q)) return 'exam-target';
  if (TOMORROW_RE.test(q) && SCHEDULE_RE.test(q)) return 'tomorrow-schedule';
  if (TOMORROW_RE.test(q)) return 'tomorrow-schedule';
  if (OFF_TOPIC_RE.test(q)) return 'off-topic';
  return 'unknown';
}

/**
 * Цель «получить 8» трактуется как 80 из 100 (десятибалльная × 10);
 * 20–100 — уже проценты; 11–19 вне шкал не трактуем → стандартные 80.
 */
export function resolveExamTarget(question: string): number {
  const match =
    question.match(TARGET_GET_RE) ?? question.match(TARGET_RE) ?? question.match(/(\d{1,3})/);
  const raw = match ? Number.parseInt(match[1]!, 10) : NaN;
  if (!Number.isFinite(raw)) return 80;
  if (raw >= 2 && raw <= 10) return raw * 10;
  if (raw >= 20 && raw <= 100) return raw;
  return 80;
}

/**
 * Дисциплина по вопросу: код («PI21-INFO»), инициалы названия («БД» →
 * «Базы данных») и prefixes слов названия — устойчиво к падежам
 * («по базам данным», «по программированию»).
 */
export function matchDiscipline(
  question: string,
  disciplines: readonly AssistantDiscipline[],
): AssistantDiscipline | null {
  const q = ` ${question.toLowerCase().replace(/ё/g, 'е')} `;
  const qWords = questionWords(question);

  // 1) Точное совпадение с кодом.
  const byCode = disciplines.find((d) => q.includes(d.code.toLowerCase()));
  if (byCode) return byCode;

  // 2) Инициалы названия отдельным словом («бд», минимум 2 буквы).
  for (const d of disciplines) {
    const initials = d.name
      .toLowerCase()
      .replace(/ё/g, 'е')
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((word) => word[0]!)
      .join('');
    if (initials.length >= 2 && qWords.includes(initials)) {
      return d;
    }
  }

  // 3) Основы слов названия (4 символа, усечённые до согласной перед гласной
  //    концовкой) — «базам данным» матчит «Базы данных» в любом падеже.
  for (const d of disciplines) {
    const nameWords = d.name
      .toLowerCase()
      .replace(/ё/g, 'е')
      .split(/[\s-]+/)
      .filter((w) => w.length >= 4)
      .map(stemOfWord);
    if (nameWords.length === 0) continue;
    const allMatch = nameWords.every((stem) => qWords.some((word) => word.startsWith(stem)));
    if (allMatch) return d;
  }
  return null;
}

/** «базы» → «баз» (падежная концовка гласная), «данных» → «данн». */
function stemOfWord(word: string): string {
  const prefix = word.slice(0, 4);
  return /[аяоыиэюе]/i.test(prefix[3] ?? '') ? prefix.slice(0, 3) : prefix;
}

// ── Ответы по намерениям ────────────────────────────────────────────────────

/** Проценты: RU — десятичная запятая (канон), EN — точка. */
function formatPercent(value: number, locale: Locale = 'ru'): string {
  const fixed = value.toFixed(1);
  return locale === 'en'
    ? fixed.replace(/\.0$/, '')
    : fixed.replace('.', ',').replace(/,0$/, '');
}

function tomorrowReply(ctx: AssistantContext, locale: Locale = 'ru'): AssistantReply {
  if (ctx.role === 'STAFF' || ctx.tomorrow === null) {
    const outOfSemester =
      ctx.role === 'STUDENT' && ctx.tomorrow === null
        ? locale === 'en'
          ? 'I found no classes for tomorrow: there is no schedule outside the semester. ' +
            'Try again later or open the full schedule.'
          : 'На завтра я не нашла пар: за пределами семестра расписания нет. ' +
            'Попробуйте позже или откройте расписание целиком.'
        : staffOnlyPhrase(locale);
    return {
      text: outOfSemester,
      cards: [],
      sources: ctx.role === 'STAFF' ? [] : [sourceLabel('schedule', locale)],
    };
  }
  const day = ctx.tomorrow;
  const count = day.events.filter((e) => !e.isCancelled).length;
  if (locale === 'en') {
    const classesWord = count === 1 ? 'class' : 'classes';
    const head =
      count > 0
        ? `Tomorrow, ${day.dateLabel}, you have ${count} ${classesWord}. ` +
          (day.events.some((e) => e.isCancelled)
            ? 'One of them is cancelled — it stays on the card for reference. '
            : '') +
          'All the details are on the card below.'
        : `Tomorrow, ${day.dateLabel}, you have no classes — a free day.` +
          (ctx.nextStudyDayLabel
            ? ` The nearest study day with classes is ${ctx.nextStudyDayLabel}.`
            : '');
    return {
      text: head,
      cards: [
        {
          type: 'schedule',
          title: count > 0 ? `Tomorrow · ${day.dateLabel}` : `Tomorrow · no classes`,
          dateLabel: day.dateLabel,
          events: day.events,
          note:
            count > 0
              ? null
              : ctx.nextStudyDayLabel
                ? `Next study day — ${ctx.nextStudyDayLabel}`
                : 'No classes are scheduled ahead',
          href: `/schedule?view=day&date=${day.dateKey}`,
        },
      ],
      sources: [sourceLabel('schedule', locale)],
    };
  }
  const pairsWord = count === 1 ? 'пара' : 'пары';
  const head =
    count > 0
      ? `Завтра, ${day.dateLabel}, у вас ${count} ${pairsWord}. ` +
        (day.events.some((e) => e.isCancelled)
          ? 'Одна из них отменена — она осталась в карточке для памяти. '
          : '') +
        'Все подробности — в карточке ниже.'
      : `Завтра, ${day.dateLabel}, пар нет — свободный день.` +
        (ctx.nextStudyDayLabel
          ? ` Ближайший учебный день с занятиями — ${ctx.nextStudyDayLabel}.`
          : '');
  return {
    text: head,
    cards: [
      {
        type: 'schedule',
        title: count > 0 ? `Завтра · ${day.dateLabel}` : `Завтра · пар нет`,
        dateLabel: day.dateLabel,
        events: day.events,
        note:
          count > 0
            ? null
            : ctx.nextStudyDayLabel
              ? `Ближайший учебный день — ${ctx.nextStudyDayLabel}`
              : 'Пар впереди не запланировано',
        href: `/schedule?view=day&date=${day.dateKey}`,
      },
    ],
    sources: [sourceLabel('schedule', locale)],
  };
}

function examTargetReply(question: string, ctx: AssistantContext, locale: Locale = 'ru'): AssistantReply {
  if (ctx.role === 'STAFF' || ctx.disciplines.length === 0) {
    return { text: staffOnlyPhrase(locale), cards: [], sources: [] };
  }
  const discipline = matchDiscipline(question, ctx.disciplines);
  const target = resolveExamTarget(question);
  if (!discipline || discipline.exam === null) {
    const notFound =
      locale === 'en'
        ? 'I could not find a discipline with an exam matching that question. Please specify the name — for example, ' +
          '“How many points do I need on the Databases exam to get an 8?”. Your disciplines: '
        : 'Не нашла дисциплину с экзаменом по этому вопросу. Уточните название — например, ' +
          '«Сколько нужно на экзамене по БД, чтобы получить 8?». Ваши дисциплины: ';
    return {
      text:
        notFound +
        ctx.disciplines
          .map((d) => `«${d.name}»`)
          .slice(0, 4)
          .join(', ') +
        '.',
      cards: [],
      sources: [sourceLabel('plan', locale)],
    };
  }

  // Экзамен — часть плана контроля: если слой данных отдал план без него
  // (краткий срез), добавляем экзаменационный элемент сами, иначе веса
  // нормируются неверно и калькулятор врёт.
  const examKindLabel = locale === 'en' ? 'Exam' : 'Экзамен';
  const plan = discipline.plan.some((el) => el.code === discipline.exam!.code)
    ? discipline.plan
    : [
        ...discipline.plan,
        {
          code: discipline.exam.code,
          name: discipline.exam.name,
          kindLabel: examKindLabel,
          weightPercent: discipline.exam.weightPercent,
          maxScore: discipline.exam.maxScore,
          graded: discipline.exam.graded,
          score: discipline.exam.score,
        },
      ];

  const outcome = needForTargetPure({
    // Последняя попытка по элементу уже отобрана слоем данных (одна строка
    // на элемент), поэтому gradedAt одинаковый — он нужен только типу.
    graded: plan
      .filter((el) => el.graded && el.score !== null)
      .map((el) => ({
        elementCode: el.code,
        score: el.score!,
        maxScore: el.maxScore,
        weight: el.weightPercent / 100,
        gradedAt: new Date(0),
      })),
    plan: plan.map((el) => ({
      elementCode: el.code,
      weight: el.weightPercent / 100,
      maxScore: el.maxScore,
    })),
    exam: {
      elementCode: discipline.exam.code,
      weight: discipline.exam.weightPercent / 100,
      maxScore: discipline.exam.maxScore,
    },
    target,
  });

  const accumulatedLabel =
    discipline.accumulated === null
      ? '—'
      : `${formatPercent(discipline.accumulated, locale)} ${locale === 'en' ? 'out of 100' : 'из 100'}`;
  const ungradedNames = plan
    .filter((el) => !el.graded && el.code !== discipline.exam?.code)
    .map((el) => el.name);

  let conclusion: string;
  if (outcome.status === 'OK') {
    conclusion =
      locale === 'en'
        ? `To reach a final of ≥ ${target}, you need at least ` +
          `${outcome.neededScore} out of ${outcome.maxScore} ` +
          `(${outcome.neededPercent?.toFixed(0)}%) on the exam — then the final is guaranteed not to be below ${target}.`
        : `Чтобы выйти на итог ≥ ${target}, на экзамене нужно набрать не меньше ` +
          `${outcome.neededScore} из ${outcome.maxScore} ` +
          `(${outcome.neededPercent?.toFixed(0)}%) — тогда итог гарантированно будет не ниже ${target}.`;
  } else if (outcome.status === 'UNREACHABLE') {
    conclusion =
      locale === 'en'
        ? `A final of ${target} out of 100 is unreachable: even a perfect exam gives a final of ` +
          `${Math.round(outcome.bestPossible)}. ` +
          (ungradedNames.length > 0
            ? `In the guaranteed scenario I count unfinished work (${ungradedNames.join(', ')}) as zeros. `
            : '') +
          `Try a lower target — the chips on the card recalculate it on the spot.`
        : `Итог ${target} из 100 недостижим: даже идеальный экзамен даст итог ` +
          `${Math.round(outcome.bestPossible)}. ` +
          (ungradedNames.length > 0
            ? `В гарантированном раскладе я считаю несданные работы (${ungradedNames.join(', ')}) нулями. `
            : '') +
          `Попробуйте цель пониже — чипы в карточке пересчитают на месте.`;
  } else if (outcome.status === 'ALREADY_SECURED') {
    conclusion =
      locale === 'en'
        ? `The target is already secured: the final is not below ${Math.round(outcome.finalPercent)} — the exam only matters for a higher grade.`
        : `Цель уже достигнута: итог не ниже ${Math.round(outcome.finalPercent)} — экзамен нужен только для более высокой оценки.`;
  } else if (outcome.status === 'EXAM_ALREADY_GRADED') {
    conclusion =
      locale === 'en'
        ? `The exam is already graded at ${outcome.examScore} out of ${outcome.examMaxScore}, final ` +
          `${Math.round(outcome.finalPercent)} — the target ${target} is ` +
          `${outcome.finalPercent >= target ? 'met' : 'not met'}.`
        : `Экзамен уже сдан на ${outcome.examScore} из ${outcome.examMaxScore}, итог ` +
          `${Math.round(outcome.finalPercent)} — цель ${target} ` +
          `${outcome.finalPercent >= target ? 'выполнена' : 'не достигнута'}.`;
  } else {
    conclusion =
      locale === 'en'
        ? 'The discipline plan has no exam element — estimating from the accumulated score.'
        : 'В плане дисциплины нет экзаменационного элемента — считаю по накопленной.';
  }

  const text =
    locale === 'en'
      ? `For “${discipline.name}” you have accumulated ${accumulatedLabel} ` +
        `(contribution of graded work; the exam weighs ${discipline.exam.weightPercent}% of the final). ` +
        conclusion
      : `По «${discipline.name}» накоплено ${accumulatedLabel} ` +
        `(вклад сданных работ; вес экзамена — ${discipline.exam.weightPercent}% итога). ` +
        conclusion;

  return {
    text,
    cards: [
      {
        type: 'calculator',
        title: locale === 'en' ? `Goal calculator · ${discipline.name}` : `Калькулятор цели · ${discipline.name}`,
        disciplineCode: discipline.code,
        disciplineName: discipline.name,
        teacherName: discipline.teacherName,
        accumulatedLabel,
        maxPossibleLabel:
          discipline.maxPossible === null
            ? null
            : `${formatPercent(discipline.maxPossible, locale)} ${locale === 'en' ? 'out of 100' : 'из 100'}`,
        plan: discipline.plan,
        exam: discipline.exam,
        initialTarget: target,
      },
    ],
    sources: [sourceLabel('gradebook', locale), sourceLabel('plan', locale)],
  };
}

function orderReply(ctx: AssistantContext, locale: Locale = 'ru'): AssistantReply {
  if (ctx.role === 'STAFF') {
    return { text: staffOnlyPhrase(locale), cards: [], sources: [] };
  }
  if (locale === 'en') {
    return {
      text:
        'I am preparing the “Military-service deferral certificate” — for the enlistment office at your place of study. ' +
        'Below is a pre-filled draft request: I submit nothing myself, ' +
        'sending happens only after your confirmation.',
      cards: [
        {
          type: 'order',
          serviceId: ASSISTANT_ORDER_SERVICE_ID,
          title: 'Request draft',
          serviceTitle: 'Military-service deferral certificate',
          benefit: 'For the enlistment office at your place of study',
          etaLabel: '1 day',
          formatLabel: 'PDF',
          requestTypeLabel: 'Certificate',
          notice:
            'Draft, not submitted. I submit nothing myself — ' +
            'sending happens only after your confirmation.',
          confirmLabel: 'Confirm and send',
          disabledReason: null,
        },
      ],
      sources: [sourceLabel('catalog', locale)],
    };
  }
  return {
    text:
      'Готовлю «Справку для отсрочки от армии» — для военкомата по месту учёбы. ' +
      'Ниже предзаполненная заявка-черновик: я сам ничего не отправляю, ' +
      'отправка — только по вашему подтверждению.',
    cards: [
      {
        type: 'order',
        serviceId: ASSISTANT_ORDER_SERVICE_ID,
        title: 'Черновик заявки',
        serviceTitle: 'Справка для отсрочки от армии',
        benefit: 'Для военкомата по месту учёбы',
        etaLabel: '1 день',
        formatLabel: 'PDF',
        requestTypeLabel: 'Справка',
        notice:
          'Черновик, не отправлен. Я сам ничего не отправляю — ' +
          'отправка только по вашему подтверждению.',
        confirmLabel: 'Подтвердить и отправить',
        disabledReason: null,
      },
    ],
    sources: [sourceLabel('catalog', locale)],
  };
}

function faqReply(_question: string, ctx: AssistantContext, locale: Locale = 'ru'): AssistantReply {
  void ctx;
  if (locale === 'en') {
    return {
      text:
        'An academic leave is arranged through the deanery: an application to the rector ' +
        'and the supporting documents. The short procedure is on the card, the full article is one click away.',
      cards: [
        {
          type: 'faq',
          title: 'How to take an academic leave',
          articleTitle: 'Academic leave: how to arrange it',
          articleHref: '/help',
          bullets: [
            'Submit the academic-leave application at the deanery (or in the cabinet: “Requests & certificates”).',
            'Attach the supporting documents: medical — the medical commission report; conscription — the summons notice; family — the supporting papers.',
            'The leave decree is issued within 10 days; the total duration is up to 2 years.',
            'After the leave you return to your own course: consultations will help you close the curriculum gap.',
          ],
        },
      ],
      sources: [sourceLabel('faq', locale)],
    };
  }
  return {
    text:
      'Академический отпуск оформляется через деканат: заявление на имя ректора ' +
      'и документы-основания. Краткий порядок — в карточке, полная статья — по ссылке.',
    cards: [
      {
        type: 'faq',
        title: 'Как оформить академический отпуск',
        articleTitle: 'Академический отпуск: порядок оформления',
        articleHref: '/help',
        bullets: [
          'Напишите заявление на академический отпуск в деканате (или в кабинете: «Заявки и справки»).',
          'Приложите документы-основания: по медицине — заключение ВКК, по призыву — повестка, по семье — подтверждающие документы.',
          'Декрет об отпуске выходит в течение 10 дней; общая длительность — до 2 лет.',
          'После отпуска вернётесь на свой курс: разницу в программе помогут закрыть консультациями.',
        ],
      },
    ],
    sources: [sourceLabel('faq', locale)],
  };
}

/**
 * Собирает ответ на вопрос студента. Детерминирован и чист.
 * Локаль (cookie du-locale) выбирает язык фраз: RU — канон.
 */
export function buildAssistantReply(
  question: string,
  ctx: AssistantContext,
  locale: Locale = 'ru',
): AssistantReply {
  switch (detectAssistantIntent(question)) {
    case 'tomorrow-schedule':
      return tomorrowReply(ctx, locale);
    case 'exam-target':
      return examTargetReply(question, ctx, locale);
    case 'order-defer-certificate':
      return orderReply(ctx, locale);
    case 'faq-academic-leave':
      return faqReply(question, ctx, locale);
    case 'foreign-data':
      return { text: foreignDataPhrase(locale), cards: [], sources: [] };
    case 'off-topic':
      return { text: offTopicPhrase(locale), cards: [], sources: [] };
    case 'unknown':
    default:
      return { text: unknownHintPhrase(locale), cards: [], sources: [] };
  }
}
