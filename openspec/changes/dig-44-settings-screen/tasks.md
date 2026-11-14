# DIG-44 — задачи

## Спека и модель

- [x] delta-спека `specs/settings/spec.md` (сценарии по вкладкам)
- [x] `DashboardWidgetId` + реестр виджетов `src/lib/dashboard-widgets.ts`
      (метки, дефолтный порядок, normalizeWidgets/moveWidget/setWidgetEnabled)
- [x] `src/lib/quiet-hours.ts`: `isWithinQuietHours` (переход через полночь),
      `isValidTime`
- [x] `StudentSettingsRow`: `widgets`, `quietHours`, `language`, `fontSize`,
      `reduceMotion`; `defaultSettingsFor` + `normalizeSettings` в data-слое

## Данные и доступ (IDOR)

- [x] mutators data-слоя: `updateOwnWidgets`, `updateOwnQuietHours`,
      `updateOwnFontSize`, `updateOwnReduceMotion`, `updateOwnLanguage`
- [x] тихие часы подавляют `createNotificationForStudent` в окне
- [x] AuthStore: `setPasswordHash` (memory + prisma)
- [x] AuthStore: `deleteSessionById(userId, sessionId)` — только своя сессия
      (memory + prisma); обёртка `revokeUserSessionById` в session.ts

## Экран `/settings` (вкладки)

- [x] tabs-навигация `?tab=` (ссылки, aria-current, дефолт «Главная»)
- [x] «Главная»: WidgetsSettings — toggle, drag&drop, кнопки «вверх/вниз»
      (клавиатура), предпросмотр; сохранение server action'ом
- [x] «Уведомления»: матрица (канал «в кабинете») + QuietHoursSettings
- [x] «Безопасность»: PasswordForm (текущий/новый/повтор) + список сеансов
      (устройство, браузер, город «—», время) с «Завершить» и
      «Выйти на всех устройствах»
- [x] «Вид»: ThemePicker (тёмная включена), язык RU/EN (EN «скоро»),
      размер шрифта, «Уменьшить анимацию»

## Применение сразу

- [x] appearance (`theme`, `fontSize`, `reduceMotion`) → классы на `<html>`
      из root layout (`src/server/data/appearance.ts`); скрипт для SYSTEM
- [x] `/dashboard` рендерит секции в сохранённом порядке, выключенные —
      скрыты; секции «Заявки» (RequestsSection) и «Мероприятия» (заглушка)
- [x] revalidatePath(settings + dashboard) после каждой мутации

## Тесты (red-first)

- [x] tests/settings-widgets.test.ts — чистые хелперы виджетов и тихих часов
- [x] tests/profile-settings.test.ts — mutators, IDOR, тихие часы в генерации
- [x] tests/settings-security.test.ts — setPasswordHash, deleteSessionById
- [x] tests/settings-page.test.tsx — рендер-контракт 4 вкладок (SSR)
- [x] tests/dashboard-page.test.tsx — порядок виджетов и скрытие выключенных
- [x] e2e/profile-settings.spec.ts — вкладки, клавиатурный порядок + reload,
      тёмная тема на html, смена пароля, сеансы

## Готовность

- [x] lint + typecheck + vitest зелёные
- [x] e2e (desktop-1440 + mobile-360) зелёные
- [x] 360 px и 1440 px (вкладки-пилюли переносятся)
