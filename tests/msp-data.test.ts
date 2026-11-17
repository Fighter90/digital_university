// DIG-68 — контракт данных каталога студенческих стартапов «МСП» (/msp).
// Приёмка: toggle голоса (голосование → снятие, дубликат не создаёт вторую
// строку), сортировка «Топ» по голосам, детерминированный slug, «Запуск
// дня» (max голосов, при равенстве самый свежий — не random), owner-scoped
// мутации (студенту — его голос/комментарий/запуск, сотруднику — отказ с
// аудитом ROLE_MISMATCH), комментарии и голоса только к существующим
// проектам (несуществующий — NOT_FOUND с аудитом, единый null).
import { beforeAll, describe, expect, it } from 'vitest';

import {
  addMspCommentToProject,
  getMspPage,
  launchMspProject,
  mspLetterOf,
  parseMspSort,
  toggleMspVoteForProject,
} from '@/server/data/msp';
import { mspSlugBase, mspSlugSuffix, newMspSlug, normalizeMspSlug } from '@/server/data/msp-slug';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, MspProjectRow } from '@/server/data/types';

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

const at = (minutes: number): Date => new Date(2026, 10, 16, 10, minutes, 0);

const projectSeed = (overrides: Partial<MspProjectRow> & { id: string }): MspProjectRow => ({
  slug: overrides.slug ?? `${overrides.id}-slug`,
  title: 'Проект',
  tagline: 'Краткое описание проекта',
  description: 'Подробное описание студенческого проекта каталога «МСП».',
  tags: ['учёба'],
  authorStudentId: 'st-anna',
  authorName: 'Анна Ковалёва',
  createdAt: at(-30),
  letter: 'П',
  ...overrides,
});

const voteSeed = (projectId: string, studentId: string, minutes: number) => ({
  projectId,
  studentId,
  createdAt: at(minutes),
});

beforeAll(() => {
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
    mspProjects: [
      // Топ-сортировка: p-top1 и p-top2 равны по голосам, «Топ» ставит
      // выше более свежий; p-new самый свежий, но с одним голосом.
      projectSeed({ id: 'msp-top1', title: 'Топ один', slug: 'top-odin-aaaa', createdAt: at(-50) }),
      projectSeed({ id: 'msp-top2', title: 'Топ два', slug: 'top-dva-bbbb', createdAt: at(-40) }),
      projectSeed({ id: 'msp-new', title: 'Новенький', slug: 'novenkiy-cccc', createdAt: at(-10) }),
      projectSeed({
        id: 'msp-zero',
        title: 'Без голосов',
        slug: 'bez-golosov-dddd',
        createdAt: at(-20),
      }),
    ],
    mspVotes: [
      voteSeed('msp-top1', 'st-anna', -45),
      voteSeed('msp-top1', 'st-ilya', -44),
      voteSeed('msp-top2', 'st-anna', -35),
      voteSeed('msp-top2', 'st-ilya', -34),
      voteSeed('msp-new', 'st-ilya', -5),
    ],
    mspComments: [
      {
        id: 'msp-cmt-1',
        projectId: 'msp-top1',
        studentId: 'st-ilya',
        authorName: 'Илья Смирнов',
        body: 'Годно!',
        createdAt: at(-20),
      },
    ],
  });

  anna = {
    userId: 'auth-anna',
    login: 'anna',
    role: 'STUDENT',
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  };
  ilya = {
    ...anna,
    userId: 'auth-ilya',
    login: 'ilya',
    studentId: 'st-ilya',
    groupName: 'ЭК-11',
    faculty: 'ЭК',
  };
  maria = {
    ...anna,
    userId: 'auth-dean',
    login: 'maria',
    role: 'STAFF',
    studentId: null,
    groupName: null,
  };
});

