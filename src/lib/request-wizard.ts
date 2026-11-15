// DIG-31 — мастер заказа справки или заявления: чистый домен.
//
// Реестр документов собирается из каталога DIG-29 (единый источник правды:
// только сервисы с action ORDER). Модуль без серверных импортов — работает
// и на сервере (server action, слой данных), и в клиентском мастере:
// ОДНА функция валидации обслуживает обе стороны приёмки («валидация на
// клиенте и на сервере»), сводка событий и даты ожидания совпадают везде.
import {
  ETA_LABELS,
  FORMAT_LABELS,
  SERVICES,
  type ServiceEta,
  type ServiceFormat,
} from '@/lib/services-catalog';
import type { RequestType } from '@/server/data/types';

export type WizardDelivery = 'PDF' | 'PICKUP' | 'MAIL';
export type WizardLanguage = 'RU' | 'EN';

export const WIZARD_DELIVERY_LABELS: Record<WizardDelivery, string> = {
  PDF: 'PDF в кабинете',
  PICKUP: 'Забрать в деканате',
  MAIL: 'Почтой',
};

export const WIZARD_LANGUAGE_LABELS: Record<WizardLanguage, string> = {
  RU: 'Русский',
  EN: 'English',
};

/** Лимиты мастера (приёмка: вложения до 5 файлов и до 10 МБ). */
export const WIZARD_LIMITS = {
  MAX_FILES: 5,
  MAX_FILE_MB: 10,
  MAX_DESTINATION_LENGTH: 120,
  MAX_COMMENT_LENGTH: 500,
  MAX_COPIES: 5,
} as const;

export interface WizardDocConfig {
  /** Тип создаваемой заявки (ServiceRequest.type). */
  requestType: RequestType;
  /** «Куда предоставляется»: hidden — поля нет, required — обязательное. */
  destination: 'hidden' | 'optional' | 'required';
  /** Поле языка (RU/EN) — у справок есть, у заявлений нет. */
  language: boolean;
  /** Допустимое количество экземпляров (заявления — ровно 1). */
  copies: { min: number; max: number };
  /** Доступные способы получения; мгновенные документы — только PDF. */
  delivery: WizardDelivery[];
  /** Вложения (сканы документов) — только у заявлений. */
  attachments: boolean;
}

export interface WizardDoc {
  serviceId: string;
  title: string;
  /** Одна строка «что это за документ» (польза из каталога). */
  oneLiner: string;
  eta: ServiceEta;
  etaLabel: string;
  format: ServiceFormat;
  formatLabel: string;
  /** Мгновенный документ: PDF готов сразу после отправки. */
  instant: boolean;
  config: WizardDocConfig;
}

/**
 * Конфиги по id каталога. Ключи — ровно все ORDER-сервисы (тест следит за
 * полнотой), правила: справки — с языком и доставкой PDF/деканат/почтой,
 * заявления — с вложениями и без языка, мгновенные — только PDF.
 */
