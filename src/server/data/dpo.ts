// DIG-42 — «Дополнительное образование» (/dpo): каталог программ, записи
// студента («Мои программы») и документы (договор/акт/квитанция/сертификат).
//
// IDOR-контракт (как у msp.ts): контекст строится из живой сессии
// (requireDataCtx). ЧТЕНИЕ каталога — любой вошедший (программа — публичный
// контент без персональных данных, осознанное исключение из owner-scope как
// listMspProjects). ЗАПИСЬ и чтение МОИХ программ/документов — owner-scoped:
// скоуп — ctx.studentId (никогда ввод). Зачисляемости нет: «Записаться»
// ставит строку записи владельца, UNIQUE пара программа+студент — дубль
// невозможен (enrollDpo → null). ROLE_MISMATCH-аудит не нужен (раздел только
// в студенческом меню, сотруднику — мягкий отказ без аудита); попытка записи
// на несуществующую программу — отказ с аудитом NOT_FOUND (единый контракт с
// msp: различие живёт только в AuditLog).

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx, DpoDocumentRow, DpoEnrollmentRow, DpoFormat, DpoProgramRow } from './types';

const RESOURCE = 'dpo-program';

/** Фильтр каталога по формату: query-параметр ?format= (по умолчанию «Все»). */
export type DpoFormatFilter = DpoFormat | 'ALL';

/** Программа в представлении каталога: строка + отметка «уже записан». */
export interface DpoCatalogView {
  program: DpoProgramRow;
  /** Текущий владелец уже записан — кнопка «Записаться» отключена. */
  enrolledByMe: boolean;
}

/** Моя программа: запись владельца + данные программы (join слоя). */
export interface DpoMyProgramView {
  enrollment: DpoEnrollmentRow;
  program: DpoProgramRow;
}

/** Парсинг query-параметра формата: всё неизвестное — «Все». */
export function parseDpoFormat(raw: string | string[] | undefined): DpoFormatFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'ONLINE' || value === 'OFFLINE' || value === 'HYBRID' ? value : 'ALL';
}

/** Фильтрация каталога чипами формата («Все» не фильтрует). */
export function filterDpoCatalog(
  views: DpoCatalogView[],
  format: DpoFormatFilter,
): DpoCatalogView[] {
  return format === 'ALL' ? views : views.filter((view) => view.program.format === format);
}

/**
 * Каталог /dpo (вкладка «Каталог программ»): программы + отметки «уже
 * записан» владельца. Чтение — любой вошедший (сотрудник видит каталог без
 * отметок записей).
 */
export async function getDpoCatalog(db: DataDb, ctx: DataCtx): Promise<DpoCatalogView[]> {
  const [programs, myEnrollments] = await Promise.all([
    db.listDpoPrograms(),
    ctx.studentId === null ? Promise.resolve([]) : db.listDpoEnrollmentsByStudent(ctx.studentId),
  ]);
  const myProgramIds = new Set(myEnrollments.map((e) => e.programId));
  return programs.map((program) => ({
    program,
    enrolledByMe: myProgramIds.has(program.id),
  }));
}

/**
 * «Мои программы»: записи владельца сессии, свежие записи первыми.
 * Сотруднику (studentId null) — пустой список (раздел студенческий).
 */
export async function getDpoMyPrograms(db: DataDb, ctx: DataCtx): Promise<DpoMyProgramView[]> {
  if (ctx.studentId === null) return [];
  const [programs, enrollments] = await Promise.all([
    db.listDpoPrograms(),
    db.listDpoEnrollmentsByStudent(ctx.studentId),
  ]);
  const byId = new Map(programs.map((p) => [p.id, p]));
  return enrollments
    .map((enrollment) => {
      const program = byId.get(enrollment.programId);
      return program ? { enrollment, program } : null;
    })
    .filter((view): view is DpoMyProgramView => view !== null)
    .sort((a, b) => b.enrollment.enrolledAt.getTime() - a.enrollment.enrolledAt.getTime());
}

/**
 * «Документы» владельца сессии, свежие первыми. Owner-scoped по
 * ctx.studentId — чужие строки наружу не проходят никогда; сотруднику —
 * пустой список (без аудита: раздел не в меню сотрудника).
 */
export async function getDpoDocuments(db: DataDb, ctx: DataCtx): Promise<DpoDocumentRow[]> {
  if (ctx.studentId === null) return [];
  const [documents, programs] = await Promise.all([
    db.listDpoDocumentsByStudent(ctx.studentId),
    db.listDpoPrograms(),
  ]);
  // Документы без программы (разрыв сида) не рвут экран — фильтруются.
  const programIds = new Set(programs.map((p) => p.id));
  return documents.filter((d) => programIds.has(d.programId));
}

export type EnrollDpoResult = { ok: true; program: DpoProgramRow } | { ok: false; error: string };

/**
 * Запись владельца на программу ДПО. Студенту — его запись; сотруднику —
 * отказ (без аудита ROLE_MISMATCH: раздел только в студенческом меню);
 * несуществующая программа — отказ с аудитом NOT_FOUND; уже записан — отказ
 * без мутации (UNIQUE пара программа+студент в адаптере).
 */
export async function enrollDpoProgram(
  db: DataDb,
  ctx: DataCtx,
  programId: string,
): Promise<EnrollDpoResult> {
  if (ctx.studentId === null) {
    return { ok: false, error: 'Записываться на программы могут только студенты' };
  }
  const programs = await db.listDpoPrograms();
  const program = programs.find((p) => p.id === programId) ?? null;
  if (!program) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: programId,
      reason: 'NOT_FOUND',
    });
    return { ok: false, error: 'Программа не найдена' };
  }
  const enrollment = await db.enrollDpo(ctx.studentId, programId);
  if (!enrollment) return { ok: false, error: 'Вы уже записаны на эту программу' };
  return { ok: true, program };
}
