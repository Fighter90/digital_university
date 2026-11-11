# Tasks: каркас кабинета — Shell (DIG-14)

- [x] 1. Red-first: юнит-тест каркаса (tests/cabinet-shell.test.ts) — конфиг навигации, единая логика активного раздела, инварианты исходников; падает до реализации.
- [x] 2. Red-first: e2e (e2e/cabinet-shell.spec.ts) — desktop-1440 и mobile-360 сценарии приёмки; падают до реализации.
- [x] 3. `src/server/auth.ts`: `requireUser()` — серверная проверка сессии (стаб до DIG-18, вымышленный студент).
- [x] 4. `src/app/(cabinet)/layout.tsx`: await requireUser() + рендер Shell; `src/lib/user.ts` — клиентски-безопасный тип.
- [x] 5. Верхняя панель 72 px: логотип, поиск (⌘K), AI, колокольчик, аватар-меню (Профиль/Настройки/Выйти), плашка концепта; blur + sticky на ≥768.
- [x] 6. Боковое меню: ≥1024 полное 212 px, 768–1023 иконочный рельс, активный раздел — коралловый фон, разделитель + Профиль, карточка «Ближайший дедлайн».
- [x] 7. Мобильная навигация: таб-бар (Главная, Расписание, Оценки, Заявки, Ещё) с env(safe-area-inset-bottom), плавающая AI-кнопка, страница «Ещё».
- [x] 8. Skip-link «К содержимому» + фокус в #main-content; aria-current по единой resolveActiveSection/resolveActiveTab.
- [x] 9. Счётчик уведомлений: /api/notifications/count (после requireUser, no-store) + polling 60 с в UnreadBadge без перезагрузки.
- [x] 10. Каркасные маршруты-заглушки (8 разделов + more) через общий PagePlaceholder.
- [x] 11. Коралловые токены в globals.css (рабочие, до DIG-13); sticky-баннер концепта на мобильном.
- [x] 12. Зелёные: pnpm lint / typecheck / test / e2e / build; node scripts/swarm/gates.mjs.
