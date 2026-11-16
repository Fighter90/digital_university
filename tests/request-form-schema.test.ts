// DIG-30 — JSON-схема полей формы заявки и zod-валидация на сервере.
// Схема хранится в RequestType.formSchema (Json); сервер обязан валидировать
// ввод zod'ом и строить название заявки «тип · ключевой параметр».
import { describe, expect, it } from 'vitest';
import {
  parseRequestFormSchema,
  requestTitleFromParams,
  validateRequestForm,
  type RequestFormSchema,
} from '@/lib/request-form-schema';

const CERT_SCHEMA: RequestFormSchema = {
  keyField: 'purpose',
  fields: [
    {
      key: 'purpose',
      label: 'Назначение',
      type: 'enum',
      required: true,
      options: ['для банка', 'для военкомата', 'по месту требования'],
    },
  ],
};

const LEAVE_SCHEMA: RequestFormSchema = {
  keyField: 'period',
  fields: [
    { key: 'period', label: 'Период', type: 'text', required: true, maxLength: 60 },
    { key: 'reason', label: 'Причина', type: 'text', required: true },
    { key: 'comment', label: 'Комментарий', type: 'text' },
    { key: 'from', label: 'Дата начала', type: 'date', required: true },
  ],
};

describe('parseRequestFormSchema: разбор JSON (DIG-30)', () => {
  it('валидирует корректную схему', () => {
    expect(parseRequestFormSchema(CERT_SCHEMA)).toEqual(CERT_SCHEMA);
    expect(parseRequestFormSchema(null)).toBeNull();
  });

  it('отклоняет сломанные схемы (не объект, без fields, неизвестный тип поля, enum без options)', () => {
    expect(parseRequestFormSchema('nope')).toBeNull();
    expect(parseRequestFormSchema(42)).toBeNull();
    expect(parseRequestFormSchema({ fields: 'nope' })).toBeNull();
    expect(
      parseRequestFormSchema({ fields: [{ key: 'a', label: 'А', type: 'mystic' }] }),
    ).toBeNull();
    expect(parseRequestFormSchema({ fields: [{ key: 'a', label: 'А', type: 'enum' }] })).toBeNull();
    expect(parseRequestFormSchema({ fields: [{ key: 'a', label: '', type: 'text' }] })).toBeNull();
    expect(parseRequestFormSchema({ keyField: 'ghost', fields: [] })).toBeNull();
  });
});

describe('validateRequestForm: zod на сервере (DIG-30)', () => {
  it('принимает валидную форму enum-поля и отбрасывает чужие ключи', () => {
    const result = validateRequestForm(CERT_SCHEMA, {
      purpose: 'для банка',
      hacker: 'inject',
    });
    expect(result).toEqual({ ok: true, data: { purpose: 'для банка' } });
  });

  it('обязательное поле: пустое/отсутствующее — ошибка с меткой поля', () => {
    for (const data of [{}, { purpose: '' }, { purpose: '   ' }]) {
      const result = validateRequestForm(CERT_SCHEMA, data);
      expect(result.ok, JSON.stringify(data)).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Назначение');
        // Обязательность: для enum — «Выберите…», для text — «Заполните…».
        expect(result.error).toMatch(/Заполните|Выберите/);
      }
    }
  });

  it('значение вне списка опций отклоняется', () => {
    const result = validateRequestForm(CERT_SCHEMA, { purpose: 'для шпионажа' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Назначение');
  });

  it('text: required, maxLength, тримминг; необязательное поле может быть пустым', () => {
    const ok = validateRequestForm(LEAVE_SCHEMA, {
      period: '  2 семестра  ',
      reason: 'по состоянию здоровья',
      comment: '',
      from: '2026-12-01',
    });
    expect(ok).toEqual({
      ok: true,
      data: {
        period: '2 семестра',
        reason: 'по состоянию здоровья',
        comment: '',
        from: '2026-12-01',
      },
    });

    const missing = validateRequestForm(LEAVE_SCHEMA, { reason: 'x', from: '2026-12-01' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('Период');

    const long = validateRequestForm(LEAVE_SCHEMA, {
      period: 'п'.repeat(61),
      reason: 'x',
      from: '2026-12-01',
    });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain('Период');

    const badDate = validateRequestForm(LEAVE_SCHEMA, {
      period: '1',
      reason: 'x',
      from: 'скоро',
    });
    expect(badDate.ok).toBe(false);
    if (!badDate.ok) expect(badDate.error).toContain('Дата начала');
  });

  it('date: несуществующие календарные даты отклоняются, високосный день принимается (ревью DIG-30)', () => {
    for (const bad of ['2026-13-45', '2026-02-30', '2025-02-29', '2026-04-31']) {
      const result = validateRequestForm(LEAVE_SCHEMA, {
        period: '1',
        reason: 'x',
        from: bad,
      });
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.error).toContain('Дата начала');
    }
    const leap = validateRequestForm(LEAVE_SCHEMA, {
      period: '1',
      reason: 'x',
      from: '2024-02-29',
    });
    expect(leap).toEqual({
      ok: true,
      data: { period: '1', reason: 'x', comment: '', from: '2024-02-29' },
    });
  });

  it('сломанная схема формы — явная ошибка, а не исключение', () => {
    const result = validateRequestForm('мусор', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('схема');
  });
});

describe('requestTitleFromParams: «тип · ключевой параметр» (DIG-30)', () => {
  it('ключевой параметр попадает в название', () => {
    expect(
      requestTitleFromParams('Справка об обучении', CERT_SCHEMA, { purpose: 'для банка' }),
    ).toBe('Справка об обучении · для банка');
    expect(
      requestTitleFromParams('Справка об обучении', CERT_SCHEMA, { purpose: 'для военкомата' }),
    ).toBe('Справка об обучении · для военкомата');
  });

  it('без ключевого поля (или без значения) название — просто тип', () => {
    expect(requestTitleFromParams('Выписка оценок', null, {})).toBe('Выписка оценок');
    expect(requestTitleFromParams('Выписка оценок', { fields: [] }, { anything: 'x' })).toBe(
      'Выписка оценок',
    );
    expect(requestTitleFromParams('Справка об обучении', CERT_SCHEMA, { purpose: '  ' })).toBe(
      'Справка об обучении',
    );
  });

  it('слишком длинное название обрезается с многоточием', () => {
    const longValue = 'п'.repeat(300);
    const title = requestTitleFromParams('Справка об обучении', CERT_SCHEMA, {
      purpose: longValue,
    });
    expect(title.length).toBeLessThanOrEqual(140);
    expect(title.endsWith('…')).toBe(true);
    expect(title.startsWith('Справка об обучении · ')).toBe(true);
  });
});
