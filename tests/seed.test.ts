// DIG-10 — invariants of the fictional demo seed data.
// The tests import PURE builders from prisma/seed-data.ts (no Prisma/DB needed)
// and pin the acceptance criteria: example.edu emails, bcrypt-only passwords,
// current-week-relative schedule, full request-status coverage, demo volumes.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  STAFF_SEED,
  STUDENT_SEED,
  TEACHER_NAMES,
  buildAppeals,
  buildExamSessions,
  buildFaq,
  buildGrades,
  buildNews,
  buildNotifications,
  buildRequests,
  buildScheduleEvents,
  getSemesterRange,
  mondayOf,
} from '../prisma/seed-data';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// Deterministic "today": 2026-11-11 12:00 UTC (Wednesday).
const NOW = new Date(Date.UTC(2026, 10, 11, 12, 0, 0));

const REQUEST_STATUSES = [
  'SUBMITTED',
  'IN_PROGRESS',
  'NEEDS_REVISION',
  'COMPLETED',
  'REJECTED',
] as const;
const SCHEDULE_KINDS = ['LECTURE', 'PRACTICE', 'LAB', 'SEMINAR', 'CONSULTATION'] as const;

const sameDay = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();
const isWeekOf = (d: Date, now: Date) => {
  const mon = mondayOf(now);
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  return d >= mon && d <= sun;
};

describe('accounts (jury demo, fictional)', () => {
  it('has exactly 2 students with disjoint personal data', () => {
    expect(STUDENT_SEED).toHaveLength(2);
    const anna = STUDENT_SEED.find((s) => s.login === 'anna.smirnova');
    const ilya = STUDENT_SEED.find((s) => s.login === 'ilya.petrov');
    expect(anna).toMatchObject({
      course: 2,
      groupName: 'ИВТ-21',
      faculty: 'Факультет компьютерных наук',
      studyForm: 'очная',
    });
    expect(ilya).toMatchObject({
      course: 3,
      groupName: 'ЭК-23',
      faculty: 'Экономический факультет',
      studyForm: 'очная',
    });
    for (const s of STUDENT_SEED) expect(s.email.endsWith('@example.edu')).toBe(true);
    expect(new Set(STUDENT_SEED.map((s) => s.gradebookNumber)).size).toBe(2);
  });

  it('has 1 staff member: Maria Kovaleva, course manager', () => {
    expect(STAFF_SEED).toHaveLength(1);
    expect(STAFF_SEED[0]).toMatchObject({ login: 'dean.kovaleva', position: 'менеджер курса' });
    expect(STAFF_SEED[0].email.endsWith('@example.edu')).toBe(true);
  });

  it('stores only bcrypt hashes in seed files, plaintext only in README', () => {
    const seedSource = read('prisma/seed-data.ts') + read('prisma/seed.ts');
    expect(seedSource.match(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g)?.length).toBeGreaterThanOrEqual(
      3,
    );
    for (const plain of ['anna-demo-2026', 'ilya-demo-2026', 'dean-demo-2026']) {
      expect(seedSource.includes(plain), `plaintext "${plain}" leaked into prisma/`).toBe(false);
      expect(read('README.md').includes(plain), `jury password "${plain}" missing in README`).toBe(
        true,
      );
    }
  });
});

