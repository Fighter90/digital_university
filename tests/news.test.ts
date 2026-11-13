// DIG-36 — контракт слоя данных «Новости и объявления» (red-first).
// Приёмка: getNewsPage — дефолтный скоуп группы (Анна видит только ПИ-21),
// вкладки факультета и вуза, фильтр темы (совместно со скоупом), для
// сотрудника вкладка группы заменяется факультетом; полоса «Важно» в
// скоупе вкладки; getNewsArticle возвращает статью и isRead; markNewsRead
// owner-scoped (отметка Ильи не видна Анне), идемпотентен, неизвестный id
// — false, сотруднику отметки не пишутся.
import { beforeAll, describe, expect, it } from 'vitest';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import { findNews } from '@/lib/news-catalog';
import { getNewsPage, getNewsArticle, markNewsRead, listDeaneryNews } from '@/server/data/news';
import type { AuthUser } from '@/server/auth/types';
import type { DataCtx } from '@/server/data/types';

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

const userOf = (id: string, login: string, role: AuthUser['role']): AuthUser => ({
  id,
  login,
  role,
});

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
  anna = (await toDataCtx(userOf('auth-anna', 'anna', 'STUDENT'), db))!;
  ilya = (await toDataCtx(userOf('auth-ilya', 'ilya', 'STUDENT'), db))!;
  maria = (await toDataCtx(userOf('auth-maria', 'maria', 'STAFF'), db))!;
  expect(anna?.groupName).toBe('ПИ-21');
});

describe('getNewsPage — скоуп по умолчанию и вкладки', () => {
  it('дефолт: вкладка группы — только новости ПИ-21, чужих групп нет', async () => {
    const page = await getNewsPage(db, anna, {});
    expect(page.scope).toBe('group');
    expect(page.scopeDefaulted).toBe(false);
    expect(page.items.length).toBeGreaterThanOrEqual(2);
    for (const item of page.items) {
      expect(item.scope).toBe('group');
      expect(item.group).toBe('ПИ-21');
    }
    expect(page.items.some((n) => n.group === 'ЭК-11')).toBe(false);
    expect(page.items.some((n) => n.scope === 'university')).toBe(false);
  });

  it('вкладка факультета: только ИТ, без ЭК', async () => {
    const page = await getNewsPage(db, anna, { scope: 'faculty' });
    expect(page.scope).toBe('faculty');
    expect(page.items.every((n) => n.scope === 'faculty' && n.faculty === 'ИТ')).toBe(true);
    expect(page.items.some((n) => n.faculty === 'ЭК')).toBe(false);
  });

  it('вкладка вуза: общий поток', async () => {
    const page = await getNewsPage(db, anna, { scope: 'university' });
    expect(page.scope).toBe('university');
    expect(page.items.every((n) => n.scope === 'university')).toBe(true);
    expect(page.items.length).toBeGreaterThanOrEqual(3);
  });

  it('сотруднику вкладка группы заменяется факультетом (scopeDefaulted)', async () => {
    const page = await getNewsPage(db, maria, {});
    expect(page.scope).toBe('faculty');
    expect(page.scopeDefaulted).toBe(true);
    expect(page.items.every((n) => n.faculty === 'ИТ')).toBe(true);
  });

  it('сотрудник с явной вкладкой группы тоже получает факультет', async () => {
    const page = await getNewsPage(db, maria, { scope: 'group' });
    expect(page.scope).toBe('faculty');
    expect(page.scopeDefaulted).toBe(true);
  });

  it('полоса «Важно» — только важные объявления скоупа вкладки', async () => {
    const group = await getNewsPage(db, anna, { scope: 'group' });
    expect(group.announcements.length).toBeGreaterThanOrEqual(1);
    expect(group.announcements.every((n) => n.important && n.group === 'ПИ-21')).toBe(true);

    const university = await getNewsPage(db, anna, { scope: 'university' });
    expect(university.announcements.every((n) => n.scope === 'university')).toBe(true);
    // Важное группы не протекает на вкладку вуза.
    expect(university.announcements.some((n) => n.group === 'ПИ-21')).toBe(false);
  });

  it('некорректный скоуп/тема из URL безопасно падают в дефолт', async () => {
    const page = await getNewsPage(db, anna, {
      scope: 'DROP TABLE' as never,
      topic: 'nope' as never,
    });
    expect(page.scope).toBe('group');
    expect(page.topic).toBe('all');
  });
});

