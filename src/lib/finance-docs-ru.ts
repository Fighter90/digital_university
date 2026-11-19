// DIG-89 — RU-демо-набор финансов (договор, платежи, документы, выплаты).
//
// Вынесено из src/lib/finance-catalog.ts (DIG-41): чистые сборщики
// демонстрационных данных с русскими строками живут в отдельном модуле,
// чтобы каталог подписей (finance-catalog) оставался свободным от
// кириллических литералов для статического контура «no Cyrillic on EN».
// Поведение и значения — байт-в-байт прежние (тесты finance-catalog и
// finance-page рендерят дефолтную локаль).
//
// Модуль чистый (без серверных импортов).
import {
  financeFundingLabel,
  formatFinanceMonth,
  isContractFunding,
  type FinanceContract,
  type FinanceDebt,
  type FinanceDocument,
  type FinanceBundle,
  type FinancePayout,
  type FinanceScholarship,
  type PaymentStatus,
} from '@/lib/finance-catalog';

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
  // «Свежие сверху» — инвариант структуры, а не порядка литерала:
  // сортируем по фактической дате выплаты (стипендии — 25-го числа,
  // помощь — 15-го, поэтому в одном месяце помощь старше стипендии).
  return [pay(1), pay(2), aid(2), pay(3), pay(4)].sort(
    (a, b) => b.paidAt.getTime() - a.paidAt.getTime(),
  );
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
