// DIG-37 — карточка человека /people/<id>. id из URL выбирает запись
// вымышленного каталога по белому списку (getPersonCard) — незнакомый id
// отвечает единым 404 (uniform 404 без оракула существования). Персональные
// разделы («Ваши дисциплины», «Ближайшие пары») считаются только из скоупа
// сессии: чужого скоупа здесь не существует по построению.
//
// NOTE: НЕ добавлять loading.tsx в этот сегмент — Suspense заставит Next
// стримить оболочку с HTTP 200 до срабатывания notFound() (контракт единого
// 404, как в requests/[number]/page.tsx).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Clock,
  DoorOpen,
  GraduationCap,
  Info,
  Mail,
  Phone,
} from 'lucide-react';

import { requireDataCtx, getPersonCard } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Карточка — Справочник — Цифровой деканат' };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  // Next уже декодирует сегмент маршрута; повторный decodeURIComponent при
  // «сыром» % даёт URIError → 500. Ловим и отвечаем единым 404 (контракт).
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    notFound();
  }
  const ctx = await requireDataCtx(`/people/${rawId}`);

  const card = await getPersonCard(dataDb, ctx, id);
  if (!card) notFound();
  const { person, upcoming } = card;
  const isTeacher = person.kind === 'TEACHER';

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:py-8">
      <Link
        href="/people"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Справочник
      </Link>

      {/* ── Шапка: аватар-инициалы, ФИО, должность, подразделение ─────────── */}
      <header className="rounded-card border border-border bg-card p-5 shadow-soft md:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={person.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                data-testid="person-heading"
                className="text-xl font-extrabold tracking-heading text-foreground sm:text-2xl"
              >
                {person.fullName}
              </h1>
              {card.isMyManager ? (
                <Badge status="accent" data-testid="person-manager-badge">
                  Ваш менеджер
                </Badge>
              ) : null}
              {card.isMyTeacher ? <Badge status="info">Ведёт у вас</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-neutral-700">{person.position}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{person.department}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge status="neutral">{isTeacher ? 'Преподаватель' : 'Сотрудник деканата'}</Badge>
              {person.isProgramManager && person.program ? (
                <span>Менеджер программы «{person.program}»</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Действия: письмо — mailto, запись на консультацию — заглушка. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            data-testid="person-mailto"
            href={`mailto:${person.email}`}
            className="inline-flex items-center gap-1.5 rounded-button bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-soft transition-colors hover:bg-neutral-700"
          >
            <Mail aria-hidden="true" className="size-4" />
            Написать письмо
          </a>
          {isTeacher ? (
            <span className="inline-flex flex-col">
              <Button
                variant="secondary"
                size="md"
                type="button"
                disabled
                data-testid="person-consultation-stub"
                aria-describedby="consultation-stub-note"
                className="cursor-not-allowed opacity-60"
              >
                <CalendarClock aria-hidden="true" className="size-4" />
                Записаться на консультацию
              </Button>
            </span>
          ) : null}
        </div>
        {isTeacher ? (
          <p
            id="consultation-stub-note"
            className="mt-2 text-xs text-muted-foreground"
            data-testid="consultation-stub-note"
          >
            Запись на консультацию появится в ближайшем обновлении кабинета — пока напишите
            преподавателю письмо или приходите в часы консультаций.
          </p>
        ) : null}
      </header>

      {/* ── Контакты ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="person-contacts-title">
        <h2 id="person-contacts-title" className="text-lg font-extrabold tracking-heading">
          Контакты
        </h2>
        <div
          data-testid="person-contacts"
          className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft"
        >
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-muted text-muted-foreground"
              >
                <Mail className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Почта</span>
                <a
                  href={`mailto:${person.email}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {person.email}
                </a>
              </span>
            </li>
            {person.room ? (
              <li className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-muted text-muted-foreground"
                >
                  <DoorOpen className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Кабинет</span>
                  <span className="font-medium text-foreground">ауд. {person.room}</span>
                </span>
              </li>
            ) : null}
            {person.phone ? (
              <li className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-muted text-muted-foreground"
                >
                  <Phone className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Телефон</span>
                  <a
                    href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {person.phone}
                  </a>
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      {/* ── Часы консультаций ─────────────────────────────────────────────── */}
      {person.consultationHours ? (
        <section aria-labelledby="person-consultation-title">
          <h2 id="person-consultation-title" className="text-lg font-extrabold tracking-heading">
            Часы консультаций
          </h2>
          <div
            data-testid="person-consultation"
            className="mt-3 flex items-start gap-3 rounded-card border border-border bg-card p-5 shadow-soft"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
            >
              <Clock className="size-4" />
            </span>
            <p className="text-sm text-foreground">{person.consultationHours}</p>
          </div>
        </section>
      ) : null}

      {/* ── Дисциплины ────────────────────────────────────────────────────── */}
      {person.disciplines.length > 0 ? (
        <section aria-labelledby="person-disciplines-title">
          <h2 id="person-disciplines-title" className="text-lg font-extrabold tracking-heading">
            Дисциплины
          </h2>
          <ul data-testid="person-disciplines" className="mt-3 flex flex-wrap gap-2">
            {person.disciplines.map((discipline) => {
              const isMine = card.myDisciplines.some((mine) => mine.name === discipline.name);
              return (
                <li
                  key={discipline.name}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-sm"
                >
                  <GraduationCap aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{discipline.name}</span>
                  {isMine ? (
                    <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                      ваша
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ── Ближайшие пары: только студенту на карточке ПРЕПОДАВАТЕЛЯ.
          Контракт слоя данных: upcoming === null ⇔ секции нет (у сотрудника
          null даже при студенческом скоупе — ревью DIG-37 r5), поэтому
          предикат секции — по upcoming, не по hasPersonalScope. ──────────── */}
      {upcoming !== null ? (
        <section aria-labelledby="person-upcoming-title">
          <h2
            id="person-upcoming-title"
            data-testid="person-upcoming-title"
            className="text-lg font-extrabold tracking-heading"
          >
            Ближайшие пары
          </h2>
          {upcoming.length === 0 ? (
            <p
              data-testid="person-upcoming-empty"
              className="mt-3 rounded-card border border-dashed border-border bg-card p-5 text-sm text-muted-foreground shadow-soft"
            >
              Ближайших пар с этим преподавателем в расписании вашей группы нет.
            </p>
          ) : (
            <ul data-testid="person-upcoming" className="mt-3 flex flex-col gap-2">
              {upcoming.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/schedule?view=day&date=${event.dateKey}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:border-muted-foreground/40"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">
                        {event.disciplineName}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {event.kindLabel} · {event.roomLabel}
                      </span>
                    </span>
                    <span className="text-right font-mono text-xs text-neutral-600">
                      <span className="block">{event.dateLabel}</span>
                      <span className="block">{event.timeLabel}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Данные справочника вымышленные. Если контакты изменились, сообщите в деканат —{' '}
          <Link
            href="/deanery"
            className="inline-flex items-center gap-0.5 font-semibold text-coral-600 hover:text-coral-500"
          >
            через обращение
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
          .
        </span>
      </p>
    </section>
  );
}
