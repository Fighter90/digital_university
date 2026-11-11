'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

type SearchPaletteProps = {
  open: boolean;
  onClose: () => void;
  /** Кнопка поиска в TopBar — при закрытии диалога фокус возвращается на неё. */
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
};

// DIG-14: заглушка ⌘K-поиска. Полный экран «Поиск ⌘K» подключается
// отдельной задачей; здесь — доступный каркас диалога: Escape закрывает,
// Tab не выходит за пределы, фокус в поле ввода, а при закрытии фокус
// возвращается на кнопку поиска (ревью DIG-14, раунд 1).
export function SearchPalette({ open, onClose, returnFocusRef }: SearchPaletteProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Был ли диалог открыт раньше — чтобы не красть фокус при первом рендере.
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Управление фокусом: при открытии — в поле ввода, при закрытии — на
  // кнопку поиска, чтобы фокус не падал в <body>.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      inputRef.current?.focus();
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  if (!open) return null;

  // Простой фокус-ловушка: Tab/Shift+Tab циклично ходят по двум контролам.
  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('input, button');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      data-testid="search-overlay"
      className="fixed inset-0 z-50 bg-neutral-950/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по кабинету"
        onKeyDown={trapFocus}
        onClick={(event) => event.stopPropagation()}
        className="mx-auto mt-[12vh] w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4">
          <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Поиск"
            placeholder="Найти пару, преподавателя, справку…"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            Закрыть
          </button>
        </div>
        <p className="px-4 py-3 text-sm text-neutral-500">
          Здесь появятся пары, преподаватели и справки. Все данные вымышленные.
        </p>
      </div>
    </div>
  );
}
