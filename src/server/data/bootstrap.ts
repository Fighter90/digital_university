// DIG-12 — one-time app data bootstrap.
//
// `ensureAppData()` fills the in-memory store with the fictional demo dataset
// on the first data-touching request (requireDataCtx). Memoized for the
// process lifetime; a failure resets the memo so the next request retries.

import { authStore } from '@/server/auth/store';
import { dataDb } from './db';
import { seedDemoData } from './demo-seed';

// Same globalThis rationale as the store singletons (dev bundles differ).
const globals = globalThis as unknown as { __appDataBootstrap?: Promise<void> };

export function ensureAppData(): Promise<void> {
  globals.__appDataBootstrap ??= seedDemoData(dataDb, authStore).catch((error: unknown) => {
    globals.__appDataBootstrap = undefined;
    throw error;
  });
  return globals.__appDataBootstrap;
}