const DOCS: Record<string, WizardDocConfig> = {
  // Справки
  'cert-enrollment': {
    requestType: 'CERTIFICATE',
    destination: 'optional',
    language: true,
    copies: { min: 1, max: 3 },
    delivery: ['PDF'],
    attachments: false,
  },
  'cert-grades': {
    requestType: 'CERTIFICATE',
    destination: 'optional',
    language: true,
    copies: { min: 1, max: 3 },
    delivery: ['PDF', 'PICKUP', 'MAIL'],
    attachments: false,
  },
  'cert-tax': {
    requestType: 'CERTIFICATE',
    destination: 'required',
    language: true,
    copies: { min: 1, max: 2 },
    delivery: ['PDF', 'PICKUP'],
    attachments: false,
  },
  'cert-defer': {
    requestType: 'CERTIFICATE',
    destination: 'required',
    language: true,
    copies: { min: 1, max: 3 },
    delivery: ['PDF', 'PICKUP', 'MAIL'],
    attachments: false,
  },
  'fin-scholarship-cert': {
    requestType: 'CERTIFICATE',
    destination: 'optional',
    language: true,
    copies: { min: 1, max: 2 },
    delivery: ['PDF', 'PICKUP', 'MAIL'],
    attachments: false,
  },
  'fin-tuition-cert': {
    requestType: 'CERTIFICATE',
    destination: 'optional',
    language: true,
    copies: { min: 1, max: 2 },
    delivery: ['PDF', 'PICKUP'],
    attachments: false,
  },
  'dorm-residence-cert': {
    requestType: 'CERTIFICATE',
    destination: 'optional',
    language: true,
    copies: { min: 1, max: 3 },
    delivery: ['PDF', 'PICKUP', 'MAIL'],
    attachments: false,
  },

  // Заявления и документные услуги (бумажные, со сканами-вложениями)
  'stmt-individual-plan': {
    requestType: 'STATEMENT',
    destination: 'hidden',
    language: false,
    copies: { min: 1, max: 1 },
    delivery: ['PICKUP', 'MAIL'],
    attachments: true,
  },
  'stmt-academic-leave': {
    requestType: 'STATEMENT',
    destination: 'hidden',
    language: false,
    copies: { min: 1, max: 1 },
    delivery: ['PICKUP', 'MAIL'],
    attachments: true,
  },
  'stmt-transfer': {
    requestType: 'STATEMENT',
    destination: 'hidden',
    language: false,
    copies: { min: 1, max: 1 },
    delivery: ['PICKUP', 'MAIL'],
    attachments: true,
  },
  'study-duplicate-gradebook': {
    requestType: 'STATEMENT',
    destination: 'hidden',
    language: false,
    copies: { min: 1, max: 1 },
    delivery: ['PICKUP', 'MAIL'],
    attachments: true,
  },
  'dorm-checkin': {
    requestType: 'DORMITORY',
    destination: 'hidden',
    language: false,
    copies: { min: 1, max: 1 },
    delivery: ['PICKUP', 'MAIL'],
    attachments: true,
  },
};

function toDoc(service: (typeof SERVICES)[number]): WizardDoc {
  const config = DOCS[service.id];
  if (!config) throw new Error(`request-wizard: у сервиса ${service.id} нет конфига мастера`);
  return {
    serviceId: service.id,
    title: service.title,
    oneLiner: service.benefit,
    eta: service.eta,
    etaLabel: ETA_LABELS[service.eta],
    format: service.format ?? 'PDF',
    formatLabel: FORMAT_LABELS[service.format ?? 'PDF'],
    instant: service.eta === 'INSTANT',
    config,
  };
}

/** Документы мастера в порядке каталога: ровно все услуги «Заказать». */
export function wizardDocs(): WizardDoc[] {
  return SERVICES.filter((service) => service.action === 'ORDER').map(toDoc);
}

/** Документ по id каталога; null — неизвестный или не-ORDER (чужеролевой). */
export function wizardDocFor(serviceId: string): WizardDoc | null {
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service || service.action !== 'ORDER' || !DOCS[service.id]) return null;
  return toDoc(service);
}

// ── Черновик и валидация (общие для клиента и сервера) ──────────────────────

export interface WizardAttachment {
  name: string;
  size: number;
}

export interface WizardDraftInput {
  destination: string;
  language: WizardLanguage;
  copies: number;
  delivery: WizardDelivery;
  comment: string;
  consent: boolean;
  attachments: WizardAttachment[];
}

export type WizardFieldKey =
  | 'serviceId'
  | 'destination'
  | 'copies'
  | 'delivery'
  | 'comment'
  | 'attachments'
  | 'consent';

export type WizardFieldErrors = Partial<Record<WizardFieldKey, string>>;

/**
 * Единая валидация шага 2 (и согласия шага 3). Возвращает {} при успехе,
 * иначе — понятные сообщения по ключам полей. Сервер вызывает ту же функцию:
 * обойти клиентскую проверку невозможно.
 */
