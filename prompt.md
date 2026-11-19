DIG-89: EN-локализация часть 3 — все остальные разделы кабинета. ЦЕЛЬ: на локали en НОЛЬ кириллицы в видимом рендере страниц: /grades (+ /grades/gradebook, /grades/session, AI-динамика), /deanery, /feedback, /finance, /events, /msp, /dpo, /people, /news, /profile, /settings, /tasks, /notifications, /services, /more, а также кабинет сотрудника /staff (+ /staff/requests, /staff/appeals, /staff/announcements). RU-версия не должна измениться ни на байт.

Контекст проекта: Next.js 15 App Router + TypeScript, локаль в cookie du-locale (дефолт ru), словари src/lib/i18n/ru.ts и en.ts (плоские ключи, паритет через Record<keyof typeof ru, string>), чтение getLocale() из src/lib/i18n/server.ts, клиент — t из src/lib/i18n/index.ts. Части 1–2 уже в main/у коллег: каркас + dashboard + schedule + requests (DIG-87), guide/help/mcp/assistant (DIG-88). Изучи паттерн DIG-87 (tests/i18n-en-surfaces.test.tsx, src/lib/dashboard-format.ts с bilingual-хелперами) и повторяй.

Что переводим:
1. Заголовки страниц, статусы, кнопки, пустые состояния, лейблы форм, тосты, диалоги — через словарь i18n (новые ключи в ru.ts+en.ts парами, паритет обязателен).
2. Статусы заявок и переходы — EN-лейблы в requests-view / staff-transitions / связанных view-файлах.
3. Демо-контент из сида (news/events/msp/dpo заголовки и описания, программы ДПО): двуязычные поля (titleRu/titleEn или {ru,en}) в prisma/seed.ts и моделях/сериализаторах — с выбором по locale при рендере. Если схема БД менять не хочется — допустимо EN-словарь маппингов по id/кодам демо-записей в src/lib (паттерн DIG-87 в dashboard-format.ts).
4. /staff: очередь, SLA-подписи, чат обращений, шаблоны ответов, объявления — EN при locale=en.
5. /notifications, /settings (вкладки, описания тумблеров кроме уже переведённых a11y), /profile — EN.
6. AI-тексты (объяснения динамики оценок, советы) — EN-шаблоны из тех же агрегатов (не ломая контракт DIG-80).

Запреты: не трогать scripts/swarm/, безопасность/IDOR не ослаблять, секретов нет, RU-тексты не менять, демо-ФИО студентов/преподавателей можно оставить латиницей как есть.

Готово, когда:
- автотест «no Cyrillic on EN» по всем перечисленным маршрутам (рендер страниц/компонентов при locale=en, проверка отсутствия [А-Яа-яЁё] в видимом тексте) зелёный;
- все существующие RU-тесты зелёные;
- node scripts/swarm/gates.mjs → GATES_SUMMARY: green (.env с DATABASE_URL="postgresql://dig:seedpass@localhost:5432/digital_university" уже создан);
- коммит(ы) на текущей ветке с DIG-89 в сообщении, push на origin (gh доступен).

Работай только в текущей директории (/tmp/dig-89en). Не трогай другие worktree.
