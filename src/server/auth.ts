import type { ShellUser } from '@/lib/user';

// DIG-14: серверная сессия кабинета. До DIG-18 (NextAuth) — детерминированный
// стаб с вымышленным студентом, чтобы каркас и e2e работали без БД.
// ВАЖНО: каждая (cabinet)-страница и API-роут обязаны проходить через
// requireUser() и фильтровать данные по session.user.id (запрет IDOR).
export type CabinetUser = ShellUser & { id: string };

export async function requireUser(): Promise<CabinetUser> {
  // TODO(DIG-18): заменить на реальную проверку сессии:
  // const session = await auth(); if (!session?.user) redirect('/login');
  return {
    id: 'student-demo-1',
    name: 'Анна Студентова',
    email: 'anna.studentova@example.edu',
    group: 'ПИ-21',
  };
}
