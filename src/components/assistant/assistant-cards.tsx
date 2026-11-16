'use client';

// DIG-46 — карточки действий в ответах ассистента (Figma «25 AI-ассистент»):
//  - schedule: мини-расписание на день (перенос — бейдж и «было: …»);
//  - calculator: карточка дисциплины с калькулятором цели — та же чистая
//    функция needForTargetPure, что у экрана «Успеваемость» (DIG-25):
//    расхождений цифр между ассистентом и кабинетом нет;
//  - order: предзаполненная заявка-черновик — ассистент сам ничего не
//    отправляет, отправка только по явному «Подтвердить и отправить»
//    (двухшаговое подтверждение → server action);
//  - faq: ссылка на статью базы знаний.

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Calculator,
  CheckCircle2,
  ExternalLink,
  FileText,
  ListChecks,
  Send,
  ShieldAlert,
} from 'lucide-react';

import { needForTargetPure } from '@/lib/performance-math';
import type { AssistantCard } from '@/lib/assistant-engine';
import { Icon } from '@/components/ui/icon';
import {
  reportAssistantAnswerAction,
  submitAssistantRequestAction,
} from '@/server/actions/assistant';

/** Ссылки внутри карточек закрывают панель (панель живёт в Shell). */
export interface AssistantCardListProps {
  cards: AssistantCard[];
  onNavigate?: () => void;
}

const TARGET_CHIPS = [60, 70, 80, 90] as const;

