# Tasks: экран «Детали пары» — боковая панель — DIG-24

- [x] 1. Red-first: `tests/event-details.test.ts` — чистая вью-модель
  `toEventDetailsView` (шапка: тип/название/дата/время; блок переноса
  «Было: … → Стало: …» + причина + кто изменил; блок отмены: причина +
  «Что делать»; аудитория + корпус + фолбэк корпуса; онлайн-ссылка;
  преподаватель с email; домашнее задание и материалы; status), чистый
  сборщик ICS-входа одной пары `toEventIcsInput`.
- [x] 2. Red-first: `tests/schedule-page.test.tsx` — страница /schedule:
  `?event=<свой>` рендерит панель с составом (перенос/отмена/аудитория/
  преподаватель/заметка/ICS/AI), `?event=<чужой>` и `?event=<мусор>` —
  notFound; панели нет без параметра.
- [x] 3. Red-first: `tests/schedule-screen.test.tsx` — карточки пары
  (EventCard) и блоки недели — ссылки на `?event=<id>`.
- [x] 4. Red-first: `e2e/schedule-event-details.spec.ts` — клик по паре из
  вида «Неделя» (1440) и из мобильного вида (360), URL `?event=`, Esc
  закрывает и возвращает фокус на блок пары, «Назад» браузера закрывает
  панель, чужая пара по прямой ссылке → 404, сохранение/удаление заметки,
  отсутствие горизонтальной прокрутки на 360 px.
- [x] 5. Данные: `ScheduleEventRow` + опциональные `onlineUrl`, `building`,
  `teacherEmail`, `changeAuthor`, `homework`, `materials` (порт DIG-12
  прокидывает поля как есть); сиды demo-seed — онлайн-пара с ссылкой,
  переносы с автором изменения, отмена с «что делать», email
  преподавателей, домашки/материалы.
- [x] 6. Схема Prisma: 4 опциональные колонки ScheduleEvent
  (`teacherEmail`, `changeAuthor`, `homework`, `materials`; building/
  onlineUrl были с init-миграции) + миграция ALTER TABLE; сид
  `prisma/seed-data.ts` — обогащение исключений недели, онсайт-пара,
  email-карта преподавателей.
- [x] 7. `src/lib/event-details.ts` — вью-модель + ICS-вход (чистые).
- [x] 8. `src/server/actions/schedule.ts` — server actions заметки
  (сохранить/удалить; requireDataCtx, лимит 500, чужая пара — ошибка).
- [x] 9. `GET /api/schedule/[id]/ics` — text/calendar одной пары по ctx;
  чужая/несуществующая — единый 404; Cache-Control private, no-store.
- [x] 10. Панель `event-details-panel.tsx` + редактор заметки (client):
  нижний лист на мобильном / правая панель на десктопе (SSR-разметка с
  классами Sheet DIG-13 — base-ui Dialog.Portal не рендерит контент на
  сервере), блоки переноса/отмены, «Как пройти» (заглушка схемы),
  преподаватель (справочник/email/«Написать»), онлайн-ссылка, домашка и
  материалы, заметка (сохр/удалить), действия ICS + AI; Esc, фокус-ловушка,
  начальный фокус и возврат фокуса на блок пары; закрытие — replaceState
  без ненадёжной search-param soft-навигации.
- [x] 11. Страница /schedule: разбор `?event=`, uniform 404 (notFound),
  панель на всех видах; ссылки на пары в EventCard / DayView /
  MobileSchedule / WeekView (контекст вида сохраняется в href); week-view:
  локальный мини-Sheet заменён URL-панелью.
- [x] 12. Гейты (lint/typecheck/build/test), e2e прогон, коммит.

## Раунд 2 — красный гейт (lint/build)

- [x] 13. lint-гейт: убраны все `no-unused-vars` warnings, накапливавшиеся
  на ветке из смежных задач — `SessionSkeleton` (grades/session),
  `fillTone` (gradebook-list), `COL_DATE` (transcript-pdf),
  `SchedulePeriod` (memory-db), `Readable` (cabinet-shell.test),
  `spawnSync` (swarm-orchestrator.test), `expect` (e2e-rc/rc-dash);
  `prisma.config.ts` — default-экспорт через именованную константу
  (import/no-anonymous-default-export). `scripts/swarm/` не тронут
  (запрещено правилами роя).
- [x] 14. build-гейт: ENOENT `routes-manifest.json → .next/standalone/…`
  был stale-артефактом `.next` от прерванной сборки; после `rm -rf .next`
  и чистого прогона `node scripts/swarm/gates.mjs` —
  `GATES: lint=pass typecheck=pass build=pass test=pass`.

## Раунд 3 — замечания ревью + красный гейт (lint=fail)

- [x] 15. Замечание ревью «маппинг новых полей в Prisma-адаптере»: проверено —
  Prisma-адаптера слоя данных расписания в проекте НЕТ (`src/server/data/db.ts`
  работает на memory-адаптере DIG-12; единственный Prisma-адаптер — auth,
  `src/server/auth/prisma-store.ts`, ScheduleEvent не касается). Memory-адаптер
  отдаёт строки как есть (`ScheduleEventRow` — новые поля прокинуты портом),
  схема Prisma (`+4 колонки DIG-24`), миграция ALTER TABLE и сид
  `prisma/seed-data.ts` согласованы 1:1 — будущему Prisma-адаптеру остаётся
  прямое отображение колонок на `ScheduleEventRow`.
- [x] 16. lint-гейт: зелёный (0 ошибок; 2 warning только в `scripts/swarm/`,
  который правилам роя трогать запрещено). Причина прошлого красного гейта —
  lint прогонялся по stale-состоянию рабочего дерева до коммита ec24346.
- [x] 17. Незакоммиченные доработки раунда 2 закоммичены: (а) e2e DIG-24 —
  worker-scoped `storageState` (один вход на воркер: per-IP rate limiter входа
  30/15 мин не выжигается параллельными воркерами), увеличенные таймауты
  ожиданий под параллельный прогон двух проектов; (б) панель — возврат фокуса
  на первый ВИДИМЫЙ триггер пары (страница содержит блоки двух брейкпоинтов,
  focus() на display:none молча не срабатывает).
