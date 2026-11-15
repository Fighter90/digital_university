# Tasks: DIG-31 — мастер заказа справки/заявления

## Спека и тесты (red-first)

- [ ] openspec: proposal + tasks + delta-спека requests
- [ ] tests/request-wizard.test.ts — контракт реестра документов и валидатора (red)
- [ ] tests/requests-wizard-create.test.ts — слой данных createWizardRequest (red)
- [ ] tests/requests-page.test.tsx — точка входа CTA/авто-открытие, сотрудник (red)
- [ ] tests/certificate-pdf.test.ts — PDF мгновенной справки (red)
- [ ] tests/services-page.test.tsx + e2e/services.spec.ts — «Мгновенно» у справки об обучении (red)

## Реализация

- [ ] src/lib/request-wizard.ts — реестр документов, валидатор, сводка, даты
- [ ] src/lib/services-catalog.ts — cert-enrollment → INSTANT
- [ ] src/server/data/port.ts + memory-db.ts — status/resultNote в appendRequestByStudent
- [ ] src/server/data/requests.ts — createWizardRequest (owner-scope, аудит отказа)
- [ ] src/server/data/index.ts — экспорт
- [ ] src/server/actions/request-wizard.ts — server action с серверной валидацией
- [ ] src/components/requests/order-wizard.tsx — мастер (3 шага, черновик, подтверждение)
- [ ] src/app/(cabinet)/requests/page.tsx — CTA + авто-открытие по ?order=
- [ ] src/lib/certificate-pdf.ts + /api/requests/[number]/pdf — PDF мгновенной справки
- [ ] next.config.ts — bodySizeLimit 12 МБ (вложения ≤ 10 МБ)

## Гейты

- [ ] vitest: новые и затронутые тесты зелёные
- [ ] npm run lint / typecheck — чисто
- [ ] e2e/requests-wizard.spec.ts — военкомат + мгновенная справка, 1440 и 360
- [ ] e2e: regression services + data-isolation