export function AssistantCardList({ cards, onNavigate }: AssistantCardListProps) {
  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      {cards.map((card, index) => (
        <AssistantCardView key={`${card.type}-${index}`} card={card} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function AssistantCardView({ card, onNavigate }: { card: AssistantCard; onNavigate?: () => void }) {
  switch (card.type) {
    case 'schedule':
      return <ScheduleCard card={card} onNavigate={onNavigate} />;
    case 'calculator':
      return <CalculatorCard card={card} />;
    case 'order':
      return <OrderCard card={card} />;
    case 'faq':
      return <FaqCard card={card} onNavigate={onNavigate} />;
  }
}

// ── Мини-расписание ─────────────────────────────────────────────────────────

function ScheduleCard({
  card,
  onNavigate,
}: {
  card: Extract<AssistantCard, { type: 'schedule' }>;
  onNavigate?: () => void;
}) {
  return (
    <div
      data-testid="assistant-card-schedule"
      className="overflow-hidden rounded-card border border-border bg-card shadow-soft"
    >
      <div className="flex items-center gap-2 border-b border-border bg-neutral-50 px-4 py-2.5">
        <Icon icon={CalendarDays} size={16} className="text-accent-ink" />
        <p className="text-sm font-bold text-foreground">{card.title}</p>
      </div>
      {card.events.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {card.events.map((event) => (
            <li
              key={`${event.timeLabel}-${event.discipline}`}
              className={`flex items-start gap-3 px-4 py-2.5 ${event.isCancelled ? 'opacity-60' : ''}`}
            >
              <span className="shrink-0 pt-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {event.timeLabel}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{event.discipline}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event.kindLabel} · {event.roomLabel}
                </p>
                {event.isMoved && event.previousRoomLabel ? (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-pill bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-ink">
                    <ShieldAlert className="size-3" aria-hidden="true" />
                    Перенос · {event.previousRoomLabel}
                  </p>
                ) : null}
                {event.isCancelled ? (
                  <p className="mt-1 inline-flex items-center rounded-pill bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-error-ink">
                    Отменена
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">{card.note ?? 'Пар нет'}</p>
      )}
      <div className="px-4 pb-3 pt-1">
        <Link
          href={card.href}
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:text-accent-strong"
        >
          Открыть расписание
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

// ── Калькулятор цели ────────────────────────────────────────────────────────

function CalculatorCard({ card }: { card: Extract<AssistantCard, { type: 'calculator' }> }) {
  const [target, setTarget] = useState<number>(card.initialTarget);
  const clamped = Number.isFinite(target) ? Math.min(100, Math.max(1, Math.round(target))) : 80;

  const outcome = useMemo(
    () =>
      needForTargetPure({
        graded: card.plan
          .filter((el) => el.graded && el.score !== null)
          .map((el) => ({
            elementCode: el.code,
            score: el.score!,
            maxScore: el.maxScore,
            weight: el.weightPercent / 100,
            gradedAt: new Date(0),
          })),
        plan: card.plan.map((el) => ({
          elementCode: el.code,
          weight: el.weightPercent / 100,
          maxScore: el.maxScore,
        })),
        exam: card.exam
          ? {
              elementCode: card.exam.code,
              weight: card.exam.weightPercent / 100,
              maxScore: card.exam.maxScore,
            }
          : null,
        target: clamped,
      }),
    [card.plan, card.exam, clamped],
  );

  const conclusion = (() => {
    switch (outcome.status) {
      case 'OK':
        return `На экзамене нужно набрать не меньше ${outcome.neededScore} из ${outcome.maxScore} — тогда итог будет не ниже ${clamped}.`;
      case 'UNREACHABLE':
        return `Итог ${clamped} из 100 недостижим: даже идеальный экзамен даст итог ${Math.round(outcome.bestPossible)}. Попробуйте цель пониже.`;
      case 'ALREADY_SECURED':
        return `Цель уже достигнута: итог не ниже ${Math.round(outcome.finalPercent)}.`;
      case 'EXAM_ALREADY_GRADED':
        return `Экзамен уже сдан на ${outcome.examScore} из ${outcome.examMaxScore}, итог ${Math.round(outcome.finalPercent)} — цель ${clamped} ${outcome.finalPercent >= clamped ? 'выполнена' : 'не достигнута'}.`;
      default:
        return 'В плане дисциплины нет экзаменационного элемента — считаю по накопленной.';
    }
  })();

  const unreachable = outcome.status === 'UNREACHABLE';

  return (
    <div
      data-testid="assistant-card-calculator"
      className="overflow-hidden rounded-card border border-border bg-card shadow-soft"
    >
      <div className="flex items-center gap-2 border-b border-border bg-neutral-50 px-4 py-2.5">
        <Calculator className="size-4 text-accent-ink" aria-hidden="true" />
        <p className="text-sm font-bold text-foreground">{card.title}</p>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{card.disciplineName}</span>
          {card.teacherName ? ` · ${card.teacherName}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          Накоплено: {card.accumulatedLabel}
          {card.maxPossibleLabel ? ` · максимум возможного ${card.maxPossibleLabel}` : ''}
        </p>

        <ul className="flex flex-col gap-1.5">
          {card.plan.map((el) => (
            <li key={el.code} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground-muted">{el.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {el.weightPercent}%{' '}
                {el.graded && el.score !== null ? (
                  <span className="font-semibold text-success-ink">· {el.score}</span>
                ) : (
                  <span className="text-muted-foreground">· не сдано</span>
                )}
              </span>
            </li>
          ))}
          {card.exam ? (
            <li className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-semibold text-foreground">
                {card.exam.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {card.exam.weightPercent}%{' '}
                {card.exam.graded && card.exam.score !== null ? (
                  <span className="font-semibold text-success-ink">· {card.exam.score}</span>
                ) : (
                  <span className="text-muted-foreground">· впереди</span>
                )}
              </span>
            </li>
          ) : null}
        </ul>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Целевой итог">
          {TARGET_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              data-testid={`assistant-target-${chip}`}
              aria-pressed={clamped === chip}
              onClick={() => setTarget(chip)}
              className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors ${
                clamped === chip
                  ? 'bg-accent text-white'
                  : 'bg-accent-soft text-accent-ink hover:bg-accent-soft/70'
              }`}
            >
              {chip}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            Своя цель
            <input
              type="number"
              min={1}
              max={100}
              value={Number.isFinite(target) ? target : ''}
              onChange={(event) => setTarget(Number(event.target.value))}
              aria-label="Свой целевой итог от 1 до 100"
              data-testid="assistant-target-custom"
              className="w-16 rounded-button border border-input bg-background px-2 py-1 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
            />
          </label>
        </div>

        <p
          data-testid="assistant-calculator-result"
          className={`rounded-button px-3 py-2 text-sm font-semibold ${unreachable ? 'bg-warning-soft text-warning-ink' : 'bg-success-soft text-success-ink'}`}
        >
          {conclusion}
        </p>
      </div>
    </div>
  );
}

// ── Предзаполненная заявка ──────────────────────────────────────────────────

function OrderCard({ card }: { card: Extract<AssistantCard, { type: 'order' }> }) {
  const [state, formAction, pending] = useActionState(submitAssistantRequestAction, null);
  // Успешная отправка (state.ok) главнее локального шага подтверждения:
  // рендер ветвится по state — отдельный эффект на сброс не нужен.
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      data-testid="assistant-card-order"
      className="overflow-hidden rounded-card border border-border bg-card shadow-soft"
    >
      <div className="flex items-center gap-2 border-b border-border bg-neutral-50 px-4 py-2.5">
        <FileText className="size-4 text-accent-ink" aria-hidden="true" />
        <p className="text-sm font-bold text-foreground">{card.title}</p>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{card.serviceTitle}</p>
        <p className="text-xs text-muted-foreground">
          {card.benefit} · готовность: {card.etaLabel} · формат: {card.formatLabel} · тип:{' '}
          {card.requestTypeLabel}
        </p>
        <p className="rounded-button bg-info-soft px-3 py-2 text-xs text-info-ink">{card.notice}</p>

        {state?.ok ? (
          <div
            data-testid="assistant-order-done"
            className="flex items-start gap-2 rounded-button bg-success-soft px-3 py-2 text-sm text-success-ink"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Заявка {state.created ? 'подана' : 'уже была подана ранее'} —{' '}
              <Link
                href={`/requests/${state.requestNumber}`}
                className="font-bold underline underline-offset-2"
              >
                {state.requestNumber}
              </Link>
              . Статус — в «Заявках и справках».
            </span>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="serviceId" value={card.serviceId} />
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2 rounded-button border border-border bg-neutral-50 px-3 py-2">
                <span className="text-sm font-semibold text-foreground">
                  Отправить заявку в деканат?
                </span>
                <button
                  type="submit"
                  disabled={pending}
                  data-testid="assistant-order-submit"
                  className="inline-flex items-center gap-1.5 rounded-button bg-coral-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
                >
                  <Send className="size-3.5" aria-hidden="true" />
                  {pending ? 'Отправляем…' : 'Да, отправить'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="rounded-button px-2 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={card.disabledReason !== null}
                data-testid="assistant-order-confirm"
                className="inline-flex w-fit items-center gap-1.5 rounded-button bg-coral-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
              >
                {card.confirmLabel}
              </button>
            )}
            {card.disabledReason ? (
              <p className="text-xs text-muted-foreground">{card.disabledReason}</p>
            ) : null}
            {state && !state.ok ? (
              <p role="alert" className="text-xs font-semibold text-error-ink">
                {state.error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}

// ── Ссылка на статью FAQ ────────────────────────────────────────────────────

function FaqCard({
  card,
  onNavigate,
}: {
  card: Extract<AssistantCard, { type: 'faq' }>;
  onNavigate?: () => void;
}) {
  return (
    <div
      data-testid="assistant-card-faq"
      className="overflow-hidden rounded-card border border-border bg-card shadow-soft"
    >
      <div className="flex items-center gap-2 border-b border-border bg-neutral-50 px-4 py-2.5">
        <ListChecks className="size-4 text-accent-ink" aria-hidden="true" />
        <p className="text-sm font-bold text-foreground">{card.title}</p>
      </div>
      <ul className="flex flex-col gap-2 px-4 py-3">
        {card.bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-2 text-sm leading-relaxed text-foreground-muted"
          >
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-pill bg-accent" />
            {bullet}
          </li>
        ))}
      </ul>
      <div className="px-4 pb-3">
        <Link
          href={card.articleHref}
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:text-accent-strong"
        >
          {card.articleTitle}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

// ── Сообщить о неверном ответе ──────────────────────────────────────────────

export function ReportWrongAnswer({ question, excerpt }: { question: string; excerpt: string }) {
  const [state, formAction, pending] = useActionState(reportAssistantAnswerAction, null);
  // Успех (state.ok) главнее локального шага подтверждения — без эффекта.
  const [confirming, setConfirming] = useState(false);

  if (state?.ok) {
    return (
      <p
        role="status"
        data-testid="assistant-report-done"
        className="mt-1.5 rounded-button bg-success-soft px-2.5 py-1.5 text-xs text-success-ink"
      >
        Спасибо! Обращение создано — ответ появится в «Связи с деканатом».
      </p>
    );
  }

  return (
    <div className="mt-1.5">
      <form action={formAction} className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="question" value={question} />
        <input type="hidden" name="answerExcerpt" value={excerpt} />
        {confirming ? (
          <>
            <span className="text-xs text-muted-foreground">Ответ действительно неверный?</span>
            <button
              type="submit"
              disabled={pending}
              data-testid="assistant-report-confirm"
              className="rounded-button bg-warning-soft px-2 py-1 text-xs font-semibold text-warning-ink transition-colors hover:bg-warning-soft/70 disabled:opacity-60"
            >
              {pending ? 'Отправляем…' : 'Да, сообщить'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-button px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Отмена
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            data-testid="assistant-report"
            aria-expanded={confirming}
            className="rounded-button px-0 py-0.5 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
          >
            Сообщить о неверном ответе
          </button>
        )}
      </form>
      {state && !state.ok ? (
        <p role="alert" className="mt-1 text-xs font-semibold text-error-ink">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
