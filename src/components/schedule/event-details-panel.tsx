'use client';

// DIG-24 — панель «Детали пары» (Figma «04 · Расписание — детали пары»).
//
// Рендерится СТРАНИЦЕЙ /schedule при ?event=<id> (сервер уже проверил доступ
// через getEventDetails: чужая пара даёт 404 до рендера панели). Панель —
// Sheet (base-ui Dialog): на десктопе — справа, < 768 px — нижний лист.
//
// URL-управление: открытие — переход по ссылке пары (?event= добавляет запись
// истории → «Назад» браузера закрывает); закрытие (Esc / крестик / «Закрыть»)
// возвращает фокус на блок пары, из которого панель открыли, и убирает
// ?event= из URL (history.replaceState БЕЗ навигации: soft-навигация между
// поисковыми вариантами страницы расписания ненадёжна — см. ViewSwitcher, а
// полная перезагрузка сбила бы возвращённый фокус).
//
// Почему не base-ui Sheet: Dialog.Popup жёстко требует Portal-контекст, а
// Portal материализуется только после mount → серверный HTML панели пуст, и
// панель мигает после гидрации. Панель DIG-24 рендерится СТРАНИЦЕЙ по
// ?event= и обязана быть в SSR-HTML (и жить без JS: «Закрыть» — обычная
// ссылка на closeHref). Поэтому разметка sheet-классов Sheet повторена
// вручную + свои Esc / фокус-ловушка / начальный фокус (см. эффекты ниже).
// Состав: шапка с цветной полосой типа, блок переноса («Было: … → Стало: …»,
// причина, «Изменил(а)»), блок отмены (причина + «Что делать»), аудитория и
// корпус («Как пройти» — схема-заглушка), преподаватель (справочник, email,
// «Написать»), онлайн-ссылка, домашнее задание и материалы, «Моя заметка»
// (server actions, только своя) и действия «Добавить в календарь» (.ics
// одной пары) / «Спросить AI об этой паре».

