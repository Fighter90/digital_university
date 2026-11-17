// DIG-41 — финансовый каталог студента («Договоры и оплата», /finance).
//
// Финансовых моделей в каноне данных DIG-9 нет, прототип конкурсный:
// содержимое строится чистой функцией `financeBundleFor(форма_обучения, now)`
// по вымышленным данным, а даты считаются от переданного `now`, чтобы экран
// не «протухал» (текущий семестр, ближайшая выплата, сроки платежей).
// Скоуп — форма финансирования из профиля владельца (`StudentRow.funding`),
// который агрегат берёт из ctx.studentId — из ввода он не приходит
// (IDOR невозможен по построению).
//
// Критерий приёмки: нигде нет реальных реквизитов и платёжных форм
// (тесты фиксируют отсутствие БИК/ИНН/КПП/р-счёта и платёжных кнопок).

export type FinanceDocKind = 'CONTRACT' | 'AGREEMENT' | 'ACT' | 'RECEIPT' | 'INVOICE';

export type FinanceDocFilter = FinanceDocKind | 'ALL';

export const FINANCE_DOC_FILTERS: readonly FinanceDocFilter[] = [
  'ALL',
  'CONTRACT',
  'AGREEMENT',
  'ACT',
  'RECEIPT',
  'INVOICE',
];

export const FINANCE_DOC_KIND_LABELS: Record<FinanceDocKind, string> = {
  CONTRACT: 'Договор',
  AGREEMENT: 'Допсоглашение',
  ACT: 'Акт',
  RECEIPT: 'Квитанция',
  INVOICE: 'Счёт',
};

export const FINANCE_DOC_KIND_PLURAL: Record<FinanceDocKind, string> = {
  CONTRACT: 'Договоры',
  AGREEMENT: 'Допсоглашения',
  ACT: 'Акты',
  RECEIPT: 'Квитанции',
  INVOICE: 'Счета',
};

/** Пилюли фильтра: «Все» + виды каталога (множественные метки). */
export const FINANCE_DOC_FILTER_LABELS: Record<FinanceDocFilter, string> = {
  ALL: 'Все',
  ...FINANCE_DOC_KIND_PLURAL,
};

// ── платежи договора ─────────────────────────────────────────────────────────

export type PaymentStatus = 'PAID' | 'DUE' | 'UPCOMING';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: 'Оплачен',
  DUE: 'К оплате',
  UPCOMING: 'Ожидается',
};

export interface FinancePayment {
  id: string;
  /** «Первый платёж», «Второй платёж»… */
  label: string;
  /** «Сентябрь 2026» — период платежа. */
  periodLabel: string;
  dueAt: Date;
  amount: number;
  status: PaymentStatus;
  paidAt: Date | null;
  /** Id квитанции в списке документов (только у оплаченных). */
  receiptId: string | null;
}

export interface FinanceContract {
  /** «ДОГ-2025-0147» — вымышленный номер. */
  number: string;
  signedAt: Date;
  /** «Осенний семестр 2026/27». */
  semesterLabel: string;
  semesterCost: number;
  payments: FinancePayment[];
}

// ── документы, выплаты, стипендия, сводка ────────────────────────────────────

export interface FinanceDocument {
  id: string;
  kind: FinanceDocKind;
  title: string;
  number: string;
  date: Date;
}

export type PayoutKind = 'SCHOLARSHIP' | 'AID';

export const PAYOUT_KIND_LABELS: Record<PayoutKind, string> = {
  SCHOLARSHIP: 'Стипендия',
  AID: 'Материальная помощь',
};

export interface FinancePayout {
  id: string;
  kind: PayoutKind;
  /** «Стипендия за октябрь», «Материальная помощь (единовременная)». */
  title: string;
  amount: number;
  paidAt: Date;
}

export interface FinanceScholarship {
  /** «Государственная академическая». */
  kindLabel: string;
  /** Сумма в месяц. */
  monthlyAmount: number;
  /** Дата ближайшей выплаты (всегда в будущем от `now`). */
  nextPayoutAt: Date;
}

export interface FinanceDebt {
  /** Сумма платежей «к оплате». */
  amount: number;
  /** Ближайший срок оплаты. */
  dueAt: Date;
}

export interface FinanceSummary {
  /** «Бюджетная основа» | «Договор (платное)». */
  fundingLabel: string;
  isContract: boolean;
  scholarship: FinanceScholarship;
  debt: FinanceDebt | null;
}

export interface FinanceBundle {
  summary: FinanceSummary;
  /** null — бюджетник: блок договора не показывается. */
  contract: FinanceContract | null;
  documents: FinanceDocument[];
  /** Свежие сверху. */
  payouts: FinancePayout[];
}

