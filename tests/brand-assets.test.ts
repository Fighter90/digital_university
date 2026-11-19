// DIG-16 — бренд-ассеты: логотип, иллюстрации пустых состояний, иконки PWA,
// OG-превью. Контракт продакшен-ассетов:
//   - иллюстрации — WebP в public/illustrations/, каждая ≤ 80 КБ;
//   - подключение через next/image с alt="" + aria-hidden (декоративные);
//   - логотип — собственный вымышленный SVG (бренд вуза запрещён);
//   - favicon / apple-touch-icon / PWA 192+512 + manifest;
//   - Open Graph 1200×630 в layout metadata;
//   - исходники и промпты генерации — в docs/ai-log/assets.md.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p));
const text = (p: string) => read(p).toString('utf8');
const kb = (p: string) => statSync(resolve(ROOT, p)).size / 1024;

const MAX_KB = 80;

// --- реестр иллюстраций ----------------------------------------------------

const EXPECTED_ILLUSTRATIONS = [
  'no-classes', // «Нет пар сегодня»
  'no-requests', // «Заявок пока нет»
  'no-notifications', // «Нет уведомлений»
  'error', // «Что-то пошло не так» / 404
  'success', // «Справка готова»
  'login-hero', // hero экрана входа
] as const;

describe('DIG-16: иллюстрации public/illustrations', () => {
  it('все шесть иллюстраций существуют в WebP и весят ≤ 80 КБ', () => {
    for (const name of EXPECTED_ILLUSTRATIONS) {
      const p = `public/illustrations/${name}.webp`;
      expect(existsSync(resolve(ROOT, p)), `нет файла ${p}`).toBe(true);
      const head = read(p).subarray(0, 12);
      // RIFF....WEBP
      expect(head.subarray(0, 4).toString('latin1'), `${p}: не RIFF`).toBe('RIFF');
      expect(head.subarray(8, 12).toString('latin1'), `${p}: не WEBP`).toBe('WEBP');
      expect(kb(p), `${p}: ${kb(p).toFixed(1)} КБ > 80 КБ`).toBeLessThanOrEqual(MAX_KB);
    }
  });

  it('реестр src/lib/illustrations.ts: все пути из реестра существуют, alt декоративный', async () => {
    const src = text('src/lib/illustrations.ts');
    expect(src).toContain('ILLUSTRATIONS');
    // реестр объявляет все шесть имён
    for (const name of EXPECTED_ILLUSTRATIONS) {
      // ключ в исходнике: с кавычками или без (prettier их снимает с
      // валидных идентификаторов) — имя с опциональной кавычкой и двоеточие
      expect(src, `в реестре нет ${name}`).toMatch(new RegExp(`['"]?${name}['"]?\\s*:`));
    }
    const { ILLUSTRATIONS } = await import('@/lib/illustrations');
    for (const [name, entry] of Object.entries(ILLUSTRATIONS)) {
      const e = entry as { src: string; width: number; height: number; alt: string };
      expect(existsSync(resolve(ROOT, `public${e.src}`)), `public${e.src} не найден`).toBe(true);
      expect(e.alt, `${name}: alt должен быть "" (декоративная)`).toBe('');
      expect(e.width).toBeGreaterThan(0);
      expect(e.height).toBeGreaterThan(0);
    }
  });

  it('компонент Illustration использует next/image (критерий приёмки)', () => {
    const src = text('src/components/ui/illustration.tsx');
    expect(src).toContain("from 'next/image'");
    expect(src).toContain('aria-hidden');
  });
});

