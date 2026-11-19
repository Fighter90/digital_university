// DIG-101 — блок «Экспорт» на /schedule (виды «День» и «Неделя»; в «Месяце»
// не показывается). Три ссылки-кнопки: Markdown / Excel / PDF — файлы
// собирают роуты /api/export/schedule.<ext> по живой сессии (owner-scope
// на слое данных). Ссылки несут текущий вид и выбранную дату — что видно
// на экране, то и выгружается. Компонент серверный: интерактива нет,
// скачивание — обычные ссылки с download (работают без JS).
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';

import { t, type Locale } from '@/lib/i18n';

export interface ScheduleExportBlockProps {
  /** Вид экспорта: всегда day|week (блок не рендерится в виде «Месяц»). */
  view: 'day' | 'week';
  /** Ключ выбранного дня «2026-11-19» (неделя считается роутом от даты). */
  dateKey: string;
  locale: Locale;
}

const FORMATS = [
  {
    testId: 'schedule-export-md',
    ext: 'md' as const,
    icon: FileText,
    labelKey: 'schedule.export.mdBtn' as const,
    shortLabel: 'MD',
  },
  {
    testId: 'schedule-export-xlsx',
    ext: 'xlsx' as const,
    icon: FileSpreadsheet,
    labelKey: 'schedule.export.xlsxBtn' as const,
    shortLabel: 'XLSX',
  },
  {
    testId: 'schedule-export-pdf',
    ext: 'pdf' as const,
    icon: FileDown,
    labelKey: 'schedule.export.pdfBtn' as const,
    shortLabel: 'PDF',
  },
];

export function ScheduleExportBlock({ view, dateKey, locale }: ScheduleExportBlockProps) {
  const query = `view=${view}&date=${dateKey}`;
  return (
    <section
      data-testid="schedule-export"
      aria-label={t(locale, 'schedule.export.aria')}
      className="rounded-card border border-border bg-card p-4 shadow-soft"
    >
      <h2 className="text-base font-extrabold tracking-heading">
        {t(locale, 'schedule.export.title')}
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {FORMATS.map(({ testId, ext, icon: Icon, labelKey, shortLabel }) => (
          <a
            key={ext}
            href={`/api/export/schedule.${ext}?${query}`}
            download
            aria-label={t(locale, labelKey)}
            title={t(locale, labelKey)}
            data-testid={testId}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            <Icon aria-hidden="true" className="size-4 text-coral-600" />
            {shortLabel}
          </a>
        ))}
      </div>
    </section>
  );
}
