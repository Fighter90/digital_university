// DIG-45 — скоупированный поиск по кабинету (источник GET /api/search).
//
// IDOR-контракт (как во всём слое данных, DIG-12): выборки строятся ТОЛЬКО
// из контекста сессии — заявки через listRequestsByStudent (свои), дисциплины
// и преподаватели через listDisciplinesByGroup (своя группа), «Люди» —
// только имена, уже видимые студенту в кабинете (преподаватели дисциплин
// группы, исполнитель его заявок, собственный профиль). Сотруднику
// студенческие группы не отдаются вовсе: до появления справочника (DIG-37/48)
// у него нет честных переходов к чужим профилям — палитра не делает видимых
// мёртвых ссылок.
//
// Аудит (DIG-45, раунд 2): аудит OWNERSHIP_DENIED живёт ЗДЕСЬ, в
// searchCabinet — полного номера заявки, который существует, но принадлежит
// не сессии. По образцу getRequestByNumber (requests.ts) делаем
// probeRequestByNumber без скоупа только чтобы различить «чужая» и «нет»:
// «чужая» → denyAccess (студент — OWNERSHIP_DENIED, сотрудник —
// ROLE_MISMATCH) при том же пустом ответе; «несуществующая» в поиске не
// аудитится (это подсказки, а не запрос карточки — NOT_FOUND пишет маршрут
// /api/requests/[number]). Частичный набор по буквам не аудитится.

import { FAQ_ENTRIES } from '@/lib/faq-catalog';
import {
  MIN_QUERY_LENGTH,
  buildGroups,
  hitMatchesSearch,
  isFullRequestNumberQuery,
  isRequestNumberQuery,
  matchesSearchQuery,
  normalizeSearchQuery,
  type SearchHit,
  type SearchResponse,
} from '@/lib/search-core';
import { matchService, servicesForRole } from '@/lib/services-catalog';
import { CABINET_SECTIONS, MORE_SECTIONS } from '@/components/shell/nav-items';
import { denyAccess } from './access';
import { listDeaneryNews } from './news';
import { normalizeRequestNumber } from './request-number';
import type { DataDb } from './port';
import type { DataCtx } from './types';

const RESOURCE = 'request';

/**
 * Адресный пробо-запрос к чужой заявке (только ПОЛНЫЙ номер): «заявка
 * существует, но не сессии» → DENIED-строка в аудите при пустом ответе.
 * Существующий свой номер и несуществующие номера аудита не создают.
 */
async function auditForeignRequestProbe(db: DataDb, ctx: DataCtx, rawQuery: string): Promise<void> {
  if (!isFullRequestNumberQuery(rawQuery)) return;
  const probed = await db.probeRequestByNumber(normalizeRequestNumber(rawQuery));
  if (!probed) return; // «нет» — молча (см. шапку)
  if (ctx.studentId === null || probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: probed.number,
      reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
    });
  }
}

