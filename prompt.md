DIG-78: Баг — переключатель «Озвучка и голосовой ввод» не сохраняется (settings, регресс). ЦЕЛЬ: в Настройках тумблер voiceAssistant сохраняется через server action в StudentSettings: включение → action → перезагрузка → значение сохранено (e2e voice-assistant.spec:58 ждёт aria-checked=true после включения и перезагрузки).

Контекст: Next.js 15 App Router + TypeScript, server actions в src/server/actions/, настройки студента — StudentSettings (prisma-модель / settings-view). Поле voiceAssistant появилось в DIG-65. Тумблер — вкладка /settings (component в src/components/settings или src/app/(cabinet)/settings).

Что делаем:
1. Найди, где тумблер voiceAssistant рендерится и какой action его сохраняет.
2. Диагноз: либо action не пишет поле, либо перезагрузка читает дефолт (поле не селектится), либо optimistic-переключение не синхронизировано.
3. Исправь: включение → server action → перечитать из БД → aria-checked отражает сохранённое значение.
4. Юнит-тест: settings-мок, toggle → save → перечитать — значение сохранено (red-first: сначала тест, воспроизводящий баг).

Готово, когда: юнит-тест зелёный; node scripts/swarm/gates.mjs → GATES_SUMMARY: green (.env с DATABASE_URL="postgresql://dig:seedpass@localhost:5432/digital_university" создан, deps установлены); коммит(ы) на текущей ветке с DIG-78, push на origin (gh доступен).

Работай только в текущей директории (/tmp/dig-78voice). Не трогай другие worktree и главный репозиторий.
