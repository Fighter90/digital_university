// DIG-47 — чистые помощники публичной проверки справок: код проверки
// (≥128 бит, base32), нормализация ввода, маскирование ФИО, статусы.
// Красная фаза: контракт зафиксирован ДО реализации.
import { describe, expect, it } from 'vitest';

import {
  VERIFICATION_CODE_PATTERN,
  certificateStatusFor,
  generateVerificationCode,
  maskFullName,
  normalizeVerificationCode,
} from '@/lib/verify';

const VALID_CODE = 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777';

describe('verify: код проверки', () => {
  it('паттерн: 8 групп по 4 символа base32 через дефис', () => {
    expect(VERIFICATION_CODE_PATTERN.test(VALID_CODE)).toBe(true);
    // 0, 1, 8, 9 в base32 запрещены
    expect(VERIFICATION_CODE_PATTERN.test('A0CD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777')).toBe(false);
    expect(VERIFICATION_CODE_PATTERN.test('ABCD-EFGH-JKLM-NPQR')).toBe(false);
    expect(VERIFICATION_CODE_PATTERN.test('')).toBe(false);
  });

  it('генератор выдаёт валидный формат', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateVerificationCode()).toMatch(VERIFICATION_CODE_PATTERN);
    }
  });

  it('энтропия не ниже 128 бит: 32 символа × 5 бит = 160', () => {
    expect(32 * Math.log2(32)).toBeGreaterThanOrEqual(128);
  });

  it('генератор криптографический: коды не повторяются', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i += 1) codes.add(generateVerificationCode());
    expect(codes.size).toBe(200);
  });
});

describe('verify: нормализация кода', () => {
  it('каноническое начертание проходит без изменений', () => {
    expect(normalizeVerificationCode(VALID_CODE)).toBe(VALID_CODE);
  });

  it('дефисы, пробелы и регистр приводятся к канону', () => {
    expect(normalizeVerificationCode('abcd efgh jklm npqr stuv wxyz 2345 6777')).toBe(VALID_CODE);
    expect(normalizeVerificationCode(VALID_CODE.replaceAll('-', ''))).toBe(VALID_CODE);
    expect(normalizeVerificationCode(`  ${VALID_CODE.toLowerCase()}  `)).toBe(VALID_CODE);
  });

  it('URL-безопасное начертание без дефисов принимается', () => {
    expect(normalizeVerificationCode('ABCDEFGHJKLMNPQRSTUVWX YZ23456777'.replaceAll(' ', ''))).toBe(
      'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777',
    );
  });

  it.each([
    ['hello'],
    [''],
    ['   '],
    [`${VALID_CODE}-EXTRA`], // лишняя группа
    ['ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-677A0'], // лишний символ
    ['AB0D-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777'], // 0 вне алфавита
  ])('невалидный ввод %j → null', (raw) => {
    expect(normalizeVerificationCode(raw)).toBeNull();
  });
});

describe('verify: маскирование ФИО', () => {
  it('фамилия (первое слово) + инициалы, как в договоре экрана («Смирнова А. В.»)', () => {
    expect(maskFullName('Смирнова Алла Викторовна')).toBe('Смирнова А. В.');
  });

  it('две части: фамилия + один инициал', () => {
    expect(maskFullName('Ковалёва Анна')).toBe('Ковалёва А.');
    expect(maskFullName('Смирнов Илья')).toBe('Смирнов И.');
  });

  it('больше двух имён: инициалы ограничены двумя (меньше утечки)', () => {
    expect(maskFullName('Ковалёва Анна Мария Клара')).toBe('Ковалёва А. М.');
  });

  it('одно слово возвращается как есть, пустое — пустая строка', () => {
    expect(maskFullName('Мир')).toBe('Мир');
    expect(maskFullName('')).toBe('');
    expect(maskFullName('   ')).toBe('');
  });
});

describe('verify: статусы справки', () => {
  const NOW = new Date('2026-11-14T12:00:00.000Z');

  it('действительна: не отозвана и не истекла', () => {
    expect(
      certificateStatusFor(
        { revokedAt: null, expiresAt: new Date('2027-11-14T00:00:00.000Z') },
        NOW,
      ),
    ).toBe('VALID');
  });

  it('отозвана — даже если срок ещё идёт', () => {
    expect(
      certificateStatusFor(
        {
          revokedAt: new Date('2026-11-10T09:00:00.000Z'),
          expiresAt: new Date('2027-11-14T00:00:00.000Z'),
        },
        NOW,
      ),
    ).toBe('REVOKED');
  });

  it('отзыв сильнее истечения', () => {
    expect(
      certificateStatusFor(
        {
          revokedAt: new Date('2026-11-10T09:00:00.000Z'),
          expiresAt: new Date('2026-11-01T00:00:00.000Z'),
        },
        NOW,
      ),
    ).toBe('REVOKED');
  });

  it('истёкшая справка больше не действительна (страница покажет «не найден»)', () => {
    expect(
      certificateStatusFor(
        { revokedAt: null, expiresAt: new Date('2026-11-01T00:00:00.000Z') },
        NOW,
      ),
    ).toBe('EXPIRED');
  });
});
