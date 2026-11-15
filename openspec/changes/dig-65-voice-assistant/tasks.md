# DIG-65 — задачи

## Спека и модуль

- [ ] delta-спека `specs/voice-assistant/spec.md` (озвучка дня, голосовой
      ввод, настройка-отключение, деградация в браузерах без поддержки)
- [ ] `src/lib/voice-assistant.ts`: `buildDaySpeechText` (детерминированный
      текст дня: счёт пар, отмена/перенос, «аудитория», онлайн),
      `isSpeechSynthesisSupported`, `getSpeechRecognitionCtor` + минимальные
      типы SpeechRecognition (SSR-safe)

## UI

- [ ] `ListenDayButton` (client): «Прослушать день» ↔ «Остановить»,
      aria-pressed, отмена озвучки на unmount; скрыт при выключенной
      настройке или без поддержки браузера
- [ ] кнопка в `DayView` (десктопный вид «День») и в `MobileSchedule`
      (мобильный вид дня, у заголовка выбранного дня)
- [ ] `VoiceInputButton` (client): микрофон в `ai-guide-form`, ru-RU,
      финальная расшифровка дописывается в поле вопроса; скрыт при
      выключенной настройке или без поддержки браузера
- [ ] `AiGuide`: проп `voiceEnabled` (из `ShellUser`), микрофон в форме
      свободного ввода
- [ ] `Shell`: прокидывает `user.voiceAssistant` в `AiGuide`
- [ ] страница `/schedule`: читает `getOwnSettings` и передаёт
      `voiceEnabled` в оба вида (только для STUDENT — сотрудник уходит
      раньше, аудит не засоряется)
- [ ] карточка «Голосовой ассистент» на вкладке «Вид» настроек
      (`VoiceSettings` + Toggle, сохранение server action'ом)
- [ ] `ShellUser` + `resolveShellUser`: поле `voiceAssistant`
      (студент — из настроек, fail-soft дефолт true; сотрудник — false)

## Данные и экшены

- [ ] `StudentSettingsRow.voiceAssistant: boolean` (+ Stored-легаси
      нормализация в `normalizeSettings`, дефолт в `defaultSettingsFor`)
- [ ] `updateOwnVoiceAssistant` (IDOR-контракт: ctx-скоуп, staff → null)
- [ ] `saveVoiceAssistantAction` (валидация типа, revalidate layout)

## Тесты (red-first)

- [ ] tests/voice-assistant.test.ts — чистый модуль: текст дня (с парами,
      пустой, все отменены, перенос, «ауд. 305» → «аудитория 305»),
      детекторы SSR-safe
- [ ] tests/voice-assistant-components.test.tsx — jsdom с моками
      speechSynthesis/SpeechRecognition: клик → speak с текстом дня и
      aria-pressed, повторный клик → cancel, выключенная настройка →
      ничего не отрисовано, нет поддержки → ничего; микрофон: клик →
      start, результат → onResult с расшифровкой
- [ ] tests/schedule-page.test.tsx — страница «дня» содержит кнопку при
      включённой настройке и не содержит при выключенной
- [ ] tests/settings-page.test.tsx — вкладка «Вид» содержит карточку и
      переключатель
- [ ] tests/shell-user.test.ts — voiceAssistant: true/из настроек для
      студента, false для сотрудника и fail-soft дефолт
- [ ] tests/ai-guide.test.tsx — микрофон скрыт при voiceEnabled=false,
      работает при true
- [ ] e2e/voice-assistant.spec.ts — кнопка озвучки есть на «Дне»,
      включение/выключение в настройках сохраняется (перезагрузка),
      кнопка скрывается/появляется, 360 px без горизонтального скролла
