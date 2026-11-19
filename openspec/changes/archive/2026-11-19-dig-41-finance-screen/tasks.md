# Tasks: экран «Договоры и оплата» (DIG-41)

- [x] 1. Change-папка openspec (proposal + tasks + delta-спека).
- [x] 2. Red-first: `tests/finance-catalog.test.ts` — контракт каталога
      (бюджетник не пуст, платник с договором, отсутствие банковских реквизитов,
      чистый фильтр документов, детерминированные даты от `now`).
- [x] 3. Red-first: `tests/finance-data.test.ts` — агрегат `getFinancePage`:
      скоуп по сессии, отказ сотруднику с аудитом ROLE_MISMATCH.
- [x] 4. Red-first: `tests/finance-page.test.tsx` — SSR-контракт страницы
      (сводка/договор/документы/выплаты/действия, сотрудник — пустое состояние).
- [x] 5. Red-first: `tests/finance-document-pdf.test.ts` — демо-PDF документа:
      глифы, детерминизм, плашка концепта, «не является платёжным», без реквизитов.
- [x] 6. Red-first: расширить `tests/cabinet-shell.test.ts` (раздел «Финансы»
      в меню и «Ещё») и `tests/request-order-map.test.ts` (fin-material-aid,
      fin-scholarship-cert).
- [x] 7. Каталог `src/lib/finance-catalog.ts` (бандл по форме обучения,
      фильтр, формат сумм, действия → мастер).
- [x] 8. Агрегат `src/server/data/finance.ts` + экспорт в `src/server/data/index.ts`.
- [x] 9. Демо-PDF `src/lib/finance-document-pdf.ts` + роут
      `src/app/api/finance/documents/[id]/route.ts` (владелец или единый 404).
- [x] 10. Страница `src/app/(cabinet)/finance/page.tsx` + `loading.tsx`,
      компоненты `src/components/finance/*` (таймлайн платежей, браузер
      документов с фильтром, выплаты, действия).
- [x] 11. Навигация: `/finance` в CABINET_SECTIONS и MORE_SECTIONS,
      иконка Wallet.
- [x] 12. Словарь заявок: `MATERIAL_AID` и `SCHOLARSHIP_CERT` в demo-seed,
      маппинги `request-order-map.ts`, иконка MATERIAL_* в requests-view.
- [x] 13. e2e `e2e/finance.spec.ts`: бюджетник (стипендия + выплаты, без
      реквизитов), платник (договор + таймлайн + скачивание PDF), сотрудник,
      360 px.
- [x] 14. Узкие тесты зелёные, гейты (`node scripts/swarm/gates.mjs`) зелёные.
- [x] 15. Раунд 2 (ревью): e2e «чужой набор и сотрудник — единый 404» дополнен
      реальной проверкой сотрудника на PDF-роут (гвард `ctx.role !== 'STUDENT'`
      не был покрыт телом теста).
