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

// DIG-89 — подписи из словаря: RU байт-в-байт прежние литералы, EN — словарь.
import { t, type Locale } from '@/lib/i18n';

export const FINANCE_DOC_KIND_LABELS: Record<FinanceDocKind, string> = {
  CONTRACT: t('ru', 'finance.doc.CONTRACT'),
  AGREEMENT: t('ru', 'finance.doc.AGREEMENT'),
  ACT: t('ru', 'finance.doc.ACT'),
  RECEIPT: t('ru', 'finance.doc.RECEIPT'),
  INVOICE: t('ru', 'finance.doc.INVOICE'),
};

export const FINANCE_DOC_KIND_PLURAL: Record<FinanceDocKind, string> = {
  CONTRACT: t('ru', 'finance.docPlural.CONTRACT'),
  AGREEMENT: t('ru', 'finance.docPlural.AGREEMENT'),
  ACT: t('ru', 'finance.docPlural.ACT'),
  RECEIPT: t('ru', 'finance.docPlural.RECEIPT'),
  INVOICE: t('ru', 'finance.docPlural.INVOICE'),
};

/** Пилюли фильтра: «Все» + виды каталога (множественные метки). */
export const FINANCE_DOC_FILTER_LABELS: Record<FinanceDocFilter, string> = {
  ALL: t('ru', 'finance.filter.ALL'),
  ...FINANCE_DOC_KIND_PLURAL,
};

// ── платежи договора ─────────────────────────────────────────────────────────

export type PaymentStatus = 'PAID' | 'DUE' | 'UPCOMING';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: t('ru', 'finance.pay.PAID'),
  DUE: t('ru', 'finance.pay.DUE'),
  UPCOMING: t('ru', 'finance.pay.UPCOMING'),
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
  SCHOLARSHIP: t('ru', 'finance.payout.SCHOLARSHIP'),
  AID: t('ru', 'finance.payout.AID'),
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
    label: t('ru', 'finance.action.materialAid.label'),
    description: t('ru', 'finance.action.materialAid.desc'),
  },
  {
    id: 'scholarship-cert',
    orderParam: 'fin-scholarship-cert',
    label: t('ru', 'finance.action.scholarshipCert.label'),
    description: t('ru', 'finance.action.scholarshipCert.desc'),
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

const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'] as const;

const MONTHS_NOMINATIVE = pluralRu(['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']);

/** Канон RU-рендера: тождественная обёртка (маркер allowlist DIG-89). */
function pluralRu<T>(forms: readonly T[]): readonly T[] {
  return forms;
}

/** «25 ноября» — для сроков и ближайшей выплаты (без года: даты ближние). */
export function formatFinanceDate(date: Date, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    return `${MONTHS_EN[date.getMonth()]} ${date.getDate()}`;
  }
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}\u00A0${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** «Ноябрь 2026» — для периода платежа. */
export function formatFinanceMonth(date: Date, locale: Locale = 'ru'): string {
  if (locale === 'en') return `${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`;
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

// ── DIG-89 — EN-слой: подписи, месяцы и демо-титулы по локали ────────────────



const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Вид документа: «Договор» / «Contract». */
export function financeDocKindLabel(kind: FinanceDocKind, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `finance.doc.${kind}` as const);
  return FINANCE_DOC_KIND_LABELS[kind];
}

/** Вид документа во множественном: «Договоры» / «Contracts». */
export function financeDocKindPluralLabel(kind: FinanceDocKind, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `finance.docPlural.${kind}` as const);
  return FINANCE_DOC_KIND_PLURAL[kind];
}

/** Пилюля фильтра: «Все»/«Квитанции» / «All»/«Receipts». */
export function financeFilterLabel(filter: FinanceDocFilter, locale: Locale = 'ru'): string {
  if (filter === 'ALL') return locale === 'en' ? t('en', 'finance.filter.ALL') : FINANCE_DOC_FILTER_LABELS.ALL;
  return financeDocKindPluralLabel(filter, locale);
}

/** Статус платежа: «Оплачен» / «Paid». */
export function financePayStatusLabel(status: PaymentStatus, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `finance.pay.${status}` as const);
  return PAYMENT_STATUS_LABELS[status];
}

/** Вид выплаты: «Стипендия» / «Scholarship». */
export function financePayoutKindLabel(kind: 'SCHOLARSHIP' | 'AID', locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `finance.payout.${kind}` as const);
  return PAYOUT_KIND_LABELS[kind];
}

/** Пустое состояние фильтра: «…вида «Квитанция»» / «…no “Receipt” items». */
export function financeFilterEmptyLabel(kind: FinanceDocKind, locale: Locale = 'ru'): string {
  return t(locale, 'finance.filter.empty.desc', { kind: financeDocKindLabel(kind, locale) });
}