import { useEffect, useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, MapPin, MessageCircle, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from 'cn';

import { buttonVariants } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { t, type Locale } from '@/lib/i18n';
import type { EventDetailsView } from '@/lib/event-details';
import { deleteEventNoteAction, saveEventNoteAction } from '@/server/actions/schedule';

export interface EventDetailsPanelProps {
  view: EventDetailsView;
  /** Сохранённая заметка студента к этой паре (текст или null). */
  note: string | null;
  /** URL текущего вида без ?event= — сюда ведут закрытие и «Назад». */
  closeHref: string;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

/** Лимит заметки — дублирует MAX_NOTE_LENGTH слоя данных (500). */
const NOTE_MAX_LENGTH = 500;

/** Классы попапа Sheet DIG-13 (мобильный — нижний лист <768 px, десктоп — правая панель). */
const PANEL_CLASSES =
  'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-block border-t border-border bg-card p-5 text-card-foreground shadow-hover outline-none md:top-0 md:bottom-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-t-none md:rounded-l-block md:border-t-0 md:border-l';

export function EventDetailsPanel({
  view,
  note,
  closeHref,
  locale = 'ru',
}: EventDetailsPanelProps) {
  // Панель открыта ровно пока жив ?event=: локальный open нужен, чтобы Esc
  // закрывал панель сразу, а URL обновлялся следом (без навигации).
  const [open, setOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const dismiss = () => setOpen(false);

  // Начальный фокус: фокус переходит В панель (приёмка DIG-24). Контейнер
  // tabIndex={-1} — фокусируется программно, в Tab-порядок не попадает.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Esc закрывает; Tab циклится внутри панели (фокус-ловушка для a11y).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismiss();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(() => {
    if (open) return;
    // Диалог уже закрыт (ловушка фокуса снята): вернуть фокус на блок пары,
    // из которого панель открыли, и убрать ?event= из URL (приёмка DIG-24).
    // replaceState без навигации — см. шапку файла; фокус переживает закрытие.
    // ВАЖНО: страница содержит блоки пар ДВУХ брейкпоинтов (десктопная сетка
    // скрыта `hidden md:block` на мобильном и наоборот) — focus() на
    // display:none элемент молча не срабатывает, поэтому берём первый
    // ВИДИМЫй триггер.
    const selector = `[data-testid="lesson-${CSS.escape(view.id)}"], [data-event-id="${CSS.escape(view.id)}"]`;
    const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const trigger =
      matches.find((el) =>
        typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null,
      ) ?? null;
    trigger?.focus();
    window.history.replaceState(null, '', closeHref);
  }, [open, closeHref, view.id]);

  if (!open) return null;

  return (
    <>
      {/* затемнение фона; клик закрывает (как Backdrop Sheet DIG-13) */}
      <div aria-hidden="true" onClick={dismiss} className="fixed inset-0 z-40 bg-foreground/25" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-title"
        aria-describedby="event-details-description"
        tabIndex={-1}
        data-testid="event-details-panel"
        className={PANEL_CLASSES}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 id="event-details-title" className="text-lg font-extrabold tracking-heading">
            {view.discipline}
          </h2>
          <button
            type="button"
            aria-label={t(locale, 'schedule.panel.closeAria')}
            onClick={dismiss}
            className="-m-2 rounded-button p-2 text-muted-foreground hover:text-foreground"
          >
            <Icon icon={X} size={18} />
          </button>
        </div>
        <p id="event-details-description" className="text-sm text-muted-foreground">
          {view.kindLabel} · {view.dateLabel} · {view.timeLabel}
        </p>

        <div className="mt-4">
          <PanelContent
            view={view}
            note={note}
            closeHref={closeHref}
            onDismiss={dismiss}
            locale={locale}
          />
        </div>
      </div>
    </>
  );
}

function PanelContent({
  view,
  note,
  closeHref,
  onDismiss,
  locale = 'ru',
}: {
  view: EventDetailsView;
  note: string | null;
  closeHref: string;
  onDismiss: () => void;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const isOnlineRoom = ['онлайн', 'online'].includes(view.roomLabel.trim().toLowerCase());
  return (
    <div className="flex flex-col gap-5">
      {/* ── Шапка: цветная полоса типа, статус ─────────────────────────── */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn('h-12 w-1.5 shrink-0 rounded-pill', view.stripeClass)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {view.isCancelled ? (
            <Badge status="error">{t(locale, 'schedule.badge.cancelledFull')}</Badge>
          ) : view.isMoved ? (
            <Badge status="warning">{t(locale, 'schedule.badge.moved')}</Badge>
          ) : (
            <Badge status="success">{t(locale, 'schedule.status.scheduled')}</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {t(locale, 'schedule.panel.group', { code: view.disciplineCode })}
          </span>
        </div>
      </div>

      {/* ── Перенос: жёлтый блок «Было → Стало» ────────────────────────── */}
      {view.move ? (
        <div className="rounded-button border border-warning-soft bg-warning-soft px-3 py-2.5 text-sm text-warning-ink">
          <p className="font-semibold">
            {t(locale, 'schedule.panel.wasNow', {
              was: view.move.wasLabel ?? '—',
              now: view.move.nowLabel,
            })}
          </p>
          {view.move.reason ? (
            <p className="mt-1">
              {t(locale, 'schedule.panel.reason', { reason: view.move.reason })}
            </p>
          ) : null}
          <p className="mt-1">
            {t(locale, 'schedule.panel.author', { author: view.move.authorLabel })}
          </p>
        </div>
      ) : null}

      {/* ── Отмена: красный блок с причиной и «Что делать» ─────────────── */}
      {view.cancel ? (
        <div className="rounded-button border border-error-soft bg-error-soft px-3 py-2.5 text-sm text-error-ink">
          {view.cancel.reason ? (
            <p className="font-semibold">
              {t(locale, 'schedule.panel.reason', { reason: view.cancel.reason })}
            </p>
          ) : null}
          {view.cancel.makeupLabel ? (
            <p className="mt-1">
              {t(locale, 'schedule.panel.whatToDo', { label: view.cancel.makeupLabel })}
            </p>
          ) : null}
        </div>
      ) : null}

      {view.deaneryNote ? (
        <p className="rounded-button bg-muted px-3 py-2 text-sm text-muted-foreground">
          {view.deaneryNote}
        </p>
      ) : null}

      {/* ── Аудитория и корпус ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-2" aria-label={t(locale, 'schedule.panel.placeAria')}>
        <Row
          label={
            isOnlineRoom ? t(locale, 'schedule.panel.format') : t(locale, 'schedule.details.room')
          }
        >
          <span className="font-semibold">{view.roomLabel}</span>
          {!isOnlineRoom ? (
            <BuildingRoute
              roomLabel={view.roomLabel}
              buildingLabel={view.buildingLabel}
              locale={locale}
            />
          ) : null}
          {view.onlineUrl ? (
            <a
              href={view.onlineUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-sm font-semibold text-accent-ink underline underline-offset-2"
            >
              {t(locale, 'schedule.panel.onlineLink')}
            </a>
          ) : null}
        </Row>

        {/* ── Преподаватель: справочник, email, «Написать» ───────────────── */}
        <Row label={t(locale, 'schedule.details.teacher')}>
          <Link
            href={view.teacherCardHref}
            className="text-sm font-semibold underline underline-offset-2 hover:no-underline"
          >
            {view.teacherName}
          </Link>
          {view.teacherEmail ? (
            <>
              <span className="break-all text-xs text-muted-foreground">{view.teacherEmail}</span>
              <a
                href={view.mailtoHref ?? `mailto:${view.teacherEmail}`}
                className={buttonVariants({
                  variant: 'secondary',
                  size: 'sm',
                  className: 'w-fit',
                })}
              >
                <Icon icon={MessageCircle} size={14} />
                {t(locale, 'schedule.panel.write')}
              </a>
            </>
          ) : null}
        </Row>

        {view.homework ? (
          <Row label={t(locale, 'schedule.panel.homework')}>
            <p className="text-sm">{view.homework}</p>
          </Row>
        ) : null}
        {view.materials ? (
          <Row label={t(locale, 'schedule.panel.materials')}>
            <p className="text-sm">{view.materials}</p>
          </Row>
        ) : null}
      </section>

      {/* ── Моя заметка ────────────────────────────────────────────────── */}
      <NoteEditor eventId={view.id} note={note} locale={locale} />

      {/* ── Действия ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <a
          href={view.icsHref}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          download
        >
          <Icon icon={CalendarPlus} size={14} />
          {t(locale, 'schedule.panel.addToCalendar')}
        </a>
        <Link href="/ai-assistant" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          <Icon icon={Sparkles} size={14} />
          {t(locale, 'schedule.panel.askAi')}
        </Link>
      </div>

      <div className="flex justify-end">
        <Link
          href={closeHref}
          data-close-href={closeHref}
          onClick={(event) => {
            // с JS закрываем локально: вернётся фокус на блок пары
            event.preventDefault();
            onDismiss();
          }}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          {t(locale, 'schedule.panel.close')}
        </Link>
      </div>
    </div>
  );
}

// ── Строка «метка → содержимое» ──────────────────────────────────────────────

/** Аудитория + корпус + «Как пройти» (схема корпуса — заглушка концепта). */
function BuildingRoute({
  roomLabel,
  buildingLabel,
  locale = 'ru',
}: {
  roomLabel: string;
  buildingLabel: string;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [routeOpen, setRouteOpen] = useState(false);
  return (
    <>
      <span className="text-xs text-muted-foreground">{buildingLabel}</span>
      <button
        type="button"
        aria-expanded={routeOpen}
        onClick={() => setRouteOpen((value) => !value)}
        className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-fit' })}
      >
        <Icon icon={MapPin} size={14} />
        {t(locale, 'schedule.panel.route')}
      </button>
      {routeOpen ? (
        <p className="rounded-button bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t(locale, 'schedule.panel.routeStub', { building: buildingLabel, room: roomLabel })}
        </p>
      ) : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// ── Заметка студента (server actions) ────────────────────────────────────────

function NoteEditor({
  eventId,
  note,
  locale = 'ru',
}: {
  eventId: string;
  note: string | null;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [saveState, saveAction, savePending] = useActionState(saveEventNoteAction, null);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteEventNoteAction, null);
  // Управляемое поле: истина о тексте — сервер (note из RSC после
  // revalidate + результат actions), DOM всегда отражает состояние, а не
  // ввод неуправляемого defaultValue. Неуправляемое поле не очищалось
  // после «Удалить» (поймано e2e DIG-24). Синхронизация — документированный
  // паттерн «adjust state during render» (react-hooks/set-state-in-effect
  // запрещает setState в эффектах).
  const [text, setText] = useState(note ?? '');
  const [syncedNote, setSyncedNote] = useState(note ?? '');
  const [syncedDelete, setSyncedDelete] = useState(deleteState);
  // сравниваем НОРМАЛИЗОВАННОЕ значение: raw note=null никогда не равен
  // syncedNote='' — иначе рендер зацикливается (SSR «Too many re-renders»)
  const serverNote = note ?? '';
  if (serverNote !== syncedNote) {
    setSyncedNote(serverNote);
    setText(serverNote);
  }
  if (deleteState !== syncedDelete) {
    setSyncedDelete(deleteState);
    if (deleteState?.ok) setText('');
  }
  const error =
    saveState?.ok === false
      ? saveState.error
      : deleteState?.ok === false
        ? deleteState.error
        : null;

  return (
    <section
      className="flex flex-col gap-2 rounded-card border border-border p-3"
      aria-label={t(locale, 'schedule.note.title')}
    >
      <h3 className="text-sm font-bold tracking-heading">{t(locale, 'schedule.note.title')}</h3>
      <p className="text-xs text-muted-foreground">
        {t(locale, 'schedule.note.hint', { max: NOTE_MAX_LENGTH })}
      </p>
      <form action={saveAction} className="flex flex-col gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <textarea
          name="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          rows={3}
          placeholder={t(locale, 'schedule.note.placeholder')}
          className="w-full resize-y rounded-button border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={savePending}
            className={buttonVariants({ variant: 'primary', size: 'sm' })}
          >
            {savePending ? t(locale, 'btn.saving') : t(locale, 'btn.save')}
          </button>
          {note ? (
            <button
              type="submit"
              formAction={deleteAction}
              disabled={deletePending}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <Icon icon={Trash2} size={14} />
              {deletePending ? t(locale, 'btn.deleting') : t(locale, 'btn.delete')}
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p className="text-xs font-medium text-error-ink">{error}</p> : null}
      {saveState?.ok ? (
        <p className="text-xs font-medium text-success-ink">{t(locale, 'schedule.note.saved')}</p>
      ) : null}
    </section>
  );
}
