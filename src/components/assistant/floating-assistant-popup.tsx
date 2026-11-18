'use client';

// DIG-72 — попап-чат плавающего AI-ассистента (клик по FAB в Shell).
//
// Десктоп (≥768): карточка 400 px у кнопки в правом нижнем углу с
// хвостиком к FAB. Мобильный 360 px: bottom-sheet на весь экран с
// ручкой-перетаскиванием. История текущей сессии — в памяти компонента
// (useState, НЕ в БД): закрытие и повторное открытие её сохраняет.
// Ответы — server action askFloatingAssistant (OpenRouter + RAG по
// справке); режим fallback показывает подсказку из справки с пометкой
// демо-режима и ссылкой на источник. Enter отправляет, Shift+Enter —
// перенос строки; фокус-ловушка и Esc — Base UI Dialog (как в панели
// DIG-46). Диалог — отдельный «лёгкий вход»: полноэкранный ассистент с
// карточками DIG-46 остаётся на /ai-assistant и по кнопке AI в шапке.

import { useEffect, useRef, useState } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { SendHorizonal, Sparkles, X } from 'lucide-react';

import {
  askFloatingAssistant,
  type FloatingAssistantReply,
} from '@/server/actions/floating-assistant';
import { Icon } from '@/components/ui/icon';

export interface FloatingAssistantPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChatEntry {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** Пометка демо-режима (fallback) — чип над текстом ответа. */
  notice?: string;
  /** Источник справки для fallback-подсказки. */
  source?: { title: string; href: string } | null;
  /** Сообщение об ошибке (rate-limit и пр.) — отдельная плашка. */
  error?: string;
  pending?: boolean;
}

let entrySeq = 0;
const nextEntryId = (): number => {
  entrySeq += 1;
  return entrySeq;
};

const GREETING =
  'Здравствуйте! Я ассистент справки цифрового деканата. Спросите, как ' +
  'пользоваться кабинетом: заявки, расписание, стипендии, настройки — ' +
  'отвечу по «Справке» и «Вопросам и ответам».';

