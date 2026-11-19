// DIG-78 — контракт переключателя «Озвучка и голосовой ввод» (jsdom):
//  - aria-checked меняется только ПОСЛЕ успешного завершения
//    saveVoiceAssistantAction (не опережает запись оптимистично): e2e
//    voice-assistant.spec:58 перезагружает страницу сразу после включения;
//  - settings-мок: toggle → save → перечитать строку настроек — значение
//    сохранено;
//  - отказ action'а откатывает переключатель к сохранённому состоянию и
//    сообщает об ошибке; повторный клик после сбоя снова пытается сохранить.
// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';

const state = vi.hoisted(() => ({
  saveAction: vi.fn<(enabled: boolean) => Promise<boolean>>(),
}));

vi.mock('@/server/actions/settings', () => ({
  saveVoiceAssistantAction: state.saveAction,
}));

import { VoiceSettings } from '@/components/settings/voice-settings';

/** Строка StudentSettings — «БД», которую сервер пишет, а тест перечитывает. */
const settingsRow = { voiceAssistant: true };

const toggle = () => screen.getByRole('switch', { name: 'Озвучка и голосовой ввод' });

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  settingsRow.voiceAssistant = true;
  state.saveAction.mockReset();
  // Серверная сторона контракта: action записывает поле в строку настроек и
  // возвращает успех (тот же эффект, что updateOwnVoiceAssistant +
  // saveSettingsByStudent скоупленной сессии).
  state.saveAction.mockImplementation(async (enabled: boolean) => {
    settingsRow.voiceAssistant = enabled;
    return true;
  });
});

describe('VoiceSettings — сохранение «Озвучка и голосовой ввод» (DIG-78)', () => {
  it('включение: aria-checked=true после записи; перечитанная строка — включено', async () => {
    settingsRow.voiceAssistant = false;
    render(<VoiceSettings voiceAssistant={false} />);
    expect(toggle()).toHaveAttribute('aria-checked', 'false');

    await act(async () => {
      fireEvent.click(toggle());
    });
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'true'));

    // Перезагрузка страницы: серверное перечитывание строки настроек.
    expect(settingsRow.voiceAssistant).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(/Сохранено/);
  });

  it('в полёте action\'а переключатель НЕ опережает запись (без optimistic-гонки)', async () => {
    settingsRow.voiceAssistant = false;
    let finishSave: ((ok: boolean) => void) | null = null;
    state.saveAction.mockImplementation(
      (enabled: boolean) =>
        new Promise<boolean>((resolve) => {
          finishSave = (ok) => {
            if (ok) settingsRow.voiceAssistant = enabled; // запись по подтверждении
            resolve(ok);
          };
        }),
    );

    render(<VoiceSettings voiceAssistant={false} />);
    expect(toggle()).toHaveAttribute('aria-checked', 'false');

    // Клик при зависшем action'е: aria-checked остаётся прежним (false),
    // статус — «Сохранение…».
    await act(async () => {
      fireEvent.click(toggle());
    });
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(/Сохранение/);

    // Server подтвердил запись → переключатель и перечитанная строка = true.
    await act(async () => {
      finishSave?.(true);
    });
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'true'));
    expect(settingsRow.voiceAssistant).toBe(true);
  });

  it('выключение: aria-checked=false после записи; перечитанная строка — выключено', async () => {
    settingsRow.voiceAssistant = true;
    render(<VoiceSettings voiceAssistant={true} />);
    expect(toggle()).toHaveAttribute('aria-checked', 'true');

    await act(async () => {
      fireEvent.click(toggle());
    });
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'false'));

    expect(settingsRow.voiceAssistant).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent(/Сохранено/);
  });

  it('отказ сохранения: переключатель откатывается, статус — ошибка, БД не менялась', async () => {
    settingsRow.voiceAssistant = true;
    state.saveAction.mockResolvedValue(false); // не студент / сбой слоя данных
    render(<VoiceSettings voiceAssistant={true} />);
    expect(toggle()).toHaveAttribute('aria-checked', 'true');

    await act(async () => {
      fireEvent.click(toggle());
    });
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/Не удалось сохранить/),
    );
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(settingsRow.voiceAssistant).toBe(true);
  });
});
