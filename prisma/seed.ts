// DIG-10 — idempotent demo seed: wipe & rebuild inside one transaction.
// Running `pnpm db:seed` any number of times yields the same final state
// (no duplicates). All content is fictional (AGENTS.md); passwords are stored
// as bcrypt hashes only — plaintext jury passwords live in README.md.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma';
import type {
  ActorRole,
  AppealStatus,
  ElementKind,
  ExamKind,
  NotificationKind,
  RequestKind,
  RequestStatus,
  ScheduleKind,
  ScheduleStatus,
  StudyForm,
} from '../src/generated/prisma';

import {
  DISCIPLINES as DISCIPLINE_ROWS,
  STAFF_SEED,
  STUDENT_SEED as STUDENT_ROWS,
  buildAppeals,
  buildExamSessions,
  buildFaq,
  buildGrades,
  buildNews,
  buildNotifications,
  buildRequests,
  buildScheduleEvents,
  nowSeed,
} from './seed-data';

// Prisma 7 connects through a driver adapter; the URL comes from DATABASE_URL
// in .env (see prisma.config.ts).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

// Transaction-scoped client handed to the $transaction callback.
type TxClient = Prisma.TransactionClient;

async function wipe(tx: TxClient) {
  // Leaf → root so FKs never block; resets ALL seeded tables.
  await tx.appealMessage.deleteMany();
  await tx.appeal.deleteMany();
  await tx.notification.deleteMany();
  await tx.requestEvent.deleteMany();
  await tx.serviceRequest.deleteMany();
  await tx.grade.deleteMany();
  await tx.assessmentElement.deleteMany();
  await tx.discipline.deleteMany();
  await tx.scheduleEvent.deleteMany();
  await tx.examSession.deleteMany();
  await tx.newsPost.deleteMany();
  await tx.faqArticle.deleteMany();
  await tx.student.deleteMany();
  await tx.staff.deleteMany();
  await tx.session.deleteMany();
  await tx.user.deleteMany();
}

// Единый словарь статусов канона (DIG-9, 8 значений): названия из сидов
// DIG-10 отображаются без потери смысла.
const REQUEST_STATUS: Record<string, RequestStatus> = {
  SUBMITTED: 'SUBMITTED',
  IN_PROGRESS: 'IN_PROGRESS',
  NEEDS_REVISION: 'NEEDS_FIX',
  COMPLETED: 'ISSUED',
  REJECTED: 'REJECTED',
};

// Формы обучения: строки сидов → enum канона.
const STUDY_FORM: Record<string, StudyForm> = {
  очная: 'FULL_TIME',
  'очно-заочная': 'PART_TIME',
  заочная: 'EXTRAMURAL',
};

