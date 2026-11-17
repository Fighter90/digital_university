// DIG-41 — финансовый экран студента («Договоры и оплата», /finance).
//
// Содержимое — демонстрационный каталог (lib/finance-catalog) по форме
// обучения владельца: скоуп строится из живой сессии (requireDataCtx),
// studentId в ctx — единственный ключ выборки, из URL он не приходит
// (IDOR невозможен по построению). Сотруднику деканата студенческие
// финансы не показываются: отказ + AuditLog ROLE_MISMATCH (как у зачётки
// DIG-27 и каталога сервисов DIG-29).

import { financeBundleFor, type FinanceBundle } from '@/lib/finance-catalog';

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx } from './types';

const RESOURCE = 'finance';

export interface FinanceStudentView {
  fullName: string;
  groupName: string;
  /** Форма финансирования из профиля («бюджет» / «контракт»); null — не ведётся. */
  funding: string | null;
}

export interface FinancePageData {
  /** null — сотруднику (пустое состояние на странице). */
  student: FinanceStudentView | null;
  bundle: FinanceBundle | null;
}

/** Один серверный агрегат страницы: профиль + демо-набор финансов. */
export async function getFinancePage(db: DataDb, ctx: DataCtx): Promise<FinancePageData> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'page',
      reason: 'ROLE_MISMATCH',
    });
    return { student: null, bundle: null };
  }

  const student = await db.findStudentById(ctx.studentId);
  if (!student) {
    // Профиль не резолвится — контекст должен был отсеять это на входе;
    // fail closed: пустой ответ без данных (без аудита — не попытка чужого).
    return { student: null, bundle: null };
  }

  return {
    student: {
      fullName: student.fullName,
      groupName: student.groupName,
      funding: student.funding,
    },
    bundle: financeBundleFor(student.funding, new Date()),
  };
}
