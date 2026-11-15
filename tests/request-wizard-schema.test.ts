// DIG-31 — общие поля мастера заказа (язык, экземпляры, способ получения,
// комментарий, вложения): лимиты, строгая серверная валидация
// validateWizardMeta (человеческая первая ошибка) и терпимая клиентская
// normalizeWizardMeta для состояния черновика. Плюс по-полевая валидация
// формы типа validateRequestFormFields — карта ошибок для клиента
// (агрегатная validateRequestForm сервера не меняется).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WIZARD_META,
  MAX_WIZARD_COMMENT_LENGTH,
  MAX_WIZARD_COPIES,
  MAX_WIZARD_DESTINATION_LENGTH,
  MAX_WIZARD_FILE_SIZE_BYTES,
  MAX_WIZARD_FILE_SIZE_MB,
  MAX_WIZARD_FILES,
  normalizeWizardMeta,
  validateWizardMeta,
  wizardFilesError,
} from '@/lib/request-wizard-schema';
import { validateRequestFormFields } from '@/lib/request-form-schema';

const CERT_SCHEMA = {
  keyField: 'purpose',
  fields: [
    {
      key: 'purpose',
      label: 'Назначение',
      type: 'enum',
      required: true,
      options: ['для банка', 'для военкомата'],
    },
  ],
};

const validMeta = (overrides: Record<string, unknown> = {}) => ({
  destination: 'ПАО «Банк», отделение № 2',
  language: 'RU',
  copies: 2,
  delivery: 'PICKUP',
  comment: 'Нужно к пятнице',
  attachments: [{ name: 'паспорт.pdf', size: 1024 }],
  ...overrides,
});

describe('лимиты мастера (DIG-31)', () => {
  it('лимиты из задачи: ≤5 файлов, ≤10 МБ, экземпляры ≤5, комментарий ≤500', () => {
    expect(MAX_WIZARD_FILES).toBe(5);
    expect(MAX_WIZARD_FILE_SIZE_MB).toBe(10);
    expect(MAX_WIZARD_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_WIZARD_COPIES).toBe(5);
    expect(MAX_WIZARD_COMMENT_LENGTH).toBe(500);
    expect(MAX_WIZARD_DESTINATION_LENGTH).toBe(200);
  });
});

describe('validateWizardMeta: серверная валидация', () => {
  it('принимает корректную мету (значения триммируются)', () => {
    const result = validateWizardMeta(validMeta());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(validMeta());
    }
  });

  it('принимает мету без необязательных полей → пустые строки и дефолты не навязываются', () => {
    const result = validateWizardMeta({ language: 'EN', copies: 1, delivery: 'PDF_ONLINE' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.destination).toBe('');
      expect(result.data.comment).toBe('');
      expect(result.data.attachments).toEqual([]);
      expect(result.data.language).toBe('EN');
    }
  });

  it('отклоняет мусор и неизвестные значения словарей', () => {
    expect(validateWizardMeta(null).ok).toBe(false);
    expect(validateWizardMeta('nope').ok).toBe(false);
    expect(validateWizardMeta([]).ok).toBe(false);
    expect(validateWizardMeta(validMeta({ language: 'DE' })).ok).toBe(false);
    expect(validateWizardMeta(validMeta({ delivery: 'DRONE' })).ok).toBe(false);
    const bad = validateWizardMeta(validMeta({ copies: 0 }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('от 1 до 5');
  });

  it('не больше 5 файлов, каждое вложение ≤10 МБ, имя файла не пустое', () => {
    const six = validateWizardMeta(
      validMeta({
        attachments: Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 })),
      }),
    );
    expect(six.ok).toBe(false);
    if (!six.ok) expect(six.error).toContain('не больше 5');

    const big = validateWizardMeta(
      validMeta({ attachments: [{ name: 'скан.pdf', size: MAX_WIZARD_FILE_SIZE_BYTES + 1 }] }),
    );
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toContain('скан.pdf');
    if (!big.ok) expect(big.error).toContain('10 МБ');

    expect(validateWizardMeta(validMeta({ attachments: [{ name: '', size: 1 }] })).ok).toBe(false);
    expect(validateWizardMeta(validMeta({ attachments: [{ name: 'a.pdf', size: -5 }] })).ok).toBe(
      false,
    );
    // на границе — проходит
    expect(
      validateWizardMeta(validMeta({ attachments: [{ name: 'a.pdf', size: MAX_WIZARD_FILE_SIZE_BYTES }] }))
        .ok,
    ).toBe(true);
  });

  it('ограничения длины комментария и «куда предоставляется»', () => {
    const longComment = validateWizardMeta(
      validMeta({ comment: 'ж'.repeat(MAX_WIZARD_COMMENT_LENGTH + 1) }),
    );
    expect(longComment.ok).toBe(false);
    if (!longComment.ok) expect(longComment.error).toContain('500');

    const longDestination = validateWizardMeta(
      validMeta({ destination: 'б'.repeat(MAX_WIZARD_DESTINATION_LENGTH + 1) }),
    );
    expect(longDestination.ok).toBe(false);
    if (!longDestination.ok) expect(longDestination.error).toContain('200');
  });
});

