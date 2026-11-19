# DIG-65 — «Прослушать день» и голосовой ввод: voice-AI в кабинете

## Why

Тренд Product Hunt: voice-AI (ElevenLabs, Cartesia, Deepgram) — голосовые
интерфейсы стали массовым паттерном. В кабинете голоса нет вовсе: расписание
читают глазами, AI-гид принимает вопрос только с клавиатуры. Для конкурса это
две упущенные точки: доступность (расписание можно «послушать», не глядя в
экран — в дороге, на бегу, при слабом зрении) и модный демо-паттерн
(диктовка ассистенту голосом). Обе функции реализуются средствами браузера
(Web Speech API) — без внешних ключей и без отправки данных кабинета наружу
из нашего кода.

## What Changes

- **«Прослушать день»**: клиентская кнопка `ListenDayButton` на виде
  «День» (десктоп, `DayView`) и в мобильном виде дня (`MobileSchedule`).
  По клику текст дня собирается детерминированно
  (`buildDaySpeechText`) и озвучивается браузерным `speechSynthesis`
  (ru-RU). Повторный клик останавливает. Отменённые пары не читаются,
  перенос помечается словами «пара перенесена», пустой день и
  «все отменены» озвучиваются честным текстом.
- **Голосовой ввод в AI-гиде**: кнопка-микрофон рядом со свободным вводом
  (`ai-guide-form`). Распознавание — Web Speech API браузера
  (`SpeechRecognition` / `webkitSpeechRecognition`, ru-RU); расшифровка
  дописывается в поле вопроса. Браузер без поддержки — кнопка не
  отрисовывается (честно, без мёртвой кнопки).
- **Отключаемость**: новая настройка студента `voiceAssistant` (по
  умолчанию включена) на вкладке «Вид» экрана «Настройки» — карточка
  «Голосовой ассистент» с переключателем. Выключено → кнопка озвучки и
  микрофон скрыты во всём кабинете (server action + revalidate layout).
  Сотруднику кабинета голосовые функции недоступны (гид и расписание
  студентские).
- **Хранение**: поле `voiceAssistant: boolean` в строке настроек студента
  (`StudentSettingsRow`, дефолт `true`, легаси-строки нормализуются).
  Мутация — `updateOwnVoiceAssistant` (скоуплен сессией, staff → null +
  аудит) и server action `saveVoiceAssistantAction`.
- **Роль**: доступность проверяется в UI по `ShellUser.voiceAssistant`
  (студент — из своих настроек, fail-soft как в DIG-50; сотрудник — false).

## Impact

- Спека: новая capability `voice-assistant` (delta — ADDED requirements).
- Чистый модуль: `src/lib/voice-assistant.ts` (сборка текста дня,
  детект `speechSynthesis` / `SpeechRecognition`, минимальные типы).
- Клиентские компоненты: `src/components/schedule/listen-day-button.tsx`,
  `src/components/shell/voice-input.tsx`, `src/components/settings/voice-settings.tsx`.
- Точки монтирования: `DayView`, `MobileSchedule`, `AiGuide` (+ `Shell`
  прокидывает флаг из `ShellUser`), страница `/schedule` (читает настройки),
  страница `/settings` (карточка на вкладке «Вид»), `ShellUser`/`resolveShellUser`.
- Тесты: `tests/voice-assistant.test.ts` (чистый модуль),
  `tests/voice-assistant-components.test.tsx` (jsdom, интерактив с моками
  Web Speech API), расширения `tests/schedule-page.test.tsx`,
  `tests/settings-page.test.tsx`, `tests/shell-user.test.ts`,
  `tests/ai-guide.test.tsx`, `e2e/voice-assistant.spec.ts`.

## Non-goals

- Никаких внешних TTS/STT-сервисов и API-ключей: только браузерные
  `speechSynthesis` и `SpeechRecognition`. Качество голоса — на стороне
  браузера пользователя.
- Никакого серверного распознавания и сохранения расшифровок: сказанное
  живёт только в поле ввода гида, никуда не пишется.
- Отдельный экран `/ai-assistant` (диалог с ассистентом) — вне задачи
  (см. DIG-59/DIG-62); голосовой ввод встраивается в существующий гид.
- Озвучка недельного/месячного вида — вне задачи (только выбранный день).
