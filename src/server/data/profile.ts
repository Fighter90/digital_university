// DIG-19 — profile & settings of the session owner.
//
// Every function takes a `DataCtx` built from the live session (never from
// URL/input), which is what keeps IDOR impossible: a STUDENT is scoped by
// ctx.studentId, a STAFF member has no studentId and is rejected with an
// audited ROLE_MISMATCH — same contract as requests.ts / appeals.ts.
//
// Product rules pinned here:
//  - profile fields (ФИО, факультет, направление, курс, группа, форма
//    обучения, номер зачётки) are READ-ONLY — only the deanery edits them;
//  - contacts (email/phone) and their visibility for teachers are editable;
//  - Telegram channel can never be enabled («скоро»);
//  - notification GENERATION respects the per-type channel matrix (the
//    in-app feed is the PUSH channel of this prototype).

import { NOTIFICATION_SETTING_TYPES } from '@/lib/notification-labels';
import { denyAccess } from './access';
import type { DataDb } from './port';
import type {
  AppealRow,
  DataCtx,
  NotificationChannel,
  NotificationRow,
  NotificationType,
  StudentRow,
  StudentSettingsRow,
  ThemePreference,
} from './types';

const RESOURCE = 'profile';

/** Pre-filled subject of the «Нашли ошибку в данных?» appeal (one entry point). */
export const DATA_ERROR_APPEAL_SUBJECT = 'Ошибка в данных профиля';

export { NOTIFICATION_SETTING_TYPES };

const ALL_TYPES: NotificationType[] = [...NOTIFICATION_SETTING_TYPES, 'SYSTEM'];

/**
 * Pure factory of default settings: every channel on except Telegram, theme
 * follows the system, contacts visible to the deanery staff. Fresh objects
 * on every call (no shared references between rows).
 */
export function defaultSettingsFor(studentId: string, now: Date = new Date()): StudentSettingsRow {
  const notificationChannels = Object.fromEntries(
    ALL_TYPES.map((type) => [
      type,
      { PUSH: true, EMAIL: true, TELEGRAM: false },
    ]),
  ) as StudentSettingsRow['notificationChannels'];
  return {
    studentId,
    phone: null,
    emailVisibleToStaff: true,
    phoneVisibleToStaff: true,
    notificationChannels,
    theme: 'SYSTEM',
    updatedAt: now,
  };
}

/** Settings of the ctx owner or defaults; null (+ audit) for a staff ctx. */
async function resolveSettings(db: DataDb, ctx: DataCtx): Promise<StudentSettingsRow | null> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'settings',
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  return (await db.findSettingsByStudent(ctx.studentId)) ?? defaultSettingsFor(ctx.studentId);
}

export async function getOwnProfile(db: DataDb, ctx: DataCtx): Promise<StudentRow | null> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'get',
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  // The id comes from the session context — there is no way to address
  // another student through this function.
  return db.findStudentById(ctx.studentId);
}

export async function getOwnSettings(
  db: DataDb,
  ctx: DataCtx,
): Promise<StudentSettingsRow | null> {
  return resolveSettings(db, ctx);
}

export interface UpdateContactsInput {
  email: string;
  phone: string | null;
  emailVisibleToStaff: boolean;
  phoneVisibleToStaff: boolean;
}

/**
 * Edits the contacts: email lives on the Student row (deanery-owned fields
 * are untouched), phone + visibility flags live on the settings row.
 */
export async function updateOwnContacts(
  db: DataDb,
  ctx: DataCtx,
  input: UpdateContactsInput,
): Promise<StudentRow | null> {
  const settings = await resolveSettings(db, ctx);
  if (!settings) return null;
  const now = new Date();
  await db.saveSettingsByStudent(ctx.studentId!, {
    ...settings,
    phone: input.phone,
    emailVisibleToStaff: input.emailVisibleToStaff,
    phoneVisibleToStaff: input.phoneVisibleToStaff,
    updatedAt: now,
  });
  return db.updateStudentContacts(ctx.studentId!, { email: input.email });
}

/** One cell of the type × channel matrix. Telegram is ignored («скоро»). */
export async function updateOwnNotificationChannel(
  db: DataDb,
  ctx: DataCtx,
  type: NotificationType,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<StudentSettingsRow | null> {
  const settings = await resolveSettings(db, ctx);
  if (!settings) return null;
  if (!ALL_TYPES.includes(type) || channel === 'TELEGRAM') {
    return settings; // defensive + product rule: Telegram stays off
  }
  const next: StudentSettingsRow = {
    ...settings,
    notificationChannels: {
      ...settings.notificationChannels,
      [type]: {
        ...settings.notificationChannels[type],
        [channel]: enabled,
      },
    },
    updatedAt: new Date(),
  };
  return db.saveSettingsByStudent(ctx.studentId!, next);
}

export async function updateOwnTheme(
  db: DataDb,
  ctx: DataCtx,
  theme: ThemePreference,
): Promise<StudentSettingsRow | null> {
  const settings = await resolveSettings(db, ctx);
  if (!settings) return null;
  return db.saveSettingsByStudent(ctx.studentId!, { ...settings, theme, updatedAt: new Date() });
}

export interface GenerateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  now?: Date;
}

/**
 * Notification generation for the ctx owner. Suppressed (null) when the
 * PUSH channel of the type is disabled — the settings screen therefore
 * directly affects what gets generated into the feed.
 */
export async function createNotificationForStudent(
  db: DataDb,
  ctx: DataCtx,
  input: GenerateNotificationInput,
): Promise<NotificationRow | null> {
  const settings = await resolveSettings(db, ctx);
  if (!settings) return null;
  if (!settings.notificationChannels[input.type]?.PUSH) return null;
  return db.appendNotificationToStudent(ctx.studentId!, {
    type: input.type,
    title: input.title,
    body: input.body,
    createdAt: input.now ?? new Date(),
  });
}

/**
 * «Нашли ошибку в данных?» — the single entry point: creates an OPEN appeal
 * to the deanery with the pre-filled subject and a first student message.
 */
export async function createDataErrorAppeal(
  db: DataDb,
  ctx: DataCtx,
  options: { now?: Date } = {},
): Promise<AppealRow | null> {
  const settings = await resolveSettings(db, ctx);
  if (!settings) return null;
  const profile = await db.findStudentById(ctx.studentId!);
  const now = options.now ?? new Date();
  return db.appendAppealByStudent(ctx.studentId!, {
    subject: DATA_ERROR_APPEAL_SUBJECT,
    message:
      'Прошу проверить данные профиля (ФИО, факультет, направление, курс, группа, контакты) ' +
      'и исправить найденную ошибку.',
    authorName: profile?.fullName ?? ctx.login,
    createdAt: now,
  });
}
