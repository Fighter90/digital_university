// DIG-19 — profile & settings data-layer contract (IDOR defence + behaviour).
//
// The profile screen reads ONLY the session owner's row (getOwnProfile is
// scoped by ctx.studentId, which is derived from the session — never from
// input). Settings mutations persist per student; notification GENERATION
// respects the per-type channel matrix; the «Нашли ошибку в данных?» entry
// point creates ONE deanery appeal with a pre-filled subject.
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import {
  createDataErrorAppeal,
  createNotificationForStudent,
  DATA_ERROR_APPEAL_SUBJECT,
  defaultSettingsFor,
  getOwnProfile,
  getOwnSettings,
  updateOwnContacts,
  updateOwnNotificationChannel,
  updateOwnTheme,
} from '@/server/data/profile';
import { listNotifications } from '@/server/data/notifications';
import { listAppeals } from '@/server/data/appeals';
import type { DataCtx } from '@/server/data/types';

const T0 = new Date('2026-11-11T10:00:00.000Z');

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx; // staff, faculty «ИТ»

beforeAll(async () => {
  db = createMemoryDataDb();
  db.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna',
        fullName: 'Анна Ковалёва',
        email: 'anna@example.edu',
        groupName: 'ПИ-21',
        course: 2,
        faculty: 'ИТ',
        program: 'Прикладная информатика',
        programCode: '09.03.04',
        studyForm: 'очная',
        funding: 'бюджет',
        gradebookNumber: '20231234',
      },
      {
        id: 'st-ilya',
        login: 'ilya',
        fullName: 'Илья Смирнов',
        email: 'ilya@example.edu',
        groupName: 'ЭК-11',
        course: 1,
        faculty: 'ЭК',
        program: 'Экономика',
        programCode: '38.03.01',
        studyForm: 'очная',
        funding: 'контракт',
        gradebookNumber: '20254567',
      },
    ],
    staff: [
      {
        id: 'stf-maria',
        login: 'maria',
        fullName: 'Мария Петрова',
        position: 'Специалист деканата',
        email: 'maria@example.edu',
        faculty: 'ИТ',
      },
    ],
  });

  anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, db))!;
  ilya = (await toDataCtx({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' }, db))!;
  maria = (await toDataCtx({ id: 'auth-maria', login: 'maria', role: 'STAFF' }, db))!;

  expect(anna?.studentId).toBe('st-anna');
  expect(maria?.studentId).toBeNull();
});

const lastAudit = () => db.auditEvents().at(-1);

/** getOwnSettings returns null only for a staff ctx — unwrap with an assertion. */
async function mustSettings(ctx: DataCtx) {
  const settings = await getOwnSettings(db, ctx);
  expect(settings, `settings for ${ctx.login}`).not.toBeNull();
  return settings!;
}

describe('getOwnProfile — session owner only', () => {
  it('returns the own student row with program code and funding', async () => {
    const profile = await getOwnProfile(db, anna);
    expect(profile).not.toBeNull();
    expect(profile?.fullName).toBe('Анна Ковалёва');
    expect(profile?.programCode).toBe('09.03.04');
    expect(profile?.funding).toBe('бюджет');
    expect(profile?.groupName).toBe('ПИ-21');
  });

  it('staff ctx gets null and a ROLE_MISMATCH audit event', async () => {
    db.auditEvents().length = 0;
    expect(await getOwnProfile(db, maria)).toBeNull();
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
    expect(lastAudit()?.resourceType).toBe('profile');
  });
});

describe('settings defaults + mutations are per student', () => {
  it('default settings: every channel on except Telegram, theme = system', async () => {
    const settings = await mustSettings(anna);
    expect(settings.studentId).toBe('st-anna');
    for (const type of ['SCHEDULE', 'DEADLINE', 'REQUEST', 'GRADE', 'NEWS'] as const) {
      expect(settings.notificationChannels[type].PUSH, `${type} push`).toBe(true);
      expect(settings.notificationChannels[type].EMAIL, `${type} email`).toBe(true);
      expect(settings.notificationChannels[type].TELEGRAM, `${type} telegram`).toBe(false);
    }
    expect(settings.theme).toBe('SYSTEM');
    expect(settings.emailVisibleToStaff).toBe(true);
    expect(settings.phoneVisibleToStaff).toBe(true);
  });

  it('defaultSettingsFor is a pure factory without shared references', () => {
    const a = defaultSettingsFor('st-x');
    const b = defaultSettingsFor('st-x');
    expect(a).toEqual(b);
    expect(a.notificationChannels).not.toBe(b.notificationChannels);
  });

  it('updateOwnContacts persists email/phone/visibility for the owner only', async () => {
    const updated = await updateOwnContacts(db, anna, {
      email: 'anna.k@example.edu',
      phone: '+7 900 010-20-30',
      emailVisibleToStaff: false,
      phoneVisibleToStaff: true,
    });
    expect(updated?.email).toBe('anna.k@example.edu');

    const annaSettings = await mustSettings(anna);
    expect(annaSettings.phone).toBe('+7 900 010-20-30');
    expect(annaSettings.emailVisibleToStaff).toBe(false);
    expect(annaSettings.phoneVisibleToStaff).toBe(true);

    // Илья не пострадал: его настройки остались дефолтными.
    const ilyaSettings = await mustSettings(ilya);
    expect(ilyaSettings.phone).toBeNull();
    expect(ilyaSettings.emailVisibleToStaff).toBe(true);
    expect((await getOwnProfile(db, ilya))?.email).toBe('ilya@example.edu');
  });

  it('staff ctx cannot change contacts (ROLE_MISMATCH, nothing written)', async () => {
    db.auditEvents().length = 0;
    expect(
      await updateOwnContacts(db, maria, {
        email: 'hax@example.edu',
        phone: null,
        emailVisibleToStaff: true,
        phoneVisibleToStaff: true,
      }),
    ).toBeNull();
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
    expect((await getOwnProfile(db, anna))?.email).toBe('anna.k@example.edu');
  });

  it('updateOwnNotificationChannel persists one cell of the matrix', async () => {
    const settings = await updateOwnNotificationChannel(db, anna, 'DEADLINE', 'EMAIL', false);
    expect(settings?.notificationChannels.DEADLINE.EMAIL).toBe(false);
    expect(settings?.notificationChannels.DEADLINE.PUSH).toBe(true);
    expect(settings?.notificationChannels.GRADE.EMAIL).toBe(true);
    expect((await mustSettings(ilya)).notificationChannels.DEADLINE.EMAIL).toBe(true);
  });

  it('Telegram can never be enabled («скоро») — the request is ignored', async () => {
    const settings = await updateOwnNotificationChannel(db, anna, 'SCHEDULE', 'TELEGRAM', true);
    expect(settings?.notificationChannels.SCHEDULE.TELEGRAM).toBe(false);
  });

  it('updateOwnTheme persists the theme preference', async () => {
    expect((await updateOwnTheme(db, anna, 'LIGHT'))?.theme).toBe('LIGHT');
    expect((await mustSettings(anna)).theme).toBe('LIGHT');
    expect((await mustSettings(ilya)).theme).toBe('SYSTEM');
  });
});

describe('notification generation respects the channel matrix', () => {
  it('suppresses a notification when the PUSH channel is off for its type', async () => {
    await updateOwnNotificationChannel(db, anna, 'GRADE', 'PUSH', false);
    const before = await listNotifications(db, anna);
    const created = await createNotificationForStudent(db, anna, {
      type: 'GRADE',
      title: 'Новая оценка',
      body: 'Тест 2 — 91 из 100.',
      now: T0,
    });
    expect(created).toBeNull();
    const after = await listNotifications(db, anna);
    expect(after).toHaveLength(before.length);
  });

  it('creates a notification for the owner when PUSH is on, scoped to that student', async () => {
    const created = await createNotificationForStudent(db, anna, {
      type: 'REQUEST',
      title: 'Справка готова',
      body: 'Можно забрать в деканате.',
      now: T0,
    });
    expect(created?.studentId).toBe('st-anna');
    const feed = await listNotifications(db, anna);
    expect(feed.some((n) => n.title === 'Справка готова')).toBe(true);
    // Илье эта генерация не попадает.
    expect((await listNotifications(db, ilya)).some((n) => n.title === 'Справка готова')).toBe(
      false,
    );
  });

  it('staff ctx cannot generate notifications through the student surface', async () => {
    db.auditEvents().length = 0;
    expect(
      await createNotificationForStudent(db, maria, {
        type: 'NEWS',
        title: 'x',
        body: 'y',
        now: T0,
      }),
    ).toBeNull();
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
  });
});

describe('«Нашли ошибку в данных?» — one entry point, one appeal', () => {
  it('creates an OPEN appeal with the pre-filled subject and a first student message', async () => {
    const appeal = await createDataErrorAppeal(db, anna, { now: T0 });
    expect(appeal?.status).toBe('OPEN');
    expect(appeal?.subject).toBe(DATA_ERROR_APPEAL_SUBJECT);
    expect(DATA_ERROR_APPEAL_SUBJECT).toContain('Ошибка');
    expect(appeal?.studentId).toBe('st-anna');
  });

  it('the appeal is visible only to its owner in listAppeals', async () => {
    const own = await listAppeals(db, anna);
    expect(own.some((a) => a.subject === DATA_ERROR_APPEAL_SUBJECT)).toBe(true);
    expect((await listAppeals(db, ilya)).some((a) => a.subject === DATA_ERROR_APPEAL_SUBJECT)).toBe(
      false,
    );
  });

  it('staff ctx cannot create an appeal through the student surface', async () => {
    db.auditEvents().length = 0;
    expect(await createDataErrorAppeal(db, maria, { now: T0 })).toBeNull();
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
  });
});
