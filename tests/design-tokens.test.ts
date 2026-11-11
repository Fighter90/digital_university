// DIG-13 — дизайн-токены: контракт дизайн-системы.
// Единственный источник истины — CSS-переменные в src/app/globals.css.
// Проверяет точные значения из макета, AA-контраст текстовых пар (WCAG),
// шрифт Onest, радиусы/тени, типы занятий и инвентарь компонентов.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// --- парсинг CSS-переменных ----------------------------------------------

const css = read('src/app/globals.css');

const vars = new Map<string, string>();
for (const m of css.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) {
  vars.set(m[1], m[2].trim());
}
const get = (name: string) => {
  const v = vars.get(name);
  expect(v, `CSS-переменная --${name} не найдена в globals.css`).toBeTruthy();
  return v as string;
};

const classes = (name: string) => {
  // значение css-класса из globals.css (для .hatch-* и подобных)
  const m = css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
  expect(m, `css-класс .${name} не найден в globals.css`).toBeTruthy();
  return (m as RegExpMatchArray)[1];
};

// --- WCAG контраст --------------------------------------------------------

const srgb = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function contrast(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const hex = (v: string) => {
  const m = v.match(/#[0-9a-fA-F]{6}/);
  expect(m, `ожидается hex-цвет в «${v}»`).toBeTruthy();
  return (m as RegExpMatchArray)[0].toLowerCase();
};

const expectToken = (name: string, value: string) => {
  expect(get(name).toLowerCase()).toContain(value.toLowerCase());
};

const expectAA = (fgName: string, bgName: string) => {
  const ratio = contrast(hex(get(fgName)), hex(get(bgName)));
  expect(
    ratio,
    `${fgName} на ${bgName}: ${ratio.toFixed(2)}:1, нужно ≥ 4.5`,
  ).toBeGreaterThanOrEqual(4.5);
};

// --- 1. палитра из макета -------------------------------------------------

describe('палитра (значения из задачи DIG-13)', () => {
  it('базовые поверхности и текст', () => {
    expectToken('background', '#F7F7F7');
    expectToken('card', '#FFFFFF');
    expectToken('border', '#EBEBEB');
    expectToken('foreground', '#222222');
    expectToken('muted-foreground', '#6A6A6A');
    expectToken('du-foreground-muted', '#9A9A9A');
  });

  it('акцент и градиент бренда', () => {
    expectToken('accent', '#FF385C');
    expectToken('du-accent-soft', '#FFF1F3');
    const gradient = get('du-gradient-brand').toLowerCase();
    for (const stop of ['#E61E4D', '#E31C5F', '#D70466']) {
      expect(gradient, `в градиенте нет ${stop}`).toContain(stop.toLowerCase());
    }
  });

  it('статусы: успех / предупреждение / ошибка / инфо (цвет + мягкий фон)', () => {
    expectToken('du-success', '#008A05');
    expectToken('du-success-soft', '#E9F6EA');
    expectToken('du-warning', '#9A6400');
    expectToken('du-warning-soft', '#FBF3E2');
    expectToken('du-error', '#C13515');
    expectToken('du-error-soft', '#FDECEA');
    expectToken('du-info', '#1D4ED8');
    expectToken('du-info-soft', '#EAF1FE');
  });

  it('типы занятий: лекция / семинар / лаб. / экзамен (мягкие фоны)', () => {
    // лекция — коралловый мягкий, семинар — синий, лаб. — зелёный, экзамен — янтарный
    expectToken('du-lesson-lecture-soft', '#FFF1F3');
    expectToken('du-lesson-seminar-soft', '#EAF1FE');
    expectToken('du-lesson-lab-soft', '#E9F6EA');
    expectToken('du-lesson-exam-soft', '#FBF3E2');
  });

  it('«перенос» — штриховка и пунктир', () => {
    const hatch = classes('hatch-rescheduled');
    expect(hatch).toMatch(/repeating-linear-gradient/i);
    expect(hatch).toMatch(/dashed/i);
  });
});

// --- 2. контраст AA -------------------------------------------------------

describe('контраст текста AA (≥ 4.5:1)', () => {
  it('основной и вторичный текст на фоне и карточках', () => {
    for (const bg of ['background', 'card']) {
      expectAA('foreground', bg);
      expectAA('muted-foreground', bg);
    }
  });

  it('ink-варианты статусов на мягких фонах и на белом', () => {
    for (const s of ['success', 'warning', 'error', 'info']) {
      expectAA(`du-${s}-ink`, `du-${s}-soft`);
      expectAA(`du-${s}-ink`, 'card');
    }
  });

  it('белый текст на градиенте бренда и на статусных заливках', () => {
    const stops = get('du-gradient-brand').match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const stop of stops) {
      const ratio = contrast('#FFFFFF', stop);
      expect(ratio, `белый на ${stop}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
    for (const s of ['success', 'warning', 'error', 'info']) {
      const ratio = contrast('#FFFFFF', hex(get(`du-${s}`)));
      expect(ratio, `белый на ${s}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('ink-варианты типов занятий на своих мягких фонах', () => {
    for (const t of ['lecture', 'seminar', 'lab', 'exam']) {
      expectAA(`du-lesson-${t}-ink`, `du-lesson-${t}-soft`);
    }
  });

  it('акцентный ink-текст AA на белом и мягком акценте', () => {
    expectAA('du-accent-ink', 'card');
    expectAA('du-accent-ink', 'du-accent-soft');
  });

  it('#9A9A9A — только декор: не участвует в текстовых AA-парах', () => {
    // документируем намерение: приглушённый цвет не является цветом текста
    expect(hex(get('du-foreground-muted'))).toBe('#9a9a9a');
    expect(contrast('#9A9A9A', '#FFFFFF')).toBeLessThan(4.5);
  });
});

// --- 3. радиусы, тени, фокус ----------------------------------------------

describe('радиусы и тени', () => {
  it('радиусы: кнопки 8, карточки 12–16, блоки 24, пилюли 999', () => {
    expect(get('du-radius-button')).toContain('8px');
    expect(get('du-radius-card-sm')).toContain('12px');
    expect(get('du-radius-card')).toContain('16px');
    expect(get('du-radius-block')).toContain('24px');
    expect(get('du-radius-pill')).toContain('999px');
  });

  it('тени: спокойная и hover с подъёмом', () => {
    expect(get('du-shadow-soft')).toBe('0 1px 2px rgba(0, 0, 0, 0.06)');
    expect(get('du-shadow-hover')).toBe('0 16px 38px rgba(0, 0, 0, 0.1)');
    // подъём на 2px выражен в hover-стиле кнопок/карточек
    expect(css).toMatch(/translateY\(-2px\)/);
  });

  it('видимое кольцо фокуса :focus-visible (≥ 3:1 к фону)', () => {
    expect(css).toMatch(/:focus-visible/);
    expect(get('ring')).toBeTruthy();
    const ratio = contrast(hex(get('ring')), hex(get('background')));
    expect(ratio, `ring на фоне: ${ratio.toFixed(2)}:1, нужно ≥ 3`).toBeGreaterThanOrEqual(3);
  });
});

// --- 4. шрифт -------------------------------------------------------------

describe('шрифт Onest (OFL)', () => {
  it('layout.tsx подключает Onest, веса 400–800, latin + cyrillic', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toMatch(/Onest/);
    expect(layout).toMatch(/next\/font\/google/);
    for (const w of ['400', '500', '600', '700', '800']) {
      expect(layout, `вес ${w}`).toContain(`'${w}'`);
    }
    expect(layout).toMatch(/cyrillic/);
    expect(layout).toMatch(/latin/);
  });

  it('globals.css маппит --font-sans на переменную Onest', () => {
    expect(css).toMatch(/--font-sans:\s*var\(--font-onest\)/);
  });

  it('заголовки: вес 800 и трекинг −0.02…−0.03em', () => {
    expect(get('du-tracking-heading')).toMatch(/-0\.0[23]\d*em/);
    expect(css).toMatch(/h1[\s\S]{0,120}font-weight:\s*800/);
  });
});

// --- 5. инвентарь компонентов ---------------------------------------------

const UI = 'src/components/ui';
const COMPONENTS = [
  'button',
  'chip',
  'card',
  'stat-tile',
  'badge',
  'stepper',
  'progress-ring',
  'toggle',
  'segmented',
  'sheet',
  'dialog',
  'toast',
  'skeleton',
  'empty-state',
  'error-state',
  'tooltip',
  'avatar',
  'icon',
] as const;

describe('компоненты src/components/ui', () => {
  for (const c of COMPONENTS) {
    it(`существует: ${c}.tsx`, () => {
      expect(existsSync(resolve(ROOT, UI, `${c}.tsx`)), `missing: ${c}.tsx`).toBe(true);
    });
  }
  it('barrel index.ts экспортирует все компоненты', () => {
    const barrel = read(`${UI}/index.ts`);
    for (const c of COMPONENTS) {
      expect(barrel, `в index.ts нет экспорта ${c}`).toMatch(new RegExp(`['"]\\./${c}['"]`));
    }
  });

  it('иконки lucide-react со stroke 1.8', () => {
    const icon = read(`${UI}/icon.tsx`);
    expect(icon).toMatch(/lucide-react/);
    expect(icon).toMatch(/1\.8/);
  });

  it('галерея /design существует и скрыта в проде', () => {
    const page = read('src/app/design/page.tsx');
    expect(page).toMatch(/NODE_ENV/);
    expect(page).toMatch(/notFound/);
  });
});
