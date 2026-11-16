# Tasks: DIG-48 — кабинет сотрудника деканата

- [x] 1. Delta-спека `specs/staff-cabinet/spec.md` (требования с WHEN/THEN).
- [x] 2. Red: `tests/staff-access.test.ts` — студент на `/staff*` получает 403 (forbidden), сотрудник проходит, аноним — на /login — падает.
- [x] 3. Red: `tests/staff-sla.test.ts` — SLA по типам, дедлайн, просрочка/скоро-срок, парсинг и фильтры очереди — падают.
- [x] 4. Red: `tests/staff-transitions.test.ts` — карта разрешённых переходов, обязательная причина доработки, подписи кнопок — падают.
- [x] 5. Red: `tests/staff-summary.test.ts` — сводка (заявок сегодня, среднее время ответа, просрочено) — падает.
- [x] 6. Red: `tests/staff-data.test.ts` — скоуп факультета в очереди/карточке/обращениях/объявлениях, смена статуса с событием и уведомлением, аудит отказов — падают.
- [x] 7. Red: `tests/staff-pages.test.tsx` — рендер сводки, очереди (фильтры, просрочка, «Взять в работу»), карточки (переходы, причина, PDF), обращений (чат, шаблоны, «Решено»), объявлений (форма, предпросмотр) — падают.
- [x] 8. `src/lib/staff-sla.ts` — SLA и фильтры очереди (чистые функции).
- [x] 9. `src/lib/staff-transitions.ts` — разрешённые переходы и валидация причины.
- [x] 10. `src/lib/staff-summary.ts` — агрегаты сводки (чистые).
- [x] 11. Порт + memory-адаптер: заявки/обращения/объявления по факультету, смена статуса = строка + событие + уведомление атомарно.
- [x] 12. `src/server/data/staff-workflow.ts` + экспорт из index: сервисные функции с проверкой роли/факультета и аудитом.
- [x] 13. `src/server/actions/staff.ts` — server actions (в работу, статус, доработка, ответ, решено, объявление).
- [x] 14. `src/lib/route-guard.ts` + `tests/access-control.test.ts` — студент на `/staff*` → forbidden (403).
- [x] 15. Навигация по роли: nav-items, side-nav, tab-bar, top-bar (логотип ведёт сотрудника на /staff).
- [x] 16. Страницы: `/staff` (сводка), `/staff/requests`, `/staff/requests/[number]`, `/staff/appeals`, `/staff/appeals/[id]`, `/staff/announcements` + компоненты.
- [x] 17. API `GET /api/staff/requests/[number]/certificate` — PDF выполненной справки сотрудником факультета.
- [x] 18. Сид: заявки очереди (просроченная + сегодня), сообщение обращения, демо-объявление.
- [x] 19. Зелёная фаза: все unit-тесты зелёные.
- [x] 20. e2e `e2e/staff-cabinet.spec.ts`: 403 студенту, вход сотрудника, «Взять в работу» → у студента событие/уведомление, обращения, объявления, мобайл 360.
- [x] 21. Гейты: lint, typecheck, build, test — зелёные; коммит `feat(staff): ... — DIG-48`.

## Раунд 2 (salvage → доводка)

- [x] 22. Ремонт swap damage от salvage-мерджей: вернуть `scripts/build-lock.mjs`, `scripts/clean-next-types.mjs` и скрипты `build`/`typecheck` каноническими с main — гейт typecheck снова детерминированный.
- [x] 23. Сводка: `getStaffSummaryData` отдаёт `now` (момент выборки), страница считает «заявок сегодня» относительно него — детерминизм unit-теста сводки, тест дополнен.
- [x] 24. Чат обращения: бейдж статуса (`appeal-status-badge`, общий `src/lib/appeal-status.ts`) — после ответа виден «Отвечено» (red-first: unit + e2e).
- [x] 25. e2e-устойчивость: вход ждёт выхода с /login; клик по доступному имени кнопки целиком (aria-label, не подстрока); catch на клик, чья кнопка исчезает при ре-рендере после server action; сброс cookies при смене аккаунта; mobile-сценарий скипается на desktop.
- [x] 26. e2e прогон: 13 passed / 3 skipped (мутации — только desktop) / 0 failed; gates green.
