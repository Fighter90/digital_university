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
  lint прогонялся по stale-состоянию рабочего дерева до коммита
  c8f9dc1 (ранее ec24346 до rebase-reword).
- [x] 17. Незакоммиченные доработки раунда 2 закоммичены: (а) e2e DIG-24 —
  worker-scoped `storageState` (один вход на воркер: per-IP rate limiter входа
  30/15 мин не выжигается параллельными воркерами), увеличенные таймауты
  ожиданий под параллельный прогон двух проектов; (б) панель — возврат фокуса
  на первый ВИДИМЫЙ триггер пары (страница содержит блоки двух брейкпоинтов,
  focus() на display:none молча не срабатывает).
- [x] 18. NoteEditor — контролируемое поле с синхронизацией «adjust state
  during render» вместо эффектов: lint-гейт роя (node 24, eslint-plugin-react-hooks
  v7) падал на `react-hooks/set-state-in-effect`; сравнение по нормализованному
  `note ?? ''` — иначе SSR зацикливался («Too many re-renders», поймано
  tests/schedule-page.test.tsx). 22/22 тестов страницы зелёные.
  Коммит 029b130 (ранее dbd5861 до rebase-reword).

## Раунд 2 (повторный запуск роя) — 4 замечания ревью от round-1

- [x] 19. «ICS-роут без поведенческих тестов» → e2e
  `e2e/schedule-event-details.spec.ts` (describe «ICS одной пары»,
  desktop-1440): своя пара sch-pi21-1 → 200, `text/calendar`,
  BEGIN:VCALENDAR/VEVENT/END, `UID:event-sch-pi21-1@digital-deanery`,
  `SUMMARY:Лекция: Информатика`, `LOCATION:ауд. 301`,
  `content-disposition: attachment`, `cache-control: no-store`;
  чужой (sch-ek11-1) и несуществующий id → единый 404 JSON
  `{error:"not_found"}` — оба сценария delta-спеки покрыты по
  прецеденту e2e/session.spec.ts:97-105/148-149.
- [x] 20. «Спека↔код: нижний лист <768 px vs sm: (640 px)» → классы
  PANEL_CLASSES выровнены на `md:` (спека не менялась — она становится
  «правдой системы» при archive). Red-first: новый e2e «720×800: панель
  во всю ширину» падал (панель была правой колонкой 420 px), после
  фикса зелёный; в 640–767 px страница показывает мобильный вид и
  панель теперь нижний лист, как в спеке.
- [x] 21. «Неверный комментарий „нет Date в полях"» → тест
  сериализуемости переписан по реальному контракту: startsAt/endsAt —
  Date (RSC сериализует), скаляры — строки/boolean/null, блоки
  переноса/отмены — объект или null.
- [x] 22. «wip(dig-24): salvage r2 — не conventional» → rebase-reword:
  теперь `a2e1830 fix(schedule): восстановление lint-правок раунда 2 —
  DIG-24`; история ветки — только conventional commits с DIG-XX
  (соседние SHA обновлены: dbd5861→029b130, ec24346→c8f9dc1).
- [x] 23. Гейты и прогон: полный spec e2e DIG-24 — 12 passed / 8
  skipped (project-gates), включая сохранение/удаление заметки;
  vitest, lint/typecheck/build/test — см. коммит 5980b21.
