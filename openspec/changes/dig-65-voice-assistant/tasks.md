# DIG-65 — задачи

## Спека и модуль

- [x] delta-спека `specs/voice-assistant/spec.md` (озвучка дня, голосовой
      ввод, настройка-отключение, деградация в браузерах без поддержки)
- [x] `src/lib/voice-assistant.ts`: `buildDaySpeechText` (детерминированный
      текст дня: счёт пар, отмена/перенос, «аудитория», онлайн),
      `isSpeechSynthesisSupported`, `getSpeechRecognitionCtor` + минимальные
      типы SpeechRecognition (SSR-safe)

## UI

- [x] `ListenDayButton` (client): «Прослушать день» ↔ «Остановить»,
      aria-pressed, отмена озвучки на unmount; скрыт при выключенной
      настройке или без поддержки браузера
- [x] кнопка в `DayView` (десктопный вид «День») и в `MobileSchedule`
      (мобильный вид дня, у заголовка выбранного дня)
- [x] `VoiceInputButton` (client): микрофон в `ai-guide-form`, ru-RU,
      финальная расшифровка дописывается в поле вопроса; скрыт при
      выключенной настройке или без поддержки браузера
- [x] `AiGuide`: проп `voiceEnabled` (из `ShellUser`), микрофон в форме
      свободного ввода
- [x] `Shell`: прокидывает `user.voiceAssistant` в `AiGuide`
- [x] страница `/schedule`: читает `getOwnSettings` и передаёт
      `voiceEnabled` в оба вида (только для STUDENT — сотрудник уходит
      раньше, аудит не засоряется)
- [x] карточка «Голосовой ассистент» на вкладке «Вид» настроек
      (`VoiceSettings` + Toggle, сохранение server action'ом)
- [x] `ShellUser` + `resolveShellUser`: поле `voiceAssistant`
      (студент — из настроек, fail-soft дефолт true; сотрудник — false)

## Данные и экшены

- [x] `StudentSettingsRow.voiceAssistant: boolean` (+ Stored-легаси
      нормализация в `normalizeSettings`, дефолт в `defaultSettingsFor`)
- [x] `updateOwnVoiceAssistant` (IDOR-контракт: ctx-скоуп, staff → null)
- [x] `saveVoiceAssistantAction` (валидация типа, revalidate layout)

## Тесты (red-first)

- [x] tests/voice-assistant.test.ts — чистый модуль: текст дня (с парами,
      пустой, все отменены, перенос, «ауд. 305» → «аудитория 305»),
      детекторы SSR-safe
- [x] tests/voice-assistant-components.test.tsx — jsdom с моками
      speechSynthesis/SpeechRecognition: клик → speak с текстом дня и
      aria-pressed, повторный клик → cancel, выключенная настройка →
      ничего не отрисовано, нет поддержки → ничего; микрофон: клик →
      start, результат → onResult с расшифровкой
- [x] tests/schedule-page.test.tsx — страница «дня» содержит кнопку при
      включённой настройке и не содержит при выключенной
- [x] tests/settings-page.test.tsx — вкладка «Вид» содержит карточку и
      переключатель
- [x] tests/shell-user.test.ts — voiceAssistant: true/из настроек для
      студента, false для сотрудника и fail-soft дефолт
- [x] tests/ai-guide.test.tsx — микрофон скрыт при voiceEnabled=false,
      работает при true
- [x] e2e/voice-assistant.spec.ts — кнопка озвучки есть на «Дне»,
      включение/выключение в настройках сохраняется (перезагрузка),
      кнопка скрывается/появляется, 360 px без горизонтального скролла
