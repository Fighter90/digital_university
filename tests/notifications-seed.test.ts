// DIG-35 — инварианты демо-сида уведомлений (приёмка задачи):
// у Анны ровно 3 непрочитанных (существующий e2e каркаса ждёт «3» на
// колокольчике), у каждой строки конкретный объект и ссылка на него,
// «Важно» — только у срочных (перенос/отмена сегодня, недопуск, доработка
// заявки, дедлайн оплаты), все 4 категории фильтров непустые.
import { describe, expect, it } from 'vitest';

import { createMemoryDataDb } from '@/server/data/memory-db';
import { seedDemoData } from '@/server/data/demo-seed';
import { matchNotificationFilter, toNotificationFeedItem } from '@/lib/notification-view';
import type { AuthStore } from '@/server/auth/types';
import type { NotificationRow } from '@/server/data/types';

// seedDemoData требует AuthStore только для посадки демо-логинов; для теста
// сида уведомлений достаточно заглушки с теми же точками расширения.
const stubStore = {
  seedUser: () => undefined,
  listUsers: () => [] as Array<{ login: string }>,
} as unknown as AuthStore;

const IMPORTANT_IDS = [
  'ntf-anna-1', // перенос пары сегодня
  'ntf-anna-5', // дедлайн оплаты (общежитие)
  'ntf-anna-7', // недопуск: долг по коллоквиуму
  'ntf-ilya-1', // отмена пары сегодня
  'ntf-ilya-2', // дедлайн оплаты (договор)
  'ntf-ilya-3', // доработка заявки
];

async function seededRows(studentId: string): Promise<NotificationRow[]> {
  const db = createMemoryDataDb();
  await seedDemoData(db, stubStore);
  return db.listNotificationsByStudent(studentId);
}

describe('демо-сид уведомлений — приёмка DIG-35', () => {
  it('у Анны ровно 3 непрочитанных (контракт e2e каркаса «3» на колокольчике)', async () => {
    const anna = await seededRows('st-anna');
    expect(anna.length).toBeGreaterThanOrEqual(6);
    expect(anna.filter((n) => !n.isRead)).toHaveLength(3);
  });

  it('у Ильи достаточно строк и 3 непрочитанных', async () => {
    const ilya = await seededRows('st-ilya');
    expect(ilya.length).toBeGreaterThanOrEqual(6);
    expect(ilya.filter((n) => !n.isRead)).toHaveLength(3);
  });

  it('каждая строка называет объект и ссылается на него (без генерики)', async () => {
    const all = [...(await seededRows('st-anna')), ...(await seededRows('st-ilya'))];
    for (const n of all) {
      expect(n.title.length, `title of ${n.id}`).toBeGreaterThanOrEqual(10);
      expect(n.body.length, `body of ${n.id}`).toBeGreaterThanOrEqual(20);
      expect(n.link, `link of ${n.id}`).toMatch(/^\//);
      expect(n.title, `generic title forbidden: ${n.id}`).not.toMatch(
        /сменился статус|изменён статус/i,
      );
    }
  });

  it('«Важно» стоит ровно у срочных строк и больше нигде', async () => {
    const all = [...(await seededRows('st-anna')), ...(await seededRows('st-ilya'))];
    const flagged = all
      .filter((n) => n.important)
      .map((n) => n.id)
      .sort();
    expect(flagged).toEqual([...IMPORTANT_IDS].sort());
  });

  it('все 4 категории фильтров непустые для Анны (Учёба/Заявки/Деканат/Финансы)', async () => {
    const anna = (await seededRows('st-anna')).map(toNotificationFeedItem);
    for (const filter of ['STUDY', 'REQUESTS', 'DEANERY', 'FINANCE'] as const) {
      expect(
        anna.some((n) => matchNotificationFilter(n, filter)),
        `filter ${filter} must not be empty for Anna`,
      ).toBe(true);
    }
  });

  it('есть действия строк: «Скачать» и «Открыть расписание»', async () => {
    const anna = await seededRows('st-anna');
    const labels = anna.map((n) => n.actionLabel).filter(Boolean);
    expect(labels).toContain('Скачать');
    expect(labels).toContain('Открыть расписание');
  });
});