describe('toggle голоса — голосование и снятие', () => {
  it('голосование создаёт РОВНО одну строку, повторный вызов снимает голос', async () => {
    const before = await db.listMspVotesByStudent('st-anna');
    expect(before.filter((v) => v.projectId === 'msp-zero')).toHaveLength(0);

    // Голосование: строка одна, счётчик растёт на 1.
    const up = await db.toggleMspVote('st-anna', 'msp-zero');
    expect(up).toEqual({ voted: true, votes: 1 });
    const mine = await db.listMspVotesByStudent('st-anna');
    expect(mine.filter((v) => v.projectId === 'msp-zero')).toHaveLength(1);

    // Дубликат НЕ создаёт вторую строку: повторный toggle снимает голос.
    const down = await db.toggleMspVote('st-anna', 'msp-zero');
    expect(down).toEqual({ voted: false, votes: 0 });
    expect(await db.listMspVotesByStudent('st-anna')).toHaveLength(before.length);

    // И снова голос — снова ровно одна строка (чередование стабильное).
    const again = await db.toggleMspVote('st-anna', 'msp-zero');
    expect(again).toEqual({ voted: true, votes: 1 });
    expect(
      (await db.listMspVotesByStudent('st-anna')).filter((v) => v.projectId === 'msp-zero'),
    ).toHaveLength(1);
    await db.toggleMspVote('st-anna', 'msp-zero'); // уборка за собой
  });

  it('голос за несуществующий проект невозможен: null', async () => {
    expect(await db.toggleMspVote('st-anna', 'msp-unknown')).toBeNull();
  });

  it('через слой данных: студент голосует за существующий проект, несуществующий — отказ + аудит NOT_FOUND', async () => {
    const ok = await toggleMspVoteForProject(db, ilya, 'msp-new');
    expect(ok).toMatchObject({ ok: true, slug: 'novenkiy-cccc', voted: false, votes: 0 });

    // Возвращаем голос (сид для последующих тестов сортировки не меняется).
    const restored = await toggleMspVoteForProject(db, ilya, 'msp-new');
    expect(restored).toMatchObject({ ok: true, voted: true, votes: 1 });

    const before = db.auditEvents().length;
    const missing = await toggleMspVoteForProject(db, ilya, 'msp-unknown');
    expect(missing).toMatchObject({ ok: false });
    const events = db.auditEvents().slice(before);
    expect(events.map((e) => e.reason)).toEqual(['NOT_FOUND']);
    for (const event of events) {
      expect(event.resourceType).toBe('msp-project');
    }
  });

  it('сотруднику голосовать нельзя: отказ + аудит ROLE_MISMATCH', async () => {
    const before = db.auditEvents().length;
    const result = await toggleMspVoteForProject(db, maria, 'msp-new');
    expect(result).toMatchObject({ ok: false });
    expect(
      db
        .auditEvents()
        .slice(before)
        .map((e) => e.reason),
    ).toEqual(['ROLE_MISMATCH']);
  });
});

describe('сортировка и «Запуск дня»', () => {
  it('parseMspSort: top → top, всё остальное (включая мусор и undefined) → new', () => {
    expect(parseMspSort(undefined)).toBe('new');
    expect(parseMspSort('top')).toBe('top');
    expect(parseMspSort('new')).toBe('new');
    expect(parseMspSort('junk')).toBe('new');
    expect(parseMspSort(['top', 'new'])).toBe('top');
  });

  it('фильтр «Топ» сортирует по голосам, при равенстве — более свежий выше', async () => {
    const top = await getMspPage(db, anna, 'top');
    expect(top.sort).toBe('top');
    expect(top.items.map((v) => v.project.id)).toEqual([
      'msp-top2', // 2 голоса, свежее (ties по голосам решает createdAt)
      'msp-top1', // 2 голоса, старше
      'msp-new', // 1 голос
      'msp-zero', // 0 голосов
    ]);
  });

  it('«Новые» сортируют по времени независимо от голосов', async () => {
    const fresh = await getMspPage(db, anna, 'new');
    expect(fresh.items.map((v) => v.project.id)).toEqual([
      'msp-new',
      'msp-zero',
      'msp-top2',
      'msp-top1',
    ]);
  });

  it('«Запуск дня» детерминирован: max голосов, при равенстве самый свежий (НЕ random)', async () => {
    const first = await getMspPage(db, anna, 'top');
    const second = await getMspPage(db, ilya, 'new');
    expect(first.launchOfDay?.project.id).toBe('msp-top2'); // ties 2:2 → свежее
    expect(second.launchOfDay?.project.id).toBe(first.launchOfDay?.project.id); // без random
    expect(first.items[0]?.votedByMe).toBe(true); // anna голосовала за топ-2
    expect(second.items.find((v) => v.project.id === 'msp-zero')?.votedByMe).toBe(false);
    for (const view of [...first.items, ...second.items]) {
      expect(view.votes).toBeGreaterThanOrEqual(0);
      expect(view.comments).toBeGreaterThanOrEqual(0);
    }
    expect(first.items.map((v) => v.votes)).toEqual([2, 2, 1, 0]); // «Топ» по голосам
  });

  it('чтение каталога доступно и сотруднику (мутации — отдельный контракт)', async () => {
    const page = await getMspPage(db, maria, 'top');
    expect(page.items).toHaveLength(4);
    expect(page.items.every((v) => !v.votedByMe)).toBe(true);
  });
});

