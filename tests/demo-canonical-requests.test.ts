// DIG-30 — канонические заявки в демо-данных прототипа.
// Словарь типов + пара живых заявок Анны: мгновенная справка READY
// (документ можно скачать) и бумажный дубликат диплома в очереди.
// Всё вымышленное; numbers формата «ЗД-ГГГГ-NNNNNN», уникальны.
import { describe, expect, it } from 'vitest';
import { createMemoryDataDb } from '@/server/data/memory-db';
import { seedDemoData } from '@/server/data/demo-seed';
import { parseRequestFormSchema } from '@/lib/request-form-schema';
import { CANONICAL_REQUEST_NUMBER_PATTERN } from '@/server/data/canonical-request-number';

const stubAuthStore = { selection: { kind: 'memory', store: {}, rateLimiter: {} } } as never;

describe('demo seed: канонические заявки (DIG-30)', () => {
  it('словарь типов: мгновенные (справка, выписка) и бумажные с SLA', async () => {
    const db = createMemoryDataDb();
    await seedDemoData(db, stubAuthStore);

    const types = await db.listCanonicalRequestTypes();
    expect(types.length).toBeGreaterThanOrEqual(4);

    const instant = types.filter((t) => t.isInstant).map((t) => t.code);
    expect(instant).toContain('CERT_ENROLLMENT');
    expect(instant).toContain('GRADES_EXTRACT');

    const diploma = types.find((t) => t.code === 'DIPLOMA_COPY')!;
    expect(diploma.isInstant).toBe(false);
    expect(diploma.etaDays).toBeGreaterThan(0);
    // JSON-схема формы разбирается (валидна для zod-валидации на сервере).
    expect(parseRequestFormSchema(diploma.formSchema)).not.toBeNull();
    for (const t of types) {
      if (t.formSchema !== null) {
        expect(parseRequestFormSchema(t.formSchema), t.code).not.toBeNull();
      }
    }
  });

  it('заявки Анны: мгновенная в READY, номера «ЗД-ГГГГ-NNNNNN» уникальны, история начинается с подачи', async () => {
    const db = createMemoryDataDb();
    await seedDemoData(db, stubAuthStore);

    const anna = await db.listCanonicalRequestsByStudent('st-anna');
    expect(anna.length).toBeGreaterThanOrEqual(3); // DIG-32: + «для военкомата» в NEEDS_FIX

    const numbers = anna.map((r) => r.number);
    for (const number of numbers) {
      expect(number, number).toMatch(CANONICAL_REQUEST_NUMBER_PATTERN);
    }
    expect(new Set(numbers).size).toBe(numbers.length);

    const cert = anna.find((r) => r.title === 'Справка об обучении · для банка')!;
    expect(cert.status).toBe('READY'); // мгновенный тип — сразу готов
    expect(cert.title).toBe('Справка об обучении · для банка');

    // DIG-32 — «Нужна доработка» для пилюли «Нужно действие» и закрепления наверху.
    const fix = anna.find((r) => r.title === 'Справка об обучении · для военкомата')!;
    expect(fix.status).toBe('NEEDS_FIX');

    const diploma = anna.find((r) => r.typeCode === 'DIPLOMA_COPY')!;
    expect(diploma.status).toBe('SUBMITTED');
    expect(diploma.title).toBe('Дубликат диплома · утрата оригинала');

    for (const request of anna) {
      const events = await db.listCanonicalRequestEvents(request.id);
      expect(events.length, request.number).toBeGreaterThanOrEqual(1);
      // История начинается с создания (подача или мгновенная READY)
      // и заканчивается текущим статусом.
      expect(events[0]!.fromStatus).toBeNull();
      expect(events[0]!.toStatus).toBe(
        request.status === 'NEEDS_FIX' ? 'SUBMITTED' : request.status,
      );
      expect(events[events.length - 1]!.toStatus).toBe(request.status);
    }
  });

  // DIG-33 — заявки Ильи: мир мутационных e2e экрана «Карточка заявки»,
  // изолированный от зафиксированного read-only мира Анны (пилюли DIG-32,
  // бейдж непрочитанных DIG-54).
  it('заявки Ильи: мгновенная READY и «нужна доработка» с валидной историей', async () => {
    const db = createMemoryDataDb();
    await seedDemoData(db, stubAuthStore);

    const ilya = await db.listCanonicalRequestsByStudent('st-ilya');
    expect(ilya.length).toBeGreaterThanOrEqual(2);

    const ready = ilya.find((r) => r.status === 'READY');
    expect(ready).toBeDefined();
    expect(ready!.typeCode).toBe('CERT_ENROLLMENT'); // мгновенный тип — PDF есть

    const fix = ilya.find((r) => r.status === 'NEEDS_FIX');
    expect(fix).toBeDefined();
    expect(fix!.typeCode).toBe('ACADEMIC_LEAVE');

    const numbers = ilya.map((r) => r.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    // Номера Ильи не пересекаются с номерами Анны (сквозная нумерация года).
    const annaNumbers = new Set(
      (await db.listCanonicalRequestsByStudent('st-anna')).map((r) => r.number),
    );
    for (const number of numbers) expect(annaNumbers.has(number)).toBe(false);

    for (const request of ilya) {
      const events = await db.listCanonicalRequestEvents(request.id);
      // Готовая мгновенная и поданная в очередь — одно событие создания;
      // доработка — минимум подача + переход сотрудника с причиной.
      expect(events.length, request.number).toBeGreaterThanOrEqual(
        request.status === 'NEEDS_FIX' ? 2 : 1,
      );
      expect(events[0]!.fromStatus).toBeNull();
      // История начинается с создания: мгновенная READY или подача.
      expect(events[0]!.toStatus).toBe(request.status === 'READY' ? 'READY' : 'SUBMITTED');
      expect(events[events.length - 1]!.toStatus).toBe(request.status);
    }

    // «Нужна доработка» Ильи несёт причину сотрудника — она попадает в карточку.
    const fixEvents = await db.listCanonicalRequestEvents(fix!.id);
    expect(fixEvents.at(-1)!.comment).toBeTruthy();
  });
});
