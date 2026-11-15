// DIG-66 — серверная часть «Что изменилось» (AI-объяснение динамики оценок).
//
// Доступ: ctx строится из живой сессии (requireDataCtx) — выборки скоуплены
// ctx.studentId (свои оценки) и ctx.groupName (справочники группы), из URL
// идентификаторы не приходят (IDOR невозможен по построению). Сотрудник без
// studentId — null + аудит ROLE_MISMATCH, тот же контракт, что у остальных
// студенческих агрегатов (performance.ts / grades.ts).
//
// Расчёт и тексты — чистая функция buildGradeInsight (src/lib/grade-insight.ts),
// формулы совпадают с GPA-кольцом сводки (требование «данные совпадают
// с успеваемостью»).

import { buildGradeInsight, type GradeInsight } from '@/lib/grade-insight';
import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx } from './types';

const RESOURCE = 'grade-insight';

/**
 * Инсайт динамики оценок для экрана «Успеваемость»: тренд среднего балла
 * семестра последней оценки с разбором работ месяца. Без оценок — null
 * (карточка не рендерится); сотрудник — null + аудит.
 */
export async function getGradeInsight(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
): Promise<GradeInsight | null> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'insight',
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  const [grades, disciplines, elements] = await Promise.all([
    db.listGradesByStudent(ctx.studentId),
    db.listDisciplinesByGroup(ctx.groupName),
    db.listDisciplineElementsByGroup(ctx.groupName),
  ]);

  return buildGradeInsight({ grades, disciplines, plan: elements, now });
}
