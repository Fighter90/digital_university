// DIG-31 — мастер заказа справки или заявления (фрейм Figma
// «06 · Заявки — мастер заказа»): модальное окно на десктопе,
// полноэкранный лист на мобильном 360 px.
//
// Шаги: 1 «Что нужно» (тип можно сменить, срок/формат, одна строка
// «что это за документ»), 2 «Параметры» (поля JSON-схемы типа + общие:
// куда предоставляется, язык RU/EN, экземпляры, способ получения,
// комментарий, вложения; данные студента — из профиля, только чтение),
// 3 «Проверка» (сводка с «Изменить», согласие «Данные верны», отправка).
// Успех: «Справка готова» (мгновенные — сразу «Скачать PDF»), номер
// заявки, дата готовности по SLA, «Следить за статусом».
//
// Валидация — общие модули с сервером (request-form-schema +
// request-wizard-schema). Черновик не теряется при случайном закрытии:
// закрытие с изменениями спрашивает «Выйти без сохранения?».
// Файлы вложений в прототипе не передаются — на сервер уходят только
// метаданные (имя, размер), проверенные по лимитам задачи.
'use client';

import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { t, type Locale } from '@/lib/i18n';
import { pluralRu } from '@/lib/dashboard-format';
import { Check, FileText, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useActionState } from 'react';
import { cn } from 'cn';

import {
  MAX_WIZARD_COMMENT_LENGTH,
  MAX_WIZARD_DESTINATION_LENGTH,
  MAX_WIZARD_FILE_SIZE_MB,
  MAX_WIZARD_FILES,
  MAX_WIZARD_COPIES,
  WIZARD_DELIVERIES,
  wizardDeliveryLabel,
  WIZARD_LANGUAGES,
  WIZARD_LANGUAGE_LABELS,
  wizardFilesError,
  type WizardAttachmentMeta,
  type WizardLanguage,
  type WizardMeta,
  type WizardDelivery,
} from '@/lib/request-wizard-schema';
import { requestFormatLabel, requestTypeHint, type OrderTarget } from '@/lib/request-order-map';
import {
  parseRequestFormSchema,
  requestTitleFromParams,
  validateRequestFormFields,
} from '@/lib/request-form-schema';
import { formatReadyBy, slaReadyDate } from '@/lib/request-sla';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Illustration } from '@/components/ui/illustration';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/components/ui/icon';
import type { RequestActionState } from '@/server/actions/requests';

/** Тип словаря заявок для шага 1 (сериализуемый DTO со страницы). */
export interface WizardTypeDto {
  code: string;
  name: string;
  etaDays: number | null;
  format: 'ELECTRONIC' | 'PAPER' | 'HYBRID';
  isInstant: boolean;
  formSchema: unknown;
}

/** Данные студента из профиля — подставляются, не вводятся заново. */
export interface WizardProfileDto {
  fullName: string;
  groupName: string;
  course: number;
  faculty: string;
}