async function seed(tx: TxClient) {
  const now = nowSeed();

  // Users (DIG-11): единственное хранилище паролей. Профили Student/Staff
  // паролей не содержат — bcrypt-хэш из сида переезжает в User-строку.
  const userByLogin = new Map<string, string>();
  const students = new Map<string, string>();
  for (const { passwordHash, studyForm, ...profile } of STUDENT_ROWS) {
    const user = await tx.user.create({
      data: { login: profile.login, passwordHash, role: 'STUDENT' },
    });
    userByLogin.set(user.login, user.id);
    const created = await tx.student.create({
      data: {
        ...profile,
        userId: user.id,
        studyForm: STUDY_FORM[studyForm] ?? 'FULL_TIME',
      },
    });
    students.set(created.login, created.id);
  }
  const { passwordHash: staffHash, ...staffProfile } = STAFF_SEED[0];
  const staffUser = await tx.user.create({
    data: { login: staffProfile.login, passwordHash: staffHash, role: 'STAFF' },
  });
  userByLogin.set(staffUser.login, staffUser.id);
  await tx.staff.create({ data: staffProfile });

  // Disciplines with weighted control elements.
  const elementIdByCode = new Map<string, string>();
  for (const { elements, ...disc } of DISCIPLINE_ROWS) {
    const created = await tx.discipline.create({
      data: {
        ...disc,
        elements: {
          create: elements.map((el, i) => ({ ...el, kind: el.kind as ElementKind, order: i + 1 })),
        },
      },
    });
    const stored = await tx.assessmentElement.findMany({ where: { disciplineId: created.id } });
    for (const el of stored) elementIdByCode.set(el.code, el.id);
  }

  // Grades (10-point scale) per student: value — оценка канона (CHECK 0..10),
  // elementId — элемент контроля сидов (AssessmentElement).
  for (const student of STUDENT_ROWS) {
    const { entries } = buildGrades(now, student);
    await tx.grade.createMany({
      data: entries.map((e) => ({
        studentId: students.get(student.login)!,
        elementId: elementIdByCode.get(e.elementCode)!,
        value: e.score,
        gradedAt: e.gradedAt,
        comment: e.comment,
      })),
    });
  }

  // Semester schedule with current-week exceptions.
  const events = buildScheduleEvents(now);
  for (let i = 0; i < events.length; i += 200) {
    await tx.scheduleEvent.createMany({
      data: events.slice(i, i + 200).map((e) => ({
        ...e,
        kind: e.kind as ScheduleKind,
        status: e.status as ScheduleStatus,
      })),
    });
  }

  // December exam session (credits, exams, one retake).
  await tx.examSession.createMany({
    data: buildExamSessions(now).map((s) => ({ ...s, kind: s.kind as ExamKind })),
  });

  // Requests with event history — every dictionary status covered
  // (map to the canonical 8-value RequestStatus, see REQUEST_STATUS).
  for (const { studentLogin, events: history, ...rest } of buildRequests(now)) {
    await tx.serviceRequest.create({
      data: {
        ...rest,
        type: rest.type as RequestKind,
        status: REQUEST_STATUS[rest.status],
        studentId: students.get(studentLogin)!,
        events: {
          create: history.map((e) => ({
            actorRole: e.actorRole as ActorRole,
            actorName: e.actorName,
            fromStatus: e.statusFrom ? REQUEST_STATUS[e.statusFrom] : null,
            toStatus: REQUEST_STATUS[e.statusTo],
            comment: e.message,
            createdAt: e.createdAt,
          })),
        },
      },
    });
  }

  // Notifications (20+ across students, several types) — канон: владелец User.
  const notifications = [
    ...buildNotifications(now, 'anna.smirnova'),
    ...buildNotifications(now, 'ilya.petrov'),
  ];
  await tx.notification.createMany({
    data: notifications.map(({ studentLogin, type, isRead, ...n }) => ({
      ...n,
      kind: type as NotificationKind,
      userId: userByLogin.get(studentLogin)!,
      readAt: isRead ? n.createdAt : null,
    })),
  });

  await tx.newsPost.createMany({ data: buildNews(now) });
  await tx.faqArticle.createMany({ data: buildFaq() });

  for (const { studentLogin, messages, ...rest } of buildAppeals(now)) {
    await tx.appeal.create({
      data: {
        ...rest,
        status: rest.status as AppealStatus,
        studentId: students.get(studentLogin)!,
        messages: {
          create: messages.map((m) => ({ ...m, authorRole: m.authorRole as ActorRole })),
        },
      },
    });
  }
}

async function main() {
  const counts = await prisma.$transaction(async (tx) => {
    await wipe(tx);
    await seed(tx);
    return {
      users: await tx.user.count(),
      students: await tx.student.count(),
      staff: await tx.staff.count(),
      disciplines: await tx.discipline.count(),
      elements: await tx.assessmentElement.count(),
      grades: await tx.grade.count(),
      schedule: await tx.scheduleEvent.count(),
      exams: await tx.examSession.count(),
      requests: await tx.serviceRequest.count(),
      requestEvents: await tx.requestEvent.count(),
      notifications: await tx.notification.count(),
      news: await tx.newsPost.count(),
      faq: await tx.faqArticle.count(),
      appeals: await tx.appeal.count(),
      appealMessages: await tx.appealMessage.count(),
    };
  });
  console.log('[seed] done:', counts);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
