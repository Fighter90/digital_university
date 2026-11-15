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
  type RequestStepperStepState,
} from '@/lib/requests-view';
import type { CanonicalRequestStatus } from '@/lib/request-machine';
import { Stepper } from '@/components/ui/stepper';

const DOT_STYLES: Record<RequestStepperStepState, string> = {
  done: 'bg-success',
  ready: 'bg-success',
  current: 'bg-accent ring-2 ring-accent/30 ring-offset-1',
  pending: 'bg-border',
};

export function RequestStepper({ status }: { status: CanonicalRequestStatus }) {
  const step = requestPipelineStep(status);
  if (step === null) return null;
  const states = requestStepperStates(status);
  const currentLabel = REQUEST_PIPELINE_STEPS[step - 1]?.label ?? '';

  return (
    <>
      {/* Полный степпер с подписями — от 640 px. */}
      <div className="hidden sm:block" data-testid="request-stepper">
        <Stepper steps={REQUEST_PIPELINE_STEPS.map((s) => ({ label: s.label }))} states={states} />
      </div>
      {/* Компактный степпер на 360 px: точки + подпись текущего шага. */}
      <div
        className="flex items-center gap-2.5 sm:hidden"
        data-testid="request-stepper-compact"
        aria-label={`Шаг ${step} из ${REQUEST_PIPELINE_STEPS.length}: ${currentLabel}`}
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
          Шаг {step} из {REQUEST_PIPELINE_STEPS.length}
          {currentLabel ? ` · ${currentLabel}` : ''}
        </span>
      </div>
    </>
  );
}
