// DIG-50 — ShellUser для шапки кабинета из реальной сессии (стаб
// requireUser из src/server/auth.ts удалён, сессия читается по DIG-11).
//
// Правило fail-soft: если у вошедшего пользователя нет строки профиля в слое
// данных (например, аккаунт из БД, когда demo-набор ещё не подключён к
// PostgreSQL), шапка показывает личность сессии (login) — БЕЗ redirect и БЕЗ
// исключения. Именно redirect fail-closed (requireDataCtx) в layout выбрасывал
// бы БД-пользователя на /login и ломал (cabinet) на проде. Страницы данных
// продолжают защищаться requireDataCtx как раньше.
//
// DIG-65 — voiceAssistant: флаг «Озвучка и голосовой ввод» студента читается
// из строки настроек (напрямую через порт данных, без DataCtx — тот же
// fail-soft: нет строки настроек или легаси-строка → дефолт «включено»).
// Сотруднику кабинета голосовые функции не показываются (false).
import type { ShellUser } from '@/lib/user';
import type { AuthUser } from '@/server/auth/types';
import type { DataDb } from './port';

/** Session user → header identity of the cabinet shell (never redirects). */
export async function resolveShellUser(db: DataDb, user: AuthUser): Promise<ShellUser> {
  if (user.role === 'STUDENT') {
    const student = await db.findStudentByLogin(user.login);
    if (student) {
      // DIG-65: сырая строка настроек → флаг с fail-soft дефолтом (легаси-строки
      // без поля voiceAssistant или с мусором вместо boolean означают «включено»
      // — как defaultSettingsFor).
      const settings = await db.findSettingsByStudent(student.id);
      const stored = settings?.voiceAssistant;
      const voiceAssistant = typeof stored === 'boolean' ? stored : true;
      return {
        name: student.fullName,
        email: student.email,
        group: student.groupName,
        role: 'STUDENT',
        voiceAssistant,
      };
    }
    return { name: user.login, email: '—', group: '—', role: 'STUDENT', voiceAssistant: true };
  }
  const staff = await db.findStaffByLogin(user.login);
  if (staff) {
    return {
      name: staff.fullName,
      email: staff.email,
      group: staff.position,
      role: 'STAFF',
      voiceAssistant: false,
    };
  }
  // Fallback: the session identity itself. Non-empty placeholders keep the
  // user menu layout intact until the profile row exists for this login.
  return { name: user.login, email: '—', group: '—', role: user.role, voiceAssistant: false };
}
