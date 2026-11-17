// DIG-70 — контракт экрана «Справка» (/guide, red-first). Приёмка: страница
// «Справка» рендерит гайд «Как пользоваться кабинетом» (заголовки разделов,
// якоря, нумерованные шаги, глубинные ссылки, callout'ы «Совет»/«Важно»),
// пункт меню «Справка» есть в полном меню и в «Ещё», поиск-фильтр — чистая
// функция filterHelpSections (пустой запрос — все разделы; вхождение по
// нижнему регистру; ноль результатов).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import GuidePage from '@/app/(cabinet)/guide/page';
import { sectionIcon } from '@/components/shell/nav-icons';
import {
  CABINET_SECTIONS,
  MORE_SECTIONS,
  STAFF_SECTIONS,
  TAB_SECTIONS,
} from '@/components/shell/nav-items';
import {
  EMPTY_SEARCH_MESSAGE,
  GUIDE_HEADING,
  GUIDE_SECTIONS,
  filterHelpSections,
} from '@/lib/help-content';

async function renderPage(node: React.ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

describe('/guide — экран «Справка»', () => {
  it('заголовок «Как пользоваться кабинетом», слово «Справка» и поле поиска', async () => {
    const Page = GuidePage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));

    expect(html).toContain('Справка');
    expect(html).toContain(GUIDE_HEADING);
    expect(html).toContain('data-testid="guide-browser"');
    expect(html).toMatch(/<label[^>]*for="guide-search"/);
    expect(html).toContain('data-testid="guide-search"');
    // Оглавление на мобильном свёрнуто в details/summary.
    expect(html).toContain('<summary');
    expect(html).toContain('Содержание');
  });

  it('все разделы каталога отрисованы якорями с шагами и кнопкой «Открыть раздел»', async () => {
    const Page = GuidePage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));

    for (const section of GUIDE_SECTIONS) {
      expect(html).toContain(`data-testid="guide-section-${section.id}"`);
      expect(html).toContain(`id="${section.id}"`);
      expect(html).toContain(`data-testid="guide-toc-${section.id}"`);
      expect(html).toContain(section.title);
      // Кнопка-глубинка в реальный раздел кабинета.
      expect(html).toContain(`data-testid="guide-open-${section.id}"`);
      expect(html).toContain(`href="${section.href}"`);
    }
    // Канон статусов заявок упомянут словами из lib/request-machine.
    expect(html).toContain('Подана');
    expect(html).toContain('Принята');
    expect(html).toContain('В работе');
    expect(html).toContain('Готова');
    expect(html).toContain('Выдана');
    expect(html).toContain('Нужна доработка');
    expect(html).toContain('Отклонена');
    expect(html).toContain('Отменена');
    // Номера заявок и обращений из задач DIG-30/DIG-39.
    expect(html).toContain('ЗД-');
    expect(html).toContain('SR-');
    expect(html).toContain('TS-');
  });

  it('callout-блоки «Совет» и «Важно» присутствуют', async () => {
    const Page = GuidePage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));

    expect(html).toContain('data-testid="guide-callout-tip"');
    expect(html).toContain('data-testid="guide-callout-warning"');
    expect(html).toContain('Совет');
    expect(html).toContain('Важно');
  });
});

describe('filterHelpSections — чистый поиск-фильтр', () => {
  it('пустой запрос (и одни пробелы) возвращает все разделы в порядке каталога', () => {
    expect(filterHelpSections('')).toEqual(GUIDE_SECTIONS);
    expect(filterHelpSections('   ')).toEqual(GUIDE_SECTIONS);
    expect(filterHelpSections('').map((s) => s.id)).toEqual(GUIDE_SECTIONS.map((s) => s.id));
  });

  it('находит по заголовку и по тексту шагов без учёта регистра', () => {
    // По заголовку.
    expect(filterHelpSections('расписан').map((s) => s.id)).toEqual(['schedule']);
    // По тексту шага (канон статусов — только в разделе «Заявки и справки»).
    const requests = filterHelpSections('Выдана').map((s) => s.id);
    expect(requests).toContain('requests');
    // По тексту callout'а.
    expect(filterHelpSections('argon2id').map((s) => s.id)).toContain('login');
    // ВЕРХНИЙ регистр — то же самое (includes по нижнему регистру).
    expect(filterHelpSections('РАСПИСАН').map((s) => s.id)).toEqual(['schedule']);
  });

  it('незнакомый запрос — пустой массив (на странице будет «Ничего не найдено»)', () => {
    expect(filterHelpSections('квантовый компьютер')).toEqual([]);
    expect(EMPTY_SEARCH_MESSAGE).toBe('Ничего не найдено');
  });
});

describe('пункт меню «Справка»', () => {
  it('есть в полном меню и в «Ещё» рядом с «Вопросами и ответами»', () => {
    const expected = { href: '/guide', label: 'Справка' };
    expect(CABINET_SECTIONS).toContainEqual(expected);
    expect(MORE_SECTIONS).toContainEqual(expected);

    const cabinetIndex = CABINET_SECTIONS.findIndex((s) => s.href === '/guide');
    const helpIndex = CABINET_SECTIONS.findIndex((s) => s.href === '/help');
    expect(cabinetIndex).toBe(helpIndex + 1);
    // Таб-бар и staff-разделы не тронуты: справка не претендует на вкладку.
    expect(TAB_SECTIONS.some((s) => s.href === '/guide')).toBe(false);
    expect(STAFF_SECTIONS.some((s) => s.href === '/guide')).toBe(false);
  });

  it('иконка /guide назначена и не совпадает с fallback-«Домой»', () => {
    expect(sectionIcon('/guide')).not.toBe(sectionIcon('/totally-unknown'));
    expect(typeof sectionIcon('/guide')).toBe('function');
  });

  it('плашка «Концепт для конкурса» рисуется каркасом на всех страницах', () => {
    // Плашка подключена в корневом layout (src/app/layout.tsx) и рендерится
    // на каждом экране, включая /guide; пиним подключение от случайного удаления.
    const layout = readFileSync(join('src', 'app', 'layout.tsx'), 'utf8');
    expect(layout).toContain('ConceptBanner');
  });
});
