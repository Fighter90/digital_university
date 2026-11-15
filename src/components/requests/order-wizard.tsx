'use client';

// DIG-31 — мастер заказа справки/заявления: модальное окно на десктопе,
// полноэкранный лист на мобильном (один адаптивный base-ui Dialog).
//
// Приёмка задачи: три шага («Что нужно → Параметры → Проверка»), валидация
// на клиенте И на сервере (одна чистая функция из lib/request-wizard),
// подтверждение «Выйти без сохранения?» при закрытии с черновиком,
// «Шаг N из 3» + Stepper, работа с клавиатуры (нативные радио/чекбоксы,
// фокус-ловушка base-ui). Данные студента подставлены из профиля и в мастере
// не редактируются. Успех: «Справка готова» + «Скачать PDF» у мгновенных,
// номер заявки, ожидаемая дата, «Следить за статусом».

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import Link from 'next/link';
import { FileCheck2, X } from 'lucide-react';

import { cn } from 'cn';

import { submitRequestWizardAction, type WizardSubmitState } from '@/server/actions/request-wizard';
import {
  WIZARD_DELIVERY_LABELS,
  WIZARD_LANGUAGE_LABELS,
  WIZARD_LIMITS,
  formatWizardDate,
  validateWizardInput,
  wizardDocFor,
  wizardDocs,
  type WizardAttachment,
  type WizardDelivery,
  type WizardDraftInput,
  type WizardFieldErrors,
  type WizardLanguage,
} from '@/lib/request-wizard';
import { Button, buttonVariants } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';

const DRAFT_KEY = 'dig31-order-draft';

export interface WizardStudentPreview {
  fullName: string;
  groupName: string;
  course: number;
  program: string;
  gradebookNumber: string;
}

export interface OrderWizardEntryProps {
  /** ?order= страницы: валидный id каталога → мастер открыт при загрузке. */
  initialServiceId: string | null;
  /** Профиль владельца; null (сотрудник) — ни CTA, ни мастера нет. */
  student: WizardStudentPreview | null;
}

/** CTA + точка монтирования мастера на странице «Мои заявки». */
export function OrderWizardEntry({ initialServiceId, student }: OrderWizardEntryProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initialServiceId !== null);

  if (!student) return null;

  const validInitial =
    initialServiceId !== null && wizardDocFor(initialServiceId) !== null ? initialServiceId : null;

  const close = () => {
    setOpen(false);
    if (initialServiceId !== null) {
      // Чистим параметр авто-открытия, чтобы F5 не поднимал мастер заново.
      router.replace('/requests');
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="requests-order-cta"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants({ variant: 'primary' }), 'mb-6 w-full sm:w-auto')}
      >
        Заказать справку или заявление
      </button>
      {open ? <OrderWizard student={student} initialServiceId={validInitial} onClosed={close} /> : null}
    </>
  );
}

const STEP_LABELS = ['Что нужно', 'Параметры', 'Проверка'] as const;

const parseIntSafe = (raw: string): number => {
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isNaN(value) ? -1 : value;
};

interface OrderWizardProps {
  student: WizardStudentPreview;
  initialServiceId: string | null;
  onClosed: () => void;
}