describe('DIG-16: иконки и PWA', () => {
  it('логотип public/brand/logo.svg — валидный SVG на палитре проекта, без внешних ссылок', () => {
    const p = 'public/brand/logo.svg';
    expect(existsSync(resolve(ROOT, p)), `нет файла ${p}`).toBe(true);
    const svg = text(p);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox');
    // собственная палитра бренда (коралловый скруглённый квадрат)
    expect(svg).toMatch(/#E7645A|#e7645a|E7645A/);
    // никаких внешних растровых ресурсов (бренд вуза запрещён);
    // xmlns="http://www.w3.org/2000/svg" — стандартный атрибут, не ссылка
    expect(svg).not.toMatch(/xlink:href|<image/);
  });

  it('PWA-иконки 192 и 512 существуют (PNG ≤ 80 КБ) и объявлены в manifest', () => {
    for (const [p, size] of [
      ['public/icons/icon-192.png', 192],
      ['public/icons/icon-512.png', 512],
    ] as const) {
      expect(existsSync(resolve(ROOT, p)), `нет файла ${p}`).toBe(true);
      const head = read(p).subarray(0, 8);
      expect([...head.subarray(1, 4)].map(Number)).toEqual([0x50, 0x4e, 0x47]); // PNG
      expect(kb(p), `${p} > 80 КБ`).toBeLessThanOrEqual(MAX_KB);
      // размеры из IHDR (байты 16-24)
      const buf = read(p);
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      expect(w, `${p}: ширина ${w}`).toBe(size);
      expect(h, `${p}: высота ${h}`).toBe(size);
    }
    const manifest = text('src/app/manifest.ts');
    expect(manifest).toContain('/icons/icon-192.png');
    expect(manifest).toContain('/icons/icon-512.png');
    expect(manifest).toContain('192x192');
    expect(manifest).toContain('512x512');
    expect(manifest).toContain('Цифровой деканат');
  });

  it('favicon и apple-touch-icon подключены файловыми конвенциями Next', () => {
    // src/app/icon.png — favicon (Next file convention); apple-icon.png — apple-touch-icon.
    expect(existsSync(resolve(ROOT, 'src/app/icon.png')), 'нет src/app/icon.png').toBe(true);
    expect(existsSync(resolve(ROOT, 'src/app/apple-icon.png')), 'нет src/app/apple-icon.png').toBe(
      true,
    );
    // дефолтная иконка шаблона Next удалена (заменена брендом)
    expect(existsSync(resolve(ROOT, 'src/app/favicon.ico'))).toBe(false);
    // обе — PNG ≤ 80 КБ
    for (const p of ['src/app/icon.png', 'src/app/apple-icon.png']) {
      expect(kb(p), `${p} > 80 КБ`).toBeLessThanOrEqual(MAX_KB);
    }
  });
});

describe('DIG-16: Open Graph 1200×630', () => {
  it('public/og.jpg 1200×630 ≤ 80 КБ и подключён в layout metadata', () => {
    const p = 'public/og.jpg';
    expect(existsSync(resolve(ROOT, p)), 'нет public/og.jpg').toBe(true);
    expect(kb(p), `og.jpg ${kb(p).toFixed(1)} КБ > 80 КБ`).toBeLessThanOrEqual(MAX_KB);
    // JPEG: маркер SOI + dims из SOF0/SOF2
    const buf = read(p);
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    let w = 0;
    let h = 0;
    for (let i = 2; i < buf.length - 9;) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
        h = buf.readUInt16BE(i + 5);
        w = buf.readUInt16BE(i + 7);
        break;
      }
      i += 2 + len;
    }
    expect(w).toBe(1200);
    expect(h).toBe(630);

    const layout = text('src/app/layout.tsx');
    expect(layout).toContain('/og.jpg');
    expect(layout).toContain('summary_large_image');
  });

  it('обложка PDF-описания public/brand/pdf-cover.jpg существует (портретная, ≤ 80 КБ)', () => {
    const p = 'public/brand/pdf-cover.jpg';
    expect(existsSync(resolve(ROOT, p)), `нет файла ${p}`).toBe(true);
    expect(kb(p), `pdf-cover.jpg ${kb(p).toFixed(1)} КБ > 80 КБ`).toBeLessThanOrEqual(MAX_KB);
    const buf = read(p);
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
  });
});

