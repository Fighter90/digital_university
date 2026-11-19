DIG-124: EN — кабинет сотрудника без кириллицы + приветствие ассистента. ЦЕЛЬ: EN-аудит (cookie du-locale=en, поиск [А-Яа-яЁё] в body.innerText) на проде даёт: /staff — «ИТ» (2), /staff/requests — 189 (названия заявок сида, имена «Анна», слово «дисциплины»), /staff/appeals — 94 (темы обращений «Вопрос по зачёту по физкультуре»), /staff/announcements — 89 (объявления «Собрание группы ПИ-21…», «Завтра», «ауд.»), /ai-assistant — 4 («Hello, Анна!»). Добей эти пять до нуля.

Контекст: Next.js 15 + TS, локаль du-locale (getLocale), EN-паттерн — src/lib/en-demo-content.ts (FACULTY_EN/GROUP_EN словари, enFacultyLabel/enGroupLabel/enPersonName; request-карточки уже локализуются localizeRequestCardTitle). Staff-страницы: src/app/(cabinet)/staff/* + компоненты (staff queue/appeals/announcements). Assistant-приветствие: src/server/data/assistant.ts (getAssistantContext, firstNameOf) + src/components/assistant/assistant-chat.tsx (greetingMessage, уже импортирует enPersonName).

Что делаем:
1. FACULTY_EN: добавить сид-факультет «ИТ» → 'IT' (и другие сид-значения, проверь prisma/seed-data.ts).
2. Staff queue: EN-маппинги названий заявок сида (request type titles — проверь, как карточка рендерит title: если title из requests-сида RU — добавь requestTitleEn словарь в en-demo-content и локализуй в staff view/сериализаторе). Имена людей → enPersonName/localizePersonName. Слово «дисциплины» в подписи → словарный ключ.
3. Appeals: EN-маппинг тем обращений сида + имена.
4. Announcements: EN-маппинг заголовков/текста объявлений сида; «Завтра»/«ауд.» — словарные подписи времени/места (или уже есть — проверь).
5. Assistant greeting: в AssistantContext добавь fullName (полное ФИО студента/сотрудника), в greetingMessage на EN: enPersonName(fullName) → первое слово = displayName («Anna»); RU — как было. Обнови типы и моки тестов.
6. Юнит-тест «no Cyrillic on EN»: рендер staff сводки/очереди/appeals/announcements + greetingMessage EN с сид-данными — ноль кириллицы (red-first).

Запреты: RU-рендер байт-в-байт; scripts/swarm/ не трогать; owner-scope не ослаблять.
Готово: тесты зелёные; node scripts/swarm/gates.mjs → GATES_SUMMARY: green (env готов, deps установлены); коммиты на ветке pochtasergeia/dig-124-en-staff-clean с DIG-124, push на origin. НЕ создавать PR — сводит оператор. Работай только в /tmp/dig-124.
