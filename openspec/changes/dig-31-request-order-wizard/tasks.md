# Tasks: DIG-31 — мастер заказа справки/заявления

## Спека и тесты (red-first)

- [x] openspec: proposal + tasks + delta-спека requests
- [x] tests/request-wizard.test.ts — контракт реестра документов и валидатора (red)
- [x] tests/requests-wizard-create.test.ts — слой данных createWizardRequest (red)
- [x] tests/requests-page.test.tsx — точка входа CTA/авто-открытие, сотрудник (red)
- [x] tests/certificate-pdf.test.ts — PDF мгновенной справки (red)
- [x] tests/services-page.test.tsx + e2e/services.spec.ts — «Мгновенно» у справки об обучении (red)

## Реализация

- [x] src/lib/request-wizard.ts — реестр документов, валидатор, сводка, даты
- [x] src/lib/services-catalog.ts — cert-enrollment → INSTANT
- [x] src/server/data/port.ts + memory-db.ts — status/resultNote в appendRequestByStudent
- [x] src/server/data/requests.ts — createWizardRequest (owner-scope, аудит отказа)
- [x] src/server/data/index.ts — экспорт
- [x] src/server/actions/request-wizard.ts — server action с серверной валидацией
- [x] src/components/requests/order-wizard.tsx — мастер (3 шага, черновик, подтверждение)
- [x] src/app/(cabinet)/requests/page.tsx — CTA + авто-открытие по ?order=
- [x] src/lib/certificate-pdf.ts + /api/requests/[number]/pdf — PDF мгновенной справки
- [x] next.config.ts — bodySizeLimit 12 МБ (вложения ≤ 10 МБ)

## Гейты

- [x] vitest: новые и затронутые тесты зелёные
- [x] npm run lint / typecheck — чисто
- [x] e2e/requests-wizard.spec.ts — военкомат + мгновенная справка, 1440 и 360
- [x] e2e: regression services + data-isolation
