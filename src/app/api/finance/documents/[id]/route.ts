// DIG-41 — скачивание демонстрационного PDF финансового документа.
//
// GET /api/finance/documents/[id]: только владелец набора. Id ищется в
// финансовом bundle СВОЕЙ формы обучения (catalog FinanceBundle строится
// по StudentRow.funding из живой сессии) — чужой/неизвестный id и сотрудники
// отвечают ОДИНАКОВЫМ 404 без раскрытия причины (контракт DIG-12), попытка
// чужого — в аудите. Документ вымышленный, с плашкой «Концепт для
// конкурса» и пометкой «не является платёжным документом»; реквизитов и
// платёжных форм нет (критерий приёмки DIG-41).
import { requireDataCtx, getFinancePage, uniformNotFoundResponse } from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  FINANCE_DOC_KIND_LABELS,
  financeDocumentById,
  type FinanceContract,
  type FinanceDocument,
} from '@/lib/finance-catalog';
import {
  buildFinanceDocumentPdf,
  financeDocumentFilename,
  moneyPlain,
  type FinanceDocumentPdfInput,
} from '@/lib/finance-document-pdf';

export const dynamic = 'force-dynamic';

function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}

/** Содержательные строки PDF по виду документа — только из своего набора. */
function pdfInputFor(
  doc: FinanceDocument,
  contract: FinanceContract | null,
  student: { fullName: string; groupName: string },
): FinanceDocumentPdfInput {
  const rows: FinanceDocumentPdfInput['rows'] = [];
  let amountLabel: string | null = null;
  let amountValue: string | null = null;

  switch (doc.kind) {
    case 'CONTRACT': {
      rows.push(
        { label: 'Программа', value: 'Экономика (бакалавриат), очная форма' },
        { label: 'Семестр', value: contract?.semesterLabel ?? '-' },
        {
          label: 'Стоимость семестра',
          value: contract ? moneyPlain(contract.semesterCost) : '-',
        },
      );
      break;
    }
    case 'AGREEMENT': {
      rows.push(
        { label: 'К договору', value: contract?.number ?? '-' },
        { label: 'Основание', value: 'индексация стоимости обучения' },
      );
      break;
    }
    case 'ACT': {
      rows.push({ label: 'Основание', value: 'отчёт по практике, подтверждён' });
      break;
    }
    case 'RECEIPT': {
      // Квитанция = оплаченный платёж договора (демо-набор платника).
      const payment = contract?.payments.find((p) => p.receiptId === doc.id);
      rows.push(
        { label: 'Договор', value: contract?.number ?? '-' },
        { label: 'Период', value: payment?.periodLabel ?? '-' },
        { label: 'Платёж', value: payment?.label ?? doc.title },
        { label: 'Статус', value: `Оплачен ${formatDate(payment?.paidAt ?? doc.date)}` },
      );
      amountLabel = 'Сумма платежа';
      amountValue = payment ? moneyPlain(payment.amount) : '-';
      break;
    }
    case 'INVOICE': {
      // Счёт = платёж «к оплате» того же периода.
      const payment = contract?.payments.find((p) => p.status === 'DUE') ?? contract?.payments[0];
      rows.push(
        { label: 'Договор', value: contract?.number ?? '-' },
        { label: 'Период', value: payment?.periodLabel ?? '-' },
        { label: 'Платёж', value: payment?.label ?? doc.title },
        { label: 'Срок оплаты', value: formatDate(payment?.dueAt ?? doc.date) },
      );
      amountLabel = 'Сумма к оплате';
      amountValue = payment ? moneyPlain(payment.amount) : '-';
      break;
    }
  }

  return {
    kindLabel: FINANCE_DOC_KIND_LABELS[doc.kind],
    title: doc.title,
    number: doc.number,
    date: doc.date,
    studentName: student.fullName,
    groupName: student.groupName,
    rows,
    amountLabel,
    amountValue,
  };
}

export async function GET(_httpRequest: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireDataCtx(`/api/finance/documents/${id}`);
  // Сотруднику студенческих финансов нет — единый 404 (агрегат пишет аудит).
  const data = await getFinancePage(dataDb, ctx);
  if (!data.bundle || !data.student || ctx.role !== 'STUDENT') return uniformNotFoundResponse();

  const doc = financeDocumentById(data.bundle, id);
  if (!doc) return uniformNotFoundResponse();

  const input = pdfInputFor(doc, data.bundle.contract, data.student);
  const now = new Date();
  const pdf = buildFinanceDocumentPdf(input, { now });

  return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${financeDocumentFilename(input, now)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