describe('DIG-16: подключение иллюстраций в экраны', () => {
  const cases: Array<[string, string, string]> = [
    ['src/components/dashboard/sections.tsx', 'no-classes', '«Нет пар сегодня» — дашборд'],
    ['src/components/schedule/day-view.tsx', 'no-classes', '«Пар в этот день нет» — расписание'],
    ['src/app/(cabinet)/requests/page.tsx', 'no-requests', '«Заявок пока нет»'],
    [
      'src/components/notifications/notifications-screen.tsx',
      'no-notifications',
      '«Нет уведомлений»',
    ],
    ['src/components/requests/order-wizard.tsx', 'success', '«Справка готова» — мастер заказа'],
    ['src/app/not-found.tsx', 'error', '404 — «Что-то пошло не так»'],
    ['src/app/(auth)/login/page.tsx', 'login-hero', 'hero экрана входа'],
  ];
  it.each(cases)('%s использует иллюстрацию %s (%#)', (file, name, label) => {
    const src = text(file);
    // EmptyState/ErrorState получают проп `illustration="…"`, прямой рендер —
    // `<Illustration name="…">`; контракт — имя как значение атрибута.
    expect(src, `${label}: нет иллюстрации ${name} в ${file}`).toMatch(
      new RegExp(`(illustration|name)=["']${name}["']`),
    );
  });

  it('компонент EmptyState поддерживает illustration, ErrorState — тоже', () => {
    expect(text('src/components/ui/empty-state.tsx')).toContain('illustration');
    expect(text('src/components/ui/error-state.tsx')).toContain('illustration');
  });

  it('логотип подключён в Shell (top-bar) и на экране входа', () => {
    expect(text('src/components/shell/top-bar.tsx')).toContain('<BrandLogo');
    expect(text('src/app/(auth)/login/page.tsx')).toContain('<BrandLogo');
  });

  it('hero-иллюстрация на входе декоративна (alt="" + aria-hidden в компоненте)', () => {
    // Декоративность обеспечивает сам компонент Illustration (alt="", aria-hidden).
    const src = text('src/components/ui/illustration.tsx');
    expect(src).toContain('alt=""');
    expect(src).toContain('aria-hidden');
  });
});

describe('DIG-16: документирование генерации', () => {
  it('docs/ai-log/assets.md фиксирует инструмент, промпты и исходники', () => {
    const md = text('docs/ai-log/assets.md');
    // инструмент генерации (Higgsfield/Recraft) задокументирован
    expect(md).toMatch(/[Hh]iggsfield|[Rr]ecraft/);
    for (const name of EXPECTED_ILLUSTRATIONS) {
      expect(md, `в assets.md нет промпта для ${name}`).toContain(name);
    }
    // исходники сохранены
    expect(existsSync(resolve(ROOT, 'docs/ai-log/assets-src')), 'нет папки исходников').toBe(true);
  });

  it('THIRD_PARTY_LICENSES.md описывает лицензию сгенерированных изображений', () => {
    const md = text('THIRD_PARTY_LICENSES.md');
    expect(md).toMatch(/[Сс]генерирован|[Сс]генерированные|AI|генераци/);
    expect(md).toMatch(/[Hh]iggsfield|[Rr]ecraft/);
  });

  it('дельта DIG-16 заархивирована: спека brand-assets в openspec/specs', () => {
    expect(existsSync(resolve(ROOT, 'openspec/specs/brand-assets/spec.md'))).toBe(true);
    const archived = readdirSync(resolve(ROOT, 'openspec/changes/archive')).find((d) =>
      d.endsWith('-dig-16-brand-assets'),
    );
    expect(archived, 'DIG-16 не найден в openspec/changes/archive').toBeTruthy();
    expect(
      existsSync(
        resolve(ROOT, 'openspec/changes/archive', archived!, 'specs/brand-assets/spec.md'),
      ),
    ).toBe(true);
  });
});
