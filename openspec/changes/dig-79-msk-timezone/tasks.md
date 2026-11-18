# Задачи — DIG-79 (таймзона МСК + гидрация #418)

- [x] 1. Red-тест `tests/msk-timezone.test.ts`: фиксированные UTC-моменты →
      МСК-строки (session-format, notification-view, ics, quiet-hours) +
      контракт compose `app: TZ=Europe/Moscow`. Убедиться, что падает.
- [x] 2. `deploy/docker-compose.yml`: `TZ: Europe/Moscow` сервису `app`.
- [x] 3. `src/lib/notification-view.ts`: HH:MM и календарные дни по Москве.
- [x] 4. `src/lib/session-format.ts`: дата/время/сезон/диапазон/отсчёт по Москве.
- [x] 5. `src/lib/ics.ts`: `icsDateTime` (DTSTART/DTEND/DTSTAMP) по Москве.
- [x] 6. `src/lib/quiet-hours.ts`: минута суток по Москве.
- [x] 7. `src/components/session/exam-timeline.tsx`: крупный день через
      `moscowParts` (согласован с `formatSessionDate`).
- [x] 8. Прогнать `npx vitest run tests/msk-timezone.test.ts` +
      смежные файлы (session, notifications, settings-widgets, dashboard,
      docker) — зелёные; `node scripts/swarm/gates.mjs` → GATES_SUMMARY: green.
- [x] 9. Коммит `fix(tz): Europe/Moscow on app container + MSK-explicit time
      formatting (BUG-02/BUG-12, React #418) — DIG-79`.
