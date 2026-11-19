// DIG-85 (BUG-15) — единый стиль аудиторий в студентском интерфейсе:
// «ауд. {номер}» везде, где студенту показывается аудитория (сессия,
// ICS-календарь, уведомления, справочник сотрудников, статические тексты).
// Стили «каб. …» и голый «Б-204» в студентском UI запрещены; EN-канон —
// «room {номер}». Старые записи в БД не мигрируются — правило перевода
// уведомлений обязано понимать и «каб.».
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { t } from '@/lib/i18n';
import { PEOPLE } from '@/lib/people-catalog';
import { createMemoryDataDb } from '@/server/data/memory-db';
import { seedDemoData } from '@/server/data/demo-seed';
import type { AuthStore } from '@/server/auth/types';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const stubStore = {
  seedUser: () => undefined,
  listUsers: () => [] as Array<{ login: string }>,
} as unknown as AuthStore;

async function seeded() {
  const db = createMemoryDataDb();
  await seedDemoData(db, stubStore);
  return db;
}

describe('i18n: session.room.short — канон «ауд. {room}»', () => {
  it('RU: аудитория сессии печатается как «ауд. А-401»', () => {
    expect(t('ru', 'session.room.short', { room: 'А-401' })).toBe('ауд. А-401');
  });

  it('EN: канон «room {room}» сохранён', () => {
    expect(t('en', 'session.room.short', { room: 'А-401' })).toBe('room А-401');
  });
});

describe('справочник сотрудников: часы приёма без «каб.»', () => {
  it('RU-часы приёма используют «ауд.», не «каб.»', () => {
    const offenders = PEOPLE.map((person) => person.consultationHours ?? '').filter((hours) =>
      /каб\.\s*\d/.test(hours),
    );
    expect(offenders).toEqual([]);
  });
});

describe('demo-seed: уведомления и тексты цитируют аудитории в каноне «ауд.»', () => {
  it('уведомление о пересдаче называет «ауд. {room}»', async () => {
    const db = await seeded();
    const rows = await db.listNotificationsByStudent('st-anna');
    const retake = rows.find((n) => n.id === 'ntf-anna-7');
    expect(retake?.body).toMatch(/ауд\. \S+\./);
    expect(retake?.body).not.toContain('каб.');
  });

  it('готовые справки и новости деканата: «ауд. 214» вместо «каб. 214»', () => {
    const demo = read('src/server/data/demo-seed.ts');
    expect(demo).not.toContain('каб. 214');
    expect(demo).toContain('ауд. 214');
    const news = read('src/server/data/news.ts');
    expect(news).not.toContain('каб. 214');
    expect(news).toContain('ауд. 214');
  });
});

describe('исходники слоя данных не строят «каб. {room}» для аудиторий', () => {
  it('calendar.ts (локации ICS) строит «ауд. {room}»', () => {
    const calendar = read('src/server/data/calendar.ts');
    expect(calendar).not.toMatch(/`каб\. \$\{/);
    expect(calendar).toMatch(/`ауд\. \$\{row\.room\}`/);
  });

  it('session.ts (текст уведомления о записи на пересдачу) строит «ауд. {room}»', () => {
    const session = read('src/server/data/session.ts');
    expect(session).not.toMatch(/каб\. \$\{probed\.room\}/);
    expect(session).toMatch(/ауд\. \$\{probed\.room\}/);
  });

  it('demo-seed.ts не содержит «каб.» в студентских текстах', () => {
    const demo = read('src/server/data/demo-seed.ts');
    expect(demo).not.toMatch(/каб\./);
  });

  it('news.ts: часы приёма деканата — «ауд. 214»', () => {
    const news = read('src/server/data/news.ts');
    expect(news).not.toContain('каб. 214');
    expect(news).toContain('ауд. 214');
  });

  it('help-контент (i18n ru.ts): деканат — «ауд. 214»', () => {
    const ru = read('src/lib/i18n/ru.ts');
    expect(ru).not.toContain('каб. 214');
    expect(ru).toContain('ауд. 214');
  });

  it('people-catalog.ts: RU-часы приёма без «каб.»', () => {
    const catalog = read('src/lib/people-catalog.ts');
    expect(catalog).not.toMatch(/каб\.\s*\d/);
  });

  it('ru-translit.ts: правило перевода уведомления о пересдаче понимает «ауд.» и «каб.»', () => {
    const translit = read('src/lib/ru-translit.ts');
    // Данные в БД не мигрируются — старые «каб.» должны переводиться по-прежнему.
    expect(translit).toMatch(/\(\?:каб\|ауд\)\\/);
  });
});