describe('slug-генерация — детерминирована', () => {
  it('одинаковый заголовок → одинаковый slug (транслит + суффикс без random)', () => {
    const first = newMspSlug('Конспект-бот');
    const second = newMspSlug('Конспект-бот');
    expect(first).toBe(second);
    expect(first).toMatch(/^konspekt-bot-[a-z0-9]{4}$/);
    expect(newMspSlug('СтудКофе')).toMatch(/^studkofe-[a-z0-9]{4}$/);
    expect(newMspSlug('Репетитор.Маркет')).toMatch(/^repetitor-market-[a-z0-9]{4}$/);
  });

  it('суффикс и база чистые функции, slug валиден по шаблону', () => {
    expect(mspSlugBase('Конспект-бот')).toBe('konspekt-bot');
    expect(mspSlugSuffix('Конспект-бот')).toBe(mspSlugSuffix('Конспект-бот'));
    expect(mspSlugSuffix('Конспект-бот')).toHaveLength(4);
    expect(mspSlugBase('///')).toBe('project'); // оборонительная база
    expect(newMspSlug('ТимЛидер')).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
  });

  it('коллизия с занятым slug снимается детерминированным числовым суффиксом', () => {
    const base = newMspSlug('БиблиоОбмен');
    const clash = newMspSlug('БиблиоОбмен', [base]);
    const clashAgain = newMspSlug('БиблиоОбмен', [base, clash]);
    expect(clash).toBe(`${base}-2`);
    expect(clashAgain).toBe(`${base}-3`);
  });

  it('normalizeMspSlug: trim + нижний регистр, пустой → URIError (тот же 404)', () => {
    expect(normalizeMspSlug(' Konspekt-Bot ')).toBe('konspekt-bot');
    expect(() => normalizeMspSlug('   ')).toThrow(URIError);
  });

  it('публикация запуска: slug/букву/автора генерирует слой данных', async () => {
    const result = await launchMspProject(db, anna, {
      title: 'Лаба.Помощь',
      tagline: 'Напарник по лабораторным работам',
      description: 'Помогает найти напарника и распределить роли по лабораторным работам курса.',
      tags: 'лабораторные, пары',
      now: at(5),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.slug).toBe(
      newMspSlug('Лаба.Помощь', [
        'top-odin-aaaa',
        'top-dva-bbbb',
        'novenkiy-cccc',
        'bez-golosov-dddd',
      ]),
    );
    expect(result.project.letter).toBe('Л');
    expect(result.project.authorStudentId).toBe('st-anna');
    expect(result.project.authorName).toBe('Анна Ковалёва');
    expect(result.project.tags).toEqual(['лабораторные', 'пары']);
    expect(mspLetterOf('ёлки-иголки')).toBe('Ё');
    // Каталог вырос на один проект.
    const page = await getMspPage(db, anna, 'new');
    expect(page.items[0]?.project.slug).toBe(result.project.slug);
  });

  it('валидация запуска: границы полей и теги, сотруднику — отказ с аудитом', async () => {
    const base = {
      title: 'Нормальный заголовок',
      tagline: 'Нормальный слоган проекта',
      description: 'Достаточно подробное описание студенческого проекта для каталога.',
      tags: 'ai',
    };
    await expect(launchMspProject(db, anna, { ...base, title: 'аб' })).resolves.toMatchObject({
      ok: false,
    });
    await expect(launchMspProject(db, anna, { ...base, tagline: 'ок' })).resolves.toMatchObject({
      ok: false,
    });
    await expect(
      launchMspProject(db, anna, { ...base, description: 'слишком коротко' }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      launchMspProject(db, anna, { ...base, tags: 'x, нормальный' }),
    ).resolves.toMatchObject({ ok: false });

    const before = db.auditEvents().length;
    await expect(launchMspProject(db, maria, base)).resolves.toMatchObject({ ok: false });
    expect(
      db
        .auditEvents()
        .slice(before)
        .map((e) => e.reason),
    ).toEqual(['ROLE_MISMATCH']);
  });
});

describe('комментарии — только к существующим проектам', () => {
  it('комментарий владельца пишется с его именем, список — старые сверху', async () => {
    const result = await addMspCommentToProject(db, anna, 'msp-top1', {
      body: 'Спасибо за запуск! Выгрузка в PDF была бы кстати.',
      now: at(2),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.comment.authorName).toBe('Анна Ковалёва');
    expect(result.comment.studentId).toBe('st-anna');

    const list = await db.listMspCommentsByProject('msp-top1');
    expect(list.map((c) => c.id)).toEqual(['msp-cmt-1', result.comment.id]); // старые сверху
  });

  it('комментарий к несуществующему проекту невозможен: null/отказ + аудит NOT_FOUND', async () => {
    expect(
      await db.appendMspComment('st-anna', 'msp-unknown', {
        authorName: 'X',
        body: 'y',
        createdAt: at(0),
      }),
    ).toBeNull();
    const before = db.auditEvents().length;
    const result = await addMspCommentToProject(db, anna, 'msp-unknown', { body: 'Текст' });
    expect(result).toMatchObject({ ok: false });
    expect(
      db
        .auditEvents()
        .slice(before)
        .map((e) => e.reason),
    ).toEqual(['NOT_FOUND']);
  });

  it('границы текста и роль: пустой/длинный текст — отказ, сотруднику — ROLE_MISMATCH', async () => {
    await expect(
      addMspCommentToProject(db, anna, 'msp-top1', { body: '   ' }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      addMspCommentToProject(db, anna, 'msp-top1', { body: 'x'.repeat(1001) }),
    ).resolves.toMatchObject({ ok: false });
    const before = db.auditEvents().length;
    await expect(
      addMspCommentToProject(db, maria, 'msp-top1', { body: 'Текст' }),
    ).resolves.toMatchObject({ ok: false });
    expect(
      db
        .auditEvents()
        .slice(before)
        .map((e) => e.reason),
    ).toEqual(['ROLE_MISMATCH']);
  });
});
