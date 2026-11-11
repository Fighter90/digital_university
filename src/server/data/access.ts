// DIG-12 — audit writer for denied access attempts.
//
// «Аудит: попытки доступа к чужим объектам пишутся в AuditLog» (DIG-12).
// `denyAccess` is the ONLY place that produces DENIED audit rows; entity
// modules call it before returning their uniform null. It never throws:
// a broken audit store must not turn a controlled 404 into a 500.

import type { DataDb } from './port';
import type { DataCtx, DenialReason } from './types';

export interface DenyInput {
  /** null for attempts without a resolvable context (anonymous probes). */
  ctx: DataCtx | null;
  /** What was probed: 'request' | 'appeal' | 'notification' | 'student' | … */
  resourceType: string;
  /** The URL-level reference used (public number / cuid). */
  resourceRef: string;
  reason: DenialReason;
  now?: Date;
}

export async function denyAccess(db: DataDb, input: DenyInput): Promise<void> {
  try {
    await db.appendAudit({
      actorUserId: input.ctx?.userId ?? null,
      actorLogin: input.ctx?.login ?? null,
      actorRole: input.ctx?.role ?? null,
      resourceType: input.resourceType,
      resourceRef: input.resourceRef,
      reason: input.reason,
      outcome: 'DENIED',
      createdAt: input.now,
    });
  } catch {
    // Audit failure must not change the HTTP answer (still a uniform 404).
  }
}