function OrderWizard({ student, initialServiceId, onClosed }: OrderWizardProps) {
  const docs = wizardDocs();
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [destination, setDestination] = useState('');
  const [language, setLanguage] = useState<WizardLanguage>('RU');
  const [copiesStr, setCopiesStr] = useState('1');
  const [delivery, setDelivery] = useState<WizardDelivery | ''>('');
  const [comment, setComment] = useState('');
  const [attachments, setAttachments] = useState<WizardAttachment[]>([]);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<WizardFieldErrors>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<WizardSubmitState, FormData>(
    submitRequestWizardAction,
    null,
  );

  const doc = serviceId === null ? null : wizardDocFor(serviceId);
  const startedFromUrl = initialServiceId !== null;
  const success = state !== null && state.ok ? state : null;

  // Смена типа документа: способ получения нормализуем под набор документа.
  useEffect(() => {
    if (doc && !doc.config.delivery.includes(delivery)) {
      setDelivery(doc.config.delivery[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // Восстановление черновика после случайной перезагрузки (без файлов:
  // FileList браузером не восстанавливается — вложения прикрепляют заново).
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        serviceId?: string;
        step?: number;
        destination?: string;
        language?: WizardLanguage;
        copiesStr?: string;
        delivery?: WizardDelivery;
        comment?: string;
        consent?: boolean;
      };
      if (saved.serviceId && wizardDocFor(saved.serviceId)) {
        setServiceId(saved.serviceId);
        setStep(saved.step === 2 || saved.step === 3 ? saved.step : 1);
        setDestination(typeof saved.destination === 'string' ? saved.destination : '');
        if (saved.language === 'EN') setLanguage('EN');
        setCopiesStr(typeof saved.copiesStr === 'string' ? saved.copiesStr : '1');
        if (saved.delivery) setDelivery(saved.delivery);
        setComment(typeof saved.comment === 'string' ? saved.comment : '');
        if (saved.consent === true) setConsent(true);
      }
    } catch {
      // повреждённый черновик игнорируем
    }
  }, []);

  // Черновик дублируется в sessionStorage на каждое изменение.
  useEffect(() => {
    if (success) return;
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ serviceId, step, destination, language, copiesStr, delivery, comment, consent }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, step, destination, language, copiesStr, delivery, comment, consent, success]);

  const draftInput = (withConsent: boolean): WizardDraftInput => ({
    destination,
    language,
    copies: parseIntSafe(copiesStr),
    delivery: (delivery === '' ? 'PDF' : delivery) as WizardDelivery,
    comment,
    consent: withConsent ? consent : true,
    attachments,
  });

  const dirty =
    step !== 1 ||
    destination.trim() !== '' ||
    comment.trim() !== '' ||
    copiesStr.trim() !== '1' ||
    language !== 'RU' ||
    attachments.length > 0 ||
    consent;

  const closeNow = () => {
    window.sessionStorage.removeItem(DRAFT_KEY);
    onClosed();
  };

  const attemptClose = () => {
    if (dirty && !success) setConfirmClose(true);
    else closeNow();
  };

  const goToStep2 = () => {
    if (!doc) return;
    const found = validateWizardInput(doc, draftInput(false));
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    setStep(3);
  };

  const onFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!doc) {
      event.preventDefault();
      return;
    }
    const found = validateWizardInput(doc, draftInput(true));
    if (Object.keys(found).length > 0) {
      event.preventDefault();
      setErrors(found);
      const keys = Object.keys(found);
      if (!(keys.length === 1 && found.consent !== undefined)) {
        setStep(2);
      }
    }
  };

  // Серверные ошибки полей: возвращаем студента к конкретному полю (шаг 2),
  // кроме случая «только согласие не подтверждено» — остаёмся на шаге 3.
  useEffect(() => {
    if (state && !state.ok && state.fieldErrors) {
      setErrors(state.fieldErrors);
      const keys = Object.keys(state.fieldErrors);
      if (keys.length === 1 && state.fieldErrors.consent !== undefined) {
        setStep(3);
      } else {
        setStep(2);
      }
    }
  }, [state]);

  const clearAttachments = () => {
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFilesChange = (fileList: FileList | null) => {
    if (!doc || !doc.config.attachments) return;
    const files = Array.from(fileList ?? []).map((file) => ({ name: file.name, size: file.size }));
    setAttachments(files);
    setErrors((prev) => {
      if (prev.attachments === undefined) return prev;
      const next = { ...prev };
      delete next.attachments;
      return next;
    });
  };

  const stepperStates: Array<'done' | 'current' | 'pending'> = [
    step === 1 ? 'current' : 'done',
    step === 2 ? 'current' : 'done',
    step === 3 ? 'current' : 'pending',
  ];

  const errorLine = (key: keyof WizardFieldErrors) =>
    errors[key] !== undefined ? (
      <p role="alert" data-testid={`wizard-error-${key}`} className="mt-1 text-xs font-medium text-error-ink">
        {errors[key]}
      </p>
    ) : null;

  return (
    <BaseDialog.Root open onOpenChange={(open) => { if (!open) attemptClose(); }}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25" />
        <BaseDialog.Popup
          className={cn(
            'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-card p-4 outline-none',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:max-h-[min(88vh,820px)] sm:w-[min(640px,calc(100vw-3rem))] sm:rounded-block sm:border sm:border-border sm:shadow-hover sm:p-6',
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <BaseDialog.Title className="text-lg font-extrabold tracking-heading">
              {success ? 'Заказ отправлен' : 'Заказ справки или заявления'}
            </BaseDialog.Title>
            <BaseDialog.Close
              aria-label="Закрыть мастер заказа"
              data-testid="wizard-close"
              className="-m-2 rounded-button p-2 text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="size-5" />
            </BaseDialog.Close>
          </div>

          {success ? (
            <div data-testid="wizard-success" className="flex flex-1 flex-col items-center py-4 text-center">
              <span
                aria-hidden="true"
                className="mb-4 flex size-16 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
              >
                <FileCheck2 className="size-8" />
              </span>
              <h2 className="text-lg font-extrabold">
                {success.instant ? 'Справка готова' : 'Заявка отправлена'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {success.instant
                  ? 'Документ сформирован — скачайте PDF в кабинете.'
                  : `Деканат принял заявку. Ожидаемая дата: ${formatWizardDate(new Date(success.expectedDateISO))}.`}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Номер заявки:{' '}
                <span data-testid="wizard-success-number" className="font-mono font-bold text-foreground">
                  {success.number}
                </span>
              </p>
              {!success.instant ? (
                <p data-testid="wizard-success-date" className="mt-1 text-sm text-muted-foreground">
                  Ожидаемая дата: {formatWizardDate(new Date(success.expectedDateISO))}
                </p>
              ) : null}
              {success.instant ? (
                <a
                  data-testid="wizard-success-download"
                  href={`/api/requests/${encodeURIComponent(success.number)}/pdf`}
                  download
                  className={cn(buttonVariants({ variant: 'primary' }), 'mt-5 w-full sm:w-auto')}
                >
                  Скачать PDF
                </a>
              ) : null}
              <Link
                data-testid="wizard-success-status"
                href={`/requests/${encodeURIComponent(success.number)}`}
                className={cn(buttonVariants({ variant: 'secondary' }), 'mt-3 w-full sm:w-auto')}
              >
                Следить за статусом
              </Link>
              <Button variant="ghost" className="mt-3" onClick={closeNow}>
                Готово
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-2" data-testid="wizard-progress">
                <Stepper
                  steps={STEP_LABELS.map((label) => ({ label }))}
                  states={stepperStates}
                  className="mb-2"
                />
                <p aria-live="polite" className="text-center text-xs text-muted-foreground">
                  Шаг {step} из 3 — {STEP_LABELS[step - 1]}
                </p>
              </div>

              <form action={formAction} onSubmit={onFormSubmit} className="flex min-h-0 flex-1 flex-col">
                <input type="hidden" name="serviceId" value={serviceId ?? ''} />

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {step === 1 ? (
                    <fieldset data-testid="wizard-step-docs" className="flex flex-col gap-2">
                      <legend className="mb-2 text-sm text-muted-foreground">
                        Что нужно? Тип можно сменить в любой момент.
                      </legend>
                      {docs.map((entry) => (
                        <label
                          key={entry.serviceId}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors',
                            serviceId === entry.serviceId
                              ? 'border-coral-600 bg-accent-soft/60'
                              : 'border-border bg-card hover:bg-muted',
                          )}
                        >
                          <input
                            type="radio"
                            name="wizard-doc"
                            value={entry.serviceId}
                            data-testid={`wizard-doc-${entry.serviceId}`}
                            checked={serviceId === entry.serviceId}
                            onChange={() => {
                              setServiceId(entry.serviceId);
                              setErrors({});
                            }}
                            className="mt-1 size-4 accent-[var(--coral-600,currentColor)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-foreground">{entry.title}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{entry.oneLiner}</span>
                            <span className="mt-1 flex flex-wrap gap-1.5">
                              <span className="rounded-pill border border-border px-2 py-0.5 text-[11px] font-medium">
                                {entry.etaLabel}
                              </span>
                              <span className="rounded-pill border border-border px-2 py-0.5 text-[11px] font-medium">
                                {entry.formatLabel}
                              </span>
                            </span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}

                  {/* Поля шага 2 всегда смонтированы — файлы и значения едут
                      в отправку с шага 3; вне шага 2 блок скрыт визуально. */}
                  <div className={cn('flex flex-col gap-4', step !== 2 && 'hidden')}>
                    {doc?.config.destination !== 'hidden' ? (
                      <div>
                        <label htmlFor="wizard-destination" className="mb-1 block text-sm font-semibold">
                          Куда предоставляется{doc?.config.destination === 'required' ? ' *' : ''}
                        </label>
                        <input
                          id="wizard-destination"
                          name="destination"
                          type="text"
                          data-testid="wizard-destination"
                          value={destination}
                          onChange={(event) => setDestination(event.target.value)}
                          maxLength={WIZARD_LIMITS.MAX_DESTINATION_LENGTH + 1}
                          placeholder="Например: военкомат по месту учёбы"
                          className="h-11 w-full rounded-button border border-border bg-card px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-coral-600"
                        />
                        {errorLine('destination')}
                      </div>
                    ) : null}

                    {doc?.config.language ? (
                      <fieldset>
                        <legend className="mb-1 text-sm font-semibold">Язык документа</legend>
                        <div className="flex gap-2">
                          {(['RU', 'EN'] as const).map((code) => (
                            <label
                              key={code}
                              className={cn(
                                'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-button border px-3 py-2 text-sm font-medium',
                                language === code ? 'border-coral-600 bg-accent-soft/60' : 'border-border',
                              )}
                            >
                              <input
                                type="radio"
                                name="language"
                                value={code}
                                checked={language === code}
                                onChange={() => setLanguage(code)}
                                className="size-4"
                              />
                              {WIZARD_LANGUAGE_LABELS[code]}
                            </label>
                          ))}
                        </div>
                        {errorLine('language')}
                      </fieldset>
                    ) : null}

                    {doc && doc.config.copies.max > doc.config.copies.min ? (
                      <div>
                        <label htmlFor="wizard-copies" className="mb-1 block text-sm font-semibold">
                          Количество экземпляров (1–{doc.config.copies.max})
                        </label>
                        <input
                          id="wizard-copies"
                          name="copies"
                          type="number"
                          inputMode="numeric"
                          min={doc.config.copies.min}
                          max={doc.config.copies.max}
                          data-testid="wizard-copies"
                          value={copiesStr}
                          onChange={(event) => setCopiesStr(event.target.value)}
                          className="h-11 w-28 rounded-button border border-border bg-card px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-coral-600"
                        />
                        {errorLine('copies')}
                      </div>
                    ) : null}

                    {doc ? (
                      <fieldset>
                        <legend className="mb-1 text-sm font-semibold">Способ получения</legend>
                        <div className="flex flex-col gap-2">
                          {doc.config.delivery.map((method) => (
                            <label
                              key={method}
                              className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-button border px-3 py-2 text-sm font-medium',
                                delivery === method ? 'border-coral-600 bg-accent-soft/60' : 'border-border',
                              )}
                            >
                              <input
                                type="radio"
                                name="delivery"
                                value={method}
                                data-testid={`wizard-delivery-${method}`}
                                checked={delivery === method}
                                onChange={() => setDelivery(method)}
                                className="size-4"
                              />
                              {WIZARD_DELIVERY_LABELS[method]}
                            </label>
                          ))}
                        </div>
                        {errorLine('delivery')}
                      </fieldset>
                    ) : null}

                    <div>
                      <label htmlFor="wizard-comment" className="mb-1 block text-sm font-semibold">
                        Комментарий (необязательно)
                      </label>
                      <textarea
                        id="wizard-comment"
                        name="comment"
                        data-testid="wizard-comment"
                        rows={3}
                        maxLength={WIZARD_LIMITS.MAX_COMMENT_LENGTH + 1}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Что важно учесть деканату"
                        className="w-full rounded-button border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-coral-600"
                      />
                      {errorLine('comment')}
                    </div>

                    {doc?.config.attachments ? (
                      <div>
                        <label htmlFor="wizard-attachments" className="mb-1 block text-sm font-semibold">
                          Вложения — до {WIZARD_LIMITS.MAX_FILES} файлов, до {WIZARD_LIMITS.MAX_FILE_MB} МБ
                        </label>
                        <input
                          id="wizard-attachments"
                          ref={fileInputRef}
                          name="attachments"
                          type="file"
                          multiple
                          data-testid="wizard-attachments"
                          onChange={(event) => onFilesChange(event.target.files)}
                          className="w-full text-sm"
                        />
                        {attachments.length > 0 ? (
                          <ul className="mt-2 flex flex-col gap-1">
                            {attachments.map((file) => (
                              <li key={file.name} className="text-xs text-muted-foreground">
                                {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} МБ
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {attachments.length > 0 ? (
                          <button
                            type="button"
                            data-testid="wizard-attachments-clear"
                            onClick={clearAttachments}
                            className="mt-1 text-xs font-medium text-coral-600 underline"
                          >
                            Убрать все файлы
                          </button>
                        ) : null}
                        {errorLine('attachments')}
                      </div>
                    ) : null}

                    <div className="rounded-card border border-border bg-muted/50 p-3" data-testid="wizard-student-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Данные студента — из профиля
                      </p>
                      <p className="mt-1 text-sm font-bold">{student.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.groupName} · {student.course} курс · зачётка № {student.gradebookNumber}
                      </p>
                    </div>
                  </div>

                  {step === 3 && doc ? (
                    <div data-testid="wizard-review" className="flex flex-col gap-3">
                      <section className="rounded-card border border-border p-3" data-testid="wizard-review-document">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold">Документ</h3>
                          <button
                            type="button"
                            data-testid="wizard-edit-document"
                            onClick={() => setStep(1)}
                            className="text-xs font-medium text-coral-600 underline"
                          >
                            Изменить
                          </button>
                        </div>
                        <p className="mt-1 text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.etaLabel} · {doc.formatLabel} · {doc.oneLiner}
                        </p>
                      </section>

                      <section className="rounded-card border border-border p-3" data-testid="wizard-review-params">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold">Параметры</h3>
                          <button
                            type="button"
                            data-testid="wizard-edit-params"
                            onClick={() => setStep(2)}
                            className="text-xs font-medium text-coral-600 underline"
                          >
                            Изменить
                          </button>
                        </div>
                        <dl className="mt-1 flex flex-col gap-0.5 text-sm">
                          {doc.config.destination !== 'hidden' && destination.trim() !== '' ? (
                            <div className="flex gap-2">
                              <dt className="text-muted-foreground">Куда предоставляется</dt>
                              <dd className="font-medium">{destination}</dd>
                            </div>
                          ) : null}
                          {doc.config.language ? (
                            <div className="flex gap-2">
                              <dt className="text-muted-foreground">Язык</dt>
                              <dd className="font-medium">{WIZARD_LANGUAGE_LABELS[language]}</dd>
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <dt className="text-muted-foreground">Экземпляров</dt>
                            <dd className="font-medium">{parseIntSafe(copiesStr)}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-muted-foreground">Получение</dt>
                            <dd className="font-medium">
                              {WIZARD_DELIVERY_LABELS[delivery === '' ? doc.config.delivery[0]! : delivery]}
                            </dd>
                          </div>
                          {comment.trim() !== '' ? (
                            <div className="flex gap-2">
                              <dt className="text-muted-foreground">Комментарий</dt>
                              <dd className="font-medium">{comment}</dd>
                            </div>
                          ) : null}
                          {attachments.length > 0 ? (
                            <div className="flex gap-2">
                              <dt className="text-muted-foreground">Вложения</dt>
                              <dd className="font-medium">{attachments.map((file) => file.name).join(', ')}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </section>

                      <section className="rounded-card border border-border p-3" data-testid="wizard-review-student">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold">Данные студента</h3>
                          <Link
                            href="/profile"
                            data-testid="wizard-edit-student"
                            className="text-xs font-medium text-coral-600 underline"
                          >
                            Изменить в профиле
                          </Link>
                        </div>
                        <p className="mt-1 text-sm">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.groupName} · {student.course} курс · {student.program} · зачётка №{' '}
                          {student.gradebookNumber}
                        </p>
                      </section>

                      <label className="flex cursor-pointer items-start gap-2 rounded-card border border-border p-3">
                        <input
                          type="checkbox"
                          name="consent"
                          data-testid="wizard-consent"
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                          className="mt-0.5 size-4"
                        />
                        <span className="text-sm font-medium">Данные верны — отправляю заявку</span>
                      </label>
                      {errorLine('consent')}
                      {typeof state === 'object' && state !== null && !state.ok && state.error ? (
                        <p role="alert" data-testid="wizard-error-server" className="text-xs font-medium text-error-ink">
                          {state.error}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    {step > 1 ? (
                      <Button
                        variant="secondary"
                        data-testid="wizard-back"
                        onClick={() => {
                          setErrors({});
                          setStep(step === 3 ? 2 : 1);
                        }}
                      >
                        Назад
                      </Button>
                    ) : null}
                  </div>
                  <div>
                    {step === 1 ? (
                      <Button data-testid="wizard-next" disabled={doc === null} onClick={() => setStep(2)}>
                        Далее
                      </Button>
                    ) : null}
                    {step === 2 ? (
                      <Button data-testid="wizard-next" onClick={goToStep2}>
                        Далее
                      </Button>
                    ) : null}
                    {step === 3 ? (
                      <Button type="submit" data-testid="wizard-submit" disabled={!consent || isPending}>
                        {isPending ? 'Отправляем…' : 'Отправить'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </form>
            </>
          )}

          <Dialog
            open={confirmClose}
            onOpenChange={(open) => setConfirmClose(open)}
            title="Выйти без сохранения?"
            description="Введённые данные будут потеряны. Черновик также стирается."
            className="w-[min(400px,calc(100vw-2rem))]"
            footer={
              <>
                <Button variant="ghost" data-testid="wizard-confirm-leave" onClick={closeNow}>
                  Выйти
                </Button>
                <Button data-testid="wizard-confirm-stay" onClick={() => setConfirmClose(false)}>
                  Продолжить заполнение
                </Button>
              </>
            }
          />
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
