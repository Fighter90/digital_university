// DIG-47 — реестр справок и публичная проверка подлинности.
//
// Три контракта (каждый закреплён tests/verify-data.test.ts):
//
//  1. verifyCertificateByCode — публичное чтение БЕЗ входа по коду
//     (160 бит base32). Наружу уходит ТОЛЬКО публичное представление:
//     статус, тип документа, дата выдачи и ФИО маской. Полное имя,
//     studentId, программа и прочее через этот контракт не проходят.
//     Истёкшая справка и неверный формат кода отвечают тем же
//     NOT_FOUND (нет «оракула» существования/формата).
//
//  2. getOrCreateCertificateForRequest — выдача справки владельцу
//     выполненной заявки типа CERTIFICATE. Idемпотентно: один код на
//     заявку, чтобы QR оставался действительным. Чужая заявка/роль —
//     единый null + аудит (как во всём слое DIG-12).
//
//  3. revokeCertificateByCode — отзыв ТОЛЬКО сотрудником (STAFF),
//     только в пределах своего факультета; идемпотентен.

import {
  certificateStatusFor,
  generateVerificationCode,
  maskFullName,
  normalizeVerificationCode,
} from '@/lib/verify';
import { denyAccess } from './access';
import type { DataDb } from './port';
import type { CertificateRow, DataCtx, ServiceRequestRow } from './types';

const RESOURCE = 'certificate';

/** Срок действия справки в реестре (дней) — печатается на документе. */
export const CERTIFICATE_VALIDITY_DAYS = 365;

/** Публичное представление справки — ровно то, что видит получатель. */
export interface CertificatePublicView {
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND';
  documentType: string | null;
  issuedAt: Date | null;
  holderName: string | null;
}

const notFoundView: CertificatePublicView = {
  status: 'NOT_FOUND',
  documentType: null,
  issuedAt: null,
  holderName: null,
};

/** Номер справки «СП-ГГГГ-NNNNNN»; `random` инъецируется для тестов. */
export function newCertificateNumber(
  now: Date = new Date(),
  random: () => number = Math.random,
): string {
  const digits = Array.from({ length: 6 }, () => Math.floor(random() * 10)).join('');
  return `СП-${now.getFullYear()}-${digits}`;
}

/**
 * Публичная проверка справки по коду (страница /verify/<код>).
 * Работает без входа: код — криптографический 160-битный ключ.
 */
export async function verifyCertificateByCode(
  db: DataDb,
  rawCode: string,
  now: Date,
): Promise<CertificatePublicView> {
  const code = normalizeVerificationCode(rawCode);
  if (!code) return notFoundView;

  const row = await db.findCertificateByCode(code);
  if (!row) return notFoundView;

  const status = certificateStatusFor(row, now);
  if (status === 'EXPIRED') return notFoundView; // вышла из реестра

  const student = await db.findStudentById(row.studentId);
  return {
    status,
    documentType: row.documentType,
    issuedAt: row.issuedAt,
    holderName: student ? maskFullName(student.fullName) : null,
  };
}

/**
 * Справка выполненной заявки-справки владельца. Возвращает существующую
 * строку или выдаёт новую (код/номер генерируются здесь). null — заявка
 * не даёт права на справку (не CERTIFICATE или не COMPLETED) либо
 * нарушение скоупа (чужая заявка / сотрудник) — с записью в аудит.
 */
export async function getOrCreateCertificateForRequest(
  db: DataDb,
  ctx: DataCtx,
  request: ServiceRequestRow,
  now: Date,
): Promise<CertificateRow | null> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: request.number,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  // Защита в глубину: строка заявки перепроверяется по владельцу —
  // контрактом слоя вызывающий мог передать только свой запрос, но
  // IDOR исключается по построению, а не по дисциплине вызывающего.
  if (request.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: request.number,
      reason: 'OWNERSHIP_DENIED',
    });
    return null;
  }
  if (request.type !== 'CERTIFICATE' || request.status !== 'COMPLETED') {
    return null; // справка не выдана: нет ни отказа доступа, ни выдачи
  }

  const existing = await db.findCertificateByStudentAndRequestId(ctx.studentId, request.id);
  if (existing) return existing;

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + CERTIFICATE_VALIDITY_DAYS);
  const row: CertificateRow = {
    id: '',
    studentId: ctx.studentId,
    requestId: request.id,
    documentType: request.title,
    purpose: null,
    number: newCertificateNumber(now),
    verificationCode: generateVerificationCode(),
    issuedAt: now,
    expiresAt,
    revokedAt: null,
    revokedReason: null,
  };
  return db.appendCertificateForStudent(ctx.studentId, row);
}

/** Данные PDF-шаблона справки (всё, что печатается на документе). */
export interface CertificatePdfInput {
  documentType: string;
  number: string;
  issuedAt: Date;
  fullName: string;
  program: string;
  course: number;
  studyForm: string;
  purpose: string | null;
  verificationCode: string;
}

/**
 * Данные PDF справки заявки владельца: справка + профиль студента
 * (профиль читается по ctx.studentId — никогда не по вводу). null —
 * справка не выдана или нарушение скоупа.
 */
export async function getCertificatePdfInput(
  db: DataDb,
  ctx: DataCtx,
  request: ServiceRequestRow,
  now: Date,
): Promise<CertificatePdfInput | null> {
  const cert = await getOrCreateCertificateForRequest(db, ctx, request, now);
  if (!cert) return null;
  const student = await db.findStudentById(ctx.studentId!);
  if (!student) return null; // fail closed: нет профиля — нет документа
  return {
    documentType: cert.documentType,
    number: cert.number,
    issuedAt: cert.issuedAt,
    fullName: student.fullName,
    program: student.program,
    course: student.course,
    studyForm: student.studyForm,
    purpose: cert.purpose,
    verificationCode: cert.verificationCode,
  };
}

/** Вход отзыва: момент и причина. */
export interface RevokeCertificateInput {
  revokedAt: Date;
  reason: string | null;
}

/**
 * Отзыв справки по коду. Только STAFF, только свой факультет;
 * идемпотентен. Нарушения — единый null + аудит.
 */
export async function revokeCertificateByCode(
  db: DataDb,
  ctx: DataCtx,
  rawCode: string,
  input: RevokeCertificateInput,
): Promise<CertificateRow | null> {
  const auditDenial = async (reason: 'ROLE_MISMATCH' | 'NOT_FOUND' | 'OWNERSHIP_DENIED') => {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: rawCode, reason });
  };

  if (ctx.role !== 'STAFF' || ctx.faculty === null) {
    await auditDenial('ROLE_MISMATCH');
    return null;
  }
  const code = normalizeVerificationCode(rawCode);
  const probed = code ? await db.findCertificateByCode(code) : null;
  if (!probed) {
    await auditDenial('NOT_FOUND');
    return null;
  }
  const revoked = await db.revokeCertificateByStaff(ctx.faculty, code!, input);
  if (!revoked) {
    await auditDenial('OWNERSHIP_DENIED');
    return null;
  }
  return revoked;
}
