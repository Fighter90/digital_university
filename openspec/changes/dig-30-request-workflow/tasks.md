# Tasks: Заявки и справки — серверная логика и машина статусов — DIG-30

- [ ] 1. Red-first: `tests/request-workflow.test.ts` — машина переходов
  (все разрешённые/запрещённые, роли, причины), SLA с выходными, номера
  «ЗД-ГГГГ-NNNNNN», тексты уведомлений, каталог типов (zod-поля, названия),
  интеграция через memory-db: подача (событие+уведомление), мгновенные
  типы (READY+PDF+2 события), дедуп 24 часа, цепочка сотрудника
  ACCEPTED→IN_PROGRESS→READY→ISSUED, отмена студентом до/после IN_PROGRESS,
  IDOR (студент не может READY; чужой номер — единый NOT_FOUND; сотрудник
  подать не может). Падает до реализации.
- [ ] 2. Канонический словарь статусов: `types.ts` (8 значений,
  `actorRole: ActorRole | null` для автоматики, опциональные
  typeCode/params/dueAt/resultUrl в `ServiceRequestRow`), `request-labels.ts`
  (8 меток + тона), `dashboard.ts` (в работе = не терминальные),
  `demo-seed.ts` (COMPLETED→ISSUED).
- [ ] 3. Номер «ЗД-<год>-<6 цифр>»: `request-number.ts` (паттерн +
  `nextRequestNumber(now, taken)`), выделение номера в memory-адаптере.
- [ ] 4. Каталог типов `src/lib/request-catalog.ts` — 6 вымышленных типов:
  код, вид, название, SLA, мгновенность, формат, поля формы (JSON-описание
  + zod-схема), название «тип · ключевой параметр».
- [ ] 5. Машина статусов `src/lib/request-workflow.ts` — карта переходов,
  `assertRequestTransition` (переход/роль/причина), SLA `dueDateFor`
  (пропуск сб/вс), сборщик текста уведомления с конкретикой.
- [ ] 6. Порт + memory-адаптер: `saveServiceRequestByStudent` (номер
  назначает адаптер), `updateServiceRequest`, `appendRequestEvent`.
- [ ] 7. `src/server/data/requests.ts`: `submitRequest` (валидация, дедуп
  24ч, мгновенные → READY+PDF, событие+уведомление), `transitionRequest`
  (IDOR-гейт, переход, RequestEvent, уведомление владельцу); экспорт через
  `@/server/data`.
- [ ] 8. PDF справки об обучении `src/lib/enrollment-certificate-pdf.ts`
  (векторный шрифт, код проверки, плашка «Концепт для конкурса») +
  `/api/requests/[number]/pdf` (владелец, READY/ISSUED, единый 404).
- [ ] 9. Server actions `src/server/actions/requests.ts`: подать/отменить/
  отправить исправленную (сессия через requireDataCtx).
- [ ] 10. Правки тестов под канонический словарь: seed/dashboard/
  data-isolation (механические переименования).
- [ ] 11. Зелёные гейты: `npx vitest run tests/request-workflow.test.ts`,
  полный `npm test`, lint, typecheck, `node scripts/swarm/gates.mjs`.
