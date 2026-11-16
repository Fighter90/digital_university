'use client';

import { useRouter } from 'next/navigation';

/**
 * DIG-35 — SSR-безопасный доступ к app-роутеру.
 *
 * В настоящем Next-рантайме контекст роутера всегда предоставлен каркасом;
 * при «сыром» рендере страницы вне каркаса (юнит-пререндер cabinet-shell:
 * структура landmark'ов, навигация не тестируется) контекста нет и
 * useRouter бросает invariant. Для разметки переходы не нужны — возвращаем
 * null, а вызывающий код просто пропускает переход.
 */
export function useSafeRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}
