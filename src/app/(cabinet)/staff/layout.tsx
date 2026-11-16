// DIG-48 — каркас кабинета сотрудника: /staff* защищены middleware (403
// студенту), здесь — серверная перепроверка роли по живой сессии
// (defense-in-depth) и общая поднавигация разделов деканата.
import { redirect } from 'next/navigation';
import { requireDataCtx } from '@/server/data';
import { StaffNav } from '@/components/staff/staff-nav';

export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireDataCtx('/staff');
  if (ctx.role !== 'STAFF') redirect('/dashboard');

  return (
    <section className="mx-auto w-full max-w-5xl">
      <StaffNav />
      {children}
    </section>
  );
}
