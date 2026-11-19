# Tasks: DIG-84 — EN-перевод ключевых страниц

- [x] 1. Словарь: ключи `grades.*`, `gradebook.*`, `transcript.*`, `requests.*`, `insight.*` в ru.ts (RU байт-в-байт) + en.ts; паритет ключей
- [x] 2. RED-тесты: i18n (EN-ключи), performance-format/performance-math (EN-подписи), grade-insight (EN-тексты), transcript-pdf (EN-строки), request-card-view (EN-хелперы)
- [x] 3. performance-math: semesterKeyLabel/bestPercentLabel — хвостовой locale
- [x] 4. performance-format: пилюли, карточки (пороги/допуск), светофор, пустой семестр, долги, подсказки, formatScore/formatDateShort — locale
- [x] 5. grade-insight: buildGradeInsight(inp, locale) + getGradeInsight — EN-тексты
- [x] 6. /grades summary page: getLocale + t() во всех блоках (сводка, пилюли, дельта, кредиты, рейтинг, светофор, карточки, долги, футер, состояния)
- [x] 7. /grades/gradebook page + GradebookList: locale, словарные подписи
- [x] 8. Выписка PDF: TranscriptOptions.locale, localized строки, роут читает cookie и локализует семестры/типы контроля
- [x] 9. /requests/[номер]: статусы, «подана», «Ведёт», параметры/вложения мастера, документ, таймлайн, формы; request-card-view locale-хелперы
- [x] 10. /requests: подзаголовок списка по словарю
- [x] 11. Компоненты: GradeInsightCard, GradebookList, RequestHistoryTimeline, RequestFixForm, RequestEmailButton, CopyRequestNumber — locale
- [x] 12. Узкие тесты зелёные → gates (lint/typecheck/build/test) зелёные
- [x] 13. e2e `e2e/i18n-key-pages.spec.ts` (1440 + 360 px): EN-рендер /grades, зачётки, выписки PDF и карточки заявки без русских строк контента
