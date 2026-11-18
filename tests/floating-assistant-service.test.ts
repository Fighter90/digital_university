// DIG-72 — серверная логика плавающего ассистента: rate-limit 10/мин на
// сессию, обрезка входа ≤1000, fallback без ключа и при ошибке API,
// ответ модели при моке fetch. В лог — только факт вызова и длина (не
// сам вопрос). Fetch и время инъекцией — реальная сеть не трогается.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  answerFloatingQuestion,
  createFloatingAssistantRateLimiter,
  FLOATING_ASSISTANT_MAX_ATTEMPTS,
  FLOATING_ASSISTANT_RATE_WINDOW_MS,
  QUESTION_MAX_LENGTH,
  type FloatingAssistantDeps,
} from '@/server/ai/floating-assistant';
import { FLOATING_SYSTEM_PROMPT } from '@/lib/floating-assistant-knowledge';

// Ключ-заглушка без префикса реальных ключей OpenRouter (grep репозитория
// по реальному префиксу пуст — проверяет security-гейт).
const KEY = 'test-openrouter-key-not-real';

function completion(answer: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content: answer } }] }),
    { status: 200 },
  );
}

const fetchOk = vi.fn(async (url: unknown, init?: RequestInit): Promise<Response> => {
  void url;
  void init;
  return completion('Готово: всё по справке.');
});

function deps(overrides: Partial<FloatingAssistantDeps> = {}): FloatingAssistantDeps {
  return {
    now: new Date('2026-11-18T10:00:00Z'),
    scopeKey: 'session-anna',
    apiKey: () => KEY,
    fetchImpl: fetchOk as unknown as typeof fetch,
    rateLimiter: createFloatingAssistantRateLimiter(),
    ...overrides,
  };
}

