// DIG-29 — контракт каталога сервисов и чистых функций (red-first).
// Приёмка задачи: студенту не показывается ни один сервис чужой роли;
// тексты единообразны (кавычки «ёлочки», тире en-dash, без опечаток);
// категории пилюлями (6, не 12); подборка «Часто нужно на 2 курсе» без
// дублей; поиск с подсветкой совпадений.
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_LABELS,
  ETA_LABELS,
  FORMAT_LABELS,
  SERVICES,
  matchService,
  picksForCourse,
  servicesForRole,
  splitHighlight,
  type ServiceEntry,
} from '@/lib/services-catalog';

describe('каталог: структура записей', () => {
  it('непустой, id уникальны, тексты непустые', () => {
    expect(SERVICES.length).toBeGreaterThanOrEqual(15);
    const ids = SERVICES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SERVICES) {
      expect(s.title.trim().length).toBeGreaterThan(2);
      expect(s.benefit.trim().length).toBeGreaterThan(2);
      expect(s.audiences.length).toBeGreaterThan(0);
      expect(s.href.startsWith('/')).toBe(true);
    }
  });

  it('польза — одна строка без точки в конце', () => {
    for (const s of SERVICES) {
      expect(s.benefit.endsWith('.')).toBe(false);
      expect(s.benefit.length).toBeLessThanOrEqual(64);
    }
  });

  it('«Заказать» — только у документных услуг (формат есть), формат есть только у них', () => {
    for (const s of SERVICES) {
      if (s.action === 'ORDER') {
        expect(s.format, `${s.id}: ORDER требует формат`).not.toBeNull();
        expect(s.href).toBe(`/requests?order=${s.id}`);
      }
      if (s.action === 'OPEN') {
        expect(s.href.startsWith('/')).toBe(true);
      }
      if (s.format === null) {
        expect(s.action, `${s.id}: без формата — только «Открыть»`).toBe('OPEN');
      }
    }
  });

  it('в каталоге есть абитуриентская и сотрудническая записи — материал для фильтра', () => {
    expect(SERVICES.some((s) => s.audiences.includes('APPLICANT'))).toBe(true);
    expect(SERVICES.some((s) => s.audiences.includes('STAFF'))).toBe(true);
  });
});

describe('servicesForRole — фильтр по роли', () => {
  it('студенту не показывается ни один сервис чужой роли', () => {
    const forStudent = servicesForRole('STUDENT');
    expect(forStudent.length).toBeGreaterThan(10);
    for (const s of forStudent) {
      expect(s.audiences).toContain('STUDENT');
    }
    const titles = forStudent.map((s) => s.title).join('\n');
    expect(titles).not.toContain('Личный кабинет абитуриента');
    expect(titles).not.toContain('Редактор расписания');
    // Проблема аудита «студенту 2 курса рекомендуют ЛК абитуриента» решена:
    // слово «абитуриент» не встречается ни в одной студенческой записи.
    const texts = forStudent.map((s) => `${s.title} ${s.benefit}`).join('\n');
    expect(texts.toLowerCase()).not.toContain('абитуриент');
  });

  it('фильтр работает и для других ролей', () => {
    for (const s of servicesForRole('APPLICANT')) {
      expect(s.audiences).toContain('APPLICANT');
    }
    for (const s of servicesForRole('STAFF')) {
      expect(s.audiences).toContain('STAFF');
    }
  });
});

describe('словари меток', () => {
  it('ровно 6 категорий пилюлями (не 12) с точными метками', () => {
    expect(Object.keys(CATEGORY_LABELS).length).toBe(6);
    expect(Object.values(CATEGORY_LABELS)).toEqual([
      'Справки',
      'Заявления',
      'Учёба',
      'Финансы и стипендии',
      'Общежитие',
      'Помощь',
    ]);
  });

  it('метки сроков: «Мгновенно», «2–3 дня» с en-dash', () => {
    expect(ETA_LABELS.INSTANT).toBe('Мгновенно');
    expect(ETA_LABELS.DAYS_1).toBe('1 день');
    expect(ETA_LABELS.DAYS_2_3).toBe('2–3 дня');
    expect(ETA_LABELS.DAYS_5).toBe('до 5 дней');
    // Во всех метках дефис-между-цифрами запрещён: только en-dash.
    for (const label of Object.values(ETA_LABELS)) {
      expect(label).not.toMatch(/\d-\d/);
    }
  });

  it('метки форматов: PDF и Бумажная', () => {
    expect(FORMAT_LABELS.PDF).toBe('PDF');
    expect(FORMAT_LABELS.PAPER).toBe('Бумажная');
  });

  it('все категории каталога входят в словарь меток', () => {
    for (const s of SERVICES) {
      expect(CATEGORY_LABELS[s.category], `${s.id}: неизвестная категория`).toBeDefined();
    }
  });
});

