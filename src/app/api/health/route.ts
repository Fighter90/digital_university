import { NextResponse } from 'next/server';
import { authStoreKind } from '@/server/auth/store';

export const dynamic = 'force-dynamic';

// DIG-50: вместе с ok публикует активный auth-store (prisma | memory), чтобы
// ops/security могли проверить на проде: memory-store не активен при
// заданном DATABASE_URL. Никаких секретов и идентификаторов здесь нет.
export function GET() {
  return NextResponse.json({ ok: true, authStore: authStoreKind });
}