beforeEach(() => {
  fetchOk.mockClear();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('answerFloatingQuestion: валидация', () => {
  it('пустой вопрос — ошибка без вызова модели и лимитера', async () => {
    const hit = vi.fn(() => ({ limited: false, retryAfterMs: 0 }));
    const result = await answerFloatingQuestion(
      { question: '   ' },
      deps({ rateLimiter: { hit } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/вопрос/i);
    expect(hit).not.toHaveBeenCalled();
    expect(fetchOk).not.toHaveBeenCalled();
  });

  it('вопрос длиннее лимита обрезается до 1000 символов', async () => {
    const long = 'Расписание '.repeat(200); // 2200 символов
    const result = await answerFloatingQuestion({ question: long }, deps());
    expect(result.ok).toBe(true);
    expect(long.length).toBeGreaterThan(QUESTION_MAX_LENGTH);
    const init = fetchOk.mock.calls[0]![1]!;
    const body = JSON.parse(init.body as string) as {
      messages: { role: string; content: string }[];
    };
    const user = body.messages.at(-1)!.content;
    expect(user.length).toBe(QUESTION_MAX_LENGTH);
    expect(QUESTION_MAX_LENGTH).toBe(1000);
  });
});

describe('answerFloatingQuestion: модель и fallback', () => {
  it('есть ключ и API отвечает → режим ai, текст без markdown-сырца', async () => {
    fetchOk.mockImplementationOnce(async () =>
      completion('## Ответ\n\nОткройте **«Расписание»** и нажмите на пару.'),
    );
    const result = await answerFloatingQuestion(
      { question: 'Как посмотреть детали пары?' },
      deps(),
    );
    expect(result).toMatchObject({ ok: true, mode: 'ai' });
    if (result.ok) {
      expect(result.answer).not.toMatch(/##|\*\*/);
      expect(result.answer).toContain('Расписание');
    }
    // ключ уходит только в Authorization-заголовок серверного запроса
    const headers = (fetchOk.mock.calls[0]![1]!.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    // системный промпт в запросе модели
    const body = JSON.parse(fetchOk.mock.calls[0]![1]!.body as string) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]!.content).toBe(FLOATING_SYSTEM_PROMPT);
  });

  it('ключа нет → демо-режим с подсказкой из справки, fetch не вызывается', async () => {
    const result = await answerFloatingQuestion(
      { question: 'Как оформить справку об обучении?' },
      deps({ apiKey: () => null }),
    );
    expect(result).toMatchObject({ ok: true, mode: 'fallback' });
    if (result.ok && result.mode === 'fallback') {
      expect(result.notice).toMatch(/демо-режим/i);
      expect(result.answer).toMatch(/справк/i);
      expect(result.source?.href.startsWith('/')).toBe(true);
    }
    expect(fetchOk).not.toHaveBeenCalled();
  });

  it('API вернул 500 → fallback без падения', async () => {
    fetchOk.mockImplementationOnce(async () => new Response('boom', { status: 500 }));
    const result = await answerFloatingQuestion({ question: 'Где мои задачи?' }, deps());
    expect(result).toMatchObject({ ok: true, mode: 'fallback' });
    if (result.ok && result.mode === 'fallback') expect(result.notice).toMatch(/демо-режим/i);
  });

  it('fetch бросил сеть → fallback без падения', async () => {
    fetchOk.mockImplementationOnce(async () => {
      throw new Error('network down');
    });
    const result = await answerFloatingQuestion({ question: 'Где мои задачи?' }, deps());
    expect(result).toMatchObject({ ok: true, mode: 'fallback' });
  });

  it('API вернул мусор без content → fallback', async () => {
    fetchOk.mockImplementationOnce(
      async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );
    const result = await answerFloatingQuestion({ question: 'Где мои задачи?' }, deps());
    expect(result).toMatchObject({ ok: true, mode: 'fallback' });
  });

  it('fallback без подходящего чанка — честное «нет в справке» с предложением обращения', async () => {
    const result = await answerFloatingQuestion(
      { question: 'Какая завтра погода на Марсе?' },
      deps({ apiKey: () => null }),
    );
    expect(result).toMatchObject({ ok: true, mode: 'fallback' });
    if (result.ok && result.mode === 'fallback') {
      expect(result.answer).toMatch(/справк|не наш|нет/i);
      expect(result.answer).toMatch(/обращени|деканат|help|guide/i);
      expect(result.source).toBeNull();
    }
  });
});

describe('answerFloatingQuestion: rate-limit на сессию', () => {
  it('окно и лимит из задачи: 10 вопросов в минуту', () => {
    expect(FLOATING_ASSISTANT_RATE_WINDOW_MS).toBe(60_000);
    expect(FLOATING_ASSISTANT_MAX_ATTEMPTS).toBe(10);
  });

  it('11-й вопрос в окне — ошибка лимита, модель не вызывается', async () => {
    const rateLimiter = createFloatingAssistantRateLimiter();
    const d = deps({ rateLimiter });
    for (let i = 0; i < 10; i += 1) {
      const r = await answerFloatingQuestion({ question: `Вопрос номер ${i}` }, d);
      expect(r.ok).toBe(true);
    }
    expect(fetchOk).toHaveBeenCalledTimes(10);
    const limited = await answerFloatingQuestion({ question: 'Вопрос номер 10' }, d);
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.error).toMatch(/слишком много|подождит/i);
    expect(fetchOk).toHaveBeenCalledTimes(10);
  });

  it('через минуту окно отпускает (скользящее окно по времени)', async () => {
    let now = new Date('2026-11-18T10:00:00Z').getTime();
    const clock = () => new Date(now);
    const rateLimiter = createFloatingAssistantRateLimiter();
    const d = deps({ rateLimiter, now: clock() });
    const dWithClock = { ...d, now: clock };
    for (let i = 0; i < 10; i += 1) {
      await answerFloatingQuestion({ question: `Вопрос ${i}` }, dWithClock);
    }
    now += FLOATING_ASSISTANT_RATE_WINDOW_MS + 1;
    const r = await answerFloatingQuestion({ question: 'Вопрос снова можно' }, dWithClock);
    expect(r.ok).toBe(true);
  });

  it('лимитер считается по scopeKey: другая сессия не страдает', async () => {
    const rateLimiter = createFloatingAssistantRateLimiter();
    const anna = deps({ rateLimiter, scopeKey: 'session-anna' });
    const ilya = deps({ rateLimiter, scopeKey: 'session-ilya' });
    for (let i = 0; i < 10; i += 1) {
      await answerFloatingQuestion({ question: `Вопрос ${i}` }, anna);
    }
    const r = await answerFloatingQuestion({ question: 'А мой вопрос' }, ilya);
    expect(r.ok).toBe(true);
  });
});

describe('логирование', () => {
  it('в логах нет текста вопроса — только факт вызова и длина', async () => {
    const infoSpy = vi.mocked(console.info);
    const question = 'СЕКРЕТНЫЙ_ВОПРОС_ПРО_СТИПЕНДИЮ';
    await answerFloatingQuestion({ question }, deps());
    const logged = infoSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).not.toContain('СЕКРЕТНЫЙ_ВОПРОС');
    expect(logged).toMatch(/floating-assistant/);
    expect(logged).toMatch(/length/);
  });

  it('fallback тоже логируется фактом вызова без текста', async () => {
    const infoSpy = vi.mocked(console.info);
    const question = 'СЕКРЕТНЫЙ_ВОПРОС_ПРО_ОБЩЕЖИТИЕ';
    await answerFloatingQuestion({ question }, deps({ apiKey: () => null }));
    const logged = infoSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).not.toContain('СЕКРЕТНЫЙ_ВОПРОС');
    expect(logged).toMatch(/fallback/);
  });
});
