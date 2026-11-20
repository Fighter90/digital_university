// DIG-106 — регресс лендинга: переключатель «Русский/English» в шапке
// ПУБЛИЧНОГО лендинга обязан работать у анонимного посетителя.
//
// Лендинг открывается без авторизации (спека landing-screen), LocaleSwitch
// стоит прямо в его шапке (DIG-90). Server action setLocale исторически был
// owner-scoped (DIG-69 — кабинет), из-за чего анонимный посетитель, нажав
// «English», выпадал на /login?next=/settings вместо смены языка.
//
// Контракт после фикса: локаль — предпочтение интерфейса самого посетителя
// (cookie du-locale, whitelist ru/en, httpOnly) — action пишет её БЕЗ сессии;
// данные он не читает и не пишет, IDOR невозможен.
import { describe, expect, it, vi } from 'vitest';

// redirect из next/navigation бросается при срабатывании guard'а — так же,
// как в реальном рантайме (NEXT_REDIRECT). Ловим его в тесте как «уведён на
// /login».
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
// redirect('/login?next=…'). Мок имитирует это, чтобы тест падал, пока
// setLocale вызывает guard.
vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async (nextPath?: string) => {
    // в тесте сессии нет — guard всегда уводит на вход
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

describe('DIG-106: анонимный переключатель языка на лендинге', () => {
  it('аноним нажимает «English» → cookie du-locale=en записана, редиректа на /login нет', async () => {
    reset();
    const { setLocale } = await import('@/server/actions/locale');
    const fd = new FormData();
    fd.set('locale', 'en');
    await setLocale(fd);

    expect(state.redirectedTo).toBeNull(); // НЕ уводим анонима на /login
    expect(state.jar.get('du-locale')).toBe('en');
    expect(state.revalidated).toContain('/');
  });

  it('аноним возвращает «Русский» → cookie du-locale=ru', async () => {
    reset();
    const { setLocale } = await import('@/server/actions/locale');
    const fd = new FormData();
    fd.set('locale', 'ru');
    await setLocale(fd);

    expect(state.redirectedTo).toBeNull();
    expect(state.jar.get('du-locale')).toBe('ru');
  });

  it('битое значение locale по-прежнему отбрасывается без записи', async () => {
    reset();
    const { setLocale } = await import('@/server/actions/locale');
    const fd = new FormData();
    fd.set('locale', 'de');
    await setLocale(fd);

    expect(state.jar.has('du-locale')).toBe(false);
    expect(state.sets).toHaveLength(0);
  });
});