/** Действия экрана → мастер заявки (карта заказа lib/request-order-map). */
export interface FinanceAction {
  id: string;
  /** Параметр ?order= каталога сервисов (предвыбор типа словаря). */
  orderParam: string;
  label: string;
  description: string;
}

export const FINANCE_ACTIONS: readonly FinanceAction[] = [
  {
    id: 'material-aid',
    orderParam: 'fin-material-aid',
    label: 'Заявление на материальную помощь',
    description: 'Единовременная поддержка из фонда вуза по заявлению студента',
  },
  {
    id: 'scholarship-cert',
    orderParam: 'fin-scholarship-cert',
    label: 'Справка о размере стипендии',
    description: 'Для банка, соцзащиты и visa-центров — со суммой и сроком назначения',
  },
];

// ── утилиты ──────────────────────────────────────────────────────────────────

const NBSP = '\u00A0';

/** Форма финансирования — «платное» (договор) для демонстрационного набора. */
export function isContractFunding(funding: string | null | undefined): boolean {
  return typeof funding === 'string' && funding.trim().toLowerCase() === 'контракт';
}

/** «48 000 ₽» — разряды неразрывными пробелами (детерминированно, без Intl). */
export function formatMoney(amount: number): string {
  const digits = String(Math.round(amount));
  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += NBSP;
    grouped += digits[i];
  }
  return `${grouped}${NBSP}₽`;
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

