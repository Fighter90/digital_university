// DIG-29 — «Каталог сервисов»: избранное (owner-scoped) и сборка страницы.
//
// Каталог сам по себе — публичный вымышленный контент (src/lib/services-catalog),
// а вот избранное — данные студента: обе функции скоупятся по ctx.studentId,
// сотруднику — отказ + AuditLog ROLE_MISMATCH (как у зачётки DIG-27).
// Ид сервисов валидируется белым списком каталога ДО записи: закрепить можно
// только сервис с ролью STUDENT — чужеролевой id отклоняется без записи.

import {
  findService,
  picksForCourse,
  MAX_FAVORITES,
  type ServiceEntry,
} from '@/lib/services-catalog';

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx } from './types';

export { MAX_FAVORITES };

const RESOURCE = 'service';

export interface ServicesPageData {
  /** Курс студента для заголовка «Часто нужно на N курсе»; сотрудник — null. */
  course: number | null;
  favorites: ServiceEntry[];
  picks: ServiceEntry[];
}

export interface ServiceToggleResult {
  ok: boolean;
  error?: string;
}

/** Закреплённое студентом, capped до MAX_FAVORITES, в порядке закрепления. */
export async function getServicesPage(db: DataDb, ctx: DataCtx): Promise<ServicesPageData> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'catalog',
      reason: 'ROLE_MISMATCH',
    });
    return { course: null, favorites: [], picks: [] };
  }

  const [student, favoriteIds] = await Promise.all([
    db.findStudentById(ctx.studentId),
    db.listFavoriteServiceIdsByStudent(ctx.studentId),
  ]);

  const favorites = favoriteIds
    .map((id) => findService(id))
    .filter((s): s is ServiceEntry => s !== null && s.audiences.includes('STUDENT'))
    .slice(0, MAX_FAVORITES);

  const favoriteSet = new Set(favorites.map((s) => s.id));
  const course = student?.course ?? null;
  const picks = course === null ? [] : picksForCourse(course).filter((s) => !favoriteSet.has(s.id));

  return { course, favorites, picks };
}

/** Toggle звёздочки избранного: лимит 6, whitelist каталога, идемпотентность. */
export async function toggleFavoriteService(
  db: DataDb,
  ctx: DataCtx,
  serviceId: string,
  on: boolean,
): Promise<ServiceToggleResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: serviceId,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const service = findService(serviceId);
  if (!service || !service.audiences.includes('STUDENT')) {
    // Неизвестный или чужеролевой id — некорректный ввод, без аудита
    // (каталог публичен, попытка доступа к чужому объекту здесь не фиксируется).
    return { ok: false, error: 'Такой сервис недоступен' };
  }

  if (on) {
    const ids = await db.listFavoriteServiceIdsByStudent(ctx.studentId);
    if (!ids.includes(serviceId) && ids.length >= MAX_FAVORITES) {
      return { ok: false, error: `В избранном не больше ${MAX_FAVORITES} сервисов` };
    }
    await db.addFavoriteServiceByStudent(ctx.studentId, serviceId);
  } else {
    await db.removeFavoriteServiceByStudent(ctx.studentId, serviceId);
  }
  return { ok: true };
}
