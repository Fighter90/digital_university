// DIG-71 — микро-анимации кабинета: контракт в globals.css и компонентах.
// Проверяем токены длительностей/кривой, новые keyframes (shimmer, колокольчик,
// пульс-точка, аккордеон), то что анимируются только transform/opacity, и что
// все новые правила спрятаны за prefers-reduced-motion: no-preference — при
// reduce анимации не применяются вовсе и контент никогда не скрыт.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolve } from 'node:path';

import { UnreadBadge } from '@/components/shell/unread-badge';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const css = read('src/app/globals.css');

/** Блок {...} от открывающей скобки после маркера до парной закрывающей. */
function block(startMarker: string): string {
  const from = css.indexOf(startMarker);
  expect(from, `маркер «${startMarker}» найден в globals.css`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open, i + 1);
    }
  }
  return css.slice(open);
}

describe('DIG-71: токены длительностей и кривой', () => {
  it.each([
    ['--du-fast: 150ms'],
    ['--du-base: 250ms'],
    ['--du-slow: 400ms'],
    ['--ease-out: cubic-bezier(0, 0, 0.58, 1)'],
  ])('%s объявлен в globals.css', (decl) => {
    expect(css).toContain(decl);
  });

  it('animate-rise уложен в лимит 400ms', () => {
    expect(block('.animate-rise')).toContain('du-rise 400ms');
  });
});

describe('DIG-71: анимируются только transform и opacity', () => {
  it('shimmer — только translateX, без background-position и размеров', () => {
    const keyframes = block('@keyframes du-shimmer');
    expect(keyframes).toContain('translateX');
    expect(keyframes).not.toMatch(/background-position|width|height|left|top/);
  });

  it('колокольчик — только rotate', () => {
    const keyframes = block('@keyframes du-bell-swing');
    expect(keyframes).toContain('rotate');
    expect(keyframes).not.toMatch(/opacity|width|height|translate/);
  });

  it('пульс-точка — только scale и opacity', () => {
    const keyframes = block('@keyframes du-dot-pulse');
    expect(keyframes).toContain('scale');
    expect(keyframes).toContain('opacity');
    expect(keyframes).not.toMatch(/width|height|box-shadow/);
  });

  it('аккордеон — грид-строки 0fr→1fr (допустимый трюк) + opacity', () => {
    const keyframes = block('@keyframes du-accordion-open');
    expect(keyframes).toContain('grid-template-rows: 0fr');
    expect(keyframes).toContain('grid-template-rows: 1fr');
    expect(keyframes).not.toMatch(/max-height|height:|width/);
  });
});

describe('DIG-71: prefers-reduced-motion отключает все новые анимации', () => {
  // Новые утилиты объявлены одним блоком внутри
  // @media (prefers-reduced-motion: no-preference) — последнего в файле.
  const gate = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)');

  it.each([
    '.animate-shimmer',
    '.animate-bell',
    '.du-pulse-dot',
    '.press-scale',
    '.du-accordion-body',
  ])('%s живёт внутри no-preference (при reduce не применяется)', (cls) => {
    const at = css.indexOf(cls);
    expect(at, `${cls} найден в globals.css`).toBeGreaterThanOrEqual(0);
    expect(at, `${cls} должен быть после media-гейта`).toBeGreaterThan(gate);
  });
});

describe('DIG-71: компоненты используют новые утилиты', () => {
  it('Skeleton — pulse сохранён (тест ui-components) + shimmer добавлен', () => {
    const skeleton = read('src/components/ui/skeleton.tsx');
    expect(skeleton).toContain('animate-pulse');
    expect(skeleton).toContain('animate-shimmer');
  });

  it('UnreadBadge — пульс-точка у счётчика при unread > 0', () => {
    const html = renderToStaticMarkup(<UnreadBadge count={3} />);
    expect(html).toContain('du-pulse-dot');
    expect(renderToStaticMarkup(<UnreadBadge count={0} />)).toBe('');
  });

  it('колокольчик качается при unread > 0 (однократно)', () => {
    const bell = read('src/components/notifications/notifications-bell.tsx');
    expect(bell).toContain('animate-bell');
  });

  it('списки-карточки каскадно появляются (animate-rise)', () => {
    for (const file of [
      'src/app/(cabinet)/news/page.tsx',
      'src/components/requests/requests-browser.tsx',
      'src/components/people/people-browser.tsx',
    ]) {
      expect(read(file), file).toContain('animate-rise');
    }
    // Расписание: каскад через проп riseIndex → animate-rise в EventCard.
    expect(read('src/components/schedule/event-card.tsx')).toContain('animate-rise');
    for (const file of [
      'src/components/schedule/day-view.tsx',
      'src/components/schedule/mobile-schedule.tsx',
    ]) {
      expect(read(file), file).toContain('riseIndex');
    }
  });

  it('аккордеон зачётной книжки плавно раскрывается', () => {
    expect(read('src/components/gradebook/gradebook-list.tsx')).toContain('du-accordion-body');
  });
});
