// DIG-43 — кнопка записи на мероприятие: обычная форма с server action,
// работает и без JS (как кнопка голоса в «МСП»). Запись → «Вы записаны ✓»
// (повторный клик отменяет); при 0 свободных мест — disabled «Мест нет»
// (записанный студент может отменить запись всегда); сотруднику —
// пояснение вместо формы (мутации студентов).
import { toggleEventRegistrationAction } from '@/server/actions/events';
import { cn } from 'cn';

export function EventRegisterButton({
  eventId,
  spotsLeft,
  registeredByMe,
  canRegister = true,
  testId,
}: {
  eventId: string;
  /** Свободные места: 0 — «Мест нет» (кроме отмены собственной записи). */
  spotsLeft: number;
  registeredByMe: boolean;
  /** false — сотрудник: афишу читает, не записывается. */
  canRegister?: boolean;
  testId?: string;
}) {
  if (!canRegister) {
    return (
      <span
        data-testid={testId}
        title="Запись доступна студентам"
        className="select-none rounded-button border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground"
      >
        Запись — студентам
      </span>
    );
  }
  // При нуле мест кнопка disabled, но записанный студент сохраняет
  // возможность отменить свою запись (место вернётся в афишу).
  const disabled = spotsLeft === 0 && !registeredByMe;
  return (
    <form action={toggleEventRegistrationAction} data-testid={testId}>
      <input type="hidden" name="eventId" value={eventId} />
      <button
        type="submit"
        disabled={disabled}
        aria-pressed={registeredByMe}
        title={
          disabled
            ? 'Свободных мест не осталось'
            : registeredByMe
              ? 'Отменить запись'
              : 'Записаться на мероприятие'
        }
        className={cn(
          'rounded-button px-3 py-1.5 text-sm font-medium shadow-soft transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 disabled:cursor-not-allowed',
          registeredByMe
            ? 'border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : disabled
              ? 'border border-border bg-muted text-muted-foreground'
              : 'bg-foreground text-background hover:bg-muted-foreground/80',
        )}
      >
        {registeredByMe ? 'Вы записаны ✓' : disabled ? 'Мест нет' : 'Записаться'}
      </button>
    </form>
  );
}
