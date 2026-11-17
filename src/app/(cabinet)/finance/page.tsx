// DIG-41 — экран «Договоры и оплата» (/finance, Figma «12 · Финансы»).
//
// Единое место финансовых данных студента: сводка (форма обучения,
// стипендия, задолженность), договор платника с таймлайном платежей,
// документы с фильтром и скачиванием демо-PDF, история выплат и действия
// → мастер заявки. Только демонстрационные данные: реальная оплата не
// проводится, платёжных форм и реквизитов нет (критерий приёмки).
//
// Данные — одним серверным агрегатом getFinancePage(dataDb, ctx); контекст
// строится из живой сессии (requireDataCtx) — студенческий bundle всегда
// свой, сотруднику — пустое состояние + аудит (IDOR невозможен по
// построению). Содержимое каталога строится по форме финансирования
// владельца: у бюджетника экран не пустой (стипендия и выплаты).
import Link from 'next/link';
import {
  BadgeCheck,
  CalendarClock,
  Download,
  FileSignature,
  GraduationCap,
  ReceiptText,
  Wallet,
} from 'lucide-react';

import { requireDataCtx, getFinancePage } from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  FINANCE_ACTIONS,
  PAYMENT_STATUS_LABELS,
  PAYOUT_KIND_LABELS,
  formatFinanceDate,
  formatFinanceDateFull,
  formatMoney,
} from '@/lib/finance-catalog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FinanceDocumentsBrowser } from '@/components/finance/documents-browser';

export const metadata = { title: 'Финансы — Цифровой деканат' };

/** Бейдж статуса платежа (мягкие тона словаря DIG-13). */
function paymentBadge(status: 'PAID' | 'DUE' | 'UPCOMING') {
  switch (status) {
    case 'PAID':
      return <Badge status="success">{PAYMENT_STATUS_LABELS.PAID}</Badge>;
    case 'DUE':
      return <Badge status="error">{PAYMENT_STATUS_LABELS.DUE}</Badge>;
    default:
      return <Badge status="neutral">{PAYMENT_STATUS_LABELS.UPCOMING}</Badge>;
  }
}

