// DIG-36 — контракт каталога новостей (red-first).
// Приёмка: уникальные id, непустые поля, 4 темы с точными метками,
// 3 скоупа с точными метками; newsForScope фильтрует по группе/факультету
// студента и сортирует свежие сверху; newsForTopic; важные объявления
// (в т.ч. «изменился порядок пересдач»); обложки-файлы существуют на диске
// с человеческим alt; вложения ведут на существующие файлы; QA-тексты
// («ёлочки», без двойных пробелов, без точки в заголовке).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  NEWS_ITEMS,
  NEWS_SCOPE_LABELS,
  NEWS_TOPIC_LABELS,
  NEWS_COVERS,
  findNews,
  newsForScope,
  newsForTopic,
  importantOf,
  formatNewsDate,
  type NewsEntry,
} from '@/lib/news-catalog';

const ROOT = resolve(import.meta.dirname, '..');

describe('каталог новостей — форма данных', () => {
  it('непустой каталог с уникальными id (kebab-case)', () => {
    expect(NEWS_ITEMS.length).toBeGreaterThanOrEqual(10);
    const ids = NEWS_ITEMS.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]{2,63}$/);
    }
  });

  it('у каждой записи заполнены заголовок, текст, источник и автор', () => {
    for (const item of NEWS_ITEMS) {
      expect(item.title.length, item.id).toBeGreaterThan(3);
      expect(item.excerpt.length, item.id).toBeGreaterThan(10);
      expect(item.body.length, item.id).toBeGreaterThanOrEqual(2);
      for (const p of item.body) expect(p.length, item.id).toBeGreaterThan(10);
      expect(item.source.length, item.id).toBeGreaterThan(2);
      expect(item.authorName.length, item.id).toBeGreaterThan(2);
      expect(item.publishedAt, item.id).toBeInstanceOf(Date);
    }
  });

  it('ровно 4 темы с точными метками задачи', () => {
    expect(Object.keys(NEWS_TOPIC_LABELS).sort()).toEqual(
      ['dormitory', 'events', 'scholarship', 'study'].sort(),
    );
    expect(NEWS_TOPIC_LABELS).toEqual({
      study: 'Учёба',
      events: 'Мероприятия',
      scholarship: 'Стипендии',
      dormitory: 'Общежитие',
    });
    // Все четыре темы реально представлены в каталоге.
    const topics = new Set(NEWS_ITEMS.map((n) => n.topic));
    for (const topic of Object.keys(NEWS_TOPIC_LABELS)) {
      expect(topics.has(topic as keyof typeof NEWS_TOPIC_LABELS), topic).toBe(true);
    }
  });

  it('ровно 3 скоупа с точными метками задачи', () => {
    expect(NEWS_SCOPE_LABELS).toEqual({
      group: 'Моя группа',
      faculty: 'Мой факультет',
      university: 'Весь вуз',
    });
    const scopes = new Set(NEWS_ITEMS.map((n) => n.scope));
    for (const scope of Object.keys(NEWS_SCOPE_LABELS)) {
      expect(scopes.has(scope as keyof typeof NEWS_SCOPE_LABELS), scope).toBe(true);
    }
  });

  it('скоуп согласован: group несёт группу, faculty — факультет, university — ни того, ни другого', () => {
    for (const item of NEWS_ITEMS) {
      if (item.scope === 'group') {
        expect(item.group, item.id).toBeTruthy();
        expect(item.faculty, item.id).toBeNull();
      } else if (item.scope === 'faculty') {
        expect(item.faculty, item.id).toBeTruthy();
        expect(item.group, item.id).toBeNull();
      } else {
        expect(item.group, item.id).toBeNull();
        expect(item.faculty, item.id).toBeNull();
      }
    }
  });

  it('важные объявления есть, среди них — про порядок пересдач', () => {
    const important = importantOf(NEWS_ITEMS as NewsEntry[]);
    expect(important.length).toBeGreaterThanOrEqual(2);
    expect(important.every((n) => n.important)).toBe(true);
    const titles = important.map((n) => n.title.toLowerCase());
    expect(titles.some((t) => t.includes('пересдач'))).toBe(true);
  });
});

