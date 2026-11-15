# Задачи DIG-31 — Мастер заказа справки или заявления

- [ ] 1. Delta-спека `specs/request-wizard/spec.md` (этот чек-лист — tasks.md).
- [ ] 2. Модуль `lib/request-wizard-schema.ts`: константы лимитов (≤5 файлов,
      ≤10 МБ, ≤5 экземпляров, комментарий ≤500), `validateWizardMeta` (zod,
      человеческая первая ошибка), `normalizeWizardMeta`. RED-first:
      `tests/request-wizard-schema.test.ts`.
- [ ] 3. По-полевая валидация формы типа: `validateRequestFormFields` в
      `lib/request-form-schema.ts` (карта ошибок для клиента; агрегатная
      `validateRequestForm` сервера не меняется). RED: тот же тест-файл.
- [ ] 4. Карта «сервис каталога → тип заявки» `lib/request-order-map.ts`
      (cert-enrollment/cert-defer(+preset «для военкомата»)/cert-grades/
      stmt-academic-leave; unknown → null без ошибки; one-line описание и
      метки формата для всех типов словаря). RED-first:
      `tests/request-order-map.test.ts`.
- [ ] 5. Сервер: `createCanonicalRequest` принимает и повторно валидирует
      мету мастера, сохраняет в `params.wizard` (JSON-строка);
      `createRequestAction` читает FormData-поле `wizard` (JSON).
      RED-first: `tests/canonical-requests-wizard.test.ts`.
- [ ] 6. Компонент `components/requests/order-wizard.tsx`: модал на десктопе /
      полноэкранный лист на 360 px, прогресс «Шаг N из 3», шаги
      «Что нужно → Параметры → Проверка», экран успеха (номер, «Скачать PDF»
      для мгновенных, дата готовности, «Следить за статусом»), подтверждение
      «Выйти без сохранения?», валидация с по-полевыми ошибками, работа с
      клавиатуры. RED-first: `tests/requests-order-wizard.test.tsx`.
- [ ] 7. Страница `/requests`: `searchParams.order` (каталог/FAQ/CTA) →
      автопейс мастера, CTA «Заказать справку» → `?order=new`, подстановка
      профиля, сотруднику мастера нет. Обновить
      `tests/requests-page.test.tsx` + новый
      `tests/requests-order-wizard-page.test.tsx`.
- [ ] 8. e2e `e2e/requests-wizard.spec.ts` (desktop 1440 + mobile 360, студент
      ilya.petrov): заказ справки для военкомата, мгновенная справка об
      обучении с «Скачать PDF», подтверждение черновика при закрытии.
- [ ] 9. Гейты: lint / typecheck / vitest / gates.mjs — зелёные; скриншоты
      1440×900 и 360×800 сверены с фреймом Figma «06 · Заявки — мастер заказа»
      (данные вымышленные, «Концепт для конкурса» — плашка Shell).
