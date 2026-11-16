// DIG-50 — ShellUser для шапки кабинета строится из реальной сессии.
//
// Правила:
//  - студент/сотрудник, известный слою данных, → его профиль (имя, email,
//    группа/должность);
//  - пользователь без строки профиля (например, аккаунт из БД, когда demo-набор
//    данных ещё не подключён к PostgreSQL) → личность сессии (login) — БЕЗ
//    redirect и БЕЗ исключения: шапка не должна «выбрасывать» вошедшего
//    пользователя на /login (это сломало бы (cabinet) на проде, DIG-50).
import { describe, expect, it } from 'vitest';
import { resolveShellUser } from '@/server/data/shell-user';
import type { DataDb } from '@/server/data/port';
import type { AuthUser } from '@/server/auth/types';

const studentDb = {
  findStudentByLogin: async (login: string) =>
    login === 'anna.smirnova'
      ? {
          id: 'st-1',
          login,
          fullName: 'Анна Смирнова',
          email: 'anna.smirnova@example.edu',
          groupName: 'ИВТ-21',
          course: 2,
          faculty: 'ФКН',
          program: 'ИВТ',
          programCode: '09.03.04',
          studyForm: 'очная',
          funding: 'бюджет',
          gradebookNumber: '2026-ИВТ-0142',
        }
      : null,
  findStaffByLogin: async (login: string) =>
    login === 'dean.kovaleva'
      ? {
          id: 'stf-1',
          login,
          fullName: 'Мария Ковалёва',
          position: 'менеджер курса',
          email: 'm.kovaleva@example.edu',
          faculty: 'ФКН',
        }
      : null,
  // DIG-65: настройки по умолчанию нет — fail-soft дефолт «включено».
  findSettingsByStudent: async () => null,
} as unknown as DataDb;

const emptyDb = {
  findStudentByLogin: async () => null,
  findStaffByLogin: async () => null,
} as unknown as DataDb;

const student: AuthUser = { id: 'u1', login: 'anna.smirnova', role: 'STUDENT' };
const staff: AuthUser = { id: 'u2', login: 'dean.kovaleva', role: 'STAFF' };
const stranger: AuthUser = { id: 'u3', login: 'new.user', role: 'STUDENT' };

describe('resolveShellUser (fail-soft, DIG-50)', () => {
  it('student with a profile row → real profile in the shell header', async () => {
    expect(await resolveShellUser(studentDb, student)).toEqual({
      name: 'Анна Смирнова',
      email: 'anna.smirnova@example.edu',
      group: 'ИВТ-21',
      role: 'STUDENT',
      voiceAssistant: true,
    });
  });

  it('staff with a profile row → name, email and position', async () => {
    expect(await resolveShellUser(studentDb, staff)).toEqual({
      name: 'Мария Ковалёва',
      email: 'm.kovaleva@example.edu',
      group: 'менеджер курса',
      role: 'STAFF',
      voiceAssistant: false,
    });
  });

  it('user without a profile row → session identity, never a redirect/throw', async () => {
    const shell = await resolveShellUser(emptyDb, stranger);
    expect(shell.name).toBe('new.user');
    expect(shell.email.length).toBeGreaterThan(0);
    expect(shell.group.length).toBeGreaterThan(0);
  });

  it('STUDENT role prefers the student row even if a staff row shares the login', async () => {
    const mixed = {
      findStudentByLogin: async () => null,
      findStaffByLogin: async () => ({
        id: 'stf-x',
        login: 'new.user',
        fullName: 'X',
        position: 'P',
        email: 'x@example.edu',
        faculty: 'F',
      }),
    } as unknown as DataDb;
    const shell = await resolveShellUser(mixed, stranger);
    expect(shell.name).toBe('new.user'); // студент без профиля не получает чужую должность
  });

  // DIG-65 — voiceAssistant: флаг «Озвучка и голосовой ввод» из строки
  // настроек студента; fail-soft дефолты для легаси/мусора и staff.
  describe('voiceAssistant (DIG-65)', () => {
    it('выключенная студентом настройка → false', async () => {
      const db = {
        ...studentDb,
        findSettingsByStudent: async () => ({ studentId: 'st-1', voiceAssistant: false }),
      } as unknown as DataDb;
      expect((await resolveShellUser(db, student)).voiceAssistant).toBe(false);
    });

    it('легаси-строка настроек без поля (или мусор вместо boolean) → true', async () => {
      const legacy = {
        ...studentDb,
        findSettingsByStudent: async () => ({ studentId: 'st-1' }),
      } as unknown as DataDb;
      const garbage = {
        ...studentDb,
        findSettingsByStudent: async () => ({ studentId: 'st-1', voiceAssistant: 'yes' }),
      } as unknown as DataDb;
      expect((await resolveShellUser(legacy, student)).voiceAssistant).toBe(true);
      expect((await resolveShellUser(garbage, student)).voiceAssistant).toBe(true);
    });

    it('студент без строки профиля (fail-soft fallback) → true', async () => {
      expect((await resolveShellUser(emptyDb, stranger)).voiceAssistant).toBe(true);
    });
  });
});