/** «25 ноября» — для сроков и ближайшей выплаты (без года: даты ближние). */
export function formatFinanceDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}\u00A0${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** «Ноябрь 2026» — для периода платежа. */
export function formatFinanceMonth(date: Date): string {
  return `${MONTHS_NOMINATIVE[date.getMonth()]}\u00A0${date.getFullYear()}`;
}

/** Дата страницы каталога «ДД.ММ.ГГГГ» (для атрибутов и PDF-строк). */
export function formatFinanceDateFull(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

/** Чистый фильтр документов: неизвестный/мусорный фильтр — весь список. */
export function filterFinanceDocuments(
  documents: readonly FinanceDocument[],
  filter: FinanceDocFilter,
): FinanceDocument[] {
  if (!FINANCE_DOC_FILTERS.includes(filter) || filter === 'ALL') return [...documents];
  return documents.filter((doc) => doc.kind === filter);
}

/** Документ своего набора: не найден или чужой — null (единый 404 снаружи). */
export function financeDocumentById(bundle: FinanceBundle, id: string): FinanceDocument | null {
  if (typeof id !== 'string' || id === '') return null;
  return bundle.documents.find((doc) => doc.id === id) ?? null;
}

// ── сборка бандла ────────────────────────────────────────────────────────────

/** Дата внутри относительного месяца от now (детерминированная). */
function shiftMonths(now: Date, months: number, day: number, hour = 10): Date {
  return new Date(now.getFullYear(), now.getMonth() + months, day, hour, 0, 0);
}

/** Ближайшая выплата стипендии — 25-е число (текущее или следующее). */
function nextScholarshipPayout(now: Date): Date {
  const day = now.getDate();
  if (day <= 25) return shiftMonths(now, 0, 25, 12);
  return shiftMonths(now, 1, 25, 12);
}

function scholarshipOf(now: Date): FinanceScholarship {
  return {
    kindLabel: 'Государственная академическая',
    monthlyAmount: 3620,
    nextPayoutAt: nextScholarshipPayout(now),
  };
}

function scholarshipPayouts(now: Date): FinancePayout[] {
  const pay = (monthsAgo: number): FinancePayout => {
    const paidAt = shiftMonths(now, -monthsAgo, 25, 12);
    return {
      id: `fin-pay-sch-${monthsAgo}`,
      kind: 'SCHOLARSHIP',
      title: `Стипендия за ${MONTHS_NOMINATIVE[paidAt.getMonth()].toLowerCase()}`,
      amount: 3620,
      paidAt,
    };
  };
  const aid = (monthsAgo: number): FinancePayout => ({
    id: `fin-pay-aid-${monthsAgo}`,
    kind: 'AID',
    title: 'Материальная помощь (единовременная)',
    amount: 8000,
    paidAt: shiftMonths(now, -monthsAgo, 15, 12),
  });
  // Свежие сверху: 25-е числа стипендий, 15-е — помощь того же месяца
  // (помощь октября моложе стипендии октября? нет: 25-е раньше 15-го
  // следующего месяца — порядок фиксируем по фактическим датам).
  return [pay(1), pay(2), aid(2), pay(3), pay(4)];
}

/**
 * Статус платежа по датам: оплачен → «Оплачен»; срок в пределах 30 дней
 * от now → «К оплате»; дальше — «Ожидается».
 */
function paymentStatusOf(now: Date, dueAt: Date, paidAt: Date | null): PaymentStatus {
  if (paidAt !== null && paidAt.getTime() <= now.getTime()) return 'PAID';
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return dueAt.getTime() - now.getTime() <= thirtyDays ? 'DUE' : 'UPCOMING';
}

function contractOf(now: Date): FinanceContract {
  const year = now.getFullYear();
  const septemberDue = new Date(year, 8, 1, 12, 0, 0);
  const septemberPaid = new Date(year, 8, 5, 12, 0, 0);
  const novemberDue = new Date(year, 10, 20, 12, 0, 0);
  const februaryDue = new Date(year + 1, 1, 10, 12, 0, 0);

  return {
    number: 'ДОГ-2025-0147',
    signedAt: new Date(year - 1, 7, 20, 12, 0, 0),
    semesterLabel: `Осенний семестр ${year}/${String((year + 1) % 100).padStart(2, '0')}`,
    semesterCost: 96000,
    payments: [
      {
        id: 'fin-pay-sep',
        label: 'Первый платёж',
        periodLabel: formatFinanceMonth(septemberDue),
        dueAt: septemberDue,
        amount: 48000,
        status: paymentStatusOf(now, septemberDue, septemberPaid),
        paidAt: septemberPaid,
        receiptId: 'fin-doc-receipt-sep',
      },
      {
        id: 'fin-pay-nov',
        label: 'Второй платёж',
        periodLabel: formatFinanceMonth(novemberDue),
        dueAt: novemberDue,
        amount: 48000,
        status: paymentStatusOf(now, novemberDue, null),
        paidAt: null,
        receiptId: null,
      },
      {
        id: 'fin-pay-feb',
        label: 'Первый платёж весеннего семестра',
        periodLabel: formatFinanceMonth(februaryDue),
        dueAt: februaryDue,
        amount: 48000,
        status: paymentStatusOf(now, februaryDue, null),
        paidAt: null,
        receiptId: null,
      },
    ],
  };
}

function budgetDocuments(now: Date): FinanceDocument[] {
  return [
    {
      id: 'fin-doc-anna-practice-contract',
      kind: 'CONTRACT',
      title: 'Договор о прохождении практики',
      number: 'ДОГ-П-2026-0189',
      date: shiftMonths(now, -5, 12),
    },
    {
      id: 'fin-doc-anna-practice-act',
      kind: 'ACT',
      title: 'Акт о прохождении практики',
      number: 'АКТ-2026-0312',
      date: shiftMonths(now, -4, 3),
    },
  ];
}

function contractDocuments(now: Date): FinanceDocument[] {
  return [
    {
      id: 'fin-doc-enrollment-contract',
      kind: 'CONTRACT',
      title: 'Договор на обучение',
      number: 'ДОГ-2025-0147',
      date: shiftMonths(now, -15, 20),
    },
    {
      id: 'fin-doc-supplement',
      kind: 'AGREEMENT',
      title: 'Допсоглашение к договору (индексация стоимости)',
      number: 'ДС-2026-0091',
      date: shiftMonths(now, -5, 15),
    },
    {
      id: 'fin-doc-receipt-sep',
      kind: 'RECEIPT',
      title: 'Квитанция: первый платёж',
      number: 'КВ-2026-0041',
      date: shiftMonths(now, -2, 5),
    },
    {
      id: 'fin-doc-invoice-nov',
      kind: 'INVOICE',
      title: 'Счёт: второй платёж (ноябрь)',
      number: 'СЧ-2026-0127',
      date: shiftMonths(now, 0, 1),
    },
  ];
}

/**
 * Демонстрационный финансовый набор по форме обучения владельца.
 * Чистая функция: одинаковые входы — одинаковый бандл (проверяется тестом).
 */
export function financeBundleFor(funding: string | null, now: Date): FinanceBundle {
  const isContract = isContractFunding(funding);
  const contract = isContract ? contractOf(now) : null;

  const duePayments = contract?.payments.filter((p) => p.status === 'DUE') ?? [];
  const debt: FinanceDebt | null =
    duePayments.length > 0
      ? {
          amount: duePayments.reduce((sum, p) => sum + p.amount, 0),
          dueAt: duePayments.reduce(
            (earliest, p) => (p.dueAt < earliest ? p.dueAt : earliest),
            duePayments[0]!.dueAt,
          ),
        }
      : null;

  return {
    summary: {
      fundingLabel: isContract ? 'Договор (платное)' : 'Бюджетная основа',
      isContract,
      scholarship: scholarshipOf(now),
      debt,
    },
    contract,
    documents: isContract ? contractDocuments(now) : budgetDocuments(now),
    payouts: scholarshipPayouts(now),
  };
}