describe('getNewsPage — фильтр тем', () => {
  it('тема фильтрует ленту вместе со скоупом', async () => {
    const page = await getNewsPage(db, anna, { scope: 'university', topic: 'dormitory' });
    expect(page.topic).toBe('dormitory');
    expect(page.items.length).toBeGreaterThanOrEqual(1);
    expect(page.items.every((n) => n.topic === 'dormitory')).toBe(true);
  });

  it('пустой результат — валидное состояние (items: [])', async () => {
    const page = await getNewsPage(db, anna, { scope: 'group', topic: 'dormitory' });
    expect(page.items).toEqual([]);
    expect(page.scope).toBe('group');
  });
});

describe('отметки «Прочитано» — owner-scoped', () => {
  it('открытие новости помечает прочитанной; виден isRead в полосе «Важно»', async () => {
    const before = await getNewsPage(db, anna, { scope: 'group' });
    const target = before.announcements[0];
    expect(target.isRead).toBe(false);

    expect(await markNewsRead(db, anna, target.id)).toBe(true);
    const after = await getNewsPage(db, anna, { scope: 'group' });
    expect(after.announcements.find((n) => n.id === target.id)?.isRead).toBe(true);
  });

  it('отметка Ильи не видна Анне (изоляция владельца)', async () => {
    const page = await getNewsPage(db, anna, { scope: 'group' });
    const id = page.announcements[0].id;
    await markNewsRead(db, anna, id);

    const ilyaPage = await getNewsPage(db, ilya, { scope: 'group' });
    // У Ильи свои объявления ЭК-11 — точно нет Анниных.
    expect(ilyaPage.announcements.some((n) => n.id === id)).toBe(false);
    // И его собственная полоса не наследует чужие отметки.
    expect(ilyaPage.announcements.every((n) => n.isRead === false)).toBe(true);
  });

  it('markNewsRead идемпотентен', async () => {
    // У Ильи своё объявление ЭК-11 — изоляция от других тестов по владельцу.
    const page = await getNewsPage(db, ilya, { scope: 'group' });
    const id = page.announcements[0].id;
    expect(await markNewsRead(db, ilya, id)).toBe(true);
    expect(await markNewsRead(db, ilya, id)).toBe(true);
    const again = await getNewsPage(db, ilya, { scope: 'group' });
    expect(again.announcements.filter((n) => n.id === id)).toHaveLength(1);
    expect(again.announcements.find((n) => n.id === id)?.isRead).toBe(true);
  });

  it('неизвестный id отклоняется без записи (whitelist каталога)', async () => {
    expect(await markNewsRead(db, anna, '../../etc/passwd')).toBe(false);
    expect(await markNewsRead(db, anna, 'totally-unknown-news')).toBe(false);
  });

  it('сотруднику отметки не пишутся (нет студенческого скоупа), лента работает', async () => {
    const page = await getNewsPage(db, maria, { scope: 'faculty' });
    const id = page.announcements[0]?.id;
    expect(await markNewsRead(db, maria, id ?? 'any')).toBe(false);
  });

  it('getNewsArticle: статья + isRead, чтение помечает владеющую отметку', async () => {
    const article = await getNewsArticle(db, anna, 'scholarship-increased-docs');
    expect(article).not.toBeNull();
    expect(article?.isRead).toBe(false);

    await markNewsRead(db, anna, 'scholarship-increased-docs');
    const after = await getNewsArticle(db, anna, 'scholarship-increased-docs');
    expect(after?.isRead).toBe(true);
    expect(after?.article.title).toBeTruthy();
    expect(after?.article.body.length).toBeGreaterThanOrEqual(2);
  });

  it('getNewsArticle: неизвестный id — null (униформный 404)', async () => {
    expect(await getNewsArticle(db, anna, 'no-such-news')).toBeNull();
  });
});

describe('listDeaneryNews — блок на главной из каталога', () => {
  it('свежие сверху, ссылки ведут на существующие страницы новостей', () => {
    const news = listDeaneryNews();
    expect(news.length).toBeGreaterThanOrEqual(3);
    const times = news.map((n) => n.publishedAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    for (const item of news) {
      expect(findNews(item.id)).not.toBeNull();
    }
  });
});
