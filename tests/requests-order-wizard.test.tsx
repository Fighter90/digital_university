// DIG-31 — поведение мастера заказа (jsdom): прогресс «Шаг N из 3»,
// предвыбор типа и смена типа, по-полевая валидация шага «Параметры»,
// сводка с «Изменить» и согласием на шаге «Проверка», подтверждение
// «Выйти без сохранения?» при закрытии с черновиком, экран успеха
// мгновенной справки («Скачать PDF», номер, «Следить за статусом»).
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import type { RequestActionState } from '@/server/actions/requests';
import type { OrderWizardProps, WizardTypeDto } from '@/components/requests/order-wizard';
import { OrderWizard } from '@/components/requests/order-wizard';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

afterEach(cleanup);

const CERT_TYPE: WizardTypeDto = {
  code: 'CERT_ENROLLMENT',
  name: 'Справка об обучении',
  etaDays: 1,
  format: 'ELECTRONIC',
  isInstant: true,
  formSchema: {
    keyField: 'purpose',
    fields: [
      {
        key: 'purpose',
        label: 'Назначение',
        type: 'enum',
        required: true,
        options: ['для банка', 'для военкомата'],
      },
    ],
  },
};

const EXTRACT_TYPE: WizardTypeDto = {
  code: 'GRADES_EXTRACT',
  name: 'Выписка оценок',
  etaDays: 1,
  format: 'ELECTRONIC',
  isInstant: true,
  formSchema: null,
};

const TYPES = [CERT_TYPE, EXTRACT_TYPE];
const PROFILE = { fullName: 'Илья Смирнов', groupName: 'ЭК-11', course: 1, faculty: 'ЭК' };

function baseProps(overrides: Partial<OrderWizardProps> = {}): OrderWizardProps {
  return {
    types: TYPES,
    profile: PROFILE,
    orderParam: 'cert-defer',
    autoTarget: { typeCode: 'CERT_ENROLLMENT', preset: { purpose: 'для военкомата' } },
    action: vi.fn(async (): Promise<RequestActionState> => ({
      ok: true,
      number: 'ЗД-2026-000777',
    })),
    ...overrides,
  };
}

function renderWizard(props: OrderWizardProps = baseProps()) {
  return render(<OrderWizard {...props} />);
}

const next = () => screen.getByTestId('wizard-next');
const back = () => screen.getByTestId('wizard-back');

describe('шаг 1 «Что нужно»', () => {
  it('прогресс «Шаг 1 из 3», предвыбранный тип с назначением-пресетом, смену типа', () => {
    renderWizard();
    expect(screen.getByTestId('order-wizard')).toBeTruthy();
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Шаг 1 из 3');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

    // Предвыбор из каталога: справка об обучении выбрана, назначение придёт пресетом.
    const selected = screen.getByTestId('wizard-type-option-CERT_ENROLLMENT');
    expect(selected).toHaveAttribute('data-selected', 'true');
    const radio = screen.getByRole('radio', { name: /Справка об обучении/ });
    expect(radio).toBeChecked();

    // Тип можно сменить в том же списке.
    fireEvent.click(screen.getByRole('radio', { name: /Выписка оценок/ }));
    expect(screen.getByTestId('wizard-type-option-GRADES_EXTRACT')).toHaveAttribute(
      'data-selected',
      'true',
    );
    expect(screen.getByTestId('wizard-type-option-CERT_ENROLLMENT')).toHaveAttribute(
      'data-selected',
      'false',
    );
  });

  it('«Далее» без выбора типа заблокирован, с выбором — ведёт на шаг 2', () => {
    renderWizard(baseProps({ orderParam: 'new', autoTarget: null }));
    expect(next()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Справка об обучении/ }));
    fireEvent.click(next());
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Шаг 2 из 3');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  });

  it('карточка типа показывает срок, формат и одну строку «что это за документ»', () => {
    renderWizard();
    const cert = screen.getByTestId('wizard-type-option-CERT_ENROLLMENT');
    expect(cert.textContent).toContain('Мгновенно');
    expect(cert.textContent).toContain('PDF');
    expect(cert.textContent).toContain('Подтверждает, что вы студент');
  });
});

