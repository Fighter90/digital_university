// DIG-31 — карта «сервис каталога (DIG-29) → тип заявки (словарь DIG-30)»:
// предвыбор типа и, где это осмысленно, предзаполненное ключевое поле
// («Справка для отсрочки» → справка об обучении с назначением
// «для военкомата»). Неизвестный id — мастер без предвыбора, не ошибка.
import { describe, expect, it } from 'vitest';
import {
  REQUEST_FORMAT_LABELS,
  REQUEST_TYPE_HINTS,
  orderTargetForService,
  requestTypeHint,
} from '@/lib/request-order-map';

describe('orderTargetForService: карта каталог → тип', () => {
  it('известные сервисы каталога дают тип словаря', () => {
    expect(orderTargetForService('cert-enrollment')).toEqual({ typeCode: 'CERT_ENROLLMENT' });
    expect(orderTargetForService('cert-grades')).toEqual({ typeCode: 'GRADES_EXTRACT' });
    expect(orderTargetForService('stmt-academic-leave')).toEqual({ typeCode: 'ACADEMIC_LEAVE' });
  });

  it('«справка для отсрочки» — справка об обучении с назначением «для военкомата»', () => {
    expect(orderTargetForService('cert-defer')).toEqual({
      typeCode: 'CERT_ENROLLMENT',
      preset: { purpose: 'для военкомата' },
    });
  });

  it('неизвестный сервис, «new», пустые и мусорные значения → null (без ошибки)', () => {
    expect(orderTargetForService('cert-tax')).toBeNull();
    expect(orderTargetForService('dorm-checkin')).toBeNull();
    expect(orderTargetForService('new')).toBeNull();
    expect(orderTargetForService('')).toBeNull();
    expect(orderTargetForService('  ')).toBeNull();
    expect(orderTargetForService('../../../etc/passwd')).toBeNull();
    expect(orderTargetForService(null)).toBeNull();
    expect(orderTargetForService(undefined)).toBeNull();
  });

  it('регистр и пробелы нормализуются', () => {
    expect(orderTargetForService(' Cert-Enrollment ')).toEqual({ typeCode: 'CERT_ENROLLMENT' });
  });
});

describe('подсказки типов и формата (шаг 1 «что это за документ одной строкой»)', () => {
  it('у всех типов словаря демо-сида есть однострочная подсказка', () => {
    // Словарь demo-seed: CERT_ENROLLMENT, GRADES_EXTRACT, DIPLOMA_COPY, ACADEMIC_LEAVE.
    for (const code of ['CERT_ENROLLMENT', 'GRADES_EXTRACT', 'DIPLOMA_COPY', 'ACADEMIC_LEAVE']) {
      expect(requestTypeHint(code), code).not.toBe('');
      expect(REQUEST_TYPE_HINTS[code], code).toBeTruthy();
    }
  });

  it('неизвестный тип получает нейтральный запасной текст', () => {
    expect(requestTypeHint('MYSTERY_TYPE')).toBe('Официальный документ деканата');
  });

  it('метки формата для всех значений словаря типов', () => {
    expect(REQUEST_FORMAT_LABELS.ELECTRONIC).toBe('PDF');
    expect(REQUEST_FORMAT_LABELS.PAPER).toBe('Бумажный документ');
    expect(REQUEST_FORMAT_LABELS.HYBRID).toBe('PDF и оригинал');
  });
});
