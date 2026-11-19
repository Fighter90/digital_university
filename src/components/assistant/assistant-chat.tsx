'use client';

// DIG-46 — чат AI-ассистента (экран /ai-assistant и выезжающая панель).
//
// Ответы формирует чистый движок src/lib/assistant-engine.ts на контексте
// сессии ( AssistantContext строит слой данных по владельцу — чужие данные
// недоступны). Стриминг — клиентский: текст ответа появляется по частям
// (уважает prefers-reduced-motion), карточки действий и источник «По
// данным: …» рендерятся сразу. Серверный прокси к модели (agent:backend)
// подменит движок fetch-стримом без изменения этого UI-контракта.
//
// Здесь же: подсказки контекста (ровно 4 из задачи), «Новый диалог»,
// история диалогов в памяти вкладки и «Сообщить о неверном ответе»
// (двухшаговое подтверждение → обращение в деканат).

import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Plus, SendHorizonal, Sparkles } from 'lucide-react';

import {
  assistantHints,
  buildAssistantReply,
  type AssistantContext,
  type AssistantReply,
} from '@/lib/assistant-engine';
import { t, type Locale } from '@/lib/i18n';
import { enPersonName } from '@/lib/en-demo-content';
import { AssistantCardList, ReportWrongAnswer } from './assistant-cards';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  /** Полный текст ответа. */
  text: string;
  /** Видимая часть (стриминг). */
  displayedText: string;
  streaming: boolean;
  /** Ответ движка (карточки + источники) — только у assistant. */
  reply?: AssistantReply;
  /** Приветствие — без «Сообщить о неверном ответе». */
  isGreeting?: boolean;
}

interface Dialog {
  id: number;
  /** Первый вопрос студента — заголовок в истории. */
  title: string;
  messages: ChatMessage[];
}