describe('шаг 2 «Параметры»', () => {
  function goToStep2(props: OrderWizardProps = baseProps()) {
    renderWizard(props);
    fireEvent.click(next());
  }

  it('поля типа и общие поля мастера; данные профиля подставлены только для чтения', () => {
    goToStep2();
    // Поле из JSON-схемы типа с пресетом каталога.
    const purpose = screen.getByTestId('wizard-field-purpose') as HTMLSelectElement;
    expect(purpose).toHaveValue('для военкомата');
    // Общие поля.
    expect(screen.getByTestId('wizard-destination')).toBeTruthy();
    expect(screen.getByTestId('wizard-copies')).toHaveValue('1');
    expect(screen.getByRole('radio', { name: 'PDF в кабинете' })).toBeChecked();
    expect(screen.getByTestId('wizard-comment')).toBeTruthy();
    expect(screen.getByTestId('wizard-files')).toBeTruthy();
    // Профиль — из данных кабинета, не вводится заново.
    const profile = screen.getByTestId('wizard-profile-block');
    expect(profile.textContent).toContain('Илья Смирнов');
    expect(profile.textContent).toContain('ЭК-11');
    // «Назад» возвращает на шаг 1.
    fireEvent.click(back());
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Шаг 1 из 3');
  });

  it('пустое обязательное поле типа даёт ошибку под полем и не пускает дальше', () => {
    goToStep2(
      baseProps({
        autoTarget: { typeCode: 'CERT_ENROLLMENT' },
        orderParam: 'cert-enrollment',
      }),
    );
    fireEvent.click(next());
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Шаг 2 из 3');
    const error = screen.getByTestId('wizard-field-error-purpose');
    expect(error.textContent).toContain('Назначение');
    // После заполнения — пускает дальше.
    fireEvent.change(screen.getByTestId('wizard-field-purpose'), {
      target: { value: 'для банка' },
    });
    fireEvent.click(next());
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Шаг 3 из 3');
  });

  it('тип без полей формы (formSchema null) не показывает поле «Назначение»', () => {
    goToStep2(baseProps({ orderParam: 'cert-grades', autoTarget: { typeCode: 'GRADES_EXTRACT' } }));
    expect(screen.queryByTestId('wizard-field-purpose')).toBeNull();
    expect(screen.getByTestId('wizard-destination')).toBeTruthy();
  });

  it('вложения: поле файлов, подсказка лимитов и (после выбора) список с удалением', () => {
    goToStep2();
    const input = screen.getByTestId('wizard-files');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('multiple');
    expect(
      screen.getByTestId('wizard-destination').closest('div')?.parentElement?.textContent,
    ).toContain('до 5 файлов');
    // Реальный выбор файлов покрывает e2e (setInputFiles): лимиты — общая
    // функция wizardFilesError, покрытая юнит-тестами схемы.
  });
});

describe('шаг 3 «Проверка»', () => {
  function goToStep3() {
    renderWizard();
    fireEvent.click(next());
    fireEvent.click(next());
  }

  it('сводка по блокам с «Изменить», согласие «Данные верны» блокирует отправку', () => {
    goToStep3();
    expect(screen.getByTestId('wizard-summary-document').textContent).toContain(
      'Справка об обучении',
    );
    expect(screen.getByTestId('wizard-summary-document').textContent).toContain('для военкомата');
    expect(screen.getByTestId('wizard-summary-params').textContent).toContain('PDF в кабинете');
    expect(screen.getByTestId('wizard-summary-profile').textContent).toContain('Илья Смирнов');
    expect(screen.getByTestId('wizard-edit-document')).toBeTruthy();
    expect(screen.getByTestId('wizard-edit-params')).toBeTruthy();

    const submit = screen.getByTestId('wizard-submit');
    expect(submit).toBeDisabled();
    // BUG-20/DIG-85: неактивная кнопка объясняется подписью рядом.
    const hint = screen.getByTestId('wizard-consent-hint');
    expect(hint).toBeVisible();
    expect(hint.textContent).toContain('согласи');
    fireEvent.click(screen.getByTestId('wizard-consent'));
    expect(submit).toBeEnabled();
    expect(screen.queryByTestId('wizard-consent-hint')).toBeNull();
  });

  it('«Изменить» возвращает на соответствующий шаг с сохранением значений', () => {
    goToStep3();
    fireEvent.click(screen.getByTestId('wizard-edit-params'));
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Шаг 2 из 3');
    expect((screen.getByTestId('wizard-field-purpose') as HTMLSelectElement).value).toBe(
      'для военкомата',
    );
    // Шаг 1 и обратно — значения не потеряны.
    fireEvent.click(back());
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Шаг 1 из 3');
    fireEvent.click(screen.getByTestId('wizard-type-option-CERT_ENROLLMENT'));
    fireEvent.click(next());
    expect((screen.getByTestId('wizard-field-purpose') as HTMLSelectElement).value).toBe(
      'для военкомата',
    );
  });

  it('отправка собирает typeCode, params и мету мастера в FormData; успех мгновенной — «Скачать PDF»', async () => {
    let sent: FormData | null = null;
    const action = vi.fn(
      async (_prev: RequestActionState, fd: FormData): Promise<RequestActionState> => {
        sent = fd;
        return { ok: true, number: 'ЗД-2026-000777' };
      },
    );
    renderWizard(baseProps({ action }));
    fireEvent.click(next());
    fireEvent.click(next());
    fireEvent.click(screen.getByTestId('wizard-consent'));
    fireEvent.click(screen.getByTestId('wizard-submit'));

    await waitFor(() => expect(screen.getByTestId('wizard-success')).toBeTruthy());
    expect(sent).toBeTruthy();
    expect(sent!.get('typeCode')).toBe('CERT_ENROLLMENT');
    expect(JSON.parse(String(sent!.get('params')))).toEqual({ purpose: 'для военкомата' });
    const wizard = JSON.parse(String(sent!.get('wizard')));
    expect(wizard.language).toBe('RU');
    expect(wizard.copies).toBe(1);
    expect(wizard.delivery).toBe('PDF_ONLINE');

    // Экран успеха мгновенного типа.
    expect(screen.getByTestId('wizard-success-number').textContent).toContain('ЗД-2026-000777');
    expect(screen.getByTestId('wizard-success-download')).toHaveAttribute(
      'href',
      '/api/requests/ЗД-2026-000777/document',
    );
    expect(screen.getByTestId('wizard-success-track')).toHaveAttribute(
      'href',
      '/requests/ЗД-2026-000777',
    );
    // Успех без черновика закрывается без подтверждения.
    fireEvent.click(screen.getByTestId('wizard-done'));
    await waitFor(() => expect(screen.queryByTestId('order-wizard')).toBeNull());
  });

  it('ошибка сервера показывается алертом на шаге 3', async () => {
    const action = vi.fn(async (): Promise<RequestActionState> => ({
      ok: false,
      error: 'Выберите тип заявки из списка',
    }));
    renderWizard(baseProps({ action }));
    fireEvent.click(next());
    fireEvent.click(next());
    fireEvent.click(screen.getByTestId('wizard-consent'));
    fireEvent.click(screen.getByTestId('wizard-submit'));
    await waitFor(() => expect(screen.getByTestId('wizard-submit-error')).toBeTruthy());
    expect(screen.getByTestId('wizard-submit-error').textContent).toContain(
      'Выберите тип заявки из списка',
    );
  });

  it('немгновенный тип: успех без «Скачать PDF», с датой готовности по SLA', async () => {
    const paper: WizardTypeDto = {
      code: 'DIPLOMA_COPY',
      name: 'Дубликат диплома',
      etaDays: 5,
      format: 'PAPER',
      isInstant: false,
      formSchema: {
        keyField: 'reason',
        fields: [{ key: 'reason', label: 'Причина', type: 'text', required: true }],
      },
    };
    renderWizard(
      baseProps({ types: [paper], orderParam: 'new', autoTarget: { typeCode: 'DIPLOMA_COPY' } }),
    );
    fireEvent.click(next());
    fireEvent.change(screen.getByTestId('wizard-field-reason'), { target: { value: 'утрата' } });
    fireEvent.click(next());
    fireEvent.click(screen.getByTestId('wizard-consent'));
    fireEvent.click(screen.getByTestId('wizard-submit'));
    await waitFor(() => expect(screen.getByTestId('wizard-success')).toBeTruthy());
    expect(screen.getByTestId('wizard-success').textContent).toContain('Заявка отправлена');
    expect(screen.queryByTestId('wizard-success-download')).toBeNull();
    expect(screen.getByTestId('wizard-success-eta').textContent).toMatch(/Готовность до/);
    expect(screen.getByTestId('wizard-success-track')).toBeTruthy();
  });
});