describe('каталог новостей — выборки', () => {
  const student = { groupName: 'ПИ-21', faculty: 'ИТ' };

  it('findNews находит по id, неизвестный — null', () => {
    expect(findNews(NEWS_ITEMS[0].id)?.id).toBe(NEWS_ITEMS[0].id);
    expect(findNews('no-such-news')).toBeNull();
  });

  it('newsForScope: вкладка группы — только новости группы студента', () => {
    const items = newsForScope('group', student);
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      expect(item.scope).toBe('group');
      expect(item.group).toBe('ПИ-21');
    }
    // Чужая группа не попадает: новостей ЭК-11 нет.
    expect(items.some((n) => n.group === 'ЭК-11')).toBe(false);
  });

  it('newsForScope: вкладка факультета — только факультет студента', () => {
    const items = newsForScope('faculty', student);
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      expect(item.scope).toBe('faculty');
      expect(item.faculty).toBe('ИТ');
    }
    expect(items.some((n) => n.faculty === 'ЭК')).toBe(false);
  });

  it('newsForScope: вкладка вуза — общий поток', () => {
    const items = newsForScope('university', student);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((n) => n.scope === 'university')).toBe(true);
  });

  it('newsForScope: сортировка свежие сверху', () => {
    for (const scope of ['group', 'faculty', 'university'] as const) {
      const items = newsForScope(scope, student);
      const times = items.map((n) => n.publishedAt.getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    }
  });

  it('newsForTopic фильтрует по теме, «all» возвращает как есть', () => {
    const all = newsForScope('university', student);
    const dorm = newsForTopic(all, 'dormitory');
    expect(dorm.length).toBeGreaterThanOrEqual(1);
    expect(dorm.every((n) => n.topic === 'dormitory')).toBe(true);
    expect(newsForTopic(all, 'all')).toEqual(all);
  });

  it('у студента другой группы свой личный скоуп (Илья: ЭК-11/ЭК)', () => {
    const ilya = { groupName: 'ЭК-11', faculty: 'ЭК' };
    const group = newsForScope('group', ilya);
    expect(group.length).toBeGreaterThanOrEqual(1);
    expect(group.every((n) => n.group === 'ЭК-11')).toBe(true);
    // Аннин контекст не даёт новостей Ильи.
    expect(newsForScope('group', student).some((n) => n.group === 'ЭК-11')).toBe(false);
  });

  it('пустой контекст (сотрудник без группы) — вкладка группы пуста, факультет работает', () => {
    const staff = { groupName: null, faculty: 'ИТ' };
    expect(newsForScope('group', staff)).toEqual([]);
    const faculty = newsForScope('faculty', staff);
    expect(faculty.every((n) => n.faculty === 'ИТ')).toBe(true);
  });
});

describe('каталог новостей — обложки и вложения', () => {
  it('обложка на каждую тему: файл существует, alt человеческий', () => {
    const topics = Object.keys(NEWS_TOPIC_LABELS) as Array<keyof typeof NEWS_TOPIC_LABELS>;
    for (const topic of topics) {
      const cover = NEWS_COVERS[topic];
      expect(cover.src.startsWith('/news/covers/'), topic).toBe(true);
      expect(cover.alt.length, topic).toBeGreaterThan(10);
      expect(existsSync(resolve(ROOT, `public${cover.src}`)), cover.src).toBe(true);
    }
  });

  it('обложка — это настоящий SVG-файл', () => {
    const svg = readFileSync(resolve(ROOT, 'public', NEWS_COVERS.study.src.slice(1)), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox');
  });

  it('вложения ссылаются на существующие файлы и несут понятную подпись размера', () => {
    const withFiles = NEWS_ITEMS.filter((n) => n.attachments && n.attachments.length > 0);
    expect(withFiles.length).toBeGreaterThanOrEqual(1);
    for (const item of withFiles) {
      for (const file of item.attachments!) {
        expect(file.href.startsWith('/news/files/'), file.href).toBe(true);
        expect(existsSync(resolve(ROOT, `public${file.href}`)), file.href).toBe(true);
        expect(file.name.length, item.id).toBeGreaterThan(3);
        expect(file.sizeLabel, item.id).toMatch(/TXT · \d+/);
      }
    }
  });
});

describe('каталог новостей — качество текстов', () => {
  const textsOf = (n: NewsEntry): string[] => [n.title, n.excerpt, ...n.body, n.source];

  it('кавычки только «ёлочки», нет двойных пробелов и прямых кавычек', () => {
    for (const item of NEWS_ITEMS) {
      for (const text of textsOf(item)) {
        expect(text.includes('  '), `${item.id}: ${text}`).toBe(false);
        expect(text.includes('"'), `${item.id}: ${text}`).toBe(false);
        if (text.includes('«')) {
          // открывающая ёлочка всегда с парной закрывающей
          const open = (text.match(/«/g) ?? []).length;
          const close = (text.match(/»/g) ?? []).length;
          expect(open, item.id).toBe(close);
        }
      }
    }
  });

  it('заголовки без точки в конце, без опечаток-маркеров', () => {
    for (const item of NEWS_ITEMS) {
      expect(item.title.endsWith('.'), item.id).toBe(false);
      expect(item.title.toLowerCase().includes('зачетн'), item.id).toBe(false);
    }
  });

  it('дата карточки форматируется детерминированно: «12 ноября 2026»', () => {
    expect(formatNewsDate(new Date(2026, 10, 12))).toBe('12 ноября 2026');
    expect(formatNewsDate(new Date(2026, 10, 3))).toBe('3 ноября 2026');
  });
});
