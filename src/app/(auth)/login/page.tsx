// DIG-11 — login page: server component that resolves the safe `?next=`
// target and redirects users who already have a live session.
// Visual redesign — DIG-18 (Figma «02 · Вход»).
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getAuthSession } from '@/server/auth/session';
import { ensureAppData } from '@/server/data/bootstrap';
import { safeNextPath } from '@/lib/route-guard';

export const metadata = { title: 'Вход — Цифровой деканат' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // NOTE(DIG-12): пока прототип работает на in-memory сторе, демо-данные
  // (вымышленные Анна/Илья/Мария) должны существовать ДО первой попытки входа.
  // При переходе на PostgreSQL (DIG-18+) это заменит prisma/seed.ts.
  await ensureAppData();

  const auth = await getAuthSession();
  if (auth) redirect('/dashboard');

  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm next={next} />
    </main>
  );
}
