DIG-104: Регресс RU — полный прогон кабинета студента (все экраны, desktop+mobile 360). Работай только в /tmp/dig-104.
1. Против прода https://ostrovok.store: вход anna.smirnova/anna-demo-2026 (cookie без du-locale = RU). Playwright-скрипт (если браузера нет: npx playwright install chromium): все маршруты /dashboard /schedule(+views) /grades(+) /requests /notifications /deanery /feedback /help /guide /ai-assistant /mcp /people /news /events /msp /dpo /finance /profile /settings /tasks /services /more — скриншоты desktop 1440 и mobile 360 в /tmp/dig-104/shots/.
2. Проверки: консоль без ошибок (page.on('console') errors), ссылки не 404, пустые состояния есть, мобильная вёрстка не ломается (360), даты в МСК.
3. Дефекты: минимальные фиксы в src/ + юнит-тест; глобальные — REGRESSION-FINDINGS-104.md (что/где/серьёзность).
4. DoD: скриншоты + отчёт; gates green (env готов, deps установлены); коммиты на ветке pochtasergeia/dig-104-regress с DIG-104, push. НЕ создавать PR.