export function FloatingAssistantPopup({ open, onOpenChange }: FloatingAssistantPopupProps) {
  // История сессии живёт в памяти компонента (не в БД): попап монтируется
  // вместе со Shell, поэтому история переживает закрытие попапа.
  const [entries, setEntries] = useState<ChatEntry[]>([
    { id: nextEntryId(), role: 'assistant', text: GREETING },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Автоскролл к последнему сообщению и фокус в поле при открытии.
  useEffect(() => {
    const list = messagesRef.current;
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [open, entries]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async () => {
    const question = draft.trim();
    if (question.length === 0 || sending) return;
    setDraft('');
    setSending(true);
    setEntries((prev) => [
      ...prev,
      { id: nextEntryId(), role: 'user', text: question },
      { id: nextEntryId(), role: 'assistant', text: '', pending: true },
    ]);
    let reply: FloatingAssistantReply;
    try {
      reply = await askFloatingAssistant({ question });
    } catch {
      reply = { ok: false, error: 'Не удалось получить ответ. Попробуйте ещё раз.' };
    }
    setSending(false);
    setEntries((prev) => {
      // Плейсхолдер «печатает» заменяется ответом (последняя запись).
      const base = prev.slice(0, -1);
      if (!reply.ok) {
        return [...base, { id: nextEntryId(), role: 'assistant', text: '', error: reply.error }];
      }
      if (reply.mode === 'ai') {
        return [...base, { id: nextEntryId(), role: 'assistant', text: reply.answer }];
      }
      return [
        ...base,
        {
          id: nextEntryId(),
          role: 'assistant',
          text: reply.answer,
          notice: reply.notice,
          source: reply.source,
        },
      ];
    });
  };

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        {/* Мобильный: затемнение под шитом; десктоп: лёгкая подложка,
            клик вне карточки закрывает попап. */}
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25" />
        <BaseDialog.Popup
          aria-label="AI-ассистент"
          data-testid="ai-fab-popup"
          className={[
            'fixed inset-0 z-50 flex flex-col bg-neutral-50 outline-none',
            // Десктоп: карточка 400 px у FAB, с хвостиком к кнопке.
            'md:inset-auto md:bottom-24 md:right-6 md:max-h-[560px] md:w-[400px]',
            'md:rounded-card md:border md:border-border md:shadow-hover',
          ].join(' ')}
        >
          {/* Ручка bottom-sheet (мобильный) — визуальный якорь свайпа. */}
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-pill bg-neutral-300 md:hidden"
          />
          {/* Хвостик карточки к FAB (десктоп) — ромб на нижней кромке. */}
          <div
            aria-hidden="true"
            className="absolute -bottom-1.5 right-9 hidden size-3 rotate-45 rounded-[2px] border-b border-r border-border bg-card md:block"
          />

          <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3 md:rounded-t-card">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-pill bg-coral-500 text-white"
            >
              <Sparkles className="size-4" />
            </span>
            <BaseDialog.Title
              data-testid="ai-fab-popup-title"
              className="flex-1 text-lg font-extrabold tracking-heading"
            >
              AI-ассистент
            </BaseDialog.Title>
            <BaseDialog.Close
              data-testid="ai-fab-popup-close"
              aria-label="Закрыть чат ассистента"
              className="-m-1.5 rounded-button p-2 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
            >
              <Icon icon={X} size={18} />
            </BaseDialog.Close>
          </header>

          <div
            ref={messagesRef}
            data-testid="ai-fab-popup-messages"
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3"
          >
            {entries.map((entry) =>
              entry.role === 'user' ? (
                <div key={entry.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-card rounded-br-md bg-coral-500 px-3.5 py-2.5 text-sm leading-snug text-white">
                    {entry.text}
                  </p>
                </div>
              ) : (
                <div key={entry.id} className="flex flex-col items-start gap-1">
                  {entry.pending ? (
                    <p
                      className="animate-pulse rounded-card rounded-bl-md bg-card px-3.5 py-2.5 text-sm text-muted-foreground"
                      data-testid="ai-fab-popup-pending"
                    >
                      Ассистент печатает…
                    </p>
                  ) : (
                    <>
                      {entry.notice && (
                        <p className="rounded-pill bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                          {entry.notice}
                        </p>
                      )}
                      {entry.text.length > 0 && (
                        <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-card rounded-bl-md bg-card px-3.5 py-2.5 text-sm leading-snug text-foreground">
                          {entry.text}
                        </p>
                      )}
                      {entry.source && (
                        <a
                          data-testid="ai-fab-popup-source"
                          href={entry.source.href}
                          className="text-xs font-semibold text-coral-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
                        >
                          {entry.source.title} →
                        </a>
                      )}
                      {entry.error && (
                        <p
                          data-testid="ai-fab-popup-error"
                          className="max-w-[90%] rounded-card rounded-bl-md bg-red-50 px-3.5 py-2.5 text-sm leading-snug text-red-700"
                        >
                          {entry.error}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ),
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-border bg-card px-3 py-3 md:rounded-b-card"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              ref={inputRef}
              data-testid="ai-fab-popup-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter отправляет, Shift+Enter оставляет перенос строки.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              type="text"
              enterKeyHint="send"
              maxLength={1000}
              placeholder="Спросите, как пользоваться кабинетом…"
              aria-label="Вопрос ассистенту"
              className="min-w-0 flex-1 rounded-button border border-neutral-200 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral-600"
            />
            <button
              type="submit"
              data-testid="ai-fab-popup-send"
              aria-label="Отправить вопрос"
              disabled={draft.trim().length === 0 || sending}
              className="grid size-11 shrink-0 place-items-center rounded-pill bg-coral-500 text-white transition-colors hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
            >
              <SendHorizonal className="size-5" aria-hidden="true" />
            </button>
          </form>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
