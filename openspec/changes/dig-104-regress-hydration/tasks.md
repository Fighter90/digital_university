# Tasks — dig-104-regress-hydration

- [x] 1. Регресс-прогон прода RU (desktop 1440 + mobile 360, 29 маршрутов + динамика):
      скриншоты shots/{desktop,mobile}, консоль/исключения, 404-обход ссылок,
      EmptyState, плашка «Концепт для конкурса», даты МСК
      (`scripts/regression/dig-104-sweep.mjs`, артефакт shots/regression-results-104.json)
- [x] 2. Локальное воспроизведение гидрационного сбоя на dev-сервере
      (`scripts/regression/dig-104-hydration-probe.mjs`): вложенный `<a>`
      преподавателя внутри `<a>`-карточки (React #418)
- [x] 3. Красно-первый тест `tests/schedule-card-nested-links.test.tsx`
      (падал: 3/4 red до фикса)
- [x] 4. Фикс `src/components/schedule/event-card.tsx`: stretched-link,
      teacher-link поверх (`pointer-events-auto`), testid на `<li>`
- [x] 5. Обновлены контракты `tests/schedule-screen.test.tsx`
      (stretched-link, без вложенных якорей)
- [x] 6. Второй дефект гидрации: `ListenDayButton` — server/client ветка
      (`isSpeechSynthesisSupported()` в рендере); red-first
      `tests/listen-day-hydration.test.tsx` + фикс (useSyncExternalStore,
      серверный снапшот false; setState-в-эффекте запрещён react-hooks lint)
- [x] 7. Верификация фиксов в браузере `scripts/regression/dig-104-fix-verify.mjs`:
      гидрация чистая, клик карточки → панель, Esc → фокус, преподаватель → /people
- [x] 8. Отчёт регресса REGRESSION-FINDINGS-104.md + скриншоты docs/shots/dig-104/
- [ ] 9. Гейты зелёные (lint, typecheck, build, test) — финальный прогон
