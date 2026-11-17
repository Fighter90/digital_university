// DIG-32 — горизонтальный степпер заявки «Подана → Принята → В работе →
// Готова → Выдана». Полный вид с подписями шагов — от 640 px; на 360 px —
// компактный: точки шагов и подпись только текущего шага
// («Шаг 2 из 5 · Принята»), как требует приёмка задачи.
// Заявки вне конвейера (REJECTED / CANCELLED) степпер не показывают.
'use client';

import {
  REQUEST_PIPELINE_STEPS,
  requestPipelineStep,
  requestStepperStates,
  pipelineStepLabel,
  type RequestStepperStepState,
} from '@/lib/requests-view';
import { t, type Locale } from '@/lib/i18n';
import type { CanonicalRequestStatus } from '@/lib/request-machine';
import { Stepper } from '@/components/ui/stepper';

const DOT_STYLES: Record<RequestStepperStepState, string> = {
  done: 'bg-success',
  ready: 'bg-success',
  current: 'bg-accent ring-2 ring-accent/30 ring-offset-1',
  pending: 'bg-border',
};

export function RequestStepper({
  status,
  locale = 'ru',
}: {
  status: CanonicalRequestStatus;
  /** DIG-69 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const step = requestPipelineStep(status);
  if (step === null) return null;
  const states = requestStepperStates(status);
  // DIG-69: подписи шагов по локали (RU — прежние метки канона байт-в-байт).
  const stepLabel = (index: number): string =>
    pipelineStepLabel(locale, REQUEST_PIPELINE_STEPS[index]?.status ?? status);
  const currentLabel = stepLabel(step - 1);

  return (
    <>
      {/* Полный степпер с подписями — от 640 px. */}
      <div className="hidden sm:block" data-testid="request-stepper">
        <Stepper
          steps={REQUEST_PIPELINE_STEPS.map((s, index) => ({ label: stepLabel(index) }))}
          states={states}
        />
      </div>
      {/* Компактный степпер на 360 px: точки + подпись текущего шага. */}
      <div
        className="flex items-center gap-2.5 sm:hidden"
        data-testid="request-stepper-compact"
        aria-label={t(locale, 'stepper.stepOfLabel', {
          step,
          total: REQUEST_PIPELINE_STEPS.length,
          label: currentLabel,
        })}
      >
        <span aria-hidden="true" className="flex items-center gap-1.5">
          {states.map((state, index) => (
            <span
              key={REQUEST_PIPELINE_STEPS[index]?.status ?? index}
              className={`size-2 rounded-full ${DOT_STYLES[state]}`}
            />
          ))}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {t(locale, 'stepper.stepOf', { step, total: REQUEST_PIPELINE_STEPS.length })}
          {currentLabel ? ` · ${currentLabel}` : ''}
        </span>
      </div>
    </>
  );
}
