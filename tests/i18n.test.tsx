// DIG-69 — юнит-тесты локализации RU/EN: паритет словарей, t(),
// sectionTitle/navLabel по префиксу, статусы, дефолт 'ru'.
import { describe, expect, it } from 'vitest';

import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  appealStatusLabel,
  isLocale,
  navLabel,
  requestStatusLabel,
  sectionTitle,
  t,
} from '@/lib/i18n';
import { appealStatusBadge } from '@/lib/appeal-status';
import { formatRequestDate } from '@/lib/request-labels';
import {
  nextActionLine,
  nextActionLineLocalized,
  pipelineStepLabel,
  requestFilterLabel,
} from '@/lib/requests-view';
import { transitionActionLabel, transitionActionTitle } from '@/lib/staff-transitions';
import { en } from '@/lib/i18n/en';
import { ru } from '@/lib/i18n/ru';
import { LocaleSwitch } from '@/components/shell/locale-switch';

describe('i18n словари', () => {
  it('наборы ключей RU и EN идентичны', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });

  it('все значения — непустые строки в обоих словарях', () => {
    for (const dict of [ru, en]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value, `ключ ${key}`).toBe('string');
        expect((value as string).length, `ключ ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('дефолтная локаль — ru, локали — ровно ru и en', () => {
    expect(DEFAULT_LOCALE).toBe('ru');
    expect(LOCALES).toEqual(['ru', 'en']);
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(LOCALE_COOKIE).toBe('du-locale');
  });
});

describe('t()', () => {
  it('t("en", "menu.schedule") непустая и английская', () => {
    const value = t('en', 'menu.schedule');
    expect(value.length).toBeGreaterThan(0);
    expect(value).toBe('Schedule');
  });

  it('t("ru", …) возвращает прежнюю RU-строку байт-в-байт', () => {
    expect(t('ru', 'menu.schedule')).toBe('Расписание');
    expect(t('ru', 'concept.banner')).toBe(
      'Концепт для конкурса, не официальный сервис вуза. Все данные вымышленные.',
    );
  });

  it('интерполяция {vars} подставляет значения', () => {
    expect(t('en', 'stepper.stepOf', { step: 2, total: 5 })).toBe('Step 2 of 5');
    expect(t('ru', 'stepper.stepOfLabel', { step: 2, total: 5, label: 'Принята' })).toBe(
      'Шаг 2 из 5: Принята',
    );
  });

  it('статусы заявок и обращения переводятся', () => {
    expect(requestStatusLabel('en', 'IN_PROGRESS')).toBe('In progress');
    expect(requestStatusLabel('ru', 'IN_PROGRESS')).toBe('В работе');
    expect(requestStatusLabel('en', 'NEEDS_FIX')).toBe('Needs revision');
    expect(appealStatusLabel('en', 'ANSWERED')).toBe('Answered');
    expect(appealStatusLabel('ru', 'ANSWERED')).toBe('Отвечено');
  });
});

describe('sectionTitle / navLabel по префиксу пути', () => {
  it('заголовок по точному href', () => {
    expect(sectionTitle('ru', '/requests')).toBe('Мои заявки');
    expect(sectionTitle('en', '/requests')).toBe('My requests');
    expect(sectionTitle('en', '/grades')).toBe('Academic performance');
  });

  it('самый длинный префикс побеждает (grades/session), вложенность матчится', () => {
    expect(sectionTitle('en', '/grades/session')).toBe('Exam session');
    expect(navLabel('en', '/grades/session', 'Оценки')).toBe('Grades');
  });

  it('ложных срабатываний по префиксу нет (/schedule-extra)', () => {
    expect(navLabel('en', '/schedule-extra', 'Fallback')).toBe('Fallback');
  });
  it('RU-метки меню байт-в-байт равны подписям nav-items (fallback каноничен)', () => {
    // У одного href — короткая и полная RU-подписи: меню и таб-бар.
    expect(navLabel('ru', '/requests', 'Заявки и справки')).toBe('Заявки и справки');
    expect(navLabel('ru', '/requests', 'Заявки')).toBe('Заявки'); // таб-бар
    expect(navLabel('en', '/requests', 'Заявки')).toBe('Requests & certificates');
  });

  it('сотрудник: префиксы /staff*', () => {
    expect(sectionTitle('en', '/staff/requests')).toBe('Request queue');
    expect(sectionTitle('en', '/staff')).toBe('Deanery overview');
    expect(navLabel('en', '/staff/appeals', 'Обращения')).toBe('Appeals');
  });
});

describe('локализованные хелперы статусов (DIG-69)', () => {
  it('подписи фильтров заявок: RU прежние байт-в-байт, EN по словарю', () => {
    expect(requestFilterLabel('ru', 'ALL')).toBe('Все');
    expect(requestFilterLabel('ru', 'NEEDS_ACTION')).toBe('Нужно действие');
    expect(requestFilterLabel('en', 'ALL')).toBe('All');
    expect(requestFilterLabel('en', 'IN_WORK')).toBe('In progress');
  });

  it('метки шагов конвейера: RU прежние, EN переведённые', () => {
    expect(pipelineStepLabel('ru', 'SUBMITTED')).toBe('Подана');
    expect(pipelineStepLabel('en', 'ISSUED')).toBe('Issued');
  });

  it('строка следующего действия: RU делегирует nextActionLine, EN по словарю', () => {
    const input = {
      status: 'ACCEPTED' as const,
      readyBy: new Date('2026-11-20T12:00:00Z'),
      reason: null,
      updatedAt: new Date('2026-11-17T09:00:00Z'),
    };
    expect(nextActionLineLocalized(input, 'ru')).toBe(nextActionLine(input));
    expect(nextActionLineLocalized(input, 'en')).toContain('Ready by');
    const fix = {
      status: 'NEEDS_FIX' as const,
      readyBy: null,
      reason: 'Приложите договор',
      updatedAt: new Date(),
    };
    expect(nextActionLineLocalized(fix, 'en')).toBe('Revision needed: Приложите договор');
  });

  it('формат времени заявок: RU прежний путь (с «МСК»), EN с «MSK»', () => {
    const value = new Date('2026-11-16T07:05:00Z'); // 10:05 Europe/Moscow
    // RU — тот же форматтер, что и раньше: результат совпадает байт-в-байт.
    expect(formatRequestDate(value)).toBe(formatRequestDate(value, 'ru'));
    expect(formatRequestDate(value)).toMatch(/МСК$/);
    expect(formatRequestDate(value, 'en')).toMatch(/MSK$/);
    expect(formatRequestDate(value, 'en')).not.toMatch(/МСК/);
  });

  it('подписи переходов сотрудника: RU прежние, EN переведённые', () => {
    expect(transitionActionLabel('ru', 'IN_PROGRESS')).toBe('Взять в работу');
    expect(transitionActionLabel('en', 'IN_PROGRESS')).toBe('Start processing');
    expect(transitionActionTitle('ru', 'ACCEPTED')).toBe('Заявка принята');
    expect(transitionActionTitle('en', 'ACCEPTED')).toBe('Request accepted');
  });

  it('бейдж статуса обращения: RU прежний, EN переведён', () => {
    const answered = appealStatusBadge('ru', 'ANSWERED');
    expect(answered.label).toBe('Отвечено');
    expect(answered.cls).toBe(appealStatusBadge('en', 'ANSWERED').cls);
    expect(appealStatusBadge('en', 'OPEN').label).toBe('New');
  });
});

describe('LocaleSwitch', () => {
  it('рендерит обе кнопки RU и EN', () => {
    const html = renderToStaticMarkup(<LocaleSwitch locale="ru" />);
    expect(html).toContain('data-testid="locale-switch"');
    expect(html).toContain('data-testid="locale-ru"');
    expect(html).toContain('data-testid="locale-en"');
    expect(html).toContain('>RU</button>');
    expect(html).toContain('>EN</button>');
  });

  it('активная локаль помечена aria-pressed', () => {
    const html = renderToStaticMarkup(<LocaleSwitch locale="en" />);
    expect(html).toContain('value="en" aria-pressed="true"');
    expect(html).toContain('value="ru" aria-pressed="false"');
  });
});