export async function searchCabinet(
  db: DataDb,
  ctx: DataCtx,
  rawQuery: string,
): Promise<SearchResponse> {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) return { query: rawQuery, groups: [] };

  const isStudent = ctx.role === 'STUDENT' && ctx.studentId !== null && ctx.groupName !== null;
  const hits: SearchHit[] = [];

  // ── Действия: каталог сервисов роли сессии («Заказать справку») ──────────
  for (const service of servicesForRole(ctx.role)) {
    if (!matchService(service, rawQuery)) continue;
    hits.push({
      id: `action-${service.id}`,
      kind: 'action',
      title: service.title,
      subtitle: service.benefit,
      href: service.href,
    });
  }

  // ── Разделы: меню кабинета + страницы «Ещё» (без дублей по href) ─────────
  const seenSections = new Set<string>();
  for (const section of [...CABINET_SECTIONS, ...MORE_SECTIONS]) {
    if (seenSections.has(section.href)) continue;
    seenSections.add(section.href);
    if (!matchesSearchQuery(section.label, query)) continue;
    hits.push({
      id: `section${section.href.replaceAll('/', '-')}`,
      kind: 'section',
      title: section.label,
      subtitle: 'Раздел кабинета',
      href: section.href,
    });
  }

  // ── Заявки владельца: по публичному номеру (в т.ч. частичному) и названию ─
  // Одна выборка на весь поиск (DIG-45 р2: раньше звали дважды — на «Заявки»
  // и на «Людей»); адресный пробо чужого ПОЛНОГО номера — до фильтра выдачи.
  const numberish = isRequestNumberQuery(rawQuery);
  const numberQ = numberish ? normalizeRequestNumber(rawQuery) : '';
  const requests = isStudent ? await db.listRequestsByStudent(ctx.studentId!) : [];
  await auditForeignRequestProbe(db, ctx, rawQuery);
  for (const request of requests) {
    const numberMatch = numberish && request.number.startsWith(numberQ);
    const titleMatch = matchesSearchQuery(request.title, query);
    if (!numberMatch && !titleMatch) continue;
    hits.push({
      id: `request-${request.id}`,
      kind: 'request',
      title: request.title,
      subtitle: `№ ${request.number}`,
      href: `/requests/${request.number}`,
      meta: request.number,
    });
  }

  if (isStudent) {
    // ── Дисциплины своей группы: название, код, преподаватель ──────────────
    const disciplines = await db.listDisciplinesByGroup(ctx.groupName!);
    const people = new Map<string, SearchHit>();
    const addPerson = (name: string, subtitle: string, href: string) => {
      const key = normalizeSearchQuery(name);
      if (key === '' || people.has(key)) return;
      people.set(key, {
        id: `person-${key.replaceAll(' ', '-')}`,
        kind: 'person',
        title: name,
        subtitle,
        href,
      });
    };

    for (const discipline of disciplines) {
      const matched =
        matchesSearchQuery(discipline.disciplineName, query) ||
        matchesSearchQuery(discipline.disciplineCode, query) ||
        matchesSearchQuery(discipline.teacherName, query);
      if (matched) {
        hits.push({
          id: `discipline-${discipline.disciplineCode}`,
          kind: 'discipline',
          title: discipline.disciplineName,
          subtitle: `Преподаватель: ${discipline.teacherName}`,
          href: `/grades/${discipline.disciplineCode}`,
          meta: discipline.disciplineCode,
        });
      }
      // Преподаватели дисциплин группы — уже видимые студенту имена.
      if (matchesSearchQuery(discipline.teacherName, query)) {
        addPerson(discipline.teacherName, 'Преподаватель', '/schedule');
      }
    }

    // ── Люди: + исполнитель заявок (виден в карточках) + свой профиль ──────
    for (const request of requests) {
      if (request.assignee && matchesSearchQuery(request.assignee, query)) {
        addPerson(request.assignee, 'Деканат', '/deanery');
      }
    }
    const self = await db.findStudentById(ctx.studentId!);
    if (self && matchesSearchQuery(self.fullName, query)) {
      addPerson(self.fullName, 'Это вы', '/profile');
    }
    hits.push(...people.values());
  }

  // ── Вопросы и ответы (вымышленный FAQ, экран — DIG-38) ────────────────────
  for (const entry of FAQ_ENTRIES) {
    if (
      !matchesSearchQuery(entry.question, query) &&
      !matchesSearchQuery(entry.answer, query) &&
      !entry.tags.some((tag) => matchesSearchQuery(tag, query))
    ) {
      continue;
    }
    hits.push({
      id: entry.id,
      kind: 'faq',
      title: entry.question,
      subtitle: entry.answer,
      href: entry.href,
      meta: entry.tags.join(' '),
    });
  }

  // ── Новости деканата (экран — DIG-36; фид ведёт в уведомления, DIG-20) ───
  for (const news of listDeaneryNews()) {
    if (
      !hitMatchesSearch(
        {
          id: news.id,
          kind: 'news',
          title: news.title,
          href: '/notifications',
          subtitle: news.excerpt,
        },
        rawQuery,
      )
    ) {
      continue;
    }
    hits.push({
      id: `news-${news.id}`,
      kind: 'news',
      title: news.title,
      subtitle: news.excerpt,
      href: '/notifications',
    });
  }

  return { query: rawQuery, groups: buildGroups(hits, query) };
}
