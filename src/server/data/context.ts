// DIG-12 — DataCtx resolution.
//
// `toDataCtx` is pure (db injectable, unit-tested): it maps the session user
// of DIG-11 (`requireUser()` → AuthUser) to the scoping context of the data
// layer. `requireDataCtx` is the thin server wrapper every protected page,
// route and action uses INSTEAD of requireUser() when it touches data:
// anonymous → /login (DIG-11 behaviour), a session user without a profile
// row → /login too (fail closed: no scope, no data).

import { redirect } from 'next/navigation';
import { getAuthSession } from '@/server/auth/session';
import type { AuthUser } from '@/server/auth/types';
import { dataDb } from './db';
import { ensureAppData } from './bootstrap';
import type { DataDb } from './port';
import type { DataCtx } from './types';

/**
 * Session user → scoping context. Returns null (fail closed) when the login
 * has no matching profile row: a STUDENT must own a Student row, a STAFF
 * member must own a Staff row with a faculty.
 */
export async function toDataCtx(user: AuthUser, db: DataDb): Promise<DataCtx | null> {
  if (user.role === 'STUDENT') {
    const student = await db.findStudentByLogin(user.login);
    if (!student) return null;
    return {
      userId: user.id,
      login: user.login,
      role: 'STUDENT',
      studentId: student.id,
      groupName: student.groupName,
      faculty: student.faculty,
    };
  }
  const staff = await db.findStaffByLogin(user.login);
  if (!staff) return null;
  return {
    userId: user.id,
    login: user.login,
    role: 'STAFF',
    studentId: null,
    groupName: null,
    faculty: staff.faculty,
  };
}

/**
 * Guard for data-touching server components, routes and actions:
 * session + DataCtx or a redirect to /login. `nextPath` preserves the
 * destination across the login round-trip (DIG-11 `?next=` contract).
 */
export async function requireDataCtx(nextPath?: string): Promise<DataCtx> {
  const auth = await getAuthSession();
  if (!auth) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login');
  }
  await ensureAppData();
  const ctx = await toDataCtx(auth.user, dataDb);
  if (!ctx) redirect('/login');
  return ctx;
}