describe('semester schedule (current-week relative)', () => {
  const range = getSemesterRange(NOW);
  const events = buildScheduleEvents(NOW);

  it('slides the semester around "now" so the demo never goes stale', () => {
    expect(range.start.getFullYear()).toBe(2026);
    expect(range.start.getMonth()).toBe(8); // September 2026 when run on Nov 11
    expect(range.end.getMonth()).toBe(11); // December 2026
    expect(range.start <= NOW).toBe(true);
    expect(range.end >= NOW).toBe(true);
    // Sliding: run "in February 2027" → window still covers the run date.
    const feb = getSemesterRange(new Date(2027, 1, 10));
    expect(feb.start <= new Date(2027, 1, 10) && feb.end >= new Date(2027, 1, 10)).toBe(true);
  });

  it('covers both groups, all class kinds, 3–5 pairs per weekday', () => {
    const groups = new Set(events.map((e) => e.groupName));
    expect([...groups].sort()).toEqual(['ИВТ-21', 'ЭК-23']);
    const kinds = new Set(events.map((e) => e.kind));
    for (const k of SCHEDULE_KINDS) expect(kinds.has(k), `kind ${k} missing`).toBe(true);

    const monday = mondayOf(NOW);
    for (let day = 0; day < 5; day += 1) {
      for (const group of ['ИВТ-21', 'ЭК-23']) {
        const probe = new Date(monday);
        probe.setDate(probe.getDate() + day + 21); // a clean week, +3 weeks out
        const count = events.filter((e) => e.groupName === group && sameDay(e.date, probe)).length;
        expect(count, `${group} ${probe.toDateString()} has ${count} pairs`).toBeGreaterThanOrEqual(
          3,
        );
        expect(count).toBeLessThanOrEqual(5);
      }
    }
  });

  it('has exactly 1 room change, 1 time shift, 1 cancellation on the current week', () => {
    const current = events.filter((e) => isWeekOf(e.date, NOW));
    const by = (s: string) => current.filter((e) => e.status === s).length;
    expect(by('ROOM_CHANGED')).toBe(1);
    expect(by('TIME_CHANGED')).toBe(1);
    expect(by('CANCELLED')).toBe(1);
    const cancelled = current.find((e) => e.status === 'CANCELLED');
    expect(cancelled?.note).toBeTruthy();
    const shifted = current.find((e) => e.status === 'TIME_CHANGED');
    expect(shifted?.previousStartsAt).toBeTruthy();
    const moved = current.find((e) => e.status === 'ROOM_CHANGED');
    expect(moved?.previousRoom).toBeTruthy();
  });

  it('is deterministic for the same "now" (idempotent content)', () => {
    expect(buildScheduleEvents(NOW)).toEqual(events);
  });

  it('uses only fictional teacher names', () => {
    expect(TEACHER_NAMES.length).toBeGreaterThanOrEqual(8);
    for (const e of events) expect(TEACHER_NAMES).toContain(e.teacherName);
  });
});

