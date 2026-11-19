# DIG-78 — tasks

- [x] 1. Красный юнит-тест: `tests/voice-settings.test.tsx` — toggle → action →
      перечитать: `aria-checked` меняется только после подтверждения action'а;
      при отказе — откат (до фикса падал: 2 из 4 кейса).
- [x] 2. Фикс `src/components/settings/voice-settings.tsx`: без оптимистичного
      переключения — состояние из подтверждённого ответа action'а; статус
      «Сохранение…» в полёте; откат при ошибке (+ i18n-ключи
      `settings.voice.saving` / `settings.voice.error` в ru и en).
- [x] 3. Зелёный юнит-прогон: `npx vitest run tests/voice-settings.test.tsx` —
      4/4 зелёные.
- [x] 4. Регресс: settings-page / i18n* / shell-user / schedule* / unread-badge
      / user-menu / floating-assistant-popup — 179 тестов зелёные.
- [x] 5. E2E-прогон `e2e/voice-assistant.spec.ts` (desktop-1440 + mobile-360) —
      4/4 зелёные (до фикса desktop падал на строке 103: включение не
      переживало перезагрузку).
- [x] 6. Гейты: `node scripts/swarm/gates.mjs` → GATES: lint=pass
      typecheck=pass build=pass test=pass, GATES_SUMMARY: green.
- [x] 7. Коммит(ы) на ветке с `DIG-78`, push на origin.
