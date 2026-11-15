// DIG-31 — мастер заказа справки/заявления: реестр документов и валидатор.
// Красная фаза: контракт зафиксирован ДО реализации.
//
// Приёмка задачи: реестр собран из каталога DIG-29 (action ORDER, ничего
// лишнего), поля шага 2 зависят от типа, мгновенная справка об обучении
// доставляется только PDF, валидация одна и та же для клиента и сервера,
// даты ожидания считаются из срока каталога.
import { describe, expect, it } from 'vitest';

import { SERVICES } from '@/lib/services-catalog';
import {
  WIZARD_DELIVERY_LABELS,
  WIZARD_LANGUAGE_LABELS,
  WIZARD_LIMITS,
  buildOrderSummary,
  expectedDateFor,
  formatWizardDate,
  validateWizardInput,
  wizardDocFor,
  wizardDocs,
  type WizardDraftInput,
} from '@/lib/request-wizard';

const ORDER_IDS = SERVICES.filter((s) => s.action === 'ORDER').map((s) => s.id);

const draft = (overrides: Partial<WizardDraftInput> = {}): WizardDraftInput => ({
  destination: '',
  language: 'RU',
  copies: 1,
  delivery: 'PDF',
  comment: '',
  consent: true,
  attachments: [],
  ...overrides,
});