export interface AssistantChatProps {
  /** null — контекст ещё грузится (панель на открытии). */
  context: AssistantContext | null;
  /** Deep-link (?intent=exam-prep&discipline=…) сеет вопрос в первый диалог. */
  seedQuestion?: string | null;
  /** Панель закрывается при переходе по внутренним ссылкам карточек. */
  onNavigate?: () => void;
  /** DIG-88 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

const STREAM_TICK_MS = 20;
const STREAM_CHARS_PER_TICK = 3;

let idSeq = 0;
const nextId = (): number => {
  idSeq += 1;
  return idSeq;
};

function greetingMessage(context: AssistantContext | null, locale: Locale = 'ru'): ChatMessage {
  const name = context?.firstName;
  const fullName = context?.fullName ?? '';
  // DIG-124 — EN-приветствие по ПОЛНОМУ ФИО: словарь персон хранит полные
  // имена («Анна Смирнова» → «Anna Smirnova»), короткое «Анна» в нём
  // отсутствует. displayName — первое слово EN-имени («Anna»); если полное
  // имя неизвестно, фолбэк — словарь по короткому имени. RU — как было.
  const displayName =
    locale === 'en'
      ? enPersonName(fullName || (name ?? ''))
          .trim()
          .split(/\s+/)[0] || undefined
      : name;
  const text = displayName
    ? t(locale, 'assistant.greetingName', {
        name: displayName,
        suffix: t(locale, 'assistant.greetingSuffix'),
      })
    : t(locale, 'assistant.greeting', { suffix: t(locale, 'assistant.greetingSuffix') });
  return {
    id: nextId(),
    role: 'assistant',
    text,
    displayedText: text,
    streaming: false,
    isGreeting: true,
  };
}

function seededDialog(
  seedQuestion: string,
  context: AssistantContext | null,
  locale: Locale = 'ru',
): Dialog {
  const reply = buildAssistantReply(
    seedQuestion,
    context ?? {
      role: 'STUDENT',
      firstName: '',
      fullName: '',
      groupLabel: null,
      tomorrow: null,
      nextStudyDayLabel: null,
      disciplines: [],
    },
    locale,
  );
  return {
    id: nextId(),
    title: seedQuestion,
    messages: [
      greetingMessage(context, locale),
      {
        id: nextId(),
        role: 'user',
        text: seedQuestion,
        displayedText: seedQuestion,
        streaming: false,
      },
      {
        id: nextId(),
        role: 'assistant',
        text: reply.text,
        displayedText: '',
        streaming: true,
        reply,
      },
    ],
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function AssistantChat({
  context,
  seedQuestion,
  onNavigate,
  locale = 'ru',
}: AssistantChatProps) {
  const [dialogs, setDialogs] = useState<Dialog[]>(() =>
    seedQuestion
      ? [seededDialog(seedQuestion, context, locale)]
      : [makeInitialDialog(context, locale)],
  );
  const [activeId, setActiveId] = useState<number>(() => dialogs[0]!.id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = dialogs.find((dialog) => dialog.id === activeId) ?? dialogs[0]!;
  const streaming = active.messages.some((message) => message.streaming);

  // ── Стриминг ответа ────────────────────────────────────────────────────
  // Цепочку тиков ведёт ЭФФЕКТ по состоянию dialogs, а не setTimeout-колбэк,
  // читающий флаги из setDialogs-updater: React вызывает updater ПОСЛЕ
  // возврата колбэка, поэтому found/finished там всегда false и цепочка
  // обрывалась после первого тика — текст навсегда залипал с курсором ▍
  // (поймано e2e DIG-46). Каждый рендер с активным стримом планирует ровно
  // один следующий тик; cleanup гасит таймер при размонтировании/смене
  // состояния. prefers-reduced-motion: текст появляется целиком за один тик.
  useEffect(() => {
    if (!streaming) return;
    const chunk = prefersReducedMotion() ? Number.POSITIVE_INFINITY : STREAM_CHARS_PER_TICK;
    const timer = window.setTimeout(() => {
      setDialogs((prev) =>
        prev.map((dialog) => ({
          ...dialog,
          messages: dialog.messages.map((message) => {
            if (!message.streaming) return message;
            const nextLength = Math.min(message.text.length, message.displayedText.length + chunk);
            return {
              ...message,
              displayedText: message.text.slice(0, nextLength),
              streaming: nextLength < message.text.length,
            };
          }),
        })),
      );
    }, STREAM_TICK_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [dialogs, streaming]);

  // Автоскролл ленты: новое сообщение и каждый тик стрима.
  const lastDisplayedText = active.messages.at(-1)?.displayedText;
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [active.messages, lastDisplayedText]);

  const send = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (question.length === 0 || streaming || context === null) return;
      const reply = buildAssistantReply(question, context, locale);
      // Порядок важен: id вопроса МЕНЬШЕ id ответа — «Сообщить о неверном
      // ответе» ищет вопрос пары по `id < message.id` (поймано e2e DIG-46:
      // assistantId аллоцировался раньше и отчёт уходил с пустым вопросом).
      const userId = nextId();
      const assistantId = nextId();
      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === activeId
            ? {
                ...dialog,
                title: dialog.messages.some((m) => m.role === 'user') ? dialog.title : question,
                messages: [
                  ...dialog.messages,
                  {
                    id: userId,
                    role: 'user',
                    text: question,
                    displayedText: question,
                    streaming: false,
                  },
                  {
                    id: assistantId,
                    role: 'assistant',
                    text: reply.text,
                    displayedText: '',
                    streaming: true,
                    reply,
                  },
                ],
              }
            : dialog,
        ),
      );
      setDraft('');
      // Стрим нового сообщения подхватит эффект выше (streaming: true).
    },
    [activeId, context, streaming, locale],
  );

  const newDialog = useCallback(() => {
    const dialog: Dialog = {
      id: nextId(),
      title: t(locale, 'assistant.newDialog'),
      messages: [greetingMessage(context, locale)],
    };
    setDialogs((prev) => [...prev, dialog]);
    setActiveId(dialog.id);
    setHistoryOpen(false);
    setDraft('');
    inputRef.current?.focus();
  }, [context, locale]);

  const restoreDialog = useCallback((dialogId: number) => {
    setActiveId(dialogId);
    setHistoryOpen(false);
    // Недописанный стрим восстановленного диалога продолжит эффект.
  }, []);

  const showHints = active.messages.every((message) => message.role === 'assistant');

  return (
    <section
      data-assistant-context={context ? JSON.stringify(context) : undefined}
      data-assistant-seed={seedQuestion ? '1' : undefined}
      aria-label={t(locale, 'assistant.chat.aria')}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* ── Панель действий диалога ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border px-1 pb-3">
        <button
          type="button"
          data-testid="assistant-new-dialog"
          onClick={newDialog}
          className="inline-flex items-center gap-1.5 rounded-button bg-accent-soft px-2.5 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t(locale, 'assistant.newDialog')}
        </button>
        <button
          type="button"
          data-testid="assistant-history"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          className="inline-flex items-center gap-1.5 rounded-button bg-muted px-2.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          <History className="size-4" aria-hidden="true" />
          {t(locale, 'assistant.history')}
          <span className="sr-only">{t(locale, 'assistant.historySuffix')}</span>
          {dialogs.length > 1 ? (
            <span className="rounded-pill bg-foreground/10 px-1.5 text-xs font-bold">
              {dialogs.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* ── История диалогов ────────────────────────────────────────────── */}
      {historyOpen ? (
        <nav
          aria-label={t(locale, 'assistant.historyAria')}
          data-testid="assistant-history-list"
          className="mt-3 flex flex-col gap-1.5 rounded-card border border-border bg-card p-2 shadow-soft"
        >
          {dialogs.length === 1 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              {t(locale, 'assistant.historyEmpty')}
            </p>
          ) : (
            dialogs.map((dialog) => (
              <button
                key={dialog.id}
                type="button"
                onClick={() => restoreDialog(dialog.id)}
                aria-current={dialog.id === activeId}
                className={`truncate rounded-button px-2.5 py-1.5 text-left text-sm transition-colors ${
                  dialog.id === activeId
                    ? 'bg-accent-soft font-semibold text-accent-ink'
                    : 'text-foreground-muted hover:bg-neutral-100'
                }`}
              >
                {dialog.title}
              </button>
            ))
          )}
        </nav>
      ) : null}

      {/* ── Лента сообщений ─────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        data-testid="assistant-messages"
        className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5"
      >
        <ul className="flex flex-col gap-3.5">
          {active.messages.map((message) => (
            <li key={message.id} className={message.role === 'user' ? 'flex justify-end' : ''}>
              <div className={message.role === 'user' ? 'max-w-[85%]' : 'w-full'}>
                <div
                  className={
                    message.role === 'user'
                      ? 'rounded-card bg-accent px-3.5 py-2.5 text-sm font-medium text-white shadow-soft'
                      : 'rounded-card border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground shadow-soft'
                  }
                >
                  {message.displayedText}
                  {message.streaming ? (
                    <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse">
                      ▍
                    </span>
                  ) : null}
                </div>

                {message.role === 'assistant' && message.reply ? (
                  <>
                    <AssistantCardList
                      cards={message.reply.cards}
                      onNavigate={onNavigate}
                      locale={locale}
                    />
                    {message.reply.sources.length > 0 ? (
                      <p
                        data-testid="assistant-sources"
                        className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {t(locale, 'assistant.sourcesPrefix', {
                          sources: message.reply.sources.join(', '),
                        })}
                      </p>
                    ) : null}
                    {!message.isGreeting ? (
                      <ReportWrongAnswer
                        locale={locale}
                        question={
                          // Последний вопрос ПЕРЕД этим ответом (findLast, а
                          // не первый попавшийся — при нескольких обменах
                          // отчёт должен цитировать свой вопрос).
                          active.messages.findLast(
                            (candidate) => candidate.role === 'user' && candidate.id < message.id,
                          )?.text ?? ''
                        }
                        excerpt={message.text.slice(0, 160)}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {/* ── Подсказки контекста (ровно 4 из задачи) ───────────────────── */}
        {showHints ? (
          <div
            data-testid="assistant-hints"
            className="mt-4 flex flex-col gap-2"
            aria-label={t(locale, 'assistant.hintsAria')}
          >
            {assistantHints(locale).map((hint) => (
              <button
                key={hint}
                type="button"
                disabled={streaming || context === null}
                onClick={() => send(hint)}
                className="inline-flex items-center gap-2 rounded-card border border-border bg-card px-3.5 py-2.5 text-left text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-neutral-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
              >
                <Sparkles className="size-4 shrink-0 text-coral-500" aria-hidden="true" />
                {hint}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Поле ввода (не перекрывается клавиатурой: viewport meta
          interactive-widget=resizes-content, панель на 360 px — весь экран) */}
      <form
        className="mt-3 flex items-end gap-2 border-t border-border pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          ref={inputRef}
          data-testid="assistant-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            context === null
              ? t(locale, 'assistant.input.loading')
              : t(locale, 'assistant.input.placeholder')
          }
          aria-label={t(locale, 'assistant.inputAria')}
          autoComplete="off"
          enterKeyHint="send"
          disabled={context === null}
          className="min-w-0 flex-1 rounded-button border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 disabled:opacity-60"
        />
        <button
          type="submit"
          data-testid="assistant-send"
          disabled={streaming || draft.trim().length === 0 || context === null}
          aria-label={t(locale, 'assistant.sendAria')}
          className="grid size-11 shrink-0 place-items-center rounded-button bg-coral-500 text-white transition-colors hover:bg-coral-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          <SendHorizonal className="size-5" aria-hidden="true" />
        </button>
      </form>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {t(locale, 'assistant.disclaimer')}
      </p>
    </section>
  );
}

function makeInitialDialog(context: AssistantContext | null, locale: Locale = 'ru'): Dialog {
  return {
    id: nextId(),
    title: t(locale, 'assistant.newDialog'),
    messages: [greetingMessage(context, locale)],
  };
}