describe('disciplines, control elements and grades (10-point scale)', () => {
  const anna = STUDENT_SEED.find((s) => s.login === 'anna.smirnova')!;
  const ilya = STUDENT_SEED.find((s) => s.login === 'ilya.petrov')!;
  const annaGrades = buildGrades(NOW, anna);
  const ilyaGrades = buildGrades(NOW, ilya);

  it('gives each student 6–8 disciplines with weighted elements summing to 1', () => {
    for (const [student, grades] of [
      [anna, annaGrades],
      [ilya, ilyaGrades],
    ] as const) {
      const codes = new Set(grades.disciplines.map((d) => d.code));
      expect(codes.size, `${student.login}: ${codes.size} disciplines`).toBeGreaterThanOrEqual(6);
      expect(codes.size).toBeLessThanOrEqual(8);
      for (const d of grades.disciplines) {
        const weightSum = d.elements.reduce((acc, el) => acc + el.weight, 0);
        expect(Math.abs(weightSum - 1), `${d.code}: weights ${weightSum}`).toBeLessThan(0.001);
        for (const el of d.elements) expect(el.maxScore).toBe(10);
        expect(d.elements.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('Anna: good record with exactly 1 debt; Ilya: no debts', () => {
    const debts = (g: ReturnType<typeof buildGrades>) =>
      g.entries.filter((entry) => entry.score < 4).length;
    expect(debts(annaGrades)).toBe(1);
    expect(debts(ilyaGrades)).toBe(0);
    const annaScores = annaGrades.entries.map((e) => e.score);
    expect(Math.min(...annaScores)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...annaScores)).toBeLessThanOrEqual(10);
    expect(annaScores.filter((s) => s >= 7).length / annaScores.length).toBeGreaterThan(0.6);
  });

  it('leaves some elements ungraded (pending work in progress)', () => {
    const gradedAnn = new Set(annaGrades.entries.map((e) => e.elementCode));
    const totalAnn = annaGrades.disciplines.flatMap((d) => d.elements.map((el) => el.code));
    expect(totalAnn.length - gradedAnn.size).toBeGreaterThanOrEqual(2);
  });
});

describe('exam session', () => {
  const sessions = buildExamSessions(NOW);

  it('has credits, exams and exactly one retake inside the semester, in December 2026', () => {
    const kinds = new Set(sessions.map((s) => s.kind));
    expect(kinds.has('CREDIT')).toBe(true);
    expect(kinds.has('EXAM')).toBe(true);
    expect(sessions.filter((s) => s.kind === 'RETAKE')).toHaveLength(1);
    const range = getSemesterRange(NOW);
    for (const s of sessions) {
      expect(s.date >= range.start && s.date <= range.end).toBe(true);
      expect(s.date.getMonth()).toBe(11);
    }
    expect(sessions.length).toBeGreaterThanOrEqual(6);
  });
});

describe('requests cover every dictionary status with history', () => {
  const requests = buildRequests(NOW);

  it('covers all 5 statuses; Anna has 2 in progress; Ilya has a "needs revision"', () => {
    const statuses = new Set(requests.map((r) => r.status));
    for (const s of REQUEST_STATUSES) expect(statuses.has(s), `status ${s} missing`).toBe(true);
    const anna = requests.filter((r) => r.studentLogin === 'anna.smirnova');
    const ilya = requests.filter((r) => r.studentLogin === 'ilya.petrov');
    expect(anna.filter((r) => r.status === 'IN_PROGRESS')).toHaveLength(2);
    expect(ilya.filter((r) => r.status === 'NEEDS_REVISION').length).toBeGreaterThanOrEqual(1);
    const practice = ilya.find((r) => r.type === 'PRACTICE');
    expect(practice?.status).toBe('COMPLETED');
    expect(practice?.resultNote).toMatch(/оффер/i);
  });

  it('every request has an event history starting with SUBMITTED', () => {
    for (const r of requests) {
      expect(r.events.length, r.title).toBeGreaterThanOrEqual(1);
      expect(r.events[0].statusTo).toBe('SUBMITTED');
      for (const ev of r.events) expect(ev.message.length).toBeGreaterThan(0);
    }
  });
});

describe('notifications, news, FAQ, appeals', () => {
  it('has 20+ notifications of 4+ types, including the current-week changes', () => {
    const anna = buildNotifications(NOW, 'anna.smirnova');
    const ilya = buildNotifications(NOW, 'ilya.petrov');
    const all = [...anna, ...ilya];
    expect(all.length).toBeGreaterThanOrEqual(20);
    expect(new Set(all.map((n) => n.type)).size).toBeGreaterThanOrEqual(4);
    const unread = all.filter((n) => !n.isRead);
    expect(unread.length, 'keep some unread for the bell badge').toBeGreaterThanOrEqual(3);
  });

  it('has exactly 5 news posts', () => {
    expect(buildNews(NOW)).toHaveLength(5);
    for (const n of buildNews(NOW)) expect(n.body.length).toBeGreaterThan(20);
  });

  it('has 25+ FAQ articles including scholarship ones', () => {
    const FAQ_SEED = buildFaq();
    expect(FAQ_SEED.length).toBeGreaterThanOrEqual(25);
    const scholarship = FAQ_SEED.filter((f) => f.category.toLowerCase().includes('стипенд'));
    expect(scholarship.length).toBeGreaterThanOrEqual(4);
    for (const f of FAQ_SEED) {
      expect(f.question.length).toBeGreaterThan(5);
      expect(f.answer.length).toBeGreaterThan(20);
    }
    expect(new Set(FAQ_SEED.map((f) => f.slug)).size).toBe(FAQ_SEED.length);
  });

  it('has appeals with two-sided conversation', () => {
    const APPEALS_SEED = buildAppeals(NOW);
    expect(APPEALS_SEED.length).toBeGreaterThanOrEqual(2);
    for (const a of APPEALS_SEED) {
      expect(a.messages.length).toBeGreaterThanOrEqual(2);
      const roles = new Set(a.messages.map((m) => m.authorRole));
      expect(roles.has('STUDENT')).toBe(true);
      expect(roles.has('STAFF')).toBe(true);
    }
  });
});

describe('schema & scripts wiring', () => {
  it('pins the prisma schema models required by the seed', () => {
    const schema = read('prisma/schema.prisma');
    for (const model of [
      'Student',
      'Staff',
      'Discipline',
      'AssessmentElement',
      'Grade',
      'ScheduleEvent',
      'ExamSession',
      'ServiceRequest',
      'RequestEvent',
      'Notification',
      'NewsPost',
      'FaqArticle',
      'Appeal',
      'AppealMessage',
    ]) {
      expect(schema, `model ${model} missing`).toMatch(new RegExp(`model ${model} `));
    }
  });

  it('exposes pnpm db:seed / db:migrate and prisma seed config', () => {
    const pkg = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
      prisma?: { seed?: string };
    };
    expect(pkg.scripts['db:seed']).toBeTruthy();
    expect(pkg.scripts['db:migrate']).toBeTruthy();
    expect(pkg.prisma?.seed).toBeTruthy();
  });

  it('seed.ts wipes and recreates inside one transaction (idempotency mechanism)', () => {
    const seed = read('prisma/seed.ts');
    expect(seed.includes('$transaction')).toBe(true);
    expect(seed.match(/deleteMany\(\)/g)?.length).toBeGreaterThanOrEqual(14);
  });
});
