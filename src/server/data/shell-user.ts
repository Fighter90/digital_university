// DIG-50 — ShellUser для шапки кабинета из реальной сессии (стаб
// requireUser из src/server/auth.ts удалён, сессия читается по DIG-11).
//
// Правило fail-soft: если у вошедшего пользователя нет строки профиля в слое
// данных (например, аккаунт из БД, когда demo-набор ещё не подключён к
// PostgreSQL), шапка показывает личность сессии (login) — БЕЗ redirect и БЕЗ
// исключения. Именно redirect fail-closed (requireDataCtx) в layout выбрасывал
// бы БД-пользователя на /login и ломал (cabinet) на проде. Страницы данных
// продолжают защищаться requireDataCtx как раньше.
import type { ShellUser } from '@/lib/user';
import type { AuthUser } from '@/server/auth/types';
import type { DataDb } from './port';

/** Session user → header identity of the cabinet shell (never redirects). */
export async function resolveShellUser(db: DataDb, user: AuthUser): Promise<ShellUser> {
  if (user.role === 'STUDENT') {
    const student = await db.findStudentByLogin(user.login);
    if (student) {
      return {
        name: student.fullName,
        email: student.email,
        group: student.groupName,
        role: 'STUDENT',
      };
    }
  } else {
    const staff = await db.findStaffByLogin(user.login);
    if (staff) {
      return { name: staff.fullName, email: staff.email, group: staff.position, role: 'STAFF' };
    }
  }
  // Fallback: the session identity itself. Non-empty placeholders keep the
  // user menu layout intact until the profile row exists for this login.
  return { name: user.login, email: '—', group: '—', role: user.role };
}
