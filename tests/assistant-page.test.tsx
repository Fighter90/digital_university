// DIG-46 — контракт страницы /ai-assistant («AI-ассистент», SSR).
// Приёмка: приветствие с именем, 4 подсказки, «Новый диалог», «История»,
// deep-link ?intent=exam-prep&discipline=… сеет вопрос, состояние сотрудника.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { AssistantContext } from '@/lib/assistant-engine';

const state = vi.hoisted(() => ({
  ctx: { role: 'STUDENT', studentId: 'st-anna', login: 'anna.smirnova' },
  context: null as AssistantContext | null,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getAssistantContext: vi.fn(async () => state.context),
}));

import AiAssistantPage from '@/app/(cabinet)/ai-assistant/page';

async function renderPage(searchParams?: Record<string, string>): Promise<string> {
  const Page = AiAssistantPage as unknown as ComponentType<{
    searchParams?: Promise<Record<string, string>>;
  }>;
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { searchParams: Promise.resolve(searchParams ?? {}) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

function contextFixture(role: 'STUDENT' | 'STAFF' = 'STUDENT'): AssistantContext {
  return {
    role,
    firstName: role === 'STUDENT' ? 'Анна' : 'Мария',
    fullName: role === 'STUDENT' ? 'Анна Смирнова' : 'Мария Ковалёва',
    groupLabel: role === 'STUDENT' ? 'ПИ-21' : null,
    tomorrow:
      role === 'STUDENT'
        ? {
            dateKey: '2026-11-12',
            dateLabel: 'четверг, 12 ноября',
            events: [
              {
                timeLabel: '12:00–13:30',
                discipline: 'Программирование',
                kindLabel: 'Лабораторная',
                roomLabel: 'ауд. 405',
                teacher: 'Иванова Ирина Игоревна',
                isMoved: true,
                isCancelled: false,
                isOnline: false,
              },
            ],
          }
        : null,
    nextStudyDayLabel: null,
    disciplines: [],
  };
}

describe('/ai-assistant — студент', () => {
  it('приветствие с именем, 4 подсказки и каркас чата', async () => {
    state.context = contextFixture();
    const html = await renderPage();
    expect(html).toContain('Анна');
    expect(html).toContain('Что у меня завтра?');
    expect(html).toContain('Сколько нужно на экзамене по БД, чтобы получить 8?');
    expect(html).toContain('Закажи справку для военкомата');
    expect(html).toContain('Как оформить академический отпуск?');
    expect(html).toContain('data-testid="assistant-new-dialog"');
    expect(html).toContain('data-testid="assistant-history"');
    expect(html).toContain('data-testid="assistant-input"');
  });

  it('deep-link ?intent=exam-prep&discipline=… сеет вопрос в чат', async () => {
    state.context = contextFixture();
    const html = await renderPage({ intent: 'exam-prep', discipline: 'PI21-INFO' });
    expect(html).toContain('PI21-INFO');
    expect(html).toContain('data-assistant-seed="1"');
  });

  // DIG-38: «Спросить AI-ассистента» из пустого состояния /help переносит
  // текст запроса в параметр q — ассистент сеет его как первый вопрос.
  it('?q= из базы знаний сеет запрос как вопрос в чат', async () => {
    state.context = contextFixture();
    const html = await renderPage({ q: 'как получить повышенную стипендию' });
    expect(html).toContain('data-assistant-seed="1"');
    expect(html).toContain('как получить повышенную стипендию');
  });

  it('?q= пустой или из одних пробелов — сид не ставится', async () => {
    state.context = contextFixture();
    const html = await renderPage({ q: '   ' });
    expect(html).not.toContain('data-assistant-seed="1"');
  });

  it('контекст передаётся в чат сериализуемым JSON', async () => {
    state.context = contextFixture();
    const html = await renderPage();
    expect(html).toContain('data-assistant-context=');
    const match = html.match(/data-assistant-context="([^"]*)"/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1].replaceAll('&quot;', '"')) as AssistantContext;
    expect(parsed.firstName).toBe('Анна');
    expect(parsed.tomorrow?.events).toHaveLength(1);
  });
});

describe('/ai-assistant — сотрудник', () => {
  it('приветствие по имени без студенческих данных', async () => {
    state.context = contextFixture('STAFF');
    const html = await renderPage();
    expect(html).toContain('Мария');
    expect(html).toContain('Что у меня завтра?');
  });
});