export function validateWizardInput(doc: WizardDoc, input: WizardDraftInput): WizardFieldErrors {
  const errors: WizardFieldErrors = {};
  const { config } = doc;

  const destination = input.destination.trim();
  if (destination.length > WIZARD_LIMITS.MAX_DESTINATION_LENGTH) {
    errors.destination = `Не длиннее ${WIZARD_LIMITS.MAX_DESTINATION_LENGTH} символов`;
  } else if (config.destination === 'required' && destination.length === 0) {
    errors.destination = 'Укажите, куда предоставляется документ';
  }

  if (!Number.isInteger(input.copies) || input.copies < config.copies.min || input.copies > config.copies.max) {
    errors.copies =
      config.copies.min === config.copies.max
        ? `Экземпляров: ровно ${config.copies.max}`
        : `От ${config.copies.min} до ${config.copies.max} экземпляров`;
  }

  if (!config.delivery.includes(input.delivery)) {
    errors.delivery = 'Выберите доступный способ получения';
  }

  if (input.comment.trim().length > WIZARD_LIMITS.MAX_COMMENT_LENGTH) {
    errors.comment = `Комментарий не длиннее ${WIZARD_LIMITS.MAX_COMMENT_LENGTH} символов`;
  }

  if (config.attachments) {
    if (input.attachments.length > WIZARD_LIMITS.MAX_FILES) {
      errors.attachments = `Не больше ${WIZARD_LIMITS.MAX_FILES} файлов`;
    } else {
      const maxBytes = WIZARD_LIMITS.MAX_FILE_MB * 1024 * 1024;
      const offender = input.attachments.find((file) => file.size > maxBytes || file.name.trim().length === 0);
      if (offender) {
        errors.attachments =
          offender.name.trim().length === 0
            ? 'У файла нет имени'
            : `Файл «${offender.name}» больше ${WIZARD_LIMITS.MAX_FILE_MB} МБ`;
      }
    }
  } else if (input.attachments.length > 0) {
    errors.attachments = 'Этому документу вложения не нужны';
  }

  if (!input.consent) {
    errors.consent = 'Подтвердите, что данные верны';
  }

  return errors;
}

/** Нормализация черновика под конфиг документа (смена типа, невалидные поля). */
export function normalizeDraft(doc: WizardDoc, input: WizardDraftInput): WizardDraftInput {
  return {
    destination: input.destination.trim().slice(0, WIZARD_LIMITS.MAX_DESTINATION_LENGTH),
    language: doc.config.language && input.language === 'EN' ? 'EN' : 'RU',
    copies: Math.min(Math.max(Math.trunc(input.copies) || doc.config.copies.min, doc.config.copies.min), doc.config.copies.max),
    delivery: doc.config.delivery.includes(input.delivery) ? input.delivery : doc.config.delivery[0]!,
    comment: input.comment.trim().slice(0, WIZARD_LIMITS.MAX_COMMENT_LENGTH),
    consent: input.consent === true,
    attachments: doc.config.attachments
      ? input.attachments.slice(0, WIZARD_LIMITS.MAX_FILES).filter((f) => f.name.trim().length > 0)
      : [],
  };
}

/** Сводка параметров для первого события заявки (история на карточке DIG-33). */
export function buildOrderSummary(doc: WizardDoc, input: WizardDraftInput): string {
  const clean = normalizeDraft(doc, input);
  const parts: string[] = ['Заказ из мастера заказа'];
  if (doc.config.destination !== 'hidden' && clean.destination.length > 0) {
    parts.push(`куда предоставляется: ${clean.destination}`);
  }
  if (doc.config.language) {
    parts.push(`язык: ${WIZARD_LANGUAGE_LABELS[clean.language]}`);
  }
  parts.push(`экземпляров: ${clean.copies}`);
  parts.push(`получение: ${WIZARD_DELIVERY_LABELS[clean.delivery]}`);
  if (clean.comment.length > 0) {
    parts.push(`комментарий: ${clean.comment}`);
  }
  if (clean.attachments.length > 0) {
    parts.push(`вложения: ${clean.attachments.map((file) => file.name).join(', ')}`);
  }
  return parts.join(' · ');
}

// ── Ожидаемая дата ──────────────────────────────────────────────────────────

const ETA_WAIT_DAYS: Record<ServiceEta, number> = {
  INSTANT: 0,
  DAYS_1: 1,
  DAYS_2_3: 3,
  DAYS_5: 5,
};

/** Ожидаемая дата готовности: сегодня + срок каталога (мгновенно — сегодня). */
export function expectedDateFor(eta: ServiceEta, now: Date): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() + ETA_WAIT_DAYS[eta]);
  return date;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

/** «19 ноября» — формат ожидаемой даты на экране успеха. */
export function formatWizardDate(date: Date): string {
  return dateFormatter.format(date);
}
