// DIG-47 — публичная карточка результата проверки справки /verify/<код>.
//
// Договор экрана (задача DIG-47): РОВНО ТРИ статуса документа —
// «Документ действителен» (зелёный), «Не найден» (нейтральный),
// «Отозван» (красный) — плюс служебное состояние rate limit'а. Видны
// только: тип документа, дата выдачи, ФИО частично и статус. Оценок,
// контактов, полного имени и прочих данных здесь нет и быть не может:
// значение приходит из слоя данных (verifyCertificateByCode), который
// отдаёт публичное представление без PII.
//
// Компонент чистый (без next/*) — рендер-контракт закреплён
// tests/verify-page.test.tsx через react-dom/static. Плашка «Концепт
// для конкурса» рендерится общим корневым layout'ом (src/app/layout.tsx)
// и сюда не дублируется.

export type VerifyViewState = 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'RATE_LIMITED';

export interface VerifyResultProps {
  state: VerifyViewState;
  documentType?: string | null;
  issuedAt?: Date | null;
  holderName?: string | null;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const STATUS_PILL: Record<VerifyViewState, { label: string; className: string } | null> = {
  VALID: {
    label: 'Документ действителен',
    className: 'border-green-200 bg-green-50 text-green-800',
  },
  REVOKED: {
    label: 'Отозван',
    className: 'border-red-200 bg-red-50 text-red-800',
  },
  NOT_FOUND: {
    label: 'Документ не найден',
    className: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  },
  RATE_LIMITED: {
    label: 'Слишком много попыток',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
};

const STATUS_NOTE: Record<VerifyViewState, string> = {
  VALID: 'Документ найден в реестре деканата и не отозван.',
  REVOKED: 'Документ был выдан, но отозван деканатом: полагаться на него нельзя.',
  NOT_FOUND: 'Код не найден в реестре, истёк или введён с ошибкой.',
  RATE_LIMITED: 'Подождите несколько минут и попробуйте снова.',
};

export function VerifyResultView({ state, documentType, issuedAt, holderName }: VerifyResultProps) {
  const pill = STATUS_PILL[state]!;
  const showDocument = state === 'VALID' || state === 'REVOKED';

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="mb-1 text-xl font-bold sm:text-2xl">Проверка подлинности справки</h1>
        <p className="mb-6 text-sm text-neutral-600">
          Страница для получателя документа (банк, ведомство, работодатель). Вход не нужен:
          достаточно кода из QR-кода на справке.
        </p>

        <div
          data-testid="verify-status"
          className={`mb-6 rounded-2xl border p-5 text-center ${pill.className}`}
        >
          <p className="text-lg font-bold">{pill.label}</p>
          <p className="mt-1 text-sm opacity-80">{STATUS_NOTE[state]}</p>
        </div>

        {showDocument ? (
          <dl className="mb-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-card p-5">
            <div>
              <dt className="text-xs text-neutral-500">Тип документа</dt>
              <dd data-testid="verify-type" className="text-sm font-medium text-neutral-900">
                {documentType ?? '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Держатель (ФИО частично)</dt>
              <dd data-testid="verify-holder" className="text-sm font-medium text-neutral-900">
                {holderName ?? '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Дата выдачи</dt>
              <dd data-testid="verify-issued" className="text-sm font-medium text-neutral-900">
                {issuedAt ? dateFormatter.format(issuedAt) : '-'}
              </dd>
            </div>
          </dl>
        ) : null}

        <details className="mb-6 rounded-2xl border border-neutral-200 bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium text-neutral-900">
            Как проверить документ
          </summary>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-neutral-700">
            <li>Отсканируйте QR-код со справки камерой телефона — откроется эта страница.</li>
            <li>Или введите код проверки вручную в адрес страницы /verify/КОД.</li>
            <li>Сверьте тип документа, дату выдачи и фамилию с инициалами с бумажной версией.</li>
            <li>
              Статус «Отозван» означает, что документ недействителен, даже если он выглядит
              подлинным.
            </li>
          </ol>
        </details>

        <p className="text-xs text-neutral-500">
          Проверка безопасна: по коду виден только статус и минимальные реквизиты — без оценок,
          контактов и прочих персональных данных.
        </p>
      </main>
    </div>
  );
}
