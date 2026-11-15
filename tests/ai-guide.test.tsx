// DIG-62 — AI-гид по кабинету (unit, jsdom): чистый модуль (шаги экскурсии,
// сценарии-подсказки, seen-флаг) и поведение компонента в Shell (первый
// показ на /dashboard, экскурсия, ответы-ссылки, закрытие, повторный вход).
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  GUIDE_STORAGE_KEY,
  TOUR_STEPS,
  matchAiGuideScenario,
  markGuideSeen,
  isGuideSeen,
} from '@/lib/ai-guide';
import { AiGuide } from '@/components/shell/ai-guide';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/dashboard');
});

afterEach(() => {
  cleanup();
});

describe('модуль ai-guide: шаги экскурсии (DIG-62)', () => {
  it('ровно 4 шага в порядке «расписание → оценки → заявки → справки»', () => {
    expect(TOUR_STEPS.map((step) => step.href)).toEqual([
      '/schedule',
      '/grades',
      '/requests',
      '/services',
    ]);
    expect(TOUR_STEPS.every((step) => step.title.length > 0)).toBe(true);
    expect(TOUR_STEPS.every((step) => step.description.length > 0)).toBe(true);
    // Все шаги ведут на внутренние экраны кабинета.
    expect(TOUR_STEPS.every((step) => step.href.startsWith('/'))).toBe(true);
  });
});

describe('модуль ai-guide: сценарии-подсказки (DIG-62)', () => {
  it('«где мои справки?» отвечает ссылкой на каталог справок /services', () => {
    const scenario = matchAiGuideScenario('где мои справки?');
    expect(scenario).not.toBeNull();
    expect(scenario!.cta.href).toBe('/services');
  });

  it('«как записаться на пересдачу?» отвечает ссылкой на /grades/session', () => {
    const scenario = matchAiGuideScenario('Как записаться на пересдачу?');
    expect(scenario).not.toBeNull();
    expect(scenario!.cta.href).toBe('/grades/session');
  });

  it('понимает близкие формулировки по ключевым словам', () => {
    expect(matchAiGuideScenario('нужна справка об обучении')?.cta.href).toBe('/services');
    expect(matchAiGuideScenario('хочу записаться на пересдачу')?.cta.href).toBe('/grades/session');
  });

  it('неизвестный вопрос — null (гид не выдумывает ответ)', () => {
    expect(matchAiGuideScenario('когда стипендия?')).toBeNull();
    expect(matchAiGuideScenario('')).toBeNull();
  });
});

describe('модуль ai-guide: seen-флаг (DIG-62)', () => {
  it('markGuideSeen пишет флаг, isGuideSeen его читает', () => {
    expect(isGuideSeen()).toBe(false);
    markGuideSeen();
    expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe('1');
    expect(isGuideSeen()).toBe(true);
  });
});