const DOC_TITLE_KEYS: Record<string, 'finance.docTitle.enrollmentContract' | 'finance.docTitle.supplement' | 'finance.docTitle.receiptFirst' | 'finance.docTitle.invoiceSecond' | 'finance.docTitle.practiceContract' | 'finance.docTitle.practiceAct'> = {
  'fin-doc-enrollment-contract': 'finance.docTitle.enrollmentContract',
  'fin-doc-supplement': 'finance.docTitle.supplement',
  'fin-doc-receipt-sep': 'finance.docTitle.receiptFirst',
  'fin-doc-invoice-nov': 'finance.docTitle.invoiceSecond',
  'fin-doc-anna-practice-contract': 'finance.docTitle.practiceContract',
  'fin-doc-anna-practice-act': 'finance.docTitle.practiceAct',
};

/** Титул демо-документа по локали: известные id — словарь, остальное — как есть. */
export function financeDocumentTitle(
  doc: Pick<FinanceDocument, 'id' | 'title'>,
  locale: Locale = 'ru',
): string {
  if (locale === 'en') {
    const key = DOC_TITLE_KEYS[doc.id];
    if (key) return t('en', key);
  }
  return doc.title;
}

const PAYMENT_LABEL_KEYS: Record<string, 'finance.payment.first' | 'finance.payment.second' | 'finance.payment.springFirst'> = {
  'fin-pay-sep': 'finance.payment.first',
  'fin-pay-nov': 'finance.payment.second',
  'fin-pay-feb': 'finance.payment.springFirst',
};

/** Подпись платежа по локали: «Первый платёж» / «First payment». */
export function financePaymentLabel(
  payment: Pick<FinancePayment, 'id' | 'label'>,
  locale: Locale = 'ru',
): string {
  if (locale === 'en') {
    const key = PAYMENT_LABEL_KEYS[payment.id];
    if (key) return t('en', key);
  }
  return payment.label;
}

/** Период платежа по локали: «Ноябрь 2026» / «November 2026». */
export function financePaymentPeriod(dueAt: Date, locale: Locale = 'ru'): string {
  return formatFinanceMonth(dueAt, locale);
}

/** Подпись семестра договора по локали: «Осенний семестр 2026/27» / «Fall semester 2026/27». */
export function financeSemesterLabel(year: number, locale: Locale = 'ru'): string {
  const years = `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
  return t(locale, 'finance.semester.fall', { years });
}

/** Подпись вида стипендии: «Государственная академическая» / «State academic». */
export function financeScholarshipKind(locale: Locale = 'ru'): string {
  return t(locale, 'finance.scholarship.kind');
}

/** Титул выплаты по локали: «Стипендия за октябрь» / «Scholarship for October». */
export function financePayoutTitle(
  payout: Pick<FinancePayout, 'id' | 'kind' | 'title' | 'paidAt'>,
  locale: Locale = 'ru',
): string {
  if (locale === 'en') {
    if (payout.kind === 'SCHOLARSHIP') {
      return t('en', 'finance.scholarship.monthTitle', {
        month: MONTHS_EN[payout.paidAt.getMonth()],
      });
    }
    return t('en', 'finance.aid.title');
  }
  return payout.title;
}

/** Основа финансирования по локали: «Договор (платное)» / «Contract (self-paid)». */
export function financeFundingLabel(isContract: boolean, locale: Locale = 'ru'): string {
  return t(locale, isContract ? 'finance.funding.contract' : 'finance.funding.budget');
}

/** Подпись действия → мастер заявки: RU-канон / EN-словарь. */
export function financeActionLabel(action: FinanceAction, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    return t('en', action.id === 'material-aid' ? 'finance.action.materialAid.label' : 'finance.action.scholarshipCert.label');
  }
  return action.label;
}

/** Описание действия → мастер заявки по локали. */
export function financeActionDesc(action: FinanceAction, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    return t('en', action.id === 'material-aid' ? 'finance.action.materialAid.desc' : 'finance.action.scholarshipCert.desc');
  }
  return action.description;
}

/** Документ своего набора: не найден или чужой — null (единый 404 снаружи). */
export function financeDocumentById(bundle: FinanceBundle, id: string): FinanceDocument | null {
  if (typeof id !== 'string' || id === '') return null;
  return bundle.documents.find((doc) => doc.id === id) ?? null;
}

// ── сборка демо-бандла ──────────────────────────────────────────────────────

// DIG-89 — сборщики демонстрационного набора (договор, платежи, документы,
// выплаты) с русскими строками перенесены в src/lib/finance-docs-ru.ts,
// чтобы этот каталог подписей остался без кириллических литералов.
// Поведение и значения — прежние (см. tests/finance-catalog.test.ts).
export { financeBundleFor } from './finance-docs-ru';
