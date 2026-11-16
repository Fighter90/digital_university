// DIG-33 — поле ввода кода проверки на публичном лендинге /verify.
// Ввод нормализуется тем же normalizeVerificationCode, что и страница
// /verify/<код> (регистр, дефисы, пробелы) — человек может вставить код
// в любом начертании. Невалидный ввод просто не отправляется (подсказка),
// страницу /verify/<код> защищает её собственный rate limit.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { normalizeVerificationCode } from '@/lib/verify';

export function VerifyCodeForm() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const code = normalizeVerificationCode(value);
    if (!code) {
      setError('Код — 32 символа A–Z и 2–7, разделители не обязательны');
      return;
    }
    setError(null);
    router.push(`/verify/${encodeURIComponent(code)}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="verify-code" className="text-xs font-semibold text-foreground">
        Код проверки из документа
      </label>
      <input
        id="verify-code"
        name="code"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        data-testid="verify-code-input"
        autoComplete="off"
        spellCheck={false}
        placeholder="ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777"
        className="w-full rounded-button border border-border bg-background px-3 py-2 font-mono text-sm uppercase text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
      />
      {error ? (
        <p role="alert" className="text-xs text-error-ink">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        data-testid="verify-code-submit"
        className="mt-1 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        Проверить документ
      </button>
    </form>
  );
}