describe('компонент AiGuide (DIG-62)', () => {
  it('первый вход студента на /dashboard раскрывает приветствие с экскурсией', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);

    const panel = await screen.findByTestId('ai-guide-panel');
    expect(panel).toBeVisible();
    expect(panel).toHaveTextContent('AI-гид');
    expect(panel).toHaveTextContent(/расписание.*оценки.*заявки.*справки/i);
    expect(screen.getByRole('button', { name: /начать экскурсию/i })).toBeVisible();

    // Показ на первом входе сам записывает seen — повторный вход не мешает.
    expect(isGuideSeen()).toBe(true);
  });

  it('сценарий-чип «Где мои справки?» даёт кнопку-ссылку на /services', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    await screen.findByTestId('ai-guide-panel');

    fireEvent.click(screen.getByRole('button', { name: /где мои справки\?/i }));

    const cta = await screen.findByTestId('ai-guide-answer-cta');
    expect(cta).toBeVisible();
    expect(cta).toHaveAttribute('href', '/services');
  });

  it('сценарий-чип «Как записаться на пересдачу?» ведёт на /grades/session', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    await screen.findByTestId('ai-guide-panel');

    fireEvent.click(screen.getByRole('button', { name: /как записаться на пересдачу\?/i }));

    const cta = await screen.findByTestId('ai-guide-answer-cta');
    expect(cta).toBeVisible();
    expect(cta).toHaveAttribute('href', '/grades/session');
  });

  it('свободный вопрос без совпадения — честный ответ без ссылки', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    await screen.findByTestId('ai-guide-panel');

    fireEvent.change(screen.getByTestId('ai-guide-input'), {
      target: { value: 'когда стипендия?' },
    });
    fireEvent.submit(screen.getByTestId('ai-guide-form'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-guide-miss')).toBeVisible();
    });
    expect(screen.queryByTestId('ai-guide-answer-cta')).toBeNull();
  });

  it('экскурсия: 4 шага, кнопка шага «Расписание» ведёт на /schedule', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    await screen.findByTestId('ai-guide-panel');

    fireEvent.click(screen.getByRole('button', { name: /начать экскурсию/i }));

    const step = await screen.findByTestId('ai-guide-step');
    expect(step).toBeVisible();
    expect(step).toHaveTextContent('Расписание');
    expect(step).toHaveTextContent('шаг 1 из 4');

    const cta = screen.getByTestId('ai-guide-step-cta');
    expect(cta).toHaveAttribute('href', '/schedule');

    // Пролистываем шаги вперёд: порядок расписание → оценки → заявки → справки.
    for (const [index, title] of ['Оценки', 'Заявки', 'Справки'].entries()) {
      fireEvent.click(screen.getByRole('button', { name: /дальше/i }));
      expect(await screen.findByTestId('ai-guide-step')).toHaveTextContent(title);
      expect(screen.getByTestId('ai-guide-step')).toHaveTextContent(`шаг ${index + 2} из 4`);
    }
  });

  it('«Пропустить» закрывает панель и запоминает отключение', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    await screen.findByTestId('ai-guide-panel');

    fireEvent.click(screen.getByRole('button', { name: /пропустить/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('ai-guide-panel')).toBeNull();
    });
    expect(isGuideSeen()).toBe(true);

    // Повторный рендер (новая «сессия»): панель сама не раскрывается.
    cleanup();
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    await waitFor(() => {
      expect(screen.queryByTestId('ai-guide-panel')).toBeNull();
    });
    // …но гида можно открыть вручную пилюлей.
    fireEvent.click(screen.getByRole('button', { name: /открыть ai-гида/i }));
    expect(await screen.findByTestId('ai-guide-panel')).toBeVisible();
  });

  it('повторный вход (seen уже записан) — панель не раскрывается сама', async () => {
    markGuideSeen();
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);

    await waitFor(() => {
      expect(screen.queryByTestId('ai-guide-panel')).toBeNull();
    });
    // Пилюля остаётся — гид доступен по требованию.
    expect(screen.getByRole('button', { name: /открыть ai-гида/i })).toBeVisible();
  });

  it('сотруднику кабинета гид не отрисовывается вовсе', async () => {
    render(<AiGuide userName="Декан Ковалёва" role="STAFF" />);

    await waitFor(() => {
      expect(screen.queryByTestId('ai-guide-panel')).toBeNull();
    });
    expect(screen.queryByRole('button', { name: /открыть ai-гида/i })).toBeNull();
  });

  // Раунд 2 (ревью DIG-62): панель — не-модальный диалог, при открытии фокус
  // уходит в панель (скринридер анонсирует её имя), при закрытии возвращается
  // на пилюлю; пилюля не теряется из фокуса после unmount.
  it('авто-показ на первом входе переводит фокус в панель (role=dialog)', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);

    const panel = await screen.findByTestId('ai-guide-panel');
    expect(panel).toHaveAttribute('role', 'dialog');
    await waitFor(() => {
      expect(panel).toHaveFocus();
    });
  });

  it('открытие пилюлей фокусирует панель, закрытие возвращает фокус на пилюлю', async () => {
    markGuideSeen();
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    await waitFor(() => {
      expect(screen.queryByTestId('ai-guide-panel')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /открыть ai-гида/i }));
    const panel = await screen.findByTestId('ai-guide-panel');
    await waitFor(() => {
      expect(panel).toHaveFocus();
    });

    fireEvent.click(screen.getByTestId('ai-guide-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('ai-guide-panel')).toBeNull();
    });
    expect(screen.getByRole('button', { name: /открыть ai-гида/i })).toHaveFocus();
  });

  it('смена вида (ответ на сценарий) анонсируется через aria-live-область', async () => {
    markGuideSeen();
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" />);
    fireEvent.click(screen.getByRole('button', { name: /открыть ai-гида/i }));
    await screen.findByTestId('ai-guide-panel');

    fireEvent.click(screen.getByRole('button', { name: /где мои справки\?/i }));
    await screen.findByTestId('ai-guide-answer-cta');

    const live = screen.getByTestId('ai-guide-live');
    expect(live).toHaveAttribute('aria-live', 'polite');
    // Кнопка-ссылка ответа живёт внутри анонсируемой области.
    expect(live).toContainElement(screen.getByTestId('ai-guide-answer-cta'));
  });
});

// DIG-65 — голосовой ввод в AI-гиде: микрофон в форме свободного ввода
// зависит от настройки «Озвучка и голосовой ввод» и поддержки браузером
// Web Speech API (в jsdom поддержка появляется только с моком).
describe('голосовой ввод в AiGuide (DIG-65)', () => {
  it('микрофон в форме есть при voiceEnabled=true и поддержке браузера', async () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: function FakeRec(this: Record<string, unknown>) {
        return this;
      },
    });
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" voiceEnabled />);
    await screen.findByTestId('ai-guide-panel');
    expect(screen.getByTestId('ai-guide-form')).toContainElement(
      screen.getByTestId('voice-input'),
    );
  });

  it('микрофона нет при voiceEnabled=false, поле вопроса и «Спросить» остаются', async () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: function FakeRec(this: Record<string, unknown>) {
        return this;
      },
    });
    markGuideSeen();
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" voiceEnabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /открыть ai-гида/i }));
    await screen.findByTestId('ai-guide-panel');
    expect(screen.queryByTestId('voice-input')).toBeNull();
    expect(screen.getByTestId('ai-guide-input')).toBeVisible();
  });

  it('без поддержки SpeechRecognition микрофона нет и при включённой настройке', async () => {
    render(<AiGuide userName="Анна Смирнова" role="STUDENT" voiceEnabled />);
    await screen.findByTestId('ai-guide-panel');
    expect(screen.queryByTestId('voice-input')).toBeNull();
  });
});
