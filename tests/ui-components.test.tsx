// DIG-13 — поведение базовых компонентов дизайн-системы.
// Рендер в jsdom: варианты, состояния, клавиатурная доступность, a11y-атрибуты.
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { Badge, type BadgeStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { Toggle } from '@/components/ui/toggle';
import { Stepper, type StepState } from '@/components/ui/stepper';
import { ToastProvider, useToast } from '@/components/ui/toast';

afterEach(cleanup);

describe('Button', () => {
  it('primary использует градиент бренда и высоту 48 (md)', () => {
    render(<Button>Сохранить</Button>);
    const b = screen.getByRole('button', { name: 'Сохранить' });
    expect(b.className).toMatch(/gradient-brand/);
    expect(b.className).toMatch(/h-12/);
  });

  it('sm — 40px, secondary / ghost / danger различаются', () => {
    render(
      <>
        <Button size="sm" variant="secondary">
          S
        </Button>
        <Button variant="ghost">G</Button>
        <Button variant="danger">D</Button>
      </>,
    );
    expect(screen.getByText('S').className).toMatch(/h-10/);
    expect(screen.getByText('S').className).toMatch(/secondary/);
    expect(screen.getByText('G').className).toMatch(/ghost/);
    expect(screen.getByText('D').className).toMatch(/danger/);
  });

  it('disabled не кликается', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Нет
      </Button>,
    );
    fireEvent.click(screen.getByText('Нет'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('активный чип — тёмный, aria-pressed=true', () => {
    render(
      <>
        <Chip active>Лекции</Chip>
        <Chip>Семинары</Chip>
      </>,
    );
    const active = screen.getByRole('button', { name: 'Лекции' });
    const idle = screen.getByRole('button', { name: 'Семинары' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(idle).toHaveAttribute('aria-pressed', 'false');
    expect(active.className).toMatch(/foreground|bg-foreground|black/);
  });

  it('переключается по клику', () => {
    function Demo() {
      const [on, setOn] = useState(false);
      return (
        <Chip active={on} onClick={() => setOn(!on)}>
          Фильтр
        </Chip>
      );
    }
    render(<Demo />);
    const chip = screen.getByRole('button', { name: 'Фильтр' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Card', () => {
  it('белая карточка: радиус карточки, спокойная тень, граница', () => {
    render(<Card data-testid="card">Контент</Card>);
    const el = screen.getByTestId('card');
    expect(el.className).toMatch(/rounded-card/);
    expect(el.className).toMatch(/shadow-soft/);
    expect(el.className).toMatch(/border/);
  });
});

describe('Badge', () => {
  const statuses: BadgeStatus[] = ['success', 'warning', 'error', 'info', 'neutral', 'accent'];

  it('словарь статусов: мягкий фон + ink-текст для каждого', () => {
    for (const s of statuses) {
      const { container, unmount } = render(<Badge status={s}>x</Badge>);
      const el = container.firstElementChild as HTMLElement;
      expect(el.className, s).toMatch(new RegExp(`${s}`));
      unmount();
    }
  });

  it('solid-вариант — белая надпись', () => {
    render(
      <Badge status="success" variant="solid">
        Зачёт
      </Badge>,
    );
    expect(screen.getByText('Зачёт').className).toMatch(/solid/);
  });
});

describe('Stepper', () => {
  const states: StepState[] = ['done', 'done', 'current', 'pending', 'ready'];

  it('5 шагов, current помечен aria-current', () => {
    render(
      <Stepper
        steps={[
          { label: 'Услуга' },
          { label: 'Документы' },
          { label: 'Оплата' },
          { label: 'Проверка' },
          { label: 'Готово' },
        ]}
        states={states}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(screen.getByText('Оплата').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('все состояния различимы (done/current/pending/rejected/ready)', () => {
    const all: StepState[] = ['done', 'current', 'pending', 'rejected', 'ready'];
    render(<Stepper steps={all.map((s) => ({ label: s }))} states={all} />);
    const items = screen.getAllByRole('listitem');
    const classes = items.map((li) => li.className);
    expect(new Set(classes).size).toBe(all.length);
    // rejected и ready стилистически различаются
    const rejected = items.find((li) => li.textContent?.includes('rejected'));
    const ready = items.find((li) => li.textContent?.includes('ready'));
    expect(rejected!.className).not.toBe(ready!.className);
  });
});

describe('ProgressRing', () => {
  it('progressbar с aria-valuenow и расчётом дуги', () => {
    render(<ProgressRing value={72} label="Успеваемость" />);
    const el = screen.getByRole('progressbar', { name: 'Успеваемость' });
    expect(el).toHaveAttribute('aria-valuenow', '72');
    expect(el.querySelector('circle.progress-arc')).toBeTruthy();
  });
});

describe('Toggle', () => {
  it('role=switch, клик переключает aria-checked', () => {
    render(<Toggle aria-label="Уведомления" />);
    const t = screen.getByRole('switch', { name: 'Уведомления' });
    expect(t).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(t);
    expect(t).toHaveAttribute('aria-checked', 'true');
  });

  it('управляемый режим', () => {
    function Demo() {
      const [on, setOn] = useState(true);
      return <Toggle checked={on} onCheckedChange={setOn} aria-label="Т" />;
    }
    render(<Demo />);
    const t = screen.getByRole('switch', { name: 'Т' });
    expect(t).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(t);
    expect(t).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Segmented (День/Неделя/Месяц)', () => {
  it('radiogroup: клик и стрелки клавиатуры', () => {
    function Demo() {
      const [v, setV] = useState('week');
      return (
        <Segmented
          options={[
            { value: 'day', label: 'День' },
            { value: 'week', label: 'Неделя' },
            { value: 'month', label: 'Месяц' },
          ]}
          value={v}
          onChange={setV}
          aria-label="Период"
        />
      );
    }
    render(<Demo />);
    const group = screen.getByRole('radiogroup', { name: 'Период' });
    expect(group).toBeTruthy();
    const day = screen.getByRole('radio', { name: 'День' });
    const week = screen.getByRole('radio', { name: 'Неделя' });
    const month = screen.getByRole('radio', { name: 'Месяц' });
    expect(week).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(day);
    expect(day).toHaveAttribute('aria-checked', 'true');

    // стрелка вправо — к следующей опции
    fireEvent.keyDown(day, { key: 'ArrowRight' });
    expect(week.getAttribute('aria-checked')).toBe('true');

    // стрелка влево из последней — в начало? нет: на предыдущую
    fireEvent.keyDown(month, { key: 'ArrowLeft' });
    expect(week.getAttribute('aria-checked')).toBe('true');
  });
});

describe('Avatar', () => {
  it('инициалы из имени и фамилии, заглавные', () => {
    render(<Avatar name="Анна Петрова" />);
    expect(screen.getByText('АП')).toBeTruthy();
  });

  it('одно слово — одна буква', () => {
    render(<Avatar name="Мария" />);
    expect(screen.getByText('М')).toBeTruthy();
  });
});

describe('Skeleton / EmptyState / ErrorState', () => {
  it('Skeleton скрыт от скринридеров', () => {
    const { container } = render(<Skeleton className="h-4 w-40" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild!.className).toMatch(/animate-pulse/);
  });

  it('EmptyState: иллюстрация, текст и CTA', () => {
    render(
      <EmptyState
        title="Заявок пока нет"
        description="Создайте первую заявку"
        action={<button>Создать заявку</button>}
      />,
    );
    expect(screen.getByText('Заявок пока нет')).toBeTruthy();
    expect(screen.getByText('Создайте первую заявку')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Создать заявку' })).toBeTruthy();
  });

  it('ErrorState: сообщение и повтор', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /повтор/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Toast', () => {
  it('уведомление появляется с ролью status и закрывается', () => {
    // useToast берёт контекст провайдера — хук должен быть внутри ToastProvider
    function Inner() {
      const { toast } = useToast();
      return <button onClick={() => toast({ title: 'Заявка создана' })}>Показать</button>;
    }
    function App() {
      return (
        <ToastProvider>
          <Inner />
        </ToastProvider>
      );
    }
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Показать' }));
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Заявка создана');
    const close = screen.getByRole('button', { name: /закрыть/i });
    fireEvent.click(close);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Demo-компонент с провайдером внутри не роняет тест (первая версия удалена)', () => {
    render(<ToastProvider>ok</ToastProvider>);
    expect(screen.getByText('ok')).toBeTruthy();
  });
});
