'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, CornerDownRight, Sparkles, X } from 'lucide-react';

import type { ShellUserRole } from '@/lib/user';
import {
  GUIDE_SCENARIOS,
  TOUR_STEPS,
  isGuideSeen,
  markGuideSeen,
  matchAiGuideScenario,
  type AiGuideScenario,
} from '@/lib/ai-guide';
import { VoiceInputButton } from '@/components/shell/voice-input';

type AiGuideProps = {
  /** Имя из шапки кабинета — для личного приветствия («Привет, Анна!»). */
  userName: string;
  role: ShellUserRole;
  /**
   * DIG-65 — настройка «Озвучка и голосовой ввод»: false прячет микрофон
   * голосового ввода. Дефолт true (включено) — как в настройках студента.
   */
  voiceEnabled?: boolean;
};

type GuideView =
  | { kind: 'welcome' }
  | { kind: 'tour'; step: number }
  | { kind: 'answer'; scenario: AiGuideScenario }
  | { kind: 'miss'; question: string };

// DIG-62 — AI-гид по кабинету (тренд Product Hunt: агент ведёт пользователя).
// Первый вход студента: панель раскрывается один раз и предлагает экскурсию
// «расписание → оценки → заявки → справки»; сценарии-подсказки отвечают
// кнопкой-ссылкой на нужный экран. Любой показ/закрытие пишут флаг в
// localStorage — повторные входы панель не открывают; гид остаётся доступен
// вручную пилюлей. Компонент не-модальный (role=dialog без aria-modal),
// живёт вне <main> и не перехватывает ввод вне своих границ; сотруднику
// кабинета гид не отрисовывается.
//
// Раунд 2 (ревью DIG-62):
//  - на мобильном панель и пилюля подняты НАД плавающей AI-кнопкой (AiFab,
//    тот же нижне-правый угол) — гид её не перекрывает и не наезжает на неё;
//  - фокус: открытие панели переводит фокус в диалог (скринридер анонсирует
//    его имя), закрытие возвращает фокус на пилюлю; смена вида (ответ,
//    шаг экскурсии) анонсируется через aria-live-область.
export function AiGuide({ userName, role, voiceEnabled = true }: AiGuideProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<GuideView>({ kind: 'welcome' });
  const [question, setQuestion] = useState('');
  // Гидрация: авто-показ решается в эффекте (localStorage читается только
  // на клиенте), поэтому SSR рисует пилюлю — расхождений гидратации нет.
  const checkedRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  // Предыдущее состояние «открыто»: возврат фокуса на пилюлю нужен только
  // при настоящем закрытии, а не при первом рендере с open=false.
  const wasOpenRef = useRef(false);

  // Управление фокусом между пилюлей и панелью (раунд 2).
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else if (wasOpenRef.current) {
      pillRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  const collapse = useCallback(() => {
    setOpen(false);
    setView({ kind: 'welcome' });
    setQuestion('');
  }, []);

  const finish = useCallback(() => {
    markGuideSeen();
    collapse();
  }, [collapse]);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    // Первый вход студента: показываем один раз и сразу фиксируем показ,
    // чтобы подсказка не мешала повторным входам (сессиям/перезагрузкам).
    if (role !== 'STUDENT' || isGuideSeen() || window.location.pathname !== '/dashboard') {
      return;
    }
    // Показ откладывается на микротаску: SSR рисует пилюлю (гидратация не
    // расходится), а синхронный setState в теле эффекта запрещён линтом
    // (react-hooks/set-state-in-effect — каскадные рендеры).
    queueMicrotask(() => {
      markGuideSeen();
      setOpen(true);
    });
  }, [role]);

  if (role !== 'STUDENT') return null;

  const firstName = userName.split(' ')[0] ?? userName;

  const ask = (query: string) => {
    const scenario = matchAiGuideScenario(query);
    setQuestion('');
    if (scenario) {
      setView({ kind: 'answer', scenario });
    } else {
      setView({ kind: 'miss', question: query.trim() });
    }
  };

  const onFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(question);
  };

  return (
    <>
      {open ? (
        <section
          ref={panelRef}
          data-testid="ai-guide-panel"
          role="dialog"
          aria-label="AI-гид по кабинету"
          // Раунд 2: не-модальный диалог — фокус не запираем (tabIndex=-1,
          // без aria-modal), клик вне панели работает как раньше.
          tabIndex={-1}
          aria-modal={false}
          className="fixed inset-x-3 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-neutral-200 bg-card p-4 shadow-xl outline-none md:inset-x-auto md:bottom-6 md:right-20 md:w-96"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-extrabold tracking-heading">
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral-500 to-amber-400 text-white"
              >
                <Sparkles className="size-4" />
              </span>
              AI-гид по кабинету
            </p>
            <button
              type="button"
              onClick={finish}
              aria-label="Закрыть AI-гида"
              data-testid="ai-guide-close"
              className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Смена вида (приветствие → экскурсия → ответ) анонсируется
              скринридеру: содержимое области меняется динамически. */}
          <div data-testid="ai-guide-live" aria-live="polite">
            {view.kind === 'welcome' ? (
              <div data-testid="ai-guide-welcome">
                <p className="mt-2 text-sm text-neutral-700">
                  Привет, {firstName}! Я — демо-гид кабинета. Могу провести экскурсию:{' '}
                  <span className="font-semibold">расписание → оценки → заявки → справки</span>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView({ kind: 'tour', step: 0 })}
                    className="inline-flex items-center gap-1.5 rounded-button bg-coral-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600 focus-visible:outline-2 focus-visible:outline-coral-600"
                  >
                    <Compass className="size-4" aria-hidden="true" />
                    Начать экскурсию
                  </button>
                  <button
                    type="button"
                    onClick={finish}
                    className="inline-flex items-center rounded-button border border-border px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                  >
                    Пропустить
                  </button>
                </div>

                {/* Сценарии-подсказки: чипы + свободный вопрос. */}
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Спросите меня
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GUIDE_SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => ask(scenario.question)}
                        className="rounded-pill bg-muted px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-coral-600"
                      >
                        {scenario.question}
                      </button>
                    ))}
                  </div>
                  <form
                    data-testid="ai-guide-form"
                    onSubmit={onFormSubmit}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      data-testid="ai-guide-input"
                      type="text"
                      aria-label="Ваш вопрос гиду"
                      placeholder="Например: где мои справки?"
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
                    />
                    {/* DIG-65 — голосовой ввод (Web Speech API браузера): финальная
                        расшифровка дописывается в поле вопроса. Скрыт при
                        выключенной настройке или без поддержки браузера. */}
                    {voiceEnabled ? (
                      <VoiceInputButton
                        onResult={(text) =>
                          setQuestion((current) => (current ? `${current} ${text}` : text))
                        }
                      />
                    ) : null}
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                    >
                      Спросить
                    </button>
                  </form>
                </div>
              </div>
            ) : view.kind === 'tour' ? (
              <div data-testid="ai-guide-step">
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Экскурсия · шаг {view.step + 1} из {TOUR_STEPS.length}
                </p>
                <p className="mt-1 text-sm font-bold">{TOUR_STEPS[view.step].title}</p>
                <p className="mt-1 text-sm text-neutral-700">{TOUR_STEPS[view.step].description}</p>
                {/* Кнопка шага — ссылка: гид закрывается и переходит на экран. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={TOUR_STEPS[view.step].href}
                    onClick={finish}
                    data-testid="ai-guide-step-cta"
                    className="inline-flex items-center gap-1.5 rounded-button bg-coral-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600 focus-visible:outline-2 focus-visible:outline-coral-600"
                  >
                    Открыть «{TOUR_STEPS[view.step].title}»
                    <CornerDownRight className="size-4" aria-hidden="true" />
                  </Link>
                  {view.step < TOUR_STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setView({ kind: 'tour', step: view.step + 1 })}
                      className="inline-flex items-center rounded-button border border-border px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                    >
                      Дальше
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={finish}
                      className="inline-flex items-center rounded-button border border-border px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                    >
                      Завершить экскурсию
                    </button>
                  )}
                </div>
              </div>
            ) : view.kind === 'answer' ? (
              <div data-testid="ai-guide-answer">
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Вопрос: «{view.scenario.question}»
                </p>
                <p className="mt-1 text-sm text-neutral-700">{view.scenario.answer}</p>
                {/* Ответ — ссылкой-кнопкой на нужный экран (приёмка DIG-62). */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={view.scenario.cta.href}
                    onClick={finish}
                    data-testid="ai-guide-answer-cta"
                    className="inline-flex items-center gap-1.5 rounded-button bg-coral-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-600 focus-visible:outline-2 focus-visible:outline-coral-600"
                  >
                    {view.scenario.cta.label}
                    <CornerDownRight className="size-4" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setView({ kind: 'welcome' })}
                    className="inline-flex items-center rounded-button border border-border px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                  >
                    Назад к подсказкам
                  </button>
                </div>
              </div>
            ) : (
              <div data-testid="ai-guide-miss">
                <p className="mt-2 text-sm text-neutral-700">
                  Вопроса «{view.question}» пока нет в демо-сценариях гида — в прототипе я отвечаю
                  только на базовые подсказки. Попробуйте одну из них:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {GUIDE_SCENARIOS.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => ask(scenario.question)}
                      className="rounded-pill bg-muted px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-coral-600"
                    >
                      {scenario.question}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'welcome' })}
                  className="mt-3 inline-flex items-center rounded-button border border-border px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                >
                  Назад к подсказкам
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <button
          type="button"
          ref={pillRef}
          onClick={() => setOpen(true)}
          aria-label="Открыть AI-гида"
          data-testid="ai-guide-pill"
          className="fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom))] right-3 z-40 inline-flex items-center gap-1.5 rounded-pill border border-neutral-200 bg-card px-3 py-2 text-xs font-semibold text-neutral-800 shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600 md:bottom-6 md:right-20"
        >
          <Sparkles className="size-3.5 text-coral-500" aria-hidden="true" />
          AI-гид
        </button>
      )}
    </>
  );
}