export default async function FinancePage() {
  const ctx = await requireDataCtx('/finance');
  const data = await getFinancePage(dataDb, ctx);

  // Сотруднику деканата студенческие финансы не показываются (агрегат
  // вернул отказ с аудитом ROLE_MISMATCH) — явное пустое состояние.
  if (!data.student || !data.bundle) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
        <h1 className="text-xl font-bold sm:text-2xl">Финансы</h1>
        <EmptyState
          className="mt-6"
          icon={Wallet}
          title="Экран доступен студентам"
          description="Договоры, стипендии и выплаты показываются в кабинете студента."
        />
      </section>
    );
  }

  const { bundle } = data;
  const { summary, contract } = bundle;
  const paidAmount = (contract?.payments ?? [])
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <h1 className="text-xl font-bold sm:text-2xl">Финансы</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Договоры, стипендии и документы — демонстрационные данные, оплата через кабинет не
        проводится.
      </p>

      {/* ── Сводка: форма обучения, стипендия, задолженность ─────────────── */}
      <div
        data-testid="finance-summary"
        className="mt-4 rounded-card border border-border bg-card p-5 shadow-soft"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <GraduationCap aria-hidden="true" className="size-4" />
            Форма обучения
          </p>
          {summary.isContract ? (
            <Badge status="accent">{summary.fundingLabel}</Badge>
          ) : (
            <Badge status="success">{summary.fundingLabel}</Badge>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Стипендия</p>
            <p className="mt-0.5 text-sm font-semibold">{summary.scholarship.kindLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ближайшая выплата — {formatFinanceDate(summary.scholarship.nextPayoutAt)}
            </p>
          </div>
          <p className="shrink-0 text-lg font-extrabold tracking-heading">
            {formatMoney(summary.scholarship.monthlyAmount)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">в месяц</span>
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-sm font-medium text-muted-foreground">Задолженность</p>
          {summary.debt ? (
            <Badge status="error">
              <CalendarClock aria-hidden="true" className="size-3.5" />К оплате{' '}
              {formatMoney(summary.debt.amount)} до {formatFinanceDate(summary.debt.dueAt)}
            </Badge>
          ) : (
            <Badge status="success">
              <BadgeCheck aria-hidden="true" className="size-3.5" />
              Задолженности нет
            </Badge>
          )}
        </div>
      </div>

      {/* ── Договор на обучение (только платное) ──────────────────────────── */}
      {contract ? (
        <div
          data-testid="finance-contract"
          className="mt-6 rounded-card border border-border bg-card p-5 shadow-soft"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold tracking-heading">Договор на обучение</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                № {contract.number}
                <span aria-hidden="true"> · </span>
                подписан {formatFinanceDateFull(contract.signedAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">{contract.semesterLabel}</p>
              <p className="text-base font-extrabold tracking-heading">
                {formatMoney(contract.semesterCost)}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-muted-foreground">Оплачено</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground">{formatMoney(paidAmount)}</span>
                {` из ${formatMoney(contract.semesterCost)}`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Оплачено по договору"
              aria-valuemin={0}
              aria-valuemax={contract.semesterCost}
              aria-valuenow={paidAmount}
              className="mt-2 h-2.5 overflow-hidden rounded-pill bg-muted"
            >
              <div
                className="h-full rounded-pill bg-accent transition-[width]"
                style={{ width: `${Math.min(100, (paidAmount / contract.semesterCost) * 100)}%` }}
              />
            </div>
          </div>

          {/* График платежей таймлайном */}
          <ol className="mt-5 flex flex-col">
            {contract.payments.map((payment, index) => (
              <li
                key={payment.id}
                data-testid="finance-payment"
                className="flex gap-3 pb-5 last:pb-0"
              >
                <div className="flex flex-col items-center" aria-hidden="true">
                  <span
                    className={`mt-1.5 size-3 shrink-0 rounded-pill ${
                      payment.status === 'PAID'
                        ? 'bg-success'
                        : payment.status === 'DUE'
                          ? 'bg-error'
                          : 'bg-muted-foreground/40'
                    }`}
                  />
                  {index < contract.payments.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold">{payment.label}</p>
                    <p className="text-sm font-bold">{formatMoney(payment.amount)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{payment.periodLabel}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {paymentBadge(payment.status)}
                    {payment.status === 'DUE' ? (
                      <span className="text-xs text-muted-foreground">
                        до {formatFinanceDate(payment.dueAt)}
                      </span>
                    ) : null}
                    {payment.status === 'PAID' && payment.receiptId ? (
                      <a
                        href={`/api/finance/documents/${payment.receiptId}`}
                        download
                        data-testid="finance-receipt-download"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-coral-600"
                      >
                        <Download aria-hidden="true" className="size-3.5" />
                        Скачать квитанцию
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* ── Документы: договоры, допсоглашения, акты, квитанции, счета ────── */}
      <section aria-labelledby="finance-documents-heading" className="mt-8">
        <h2 id="finance-documents-heading" className="text-base font-extrabold tracking-heading">
          Документы
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Демонстрационные копии: договоры, допсоглашения, акты, квитанции и счета.
        </p>
        <div className="mt-3">
          <FinanceDocumentsBrowser documents={bundle.documents} />
        </div>
      </section>

      {/* ── Выплаты: история стипендий и материальной помощи ──────────────── */}
      <section aria-labelledby="finance-payouts-heading" className="mt-8">
        <h2 id="finance-payouts-heading" className="text-base font-extrabold tracking-heading">
          Выплаты
        </h2>
        {bundle.payouts.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon={ReceiptText}
            title="Выплат пока нет"
            description="Когда стипендия или материальная помощь будут назначены, они появятся здесь."
          />
        ) : (
          <ul data-testid="finance-payouts" className="mt-3 flex flex-col divide-y divide-border">
            {bundle.payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{payout.title}</p>
                    <Badge status={payout.kind === 'SCHOLARSHIP' ? 'success' : 'accent'}>
                      {PAYOUT_KIND_LABELS[payout.kind]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatFinanceDateFull(payout.paidAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold">+{formatMoney(payout.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Действия → мастер заявки ──────────────────────────────────────── */}
      <section aria-labelledby="finance-actions-heading" className="mt-8">
        <h2 id="finance-actions-heading" className="text-base font-extrabold tracking-heading">
          Действия
        </h2>
        <div data-testid="finance-actions" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FINANCE_ACTIONS.map((action) => (
            <Link
              key={action.id}
              href={`/requests?order=${action.orderParam}`}
              data-testid={`finance-action-${action.id}`}
              className="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
              >
                {action.id === 'material-aid' ? (
                  <FileSignature className="size-5" />
                ) : (
                  <ReceiptText className="size-5" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
