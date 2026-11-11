// DIG-11 — server actions for sign-in / sign-out.
// Next.js protects Server Actions against CSRF out of the box (Origin/Host
// check on every POST to an action endpoint); the raw token never leaves the
// HttpOnly cookie, and no password material is ever logged here.
'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signInWithDefaults } from '@/server/auth/store';
import { signOutAllDevices, signOutCurrentSession } from '@/server/auth/session';
import {
  buildRoleHintCookie,
  buildSessionCookie,
  buildClearedRoleHintCookie,
} from '@/server/auth/cookies';
import { signRoleHint } from '@/server/auth/role-cookie';
import { ERROR_MESSAGES } from '@/server/auth/login';
import { safeNextPath } from '@/lib/route-guard';

const credentialsSchema = z.object({
  login: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export type SignInFormState = { error: string } | null;

export async function signInAction(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const parsed = credentialsSchema.safeParse({
    login: String(formData.get('login') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) {
    return { error: ERROR_MESSAGES.INVALID_CREDENTIALS };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = requestHeaders.get('user-agent');

  const result = await signInWithDefaults({
    login: parsed.data.login,
    password: parsed.data.password,
    ip,
    userAgent,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  const jar = await cookies();
  jar.set(buildSessionCookie(result.token));

  // Signed role hint for the middleware's cheap /staff gate; real role checks
  // always re-read the session server-side (requireStaff / requireUser).
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    jar.set(buildRoleHintCookie(await signRoleHint(result.user.role, result.user.id, secret)));
  } else {
    jar.set(buildClearedRoleHintCookie());
  }

  redirect(safeNextPath(String(formData.get('next') ?? '')) ?? '/dashboard');
}

export async function signOutAction(): Promise<void> {
  await signOutCurrentSession();
  redirect('/login');
}

export async function signOutAllDevicesAction(): Promise<void> {
  await signOutAllDevices();
  redirect('/login');
}