describe('wizardFilesError: лимиты вложений на клиенте (DIG-31)', () => {
  it('6-й файл и файл больше 10 МБ дают те же сообщения, что и сервер', () => {
    expect(wizardFilesError([], 5)).toBeNull();
    expect(wizardFilesError([{ name: 'g.pdf', size: 1 }], 5)).toContain('не больше 5');
    expect(
      wizardFilesError(
        Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 })),
        0,
      ),
    ).toContain('не больше 5');
    expect(
      wizardFilesError([{ name: 'скан.pdf', size: MAX_WIZARD_FILE_SIZE_BYTES + 1 }], 0),
    ).toContain('скан.pdf');
    expect(
      wizardFilesError([{ name: 'скан.pdf', size: MAX_WIZARD_FILE_SIZE_BYTES }], 4),
    ).toBeNull();
    expect(wizardFilesError([{ name: 'a.pdf', size: 1 }], 4)).toBeNull();
  });
});

describe('normalizeWizardMeta: терпимый разбор черновика (клиент)', () => {
  it('пустой/битый ввод → дефолт (RU, 1 экз., PDF в кабинете)', () => {
    expect(normalizeWizardMeta(null)).toEqual(DEFAULT_WIZARD_META);
    expect(normalizeWizardMeta(undefined)).toEqual(DEFAULT_WIZARD_META);
    expect(normalizeWizardMeta('x')).toEqual(DEFAULT_WIZARD_META);
    expect(normalizeWizardMeta({})).toEqual({
      destination: '',
      language: 'RU',
      copies: 1,
      delivery: 'PDF_ONLINE',
      comment: '',
      attachments: [],
    });
  });

  it('сохраняет валидные значения, отбрасывает битые (copies-мусор → 1, чужие вложения → [])', () => {
    const meta = normalizeWizardMeta(validMeta({ copies: 99, attachments: [{ name: '' }] }));
    expect(meta.copies).toBe(1);
    expect(meta.attachments).toEqual([]);
    expect(meta.language).toBe('RU');
    expect(meta.delivery).toBe('PICKUP');
    expect(meta.destination).toBe('ПАО «Банк», отделение № 2');
  });
});

describe('validateRequestFormFields: по-полевая карта ошибок (клиент DIG-31)', () => {
  it('пустое обязательное enum-поле даёт ошибку с ключом поля и человеческим текстом', () => {
    const result = validateRequestFormFields(CERT_SCHEMA, { purpose: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) return;
    expect(result.errors.purpose).toContain('Назначение');
    expect(Object.keys(result.errors)).toEqual(['purpose']);
  });

  it('несколько полей — ошибки по каждому ключу, ok при полном прохождении', () => {
    const leaveSchema = {
      keyField: 'period',
      fields: [
        { key: 'period', label: 'Период', type: 'text', required: true, maxLength: 60 },
        { key: 'from', label: 'Дата начала', type: 'date', required: true },
      ],
    };
    const both = validateRequestFormFields(leaveSchema, { period: '', from: '2026-13-99' });
    expect(both.ok).toBe(false);
    if (!both.ok) return;
    expect(Object.keys(both.errors).sort()).toEqual(['from', 'period']);
    expect(both.errors.period).toContain('Период');

    const good = validateRequestFormFields(leaveSchema, { period: 'осень 2026', from: '2026-09-01' });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.data).toEqual({ period: 'осень 2026', from: '2026-09-01' });
      expect(good.errors).toEqual({});
    }
  });

  it('чужие ключи отбрасываются', () => {
    const result = validateRequestFormFields(CERT_SCHEMA, { purpose: 'для банка', hack: 'x' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ purpose: 'для банка' });
  });

  it('сломанная схема — общий ответ ok:false (не карта)', () => {
    const result = validateRequestFormFields({ fields: 'nope' }, {});
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) expect(result.error).toContain('схема');
  });
});
