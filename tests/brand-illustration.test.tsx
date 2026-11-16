// DIG-16 — контракт иллюстраций в UI-компонентах:
//  - Illustration рендерит next/image с alt="" и aria-hidden="true"
//    (все иллюстрации — декоративные, смысл дублирует соседний текст);
//  - EmptyState: с illustration — картинка вместо иконки; без — иконка;
//  - ErrorState: с illustration — картинка, role="alert" сохраняется.
// next/image мокается: в jsdom оптимизатор не работает, важен контракт пропсов.
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { imageProps } = vi.hoisted(() => ({
  imageProps: { current: null as Record<string, unknown> | null },
}));

vi.mock('next/image', () => ({
  default: function MockImage(props: Record<string, unknown>) {
    imageProps.current = props;
    const { src, alt, width, height, ...rest } = props;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={String(src)}
        alt={String(alt)}
        width={Number(width)}
        height={Number(height)}
        data-testid="illustration-img"
        {...rest}
      />
    );
  },
}));

import { Illustration } from '@/components/ui/illustration';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { BrandLogo } from '@/components/brand/logo';
import { ILLUSTRATIONS } from '@/lib/illustrations';

afterEach(() => {
  cleanup();
  imageProps.current = null;
});

describe('Illustration (DIG-16)', () => {
  it('рендерит декоративную картинку: alt="" и aria-hidden="true"', () => {
    render(<Illustration name="no-classes" />);
    const img = screen.getByTestId('illustration-img');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });

  it('берёт src и размеры из реестра ILLUSTRATIONS', () => {
    render(<Illustration name="no-requests" />);
    const entry = ILLUSTRATIONS['no-requests'];
    expect(imageProps.current?.src).toBe(entry.src);
    expect(imageProps.current?.width).toBe(entry.width);
    expect(imageProps.current?.height).toBe(entry.height);
  });

  it('картинка не перехватывает события (pointer-events-none, draggable=false)', () => {
    render(<Illustration name="success" />);
    const img = screen.getByTestId('illustration-img');
    expect(img).toHaveAttribute('draggable', 'false');
    expect(img.className).toContain('pointer-events-none');
  });

  it('unknown-имя иллюстрации падает на этапе типов (TS) и отсутствует в реестре', () => {
    expect('nonexistent' in ILLUSTRATIONS).toBe(false);
  });
});

describe('EmptyState + illustration (DIG-16)', () => {
  it('с иллюстрацией: картинка вместо иконки-кружка', () => {
    const { container } = render(<EmptyState illustration="no-classes" title="Нет пар сегодня" />);
    expect(screen.getByTestId('illustration-img')).toBeInTheDocument();
    expect(screen.getByText('Нет пар сегодня')).toBeVisible();
    // иконка по умолчанию (Inbox) не рендерится — svg в компоненте нет
    expect(container.querySelector('svg')).toBeNull();
  });

  it('без иллюстрации: прежнее поведение — иконка в кружке (обратная совместимость)', () => {
    const { container } = render(<EmptyState title="Пусто" />);
    expect(screen.queryByTestId('illustration-img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('декоративная иллюстрация скрыта от скринридеров, но заголовок доступен', () => {
    render(<EmptyState illustration="no-notifications" title="Новых уведомлений нет" />);
    const img = screen.getByTestId('illustration-img');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { name: 'Новых уведомлений нет' })).toBeVisible();
  });
});

describe('ErrorState + illustration (DIG-16)', () => {
  it('с иллюстрацией: картинка и role="alert" сохраняются', () => {
    render(<ErrorState illustration="error" />);
    expect(screen.getByTestId('illustration-img')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByText('Что-то пошло не так')).toBeVisible();
  });

  it('без иллюстрации: прежнее поведение — иконка TriangleAlert', () => {
    const { container } = render(<ErrorState />);
    expect(screen.queryByTestId('illustration-img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('BrandLogo — несколько инстансов на странице (DIG-16, раунд 1 фикс)', () => {
  // /login рендерит два BrandLogo: первый — в скрытой на мобильном секции
  // (hidden md:flex). Если заливка идёт через url(#id), браузер резолвит id
  // к первому инстансу в DOM — в display:none поддереве paint server не
  // рендерится, и на 360 px логотип теряет коралловую заливку.
  it('инлайн-логотип не использует paint server (url(#id)) — дубликаты безопасны', () => {
    const { container } = render(
      <>
        <BrandLogo />
        <BrandLogo />
      </>,
    );
    const fills = [...container.querySelectorAll('svg rect')].map((r) => r.getAttribute('fill'));
    expect(fills.length).toBeGreaterThanOrEqual(2);
    for (const fill of fills) {
      expect(
        fill,
        'url(#id) ломается при скрытом дубле id — используйте сплошной цвет',
      ).not.toMatch(/^url\(/);
    }
  });

  it('заливка знака — коралловый бренда-цвет #E7645A', () => {
    const { container } = render(<BrandLogo />);
    const rect = container.querySelector('svg rect');
    expect(rect?.getAttribute('fill')).toBe('#E7645A');
  });
});
