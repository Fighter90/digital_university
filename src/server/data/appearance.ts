// DIG-44 — appearance prefs applied to the whole cabinet.
//
// The root layout reads these ONCE per request and puts classes on <html>
// (dark / font-lg / font-xl / reduce-motion) — server-side, before first
// paint, for every page including /login (anonymous visitors get defaults).
// The data layer is the same IDOR-safe, session-scoped surface as everywhere:
// there is no way to read another student's prefs through this module.

import { getAuthSession } from '@/server/auth/session';
import { dataDb } from './db';
import { ensureAppData } from './bootstrap';
import { toDataCtx } from './context';
import { getOwnSettings } from './profile';
import type { FontSizePreference, ThemePreference } from './types';

export interface AppliedAppearance {
  theme: ThemePreference;
  fontSize: FontSizePreference;
  reduceMotion: boolean;
}

export const DEFAULT_APPEARANCE: AppliedAppearance = {
  theme: 'SYSTEM',
  fontSize: 'NORMAL',
  reduceMotion: false,
};

/**
 * Appearance of the CURRENT session owner (or the defaults for anonymous
 * visitors and staff). Any failure resolves to the defaults — the cabinet
 * must render even if the settings row is temporarily unreachable.
 */
export async function getAppliedAppearance(): Promise<AppliedAppearance> {
  try {
    const auth = await getAuthSession();
    if (!auth) return DEFAULT_APPEARANCE;
    await ensureAppData();
    const ctx = await toDataCtx(auth.user, dataDb);
    if (!ctx || ctx.role !== 'STUDENT') return DEFAULT_APPEARANCE;
    const settings = await getOwnSettings(dataDb, ctx);
    if (!settings) return DEFAULT_APPEARANCE;
    return {
      theme: settings.theme,
      fontSize: settings.fontSize,
      reduceMotion: settings.reduceMotion,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Class list for <html> from the applied appearance (LIGHT adds nothing). */
export function appearanceClasses(appearance: AppliedAppearance): string[] {
  const classes: string[] = [];
  if (appearance.theme === 'DARK') classes.push('dark');
  if (appearance.fontSize === 'LARGE') classes.push('font-lg');
  if (appearance.fontSize === 'XLARGE') classes.push('font-xl');
  if (appearance.reduceMotion) classes.push('reduce-motion');
  return classes;
}

/**
 * Inline script for the SYSTEM theme: toggles the `dark` class from
 * `prefers-color-scheme` before first paint (no flash). Kept tiny and
 * dependency-free; runs only when the saved preference is SYSTEM.
 */
export const SYSTEM_THEME_SCRIPT =
  'try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)' +
  '{document.documentElement.classList.add("dark")}}catch(e){}';
