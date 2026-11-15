// DIG-32 — агрегатор экрана «Мои заявки»: карточки-виды для клиента.
//
// IDOR-контракт (как весь слой DIG-12): контекст из живой сессии
// (requireDataCtx на странице), оба списка читаются ТОЛЬКО через
// сервисные функции слоя — listCanonicalRequestsByStudent (DIG-30) и
// listRequests (DIG-12): владение скоупится по ctx.studentId, а чтению
// сотрудника отвечает [] + аудит ROLE_MISMATCH. Экран не добавляет
// новых путей к данным и не обходит аудит.
//
// В прототипе два хранилища заявок: канонические «ЗД-…» (DIG-30) и
// legacy-панели кабинета «SR-…» (DIG-12, на них завязан e2e-контракт
// изоляции данных). Экран показывает обе едиными карточками и ЕДИНЫМ
// словарём статусов: unifyRequestStatus отображает легаси-значения на
// канон до рендера, поэтому UI не знает про «Выполнена/Требует правок».
import {
  legacyTypeIcon,
  nextActionLine,
  requestAction,
  requestIconKindForTypeCode,
  unifyRequestStatus,
  type RequestCardView,
  type UnifiedRequestStatus,
} from '../../lib/requests-view';
import { formatRequestDate } from '../../lib/request-labels';
import { slaReadyDate } from '../../lib/request-sla';
import { listCanonicalRequestsByStudent } from './canonical-requests';
import { listRequests } from './requests';
import type { DataDb } from './port';
import type {
  CanonicalRequestEventRow,
  CanonicalRequestRow,
  DataCtx,
  ServiceRequestRow,
} from './types';

/** Последний по времени комментарий событий — причина доработки/отказа. */
function latestReason(events: CanonicalRequestEventRow[]): string | null {
  let reason: string | null = null;
  let at = -Infinity;
  for (const event of events) {
    const comment = event.comment?.trim() ?? '';
    if (comment && event.createdAt.getTime() >= at) {
      reason = comment;
      at = event.createdAt.getTime();
    }
  }
  return reason;
}

/** SLA-дата готовности показывается, пока заявка движется по конвейеру. */
function pipelineReadyBy(
  status: UnifiedRequestStatus,
  createdAt: Date,
  etaDays: number | null,
): Date | null {
  if (!['SUBMITTED', 'ACCEPTED', 'IN_PROGRESS'].includes(status)) return null;
  return slaReadyDate(createdAt, etaDays);
}

function viewFromCanonical(
  row: CanonicalRequestRow,
  etaDays: number | null,
  reason: string | null,
): RequestCardView {
  const status = unifyRequestStatus(row.status);
  const readyBy = pipelineReadyBy(status, row.createdAt, etaDays);
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    typeName: row.typeName,
    iconKind: requestIconKindForTypeCode(row.typeCode),
    status,
    createdAtISO: row.createdAt.toISOString(),
    createdAtLabel: formatRequestDate(row.createdAt),
    readyByISO: readyBy ? readyBy.toISOString() : null,
    readyByLabel: readyBy ? formatRequestDate(readyBy) : null,
    updatedAtISO: row.updatedAt.toISOString(),
    action: requestAction(status),
    pipelineStep: null, // шаги конвейера вычисляет requests-view при рендере
    nextAction: nextActionLine({ status, readyBy, reason, updatedAt: row.updatedAt }),
    reason,
    isFix: status === 'NEEDS_FIX',
  };
}

function viewFromLegacy(row: ServiceRequestRow): RequestCardView {
  const status = unifyRequestStatus(row.status);
  const reason = row.resultNote?.trim() ? row.resultNote.trim() : null;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    typeName: row.type,
    iconKind: legacyTypeIcon(row.type),
    status,
    createdAtISO: row.createdAt.toISOString(),
    createdAtLabel: formatRequestDate(row.createdAt),
    readyByISO: null,
    readyByLabel: null,
    updatedAtISO: row.updatedAt.toISOString(),
    action: requestAction(status),
    pipelineStep: null,
    nextAction: nextActionLine({ status, readyBy: null, reason, updatedAt: row.updatedAt }),
    reason,
    isFix: status === 'NEEDS_FIX',
  };
}

export interface RequestsScreenData {
  /** Карточки владельца ctx; сотруднику — [] (чтения аудируются слоем). */
  cards: RequestCardView[];
}

/** Все заявки владельца едиными карточками (канон + legacy, один словарь). */
export async function getRequestsScreen(db: DataDb, ctx: DataCtx): Promise<RequestsScreenData> {
  // Оба чтения owner-scoped: студент получает только своё, сотруднику []
  // с аудитом ROLE_MISMATCH внутри каждого вызова.
  const [canonical, legacy, types] = await Promise.all([
    listCanonicalRequestsByStudent(db, ctx),
    listRequests(db, ctx),
    db.listCanonicalRequestTypes(),
  ]);

  const etaByCode = new Map(types.map((type) => [type.code, type.etaDays]));

  const cards: RequestCardView[] = [];
  for (const row of canonical) {
    // Причина доработки/отказа живёт в событиях — читаем только для них.
    const reason =
      row.status === 'NEEDS_FIX' || row.status === 'REJECTED'
        ? latestReason((await db.listCanonicalRequestEvents(row.id)) ?? [])
        : null;
    cards.push(viewFromCanonical(row, etaByCode.get(row.typeCode) ?? null, reason));
  }
  for (const row of legacy) cards.push(viewFromLegacy(row));
  return { cards };
}
