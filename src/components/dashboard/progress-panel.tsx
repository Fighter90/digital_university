import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { ProgressRing } from '@/components/ui/progress-ring';
import { debtLabel, formatAverage, formatDelta } from '@/lib/dashboard-format';
import type { DashboardSection, ProgressView } from '@/server/data/dashboard';

// DIG-20: «Как у меня дела» — кольцо среднего балла, бейдж риска по долгам
// (пересдачам) и мини-полоски по дисциплинам, цвет по уровню:
// ≥85 — success, 70–84 — warning, ниже — error.

const LEVEL_FILL: Record<ProgressView['disciplines'][number]['level'], string> = {
  good: 'bg-success',
  medium: 'bg-warning',
  risk: 'bg-error',
};

export interface ProgressPanelProps {
  section: DashboardSection<ProgressView>;
}

export function ProgressPanel({ section }: ProgressPanelProps) {
  if (!section.ok) {
    return <ErrorState title="Блок «Успеваемость» не загрузился" description="Обновите страницу — остальные блоки на месте." />;
  }
  const { average, averageDelta, credits, creditsTotal, debts, disciplines } = section.value;

  return (
    <section aria-labelledby="dashboard-progress-heading" className="flex flex-col gap-3">
      <h2 id="dashboard-progress-heading" className="text-lg font-extrabold tracking-heading sm:text-xl">
        Как у меня дела
      </h2>

      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-0">
          <ProgressRing value={average ?? 0} label="Средний балл" size={88} stroke={8}>
            {formatAverage(average)}
          </ProgressRing>
          <div className="min-w-0">
            <CardTitle>Средний балл</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {average === null
                ? 'Оценок пока нет'
                : averageDelta === null
                  ? 'прохождение дисциплин в процентах'
                  : `${formatDelta(averageDelta)} к последним работам`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Кредиты: {credits} из {creditsTotal}
            </p>
          </div>
        </CardHeader>

        <CardContent className="mt-4 flex flex-col gap-4">
          {debts.length > 0 ? (
            <Badge status="warning" variant="soft" className="w-fit">
              {debts.length === 1
                ? `${debtLabel(debts.length)} — пересдача ${debts[0]?.dateLabel}`
                : `${debtLabel(debts.length)} — ближайшая пересдача ${debts[0]?.dateLabel}`}
            </Badge>
          ) : (
            <Badge status="success" variant="soft" className="w-fit">
              Долгов нет
            </Badge>
          )}

          {disciplines.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {disciplines.map((discipline) => (
                <li key={discipline.code} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{discipline.disciplineName}</span>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {formatAverage(discipline.average)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-muted">
                    <div
                      data-level={discipline.level}
                      className={`h-full rounded-pill ${LEVEL_FILL[discipline.level]}`}
                      style={{ width: `${Math.min(100, Math.max(0, discipline.average))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Полоски по дисциплинам появятся после первых оценок.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
