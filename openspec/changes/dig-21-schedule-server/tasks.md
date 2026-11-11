# Tasks: серверная часть расписания — DIG-21

- [x] 1. Red-first: `tests/schedule.test.ts` — 37 контрактов: время
  Europe/Moscow (ISO +03:00, round-trip настенных компонент, границы
  дня/недели/месяца как полуинтервалы), семестр и листание недель
  (`pageMoscowWeek` с клампом и null за пределами), `getSchedule` (период,
  сортировка, скоуп группы, перенос с previousRoom/previousStartsAt,
  отмена), стык недель (воскресенье 23:40 / понедельник 08:10),
  `getDay`/`getToday`/`getMonth`/`getNextStudyDay`, детали пары (чужая
  группа → null + аудит OWNERSHIP_DENIED), заметки (создать/изменить/
  удалить, только свои, trim+лимит), `applyScheduleChange` (только STAFF,
  уведомление всем студентам группы с уважением PUSH-матрицы), perf-тест
  недели ≤ 100 мс на сетке ~700 пар. Падало до реализации (модули не
  существовали).
- [x] 2. `src/lib/schedule-time.ts` — чистая арифметика времени на Intl
  (без новых зависимостей): moscowParts/DateKey/formatMoscowTime/toMoscowIso,
  fromMoscowWallClock (двухпроходный офсет), startOfMoscowDay/Week,
  shiftMoscowDays, dayRange/weekRange/monthRange, semesterBounds,
  pageMoscowWeek.
- [x] 3. Порт данных DIG-12 расширен скоупленными методами:
  `listScheduleByGroupRange`, `probeScheduleEventById`,
  `saveScheduleEventChange`, `listStudentsByGroup`, заметки
  (find/probe/save-upsert/delete), `link` у appendNotificationToStudent;
  in-memory адаптер реализует 1:1 (`notes` в seed, upsert сохраняет
  createdAt). Схема Prisma изменений не требует (индекс
  `@@index([groupId, startsAt])` и модель StudentNote уже есть — покрыто
  tests/prisma-schema.test.mjs).
- [x] 4. `src/server/data/schedule.ts` — `getSchedule`, `getDay`,
  `getToday`, `getWeek`, `getMonth`, `getNextStudyDay`, `getEventDetails`,
  `saveEventNote`, `deleteEventNote`, `applyScheduleChange` (+ сохранены
  исторические `listSchedule`/`listExams`); barrel `@/server/data`
  экспортирует новые функции и типы.
- [x] 5. Зелёные гейты: vitest 385/385 (+node --test 24 pass), lint 0
  ошибок, typecheck чисто.
- [x] 6. Change-папка openspec/changes/dig-21-schedule-server (proposal,
  tasks, delta-спека schedule с сценариями WHEN/THEN).