describe('picksForCourse — «Часто нужно на N курсе»', () => {
  it('для 2 курса — детерминированная подборка с мгновенной выпиской', () => {
    const picks = picksForCourse(2);
    expect(picks.length).toBeGreaterThan(2);
    expect(picks.length).toBeLessThanOrEqual(6);
    const ids = picks.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // без дублей внутри подборки
    expect(ids).toContain('transcript-instant');
    expect(ids).toContain('cert-enrollment');
    for (const s of picks) {
      expect(s.audiences).toContain('STUDENT');
    }
  });

  it('для курса без подборки — пусто', () => {
    expect(picksForCourse(7)).toEqual([]);
  });
});

describe('поиск и подсветка', () => {
  const sample: ServiceEntry = SERVICES.find((s) => s.id === 'cert-enrollment')!;

  it('matchService ищет по названию, пользе и категории без учёта регистра', () => {
    expect(matchService(sample, 'справка')).toBe(true);
    expect(matchService(sample, 'СПРАВКА ОБ ОБУЧЕНИИ')).toBe(true);
    expect(matchService(sample, 'банка')).toBe(true); // слово из пользы
    expect(matchService(sample, 'Справки')).toBe(true); // метка категории
    expect(matchService(sample, 'общежитие')).toBe(false);
    expect(matchService(sample, '')).toBe(true); // пустой запрос — всё
  });

  it('matchService схлопывает пробелы в запросе', () => {
    expect(matchService(sample, '   справка   об   ')).toBe(true);
  });

  it('splitHighlight подсвечивает вхождения без учёта регистра', () => {
    const chunks = splitHighlight('Справка об обучении', 'об');
    const hit = chunks.filter((c) => c.hit).map((c) => c.text);
    expect(hit.join('')).toBe('обоб'); // «об» в «Справка» и «об» отдельно
    const plain = chunks.map((c) => c.text).join('');
    expect(plain).toBe('Справка об обучении');
    expect(chunks.every((c) => c.text.length > 0)).toBe(true);
  });

  it('splitHighlight без запроса и без совпадений — один кусок без подсветки', () => {
    expect(splitHighlight('Справка', '')).toEqual([{ text: 'Справка', hit: false }]);
    expect(splitHighlight('Справка', 'нет-слова')).toEqual([{ text: 'Справка', hit: false }]);
  });
});

describe('QA-тексты: кавычки, тире, опечатки (критерий приёмки)', () => {
  const allTexts = (): string[] => [
    ...Object.values(CATEGORY_LABELS),
    ...Object.values(ETA_LABELS),
    ...Object.values(FORMAT_LABELS),
    ...SERVICES.flatMap((s) => [s.title, s.benefit]),
  ];

  it('двойные пробелы и прямые кавычки запрещены', () => {
    for (const text of allTexts()) {
      expect(text).not.toMatch(/  /);
      expect(text).not.toContain('"');
    }
  });

  it('дефис между цифрами запрещён — только en-dash («2–3 дня»)', () => {
    for (const text of allTexts()) {
      expect(text).not.toMatch(/\d-\d/);
    }
  });

  it('маркеры опечаток аудита («Мои зачетная») не встречаются: «ё» обязательна', () => {
    for (const text of allTexts()) {
      expect(text.toLowerCase()).not.toContain('зачетн');
      expect(text).not.toMatch(/\sМои\s/); // «Мои зачетная книжка»-стиль
    }
    // А «зачётная» — с ё — разрешена и присутствует (выписка из зачётной).
    expect(SERVICES.some((s) => s.title.toLowerCase().includes('зачёт'))).toBe(true);
  });

  it('концевые пробелы запрещены', () => {
    for (const text of allTexts()) {
      expect(text).toBe(text.trim());
    }
  });
});
