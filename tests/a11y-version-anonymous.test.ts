// DIG-128 — регресс: ссылка «Версия для слабовидящих» в футере ПУБЛИЧНОГО
// лендинга обязана работать у анонимного посетителя.
//
// История повторяет DIG-106 (переключатель языка): toggleA11yVersion был
// owner-scoped (DIG-100), из-за чего аноним, нажав «Версия для слабовидящих»,
// выпадал на /login?next=/ и НЕ получал доступную версию — слабовидящий
// посетитель не мог включить её до входа (вход сам требует доступного UI).
//
// Контракт после фикса: версия интерфейса — предпочтение самого посетителя
// (cookie du-a11y-version, whitelist plain/off, httpOnly) — action пишет её
// БЕЗ сессии; данные он не читает и не пишет, IDOR невозможен.
// setA11y (DIG-86, вкладка «Настройки → Доступность») остаётся owner-scoped:
// там сессия всегда есть, а действие лежит внутри кабинета.
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  sets: [] as Array<{ name: string; value: string }>,
  revalidated: [] as Array<string>,
  redirectedTo: null as string | null,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      state.jar.set(name, value);
      state.sets.push({ name, value });
    },
    delete: (name: string) => state.jar.delete(name),
  })),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn((p: string) => state.revalidated.push(p)),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    state.redirectedTo = to;
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));
// requireDataCtx реального модуля ведёт себя как настоящий guard: аноним →
// redirect('/login?next=…'). Тест падает, пока toggleA11yVersion вызывает guard.
vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async (nextPath?: string) => {
    const to = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
    state.redirectedTo = to;
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

function reset() {
  state.jar.clear();
  state.sets.length = 0;
  state.revalidated.length = 0;
  state.redirectedTo = null;
}

describe('DIG-128: анонимная ссылка «Версия для слабовидящих» на лендинге', () => {
  it('аноним включает версию → cookie du-a11y-version=plain записана, редиректа на /login нет', async () => {
    reset();
    const { toggleA11yVersion } = await import('@/server/actions/a11y');
    const fd = new FormData();
    fd.set('version', 'plain');
    fd.set('next', '/');
    await toggleA11yVersion(fd);

    expect(state.redirectedTo).toBeNull(); // НЕ уводим анонима на /login
    expect(state.jar.get('du-a11y-version')).toBe('plain');
    expect(state.revalidated).toContain('/');
  });

  it('аноним возвращает обычную версию → cookie du-a11y-version=off', async () => {
    reset();
    const { toggleA11yVersion } = await import('@/server/actions/a11y');
    const fd = new FormData();
    fd.set('version', 'off');
    await toggleA11yVersion(fd);

    expect(state.redirectedTo).toBeNull();
    expect(state.jar.get('du-a11y-version')).toBe('off');
  });

  it('битое значение version отбрасывается без записи', async () => {
    reset();
    const { toggleA11yVersion } = await import('@/server/actions/a11y');
    const fd = new FormData();
    fd.set('version', 'hack');
    await toggleA11yVersion(fd);

    expect(state.jar.has('du-a11y-version')).toBe(false);
    expect(state.sets).toHaveLength(0);
  });

  it('open redirect невозможен: next вне «/…» игнорируется', async () => {
    reset();
    const { toggleA11yVersion } = await import('@/server/actions/a11y');
    const fd = new FormData();
    fd.set('version', 'plain');
    fd.set('next', 'https://evil.example');
    await toggleA11yVersion(fd);

    // версия всё равно включается, но поле next никуда не уводит
    expect(state.redirectedTo).toBeNull();
    expect(state.jar.get('du-a11y-version')).toBe('plain');
  });
});
