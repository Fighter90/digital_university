import Link from 'next/link';
import { cn } from 'cn';
import { SETTINGS_TABS, type SettingsTabId } from '@/lib/settings-tabs';

// DIG-44 — вкладки «Настройки» как обычные ссылки (?tab=…): работают без JS,
// активная вкладка помечена aria-current="page".
export function SettingsTabs({ active }: { active: SettingsTabId }) {
  return (
    <nav aria-label="Разделы настроек" className="flex flex-wrap gap-2" data-testid="settings-tabs">
      {SETTINGS_TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={`/settings?tab=${tab.id}`}
            // prefetch={false}: вкладки живут на странице, которую мутируют
            // server actions (revalidatePath). Предзагруженный (устаревший)
            // RSC-payload, применённый во время экшена, откатывает UI к
            // значениям до сохранения — классическая гонка prefetch/mutation.
            prefetch={false}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'rounded-pill border px-4 py-1.5 text-sm font-semibold transition-colors',
              selected
                ? 'border-transparent bg-foreground text-background'
                : 'border-border bg-card text-neutral-700 hover:border-coral-200 hover:bg-coral-50',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