export interface OrderWizardProps {
  types: WizardTypeDto[];
  profile: WizardProfileDto | null;
  /** Сырой ?order= страницы: не null — мастер открыт при монтировании. */
  orderParam: string | null;
  /** Разобранный предвыбор (orderTargetForService): тип + пресет полей. */
  autoTarget: OrderTarget | null;
  /** Server action подачи заявки (createRequestAction). */
  action: (prevState: RequestActionState, formData: FormData) => Promise<RequestActionState>;
  /** DIG-69 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

type WizardStep = 1 | 2 | 3;

const STEP_TITLE_KEYS: Record<
  WizardStep,
  'wizard.step.what' | 'wizard.step.params' | 'wizard.step.review'
> = {
  1: 'wizard.step.what',
  2: 'wizard.step.params',
  3: 'wizard.step.review',
};

const inputClass =
  'mt-1 w-full rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground/40';

/** Метка срока/формата типа для шагов 1 и 3 (по локали, DIG-87). */
function typeBadgeLabel(
  type: { isInstant: boolean; etaDays: number | null },
  locale: Locale,
): string {
  if (type.isInstant) return t(locale, 'wizard.badge.instant');
  return type.etaDays !== null
    ? t(locale, 'wizard.badge.eta', { days: type.etaDays })
    : t(locale, 'wizard.badge.etaUnknown');
}

/** «N файл/файла/файлов» / «N file(s)» — сводка вложений шага 3 (DIG-87). */
function filesCountLabel(count: number, locale: Locale): string {
  if (locale === 'en') return `${count} ${count === 1 ? 'file' : 'files'}`;
  return `${count} ${pluralRu(count, ['файл', 'файла', 'файлов'])}`;
}

export function OrderWizard({
  types,
  profile,
  orderParam,
  autoTarget,
  action,
  locale = 'ru',
}: OrderWizardProps) {
  const router = useRouter();

  // Мастер монтируется с чистым черновиком под своим ключом (страница даёт
  // key={orderParam}): ссылка ?order=… открывает шаг 1 с предвыбором,
  // закрытие с обнулением параметра пересоздаёт закрытый мастер.
  const [open, setOpen] = useState(() => orderParam !== null);
  const [step, setStep] = useState<WizardStep>(1);
  const [typeCode, setTypeCode] = useState<string | null>(autoTarget?.typeCode ?? null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    autoTarget?.preset ? { ...autoTarget.preset } : {},
  );
  const [meta, setMeta] = useState<WizardMeta>({
    destination: '',
    language: 'RU',
    copies: 1,
    delivery: 'PDF_ONLINE',
    comment: '',
    attachments: [],
  });
  const [files, setFiles] = useState<WizardAttachmentMeta[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [filesError, setFilesError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<RequestActionState>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Ответ действия зеркалим в локальное состояние из самого обработчика
  // (не из эффекта): внутренний state useActionState нельзя сбросить.
  const [, formAction, pending] = useActionState<RequestActionState, FormData>(
    async (prev, formData) => {
      const next = await action(prev, formData);
      setResult(next);
      setSubmitError(next && !next.ok ? next.error : null);
      if (next && next.ok) setDirty(false);
      return next;
    },
    null,
  );

  const selectedType = useMemo(
    () => types.find((type) => type.code === typeCode) ?? null,
    [types, typeCode],
  );
  const schema = useMemo(
    () => (selectedType ? parseRequestFormSchema(selectedType.formSchema) : null),
    [selectedType],
  );
  const keyField = schema?.keyField ?? null;
  const keyValue = keyField ? (values[keyField] ?? '').trim() : '';
  const keyFieldLabel = keyField
    ? (schema?.fields.find((field) => field.key === keyField)?.label ?? '')
    : '';
  const documentTitle = selectedType
    ? requestTitleFromParams(selectedType.name, schema, values)
    : '';

  const resetDraft = () => {
    setStep(1);
    setTypeCode(autoTarget?.typeCode ?? null);
    setValues(autoTarget?.preset ? { ...autoTarget.preset } : {});
    setMeta({
      destination: '',
      language: 'RU',
      copies: 1,
      delivery: 'PDF_ONLINE',
      comment: '',
      attachments: [],
    });
    setFiles([]);
    setFieldErrors({});
    setFilesError(null);
    setConsent(false);
    setConfirmExit(false);
    setDirty(false);
    setResult(null);
    setSubmitError(null);
  };

  // Закрытие со сбросом ?order= из адресной строки: без router.push —
  // заменяем URL, список перечитывается сервером при следующей навигации.
  const closeNow = () => {
    resetDraft();
    setOpen(false);
    if (orderParam !== null) {
      router.replace('/requests', { scroll: false });
    }
  };

  const closeRequested = () => {
    if (dirty && result === null) {
      setConfirmExit(true);
      return;
    }
    closeNow();
  };

  const markDirty = () => setDirty(true);

  const selectType = (code: string) => {
    setTypeCode(code);
    setFieldErrors({});
    if (autoTarget && autoTarget.typeCode === code && autoTarget.preset) {
      setValues((prev) => ({ ...prev, ...autoTarget.preset }));
    }
    markDirty();
  };

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    markDirty();
  };

  const updateMeta = (patch: Partial<WizardMeta>) => {
    setMeta((prev) => ({ ...prev, ...patch }));
    markDirty();
  };

  const goNext = () => {
    setSubmitError(null);
    if (step === 1) {
      if (!typeCode) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      const check = validateRequestFormFields(selectedType?.formSchema ?? null, values);
      if (!check.ok) {
        if ('errors' in check) {
          setFieldErrors(check.errors);
        } else {
          setFieldErrors({});
          setSubmitError(check.error);
        }
        return;
      }
      setFieldErrors({});
      setStep(3);
    }
  };

  const onFilesChosen = (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    if (chosen.length === 0) return;
    const metas = chosen.map((file) => ({ name: file.name, size: file.size }));
    const error = wizardFilesError(metas, files.length, locale);
    if (error) {
      setFilesError(error);
      return;
    }
    setFiles((prev) => [...prev, ...metas]);
    setFilesError(null);
    markDirty();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFilesError(null);
    markDirty();
  };

  // ── результат подачи ────────────────────────────────────────────────────
  const created = result && result.ok && result.number ? result : null;
  const duplicate = result && result.ok && result.duplicate ? result.duplicate : null;
  const successNumber = created?.number ?? duplicate?.number ?? null;
  const instantType = selectedType?.isInstant ?? false;
  // Дата готовности считается на момент показа экрана успеха (после
  // отправки, только на клиенте) — по SLA типа в рабочих днях.
  const etaLabel = (() => {
    if (!selectedType || selectedType.isInstant) return null;
    const ready = slaReadyDate(new Date(), selectedType.etaDays);
    return ready ? formatReadyBy(ready, locale) : null;
  })();

  const progress = created || duplicate ? 3 : step;
  const progressPercent = Math.round((progress / 3) * 100);

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeRequested();
        else setOpen(true);
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25" />
        <BaseDialog.Popup
          data-testid="order-wizard"
          className={cn(
            'fixed z-50 flex flex-col overflow-y-auto bg-card text-card-foreground shadow-hover outline-none',
            // мобильный 360 px — полноэкранный лист
            'inset-0 rounded-none',
            // десктоп — модальное окно по центру
            'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[min(680px,calc(100vw-4rem))] sm:max-h-[min(90dvh,860px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-block sm:border sm:border-border',
          )}
        >
          <div className="sticky top-0 z-10 border-b border-border bg-card px-5 pb-3 pt-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <BaseDialog.Title className="text-lg font-extrabold tracking-heading">
                {t(locale, 'wizard.title')}
              </BaseDialog.Title>
              <BaseDialog.Close
                data-testid="wizard-close"
                aria-label={t(locale, 'wizard.closeAria')}
                className="-m-2 rounded-button p-2 text-muted-foreground hover:text-foreground"
              >
                <Icon icon={X} size={18} />
              </BaseDialog.Close>
            </div>
            <div data-testid="wizard-progress" className="mt-3 flex items-center gap-3">
              <span
                data-testid="wizard-step-label"
                className="whitespace-nowrap text-xs font-semibold text-muted-foreground"
              >
                {created || duplicate
                  ? t(locale, 'wizard.done')
                  : t(locale, 'wizard.stepLabel', {
                      step,
                      total: 3,
                      title: t(locale, STEP_TITLE_KEYS[step]),
                    })}
              </span>
              <div
                role="progressbar"
                aria-label={t(locale, 'wizard.progressAria')}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={progress}
                className="h-1.5 flex-1 overflow-hidden rounded-pill bg-muted"
              >
                <div
                  className="h-full rounded-pill bg-coral-600 transition-[width] duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <form
            action={formAction}
            onSubmit={(event) => {
              // Enter в поле на шагах 1–2 не должен «проваливать» заявку:
              // отправка — только кнопкой на шаге 3 (согласие включено).
              if (step !== 3) event.preventDefault();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {step === 3 && !created && !duplicate ? (
              <>
                <input type="hidden" name="typeCode" value={typeCode ?? ''} />
                <input type="hidden" name="params" value={JSON.stringify(values)} />
                <input
                  type="hidden"
                  name="wizard"
                  value={JSON.stringify({ ...meta, attachments: files })}
                />
              </>
            ) : null}

            <div className="flex-1 px-5 py-5 sm:px-6">
              {created || duplicate ? (
                <SuccessScreen
                  number={successNumber!}
                  instant={instantType}
                  duplicate={duplicate !== null}
                  etaLabel={etaLabel}
                  locale={locale}
                />
              ) : step === 1 ? (
                <StepWhat types={types} typeCode={typeCode} onSelect={selectType} locale={locale} />
              ) : step === 2 ? (
                <StepParams
                  schemaFields={schema?.fields ?? []}
                  values={values}
                  fieldErrors={fieldErrors}
                  onValue={updateValue}
                  meta={meta}
                  files={files}
                  filesError={filesError}
                  onMeta={updateMeta}
                  onFiles={onFilesChosen}
                  onRemoveFile={removeFile}
                  profile={profile}
                  locale={locale}
                />
              ) : (
                <StepReview
                  documentTitle={documentTitle}
                  keyFieldLabel={keyFieldLabel}
                  keyValue={keyValue}
                  selectedType={selectedType}
                  meta={meta}
                  files={files}
                  profile={profile}
                  consent={consent}
                  locale={locale}
                  onConsent={(next) => {
                    setConsent(next);
                    markDirty();
                  }}
                  onEditDocument={() => setStep(1)}
                  onEditParams={() => setStep(2)}
                  submitError={submitError}
                />
              )}
            </div>

            <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-4 sm:px-6">
              {step > 1 && !created && !duplicate ? (
                <button
                  type="button"
                  data-testid="wizard-back"
                  onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
                  className="inline-flex items-center rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
                >
                  {t(locale, 'wizard.back')}
                </button>
              ) : (
                <span />
              )}

              {created || duplicate ? (
                <button
                  type="button"
                  data-testid="wizard-done"
                  onClick={closeNow}
                  className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
                >
                  {t(locale, 'wizard.done')}
                </button>
              ) : step === 3 ? (
                // DIG-85 (BUG-20): неактивная «Отправить» объясняется подписью —
                // студент видит, ЧТО разблокирует кнопку, а не угадывает.
                <div className="flex items-center justify-end gap-3">
                  {!consent && !pending ? (
                    <p
                      data-testid="wizard-consent-hint"
                      className="text-right text-xs text-muted-foreground"
                    >
                      {t(locale, 'wizard.consent.hint')}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    data-testid="wizard-submit"
                    disabled={!consent || pending}
                    className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
                  >
                    {pending ? t(locale, 'btn.submitting') : t(locale, 'btn.submit')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="wizard-next"
                  onClick={goNext}
                  disabled={step === 1 && !typeCode}
                  className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
                >
                  {step === 2 ? t(locale, 'wizard.nextReview') : t(locale, 'wizard.next')}
                </button>
              )}
            </div>
          </form>
        </BaseDialog.Popup>
      </BaseDialog.Portal>

      {/* Подтверждение выхода: черновик не теряется при случайном закрытии */}
      <BaseDialog.Root open={confirmExit} onOpenChange={setConfirmExit}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-[60] bg-foreground/25" />
          <BaseDialog.Popup
            data-testid="wizard-exit-confirm"
            className="fixed top-1/2 left-1/2 z-[70] w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-block border border-border bg-card p-6 text-card-foreground shadow-hover outline-none"
          >
            <BaseDialog.Title className="text-lg font-extrabold tracking-heading">
              {t(locale, 'wizard.exit.title')}
            </BaseDialog.Title>
            <BaseDialog.Description className="mt-1 text-sm text-muted-foreground">
              {t(locale, 'wizard.exit.desc')}
            </BaseDialog.Description>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                data-testid="wizard-exit-stay"
                onClick={() => setConfirmExit(false)}
                className="inline-flex items-center rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
              >
                {t(locale, 'wizard.exit.stay')}
              </button>
              <button
                type="button"
                data-testid="wizard-exit-discard"
                onClick={closeNow}
                className="inline-flex items-center rounded-button bg-error px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-error/90"
              >
                {t(locale, 'wizard.exit.discard')}
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </BaseDialog.Root>
  );
}

// ── шаг 1 ────────────────────────────────────────────────────────────────────

function StepWhat({
  types,
  typeCode,
  onSelect,
  locale = 'ru',
}: {
  types: WizardTypeDto[];
  typeCode: string | null;
  onSelect: (code: string) => void;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  return (
    <div role="radiogroup" aria-label={t(locale, 'wizard.type.groupAria')}>
      <p className="text-sm text-muted-foreground">{t(locale, 'wizard.type.intro')}</p>
      <div className="mt-3 flex flex-col gap-2">
        {types.map((type) => {
          const selected = type.code === typeCode;
          return (
            <label
              key={type.code}
              data-testid={`wizard-type-option-${type.code}`}
              data-selected={selected}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors',
                selected
                  ? 'border-coral-600 bg-coral-50/60'
                  : 'border-border bg-card hover:border-muted-foreground/40',
              )}
            >
              <input
                type="radio"
                name="wizard-type"
                value={type.code}
                checked={selected}
                onChange={() => onSelect(type.code)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-button bg-accent-soft text-accent-ink"
              >
                <Icon icon={FileText} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-snug">{type.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {requestTypeHint(type.code, locale)}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <Badge status={type.isInstant ? 'success' : 'neutral'}>
                    {typeBadgeLabel(type, locale)}
                  </Badge>
                  <Badge>{requestFormatLabel(type.format, locale)}</Badge>
                </span>
              </span>
              {selected ? (
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-coral-600 text-white"
                >
                  <Icon icon={Check} size={12} />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── шаг 2 ────────────────────────────────────────────────────────────────────

type SchemaField = {
  key: string;
  label: string;
  type: 'text' | 'enum' | 'date';
  required?: boolean;
  options?: string[];
  maxLength?: number;
};

function StepParams({
  schemaFields,
  values,
  fieldErrors,
  onValue,
  meta,
  files,
  filesError,
  onMeta,
  onFiles,
  onRemoveFile,
  profile,
  locale = 'ru',
}: {
  schemaFields: SchemaField[];
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  onValue: (key: string, value: string) => void;
  meta: WizardMeta;
  files: WizardAttachmentMeta[];
  filesError: string | null;
  onMeta: (patch: Partial<WizardMeta>) => void;
  onFiles: (list: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  profile: WizardProfileDto | null;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  return (
    <div>
      <div
        data-testid="wizard-profile-block"
        className="rounded-card border border-border bg-muted/40 p-3"
      >
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t(locale, 'wizard.profile.title')}
        </p>
        <p className="mt-1 text-sm font-bold">
          {profile?.fullName ?? t(locale, 'wizard.profile.empty')}
        </p>
        {profile ? (
          <p className="text-xs text-muted-foreground">
            {profile.groupName} · {t(locale, 'wizard.profile.course', { course: profile.course })} ·{' '}
            {profile.faculty}
          </p>
        ) : null}
      </div>

      {schemaFields.map((field) => {
        const error = fieldErrors[field.key];
        const errorId = `wizard-field-error-${field.key}`;
        return (
          <div key={field.key} className="mt-4">
            <label htmlFor={`wizard-field-${field.key}`} className="text-sm font-semibold">
              {field.label}
              {field.required ? <span aria-hidden="true"> *</span> : null}
            </label>
            {field.type === 'enum' ? (
              <select
                id={`wizard-field-${field.key}`}
                data-testid={`wizard-field-${field.key}`}
                value={values[field.key] ?? ''}
                onChange={(event) => onValue(field.key, event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={inputClass}
              >
                <option value="" disabled={field.required === true}>
                  {t(locale, 'wizard.selectPlaceholder')}
                </option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === 'date' ? (
              <input
                type="date"
                id={`wizard-field-${field.key}`}
                data-testid={`wizard-field-${field.key}`}
                value={values[field.key] ?? ''}
                onChange={(event) => onValue(field.key, event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={inputClass}
              />
            ) : (
              <input
                type="text"
                id={`wizard-field-${field.key}`}
                data-testid={`wizard-field-${field.key}`}
                value={values[field.key] ?? ''}
                maxLength={field.maxLength ?? 200}
                onChange={(event) => onValue(field.key, event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={inputClass}
              />
            )}
            {error ? (
              <p
                id={errorId}
                data-testid={`wizard-field-error-${field.key}`}
                role="alert"
                className="mt-1 text-xs text-error-ink"
              >
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="mt-4">
        <label htmlFor="wizard-destination" className="text-sm font-semibold">
          {t(locale, 'wizard.destination.label')}
        </label>
        <input
          id="wizard-destination"
          data-testid="wizard-destination"
          type="text"
          value={meta.destination}
          maxLength={MAX_WIZARD_DESTINATION_LENGTH}
          placeholder={t(locale, 'wizard.destination.placeholder')}
          onChange={(event) => onMeta({ destination: event.target.value })}
          className={inputClass}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div data-testid="wizard-language">
          <p className="text-sm font-semibold">{t(locale, 'wizard.language.label')}</p>
          <div className="mt-1">
            <Segmented
              options={WIZARD_LANGUAGES.map((lang: WizardLanguage) => ({
                value: lang,
                label: WIZARD_LANGUAGE_LABELS[lang],
              }))}
              value={meta.language}
              onChange={(lang) => onMeta({ language: lang })}
              aria-label={t(locale, 'wizard.language.label')}
            />
          </div>
        </div>
        <div>
          <label htmlFor="wizard-copies" className="text-sm font-semibold">
            {t(locale, 'wizard.copies.label')}
          </label>
          <select
            id="wizard-copies"
            data-testid="wizard-copies"
            value={meta.copies}
            onChange={(event) => onMeta({ copies: Number(event.target.value) })}
            className={inputClass}
          >
            {Array.from({ length: MAX_WIZARD_COPIES }, (_, i) => i + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold">{t(locale, 'wizard.delivery.label')}</p>
        <div
          role="radiogroup"
          aria-label={t(locale, 'wizard.delivery.label')}
          className="mt-1 flex flex-col gap-2"
        >
          {WIZARD_DELIVERIES.map((delivery: WizardDelivery) => {
            const checked = meta.delivery === delivery;
            return (
              <label
                key={delivery}
                data-testid={`wizard-delivery-${delivery}`}
                data-selected={checked}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-button border px-3 py-2 text-sm transition-colors',
                  checked
                    ? 'border-coral-600 bg-coral-50/60 font-semibold'
                    : 'border-border bg-card hover:border-muted-foreground/40',
                )}
              >
                <input
                  type="radio"
                  name="wizard-delivery"
                  value={delivery}
                  checked={checked}
                  onChange={() => onMeta({ delivery })}
                  className="size-4 accent-coral-600"
                />
                {wizardDeliveryLabel(delivery, locale)}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="wizard-comment" className="text-sm font-semibold">
          {t(locale, 'wizard.comment.label')}{' '}
          <span className="font-normal text-muted-foreground">
            {t(locale, 'wizard.comment.optional')}
          </span>
        </label>
        <textarea
          id="wizard-comment"
          data-testid="wizard-comment"
          value={meta.comment}
          rows={2}
          maxLength={MAX_WIZARD_COMMENT_LENGTH}
          placeholder={t(locale, 'wizard.comment.placeholder')}
          onChange={(event) => onMeta({ comment: event.target.value })}
          className={inputClass}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="wizard-files" className="text-sm font-semibold">
          {t(locale, 'wizard.files.label')}{' '}
          <span className="font-normal text-muted-foreground">
            {t(locale, 'wizard.files.hint', {
              files: MAX_WIZARD_FILES,
              size: MAX_WIZARD_FILE_SIZE_MB,
            })}
          </span>
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-button border border-dashed border-border bg-muted/30 px-3 py-2.5">
          <Icon icon={Paperclip} size={16} className="text-muted-foreground" />
          <input
            id="wizard-files"
            data-testid="wizard-files"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(event) => {
              onFiles(event.target.files);
              event.target.value = '';
            }}
            aria-describedby={filesError ? 'wizard-files-error' : undefined}
            className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-button file:border-0 file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground file:shadow-soft"
          />
        </div>
        {filesError ? (
          <p
            id="wizard-files-error"
            data-testid="wizard-files-error"
            role="alert"
            className="mt-1 text-xs text-error-ink"
          >
            {filesError}
          </p>
        ) : null}
        {files.length > 0 ? (
          <ul data-testid="wizard-files-list" className="mt-2 flex flex-col gap-1">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-button bg-muted/40 px-3 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={t(locale, 'wizard.files.removeAria', { name: file.name })}
                  onClick={() => onRemoveFile(index)}
                  className="rounded-button p-1 text-muted-foreground hover:text-foreground"
                >
                  <Icon icon={X} size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

// ── шаг 3 ────────────────────────────────────────────────────────────────────

function StepReview({
  documentTitle,
  keyFieldLabel,
  keyValue,
  selectedType,
  meta,
  files,
  profile,
  consent,
  onConsent,
  onEditDocument,
  onEditParams,
  submitError,
  locale = 'ru',
}: {
  documentTitle: string;
  keyFieldLabel: string;
  keyValue: string;
  selectedType: WizardTypeDto | null;
  meta: WizardMeta;
  files: WizardAttachmentMeta[];
  profile: WizardProfileDto | null;
  consent: boolean;
  onConsent: (next: boolean) => void;
  onEditDocument: () => void;
  onEditParams: () => void;
  submitError: string | null;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const editButton =
    'rounded-button border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft transition-colors hover:bg-muted';
  return (
    <div className="flex flex-col gap-3">
      <section
        data-testid="wizard-summary-document"
        className="rounded-card border border-border p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{t(locale, 'wizard.review.document')}</h3>
          <button
            type="button"
            data-testid="wizard-edit-document"
            onClick={onEditDocument}
            className={editButton}
          >
            {t(locale, 'wizard.review.edit')}
          </button>
        </div>
        <p className="mt-1 text-sm">{documentTitle}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedType ? (
            <>
              <Badge status={selectedType.isInstant ? 'success' : 'neutral'}>
                {typeBadgeLabel(selectedType, locale)}
              </Badge>
              <Badge>{requestFormatLabel(selectedType.format, locale)}</Badge>
            </>
          ) : null}
        </div>
      </section>

      <section
        data-testid="wizard-summary-params"
        className="rounded-card border border-border p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{t(locale, 'wizard.review.params')}</h3>
          <button
            type="button"
            data-testid="wizard-edit-params"
            onClick={onEditParams}
            className={editButton}
          >
            {t(locale, 'wizard.review.edit')}
          </button>
        </div>
        <dl className="mt-1 flex flex-col gap-1 text-sm">
          {keyFieldLabel ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{keyFieldLabel}</dt>
              <dd className="text-right font-medium">{keyValue || '—'}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t(locale, 'wizard.review.destination')}</dt>
            <dd className="text-right font-medium">{meta.destination.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t(locale, 'wizard.review.language')}</dt>
            <dd className="text-right font-medium">{WIZARD_LANGUAGE_LABELS[meta.language]}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t(locale, 'wizard.review.copies')}</dt>
            <dd className="text-right font-medium">{meta.copies}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t(locale, 'wizard.review.delivery')}</dt>
            <dd className="text-right font-medium">{wizardDeliveryLabel(meta.delivery, locale)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t(locale, 'wizard.review.comment')}</dt>
            <dd className="text-right font-medium">{meta.comment.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t(locale, 'wizard.review.attachments')}</dt>
            <dd className="text-right font-medium">
              {files.length > 0 ? filesCountLabel(files.length, locale) : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section
        data-testid="wizard-summary-profile"
        className="rounded-card border border-border p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{t(locale, 'wizard.review.profile')}</h3>
          <Link href="/profile" className={editButton}>
            {t(locale, 'wizard.review.edit')}
          </Link>
        </div>
        <p className="mt-1 text-sm font-medium">{profile?.fullName ?? '—'}</p>
        {profile ? (
          <p className="text-xs text-muted-foreground">
            {profile.groupName} · {t(locale, 'wizard.profile.course', { course: profile.course })} ·{' '}
            {profile.faculty}
          </p>
        ) : null}
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="wizard-consent"
          checked={consent}
          onChange={(event) => onConsent(event.target.checked)}
          className="mt-0.5 size-4 accent-coral-600"
        />
        <span>
          <span className="font-semibold">{t(locale, 'wizard.consent.strong')}</span>{' '}
          {t(locale, 'wizard.consent.rest')}
        </span>
      </label>

      {submitError ? (
        <p
          data-testid="wizard-submit-error"
          role="alert"
          className="rounded-button border border-error-soft bg-error-soft px-3 py-2 text-xs text-error-ink"
        >
          {submitError}
        </p>
      ) : null}
    </div>
  );
}

// ── успех ────────────────────────────────────────────────────────────────────

function SuccessScreen({
  number,
  instant,
  duplicate,
  etaLabel,
  locale = 'ru',
}: {
  number: string;
  instant: boolean;
  duplicate: boolean;
  etaLabel: string | null;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  return (
    <div data-testid="wizard-success" className="flex flex-col items-center py-2 text-center">
      {/* DIG-16: декоративная ИИ-иллюстрация «Справка готова» (alt=""). */}
      <Illustration name="success" className="size-24 md:size-28" />

      <h3 className="mt-3 text-lg font-extrabold tracking-heading">
        {instant ? t(locale, 'wizard.success.instantTitle') : t(locale, 'wizard.success.sentTitle')}
      </h3>
      {duplicate ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t(locale, 'wizard.success.duplicate')}
        </p>
      ) : (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {instant ? t(locale, 'wizard.success.instantDesc') : t(locale, 'wizard.success.sentDesc')}
        </p>
      )}

      <p data-testid="wizard-success-number" className="mt-3 text-sm font-bold">
        {number}
      </p>

      <div className="mt-4 flex w-full flex-col items-center gap-2.5">
        {instant ? (
          <a
            data-testid="wizard-success-download"
            href={`/api/requests/${number}/document`}
            className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'w-full sm:w-auto')}
          >
            {t(locale, 'wizard.success.download')}
          </a>
        ) : etaLabel ? (
          <p data-testid="wizard-success-eta" className="text-sm text-muted-foreground">
            {t(locale, 'requests.readyBy', { date: etaLabel })}
          </p>
        ) : null}

        <Link
          data-testid="wizard-success-track"
          href={`/requests/${number}`}
          className="text-sm font-semibold text-coral-600 underline-offset-2 hover:underline"
        >
          {t(locale, 'wizard.success.track')}
        </Link>
      </div>
    </div>
  );
}
