// DIG-38 — клиентский браузер базы знаний (unit, jsdom): большое поле
// «Найдите ответ», популярные запросы, фильтр категорий. Раунд 4 ревью:
// если список опустел из-за фильтра категории (а не из-за поиска),
// состояние «Ничего не нашлось» с двумя действиями вводит в заблуждение —
// поиск-то нашёл; показываем честную записку со сбросом фильтра.
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { HelpBrowser } from '@/components/help/help-browser';

afterEach(() => {
  cleanup();
});

describe('HelpBrowser — поле поиска', () => {
  it('подпись «Найдите ответ» связана с полем (label for)', () => {
    render(React.createElement(HelpBrowser));

    const input = screen.getByTestId('help-search');
    expect(input).toHaveAccessibleName('Найдите ответ');
    expect(input).toHaveAttribute('id', 'help-search');
    expect(document.querySelector('label[for="help-search"]')).toHaveTextContent('Найдите ответ');
  });

  it('клик по популярному запросу подставляет его в поле', () => {
    render(React.createElement(HelpBrowser));

    fireEvent.click(screen.getByTestId('help-popular-общежитие'));

    expect((screen.getByTestId('help-search') as HTMLInputElement).value).toBe('общежитие');
    expect(screen.getByTestId('help-popular-общежитие')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('HelpBrowser — фильтр категории vs пустой поиск', () => {
  it('поиск нашёл, но категория всё скрыла — записка со сбросом, не «Ничего не нашлось»', () => {
    render(React.createElement(HelpBrowser));

    fireEvent.change(screen.getByTestId('help-search'), {
      target: { value: 'стипендия' },
    });
    fireEvent.click(screen.getByTestId('help-category-DORMITORY'));

    expect(screen.queryByTestId('help-empty')).not.toBeInTheDocument();
    const note = screen.getByTestId('help-filter-empty');
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/Общежитие/);
    expect(note).toHaveTextContent(/стипендия/);

    // Сброс возвращает результаты поиска.
    fireEvent.click(screen.getByTestId('help-filter-reset'));
    expect(screen.queryByTestId('help-filter-empty')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('help-articles')).getAllByRole('link').length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('поиск не нашёл ничего — именно состояние «Ничего не нашлось» с двумя действиями', () => {
    render(React.createElement(HelpBrowser));

    fireEvent.change(screen.getByTestId('help-search'), {
      target: { value: 'фыгвпркст' },
    });

    const empty = screen.getByTestId('help-empty');
    expect(empty).toHaveTextContent('Ничего не нашлось');
    expect(screen.getByTestId('help-empty-ai')).toHaveAttribute(
      'href',
      '/ai-assistant?q=%D1%84%D1%8B%D0%B3%D0%B2%D0%BF%D1%80%D0%BA%D1%81%D1%82',
    );
    expect(screen.getByTestId('help-empty-deanery')).toHaveAttribute(
      'href',
      '/deanery?q=%D1%84%D1%8B%D0%B3%D0%B2%D0%BF%D1%80%D0%BA%D1%81%D1%82',
    );
  });

  it('повторный клик по активной плитке снимает фильтр', () => {
    render(React.createElement(HelpBrowser));

    const tile = screen.getByTestId('help-category-IT');
    fireEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(screen.getByTestId('help-articles')).getAllByRole('link').length,
    ).toBeGreaterThanOrEqual(12);
  });

  // Вариант `aria-pressed:` на дочернем элементе — мёртвый CSS: скомпилированный
  // селектор `.aria-pressed\:…[aria-pressed=true]` требует атрибут на самом
  // ребёнке, которого там нет. Активная плитка красит кнопку, но иконка
  // оставалась коралловой, а счётчик — серым на тёмном фоне (низкий контраст).
  // Дочерние элементы обязаны читать состояние плитки через group-aria-pressed.
  it('активная плитка: дети реагируют через group-aria-pressed, мёртвых aria-pressed-вариантов нет', () => {
    render(React.createElement(HelpBrowser));

    const tile = screen.getByTestId('help-category-STUDY');
    fireEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'true');

    // Плитка — группа: именно её aria-pressed читают дочерние элементы.
    expect(tile.className).toContain('group');

    const deadVariantDescendants = [...tile.querySelectorAll('*')].filter((child) =>
      /(^|\s)aria-pressed:/.test(child.getAttribute('class') ?? ''),
    );
    expect(deadVariantDescendants).toEqual([]);
  });
});
