// DIG-31 — сервис заявок принимает мету мастера заказа (язык, экземпляры,
// способ получения, комментарий, вложения-метаданные): повторная серверная
// валидация (защита в глубину поверх action) и сохранение в params заявки
// под ключом «wizard» (JSON-строка — тип params Record<string, string>
// не меняется). Обычные параметры формы и дубликаты ведут себя как в DIG-30.
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import type { DataCtx } from '@/server/data/types';
import { createCanonicalRequest } from '@/server/data/canonical-requests';
import type { CanonicalRequestTypeRow } from '@/server/data/types';

const NOW = new Date('2026-11-13T10:00:00'); // пятница

const TYPES: CanonicalRequestTypeRow[] = [
  {
    id: 'crt-cert',
    code: 'CERT_ENROLLMENT',
    name: 'Справка об обучении',
    etaDays: 1,
    format: 'ELECTRONIC',
    isInstant: true,
    formSchema: {
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
    },
  },
];

let db: MemoryDataDb;
let anna: DataCtx;

const wizardMeta = {
  destination: 'Военкомат по месту учёбы',
  language: 'RU',
  copies: 2,
  delivery: 'PICKUP',
  comment: 'Срочно, нужно к среде',
  attachments: [{ name: 'заявление.pdf', size: 2048 }],
};

beforeEach(async () => {
  db = createMemoryDataDb();
  db.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna',
        fullName: 'Анна Ковалёва',
        email: 'anna@example.edu',
        groupName: 'ПИ-21',
        course: 2,
        faculty: 'ИТ',
        program: 'Прикладная информатика',
        programCode: '09.03.04',
        studyForm: 'очная',
        funding: 'бюджет',
        gradebookNumber: '20231234',
      },
    ],
    canonicalRequestTypes: TYPES,
  });
  anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, db))!;
});

describe('мета мастера в createCanonicalRequest (DIG-31)', () => {
  it('мета сохраняется в params.wizard (JSON-строка), поля формы — рядом', async () => {
    const result = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для военкомата' },
      meta: wizardMeta,
      now: NOW,
    });
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.request.params.purpose).toBe('для военкомата');
    expect(typeof result.request.params.wizard).toBe('string');
    const stored = JSON.parse(result.request.params.wizard!);
    expect(stored).toEqual(wizardMeta);
  });

  it('без меты — params содержит только поля формы (обратная совместимость DIG-30)', async () => {
    const result = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.request.params).toEqual({ purpose: 'для банка' });
    expect('wizard' in result.request.params).toBe(false);
  });

  it('сломанная мета отклоняется без создания заявки (человеческая ошибка)', async () => {
    const result = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      meta: { language: 'DE', copies: 1, delivery: 'PDF_ONLINE' },
      now: NOW,
    });
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toContain('язык');
    // Ничего не создано: повторная подача получает номер №1.
    const second = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    if (second.kind === 'created') {
      expect(second.request.number).toMatch(/000001$/);
    }
  });

  it('мета с 6 вложениями отклоняется тем же лимитом, что и клиент', async () => {
    const result = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      meta: {
        language: 'RU',
        copies: 1,
        delivery: 'PDF_ONLINE',
        attachments: Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 })),
      },
      now: NOW,
    });
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toContain('не больше 5');
  });

  it('сотрудник по-прежнему не подаёт заявки (IDOR-контракт DIG-30 не ослаблен)', async () => {
    db.seed({
      staff: [
        {
          id: 'stf-maria',
          login: 'maria',
          fullName: 'Мария Петрова',
          position: 'Специалист деканата',
          email: 'maria@example.edu',
          faculty: 'ИТ',
        },
      ],
    });
    const maria = (await toDataCtx({ id: 'auth-maria', login: 'maria', role: 'STAFF' }, db))!;
    const result = await createCanonicalRequest(db, maria, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      meta: wizardMeta,
      now: NOW,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.code).toBe('ROLE_MISMATCH');
  });
});