describe('черновик и закрытие', () => {
  beforeEach(() => replaceMock.mockClear());

  it('закрытие с черновиком требует подтверждения; «Продолжить заполнение» сохраняет значения', () => {
    renderWizard(baseProps({ orderParam: 'new', autoTarget: null }));
    fireEvent.click(screen.getByRole('radio', { name: /Справка об обучении/ }));
    fireEvent.click(next());
    fireEvent.change(screen.getByTestId('wizard-comment'), { target: { value: 'черновик' } });

    // Крестик при грязном черновике не закрывает сразу.
    fireEvent.click(screen.getByTestId('wizard-close'));
    expect(screen.getByTestId('wizard-exit-confirm')).toBeTruthy();
    expect(screen.getByTestId('wizard-exit-confirm').textContent).toContain(
      'Выйти без сохранения?',
    );

    fireEvent.click(screen.getByTestId('wizard-exit-stay'));
    expect(screen.queryByTestId('wizard-exit-confirm')).toBeNull();
    expect(screen.getByTestId('order-wizard')).toBeTruthy();
    expect((screen.getByTestId('wizard-comment') as HTMLTextAreaElement).value).toBe('черновик');
  });

  it('«Выйти без сохранения» закрывает мастер и сбрасывает черновик', () => {
    renderWizard(baseProps({ orderParam: 'new', autoTarget: null }));
    fireEvent.click(screen.getByRole('radio', { name: /Справка об обучении/ }));
    fireEvent.click(next());
    fireEvent.change(screen.getByTestId('wizard-comment'), { target: { value: 'черновик' } });
    fireEvent.click(screen.getByTestId('wizard-close'));
    fireEvent.click(screen.getByTestId('wizard-exit-discard'));
    expect(screen.queryByTestId('order-wizard')).toBeNull();
    // Параметр заказа убран из адресной строки: перезагрузка не откроет мастер.
    expect(replaceMock).toHaveBeenCalledWith('/requests', { scroll: false });
  });

  it('закрытие без черновика (шаг 1, ничего не менялось) не спрашивает подтверждение', () => {
    renderWizard(baseProps({ orderParam: 'new', autoTarget: null }));
    fireEvent.click(screen.getByTestId('wizard-close'));
    expect(screen.queryByTestId('order-wizard')).toBeNull();
    expect(screen.queryByTestId('wizard-exit-confirm')).toBeNull();
  });
});