describe('wizardDocs — реестр из каталога (единый источник правды)', () => {
  it('покрывает ровно все услуги с «Заказать» и ничего лишнего', () => {
    const ids = wizardDocs().map((d) => d.serviceId);
    expect(ids).toEqual(ORDER_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('каждый документ несёт заголовок, одну строку пользы, срок и формат каталога', () => {
    for (const doc of wizardDocs()) {
      const service = SERVICES.find((s) => s.id === doc.serviceId)!;
      expect(doc.title).toBe(service.title);
      expect(doc.oneLiner).toBe(service.benefit);
      expect(doc.etaLabel).not.toBe('');
      expect(doc.formatLabel).not.toBe('');
      expect(doc.instant).toBe(service.eta === 'INSTANT');
    }
  });

  it('wizardDocFor — null для неизвестного и не-ORDER id (чужеролевые не заказываются)', () => {
    expect(wizardDocFor('cert-defer')).not.toBeNull();
    expect(wizardDocFor('transcript-instant')).toBeNull(); // action OPEN
    expect(wizardDocFor('нет-такого')).toBeNull();
    expect(wizardDocFor('app-personal-cabinet')).toBeNull();
  });
});

describe('зависимость полей шага 2 от типа документа', () => {
  it('мгновенная справка об обучении: срок «Мгновенно», доставка только «PDF в кабинете»', () => {
    const doc = wizardDocFor('cert-enrollment')!;
    expect(doc.instant).toBe(true);
    expect(doc.etaLabel).toBe('Мгновенно');
    expect(doc.config.delivery).toEqual(['PDF']);
    expect(WIZARD_DELIVERY_LABELS.PDF).toBe('PDF в кабинете');
  });

  it('справка для военкомата: адресат обязателен, язык есть, доставкаPDF+деканат+почтой', () => {
    const doc = wizardDocFor('cert-defer')!;
    expect(doc.config.destination).toBe('required');
    expect(doc.config.language).toBe(true);
    expect(doc.config.delivery).toEqual(['PDF', 'PICKUP', 'MAIL']);
    expect(doc.config.attachments).toBe(false);
    expect(doc.config.copies.max).toBeGreaterThanOrEqual(2);
    expect(doc.config.copies.max).toBeLessThanOrEqual(WIZARD_LIMITS.MAX_COPIES);
  });

  it('заявление (академический отпуск): вложения есть, языка и адресата нет', () => {
    const doc = wizardDocFor('stmt-academic-leave')!;
    expect(doc.config.attachments).toBe(true);
    expect(doc.config.language).toBe(false);
    expect(doc.config.destination).toBe('hidden');
    expect(doc.config.delivery).not.toContain('PDF'); // бумажный документ
    expect(doc.config.copies).toEqual({ min: 1, max: 1 });
  });

  it('справка для налогового вычета тоже требует адресата', () => {
    expect(wizardDocFor('cert-tax')!.config.destination).toBe('required');
  });
});

describe('validateWizardInput — понятные ошибки у полей (клиент и сервер)', () => {
  const doc = wizardDocFor('cert-defer')!;

  it('корректный черновик — ошибок нет', () => {
    expect(
      validateWizardInput(doc, draft({ destination: 'Военкомат по месту учёбы', copies: 2, delivery: 'MAIL' })),
    ).toEqual({});
  });

  it('пустой обязательный адресат и слишком длинный адресат', () => {
    const empty = validateWizardInput(doc, draft({}));
    expect(empty.destination).toBe('Укажите, куда предоставляется документ');

    const long = validateWizardInput(doc, draft({ destination: 'А'.repeat(WIZARD_LIMITS.MAX_DESTINATION_LENGTH + 1) }));
    expect(long.destination).toContain('120');
  });

  it('экземпляры: не целое, ниже минимума, выше максимума документа', () => {
    expect(validateWizardInput(doc, draft({ copies: Number.NaN })).copies).toBeTruthy();
    expect(validateWizardInput(doc, draft({ copies: 0 })).copies).toContain('1');
    expect(validateWizardInput(doc, draft({ copies: 99 })).copies).toContain(String(doc.config.copies.max));
    expect(validateWizardInput(doc, draft({ copies: 1.5 })).copies).toBeTruthy();
  });

  it('способ получения вне набора документа отклоняется', () => {
    expect(validateWizardInput(doc, draft({ delivery: 'COURIER' as never })).delivery).toBeTruthy();
    const instant = wizardDocFor('cert-enrollment')!;
    expect(validateWizardInput(instant, draft({ delivery: 'MAIL' })).delivery).toBeTruthy();
    expect(validateWizardInput(instant, draft({ delivery: 'PDF' }))).toEqual({});
  });

  it('комментарий длиннее лимита — ошибка с числом', () => {
    const errors = validateWizardInput(doc, draft({ comment: 'б'.repeat(WIZARD_LIMITS.MAX_COMMENT_LENGTH + 1) }));
    expect(errors.comment).toContain(String(WIZARD_LIMITS.MAX_COMMENT_LENGTH));
  });

  it('вложения: больше 5 файлов, файл больше 10 МБ, вложения у справки запрещены', () => {
    const stmt = wizardDocFor('stmt-academic-leave')!;
    const files = Array.from({ length: WIZARD_LIMITS.MAX_FILES + 1 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 }));
    expect(validateWizardInput(stmt, draft({ attachments: files })).attachments).toContain(
      String(WIZARD_LIMITS.MAX_FILES),
    );

    const tooBig = validateWizardInput(stmt, draft({ attachments: [{ name: 'scan.pdf', size: 10 * 1024 * 1024 + 1 }] }));
    expect(tooBig.attachments).toContain('scan.pdf');
    expect(tooBig.attachments).toContain('10');

    // Справке вложения не нужны: переданные файлы — ошибка, пусто — ок.
    expect(
      validateWizardInput(doc, draft({ destination: 'Военкомат', attachments: [{ name: 'x.png', size: 1 }] }))
        .attachments,
    ).toBeTruthy();
    expect(validateWizardInput(doc, draft({ destination: 'Военкомат' }))).toEqual({});
  });

  it('без согласия «Данные верны» отправка невозможна', () => {
    expect(validateWizardInput(doc, draft({ consent: false })).consent).toBe(
      'Подтвердите, что данные верны',
    );
  });

  it('язык: у документа без языка значение нормализуется в RU без ошибки', () => {
    const stmt = wizardDocFor('stmt-academic-leave')!;
    expect(validateWizardInput(stmt, draft({ language: 'EN', delivery: 'PICKUP' }))).toEqual({});
    expect(WIZARD_LANGUAGE_LABELS.RU).toBe('Русский');
    expect(WIZARD_LANGUAGE_LABELS.EN).toBe('English');
  });
});

describe('expectedDateFor — ожидаемая дата из срока каталога', () => {
  const now = new Date(2026, 10, 16, 12, 0, 0); // 16 ноября 2026, понедельник

  it('мгновенно — сегодня; 1 день → +1; 2–3 дня → +3; до 5 дней → +5', () => {
    expect(expectedDateFor('INSTANT', now).toDateString()).toBe(now.toDateString());
    expect(expectedDateFor('DAYS_1', now).getDate()).toBe(17);
    expect(expectedDateFor('DAYS_2_3', now).getDate()).toBe(19);
    expect(expectedDateFor('DAYS_5', now).getDate()).toBe(21);
  });

  it('formatWizardDate — «день месяца» по-русски', () => {
    expect(formatWizardDate(new Date(2026, 10, 19))).toBe('19 ноября');
  });
});

describe('buildOrderSummary — человекочитаемая сводка для истории заявки', () => {
  it('содержит адресат, язык, экземпляры, получение, комментарий и вложения', () => {
    const summary = buildOrderSummary(wizardDocFor('cert-defer')!, {
      ...draft({ destination: 'Военкомат по месту учёбы', copies: 2, delivery: 'MAIL' }),
      comment: 'Нужна для подачи документов',
      attachments: [],
    });
    expect(summary).toContain('Военкомат по месту учёбы');
    expect(summary).toContain('Русский');
    expect(summary).toContain('2');
    expect(summary).toContain(WIZARD_DELIVERY_LABELS.MAIL);
    expect(summary).toContain('Нужна для подачи документов');
  });

  it('у заявления перечисляет вложения и не упоминает язык', () => {
    const summary = buildOrderSummary(wizardDocFor('stmt-academic-leave')!, {
      ...draft({ delivery: 'PICKUP' }),
      attachments: [{ name: 'spravka.pdf', size: 100 }],
    });
    expect(summary).toContain('spravka.pdf');
    expect(summary).not.toContain('язык');
  });

  it('стиль текста: без прямых кавычек и двойных пробелов', () => {
    const summary = buildOrderSummary(wizardDocFor('cert-defer')!, draft({ destination: 'Военкомат' }));
    expect(summary).not.toContain('"');
    expect(summary).not.toMatch(/  /);
  });
});
