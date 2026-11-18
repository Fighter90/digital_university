# DIG-72 — tasks

## Спека и данные

- [x] openspec/changes/dig-72-ai-fab-rag-popup: proposal.md, tasks.md, delta-спека floating-assistant
- [x] `.env.example` — имена OPENROUTER_API_KEY / OPENROUTER_MODEL без значений

## Red-first (тесты)

- [x] tests/floating-assistant-knowledge.test.ts — retrieval находит нужный чанк (RU-вопросы: справка, пересдача, стипендия; EN-ключ MCP), топ-3, промпт (системный + контекст), снятие markdown
- [x] tests/floating-assistant-service.test.ts — fallback без ключа (fetch не зовётся), ответ модели при моке fetch, fallback при ошибке API, rate-limit 10/мин на сессию, обрезка >1000, в логах нет текста вопроса
- [x] tests/floating-assistant-popup.test.tsx — попап: отправка по Enter и кнопке, ответ-текст, пометка демо-режима у fallback, ошибка лимита; Shell: FAB виден студенту на /dashboard и скрыт на /ai-assistant

## Реализация

- [x] src/lib/floating-assistant-knowledge.ts — чанки GUIDE_SECTIONS + FAQ_ARTICLES, лексический retrieval, промпт, toPlainText
- [x] src/server/ai/openrouter.ts — fetch chat-completions, ключ из env, таймаут 20 c, без повторов
- [x] src/server/ai/floating-assistant.ts — rate-limiter (10/мин/сессия), обрезка 1000, оркестрация «модель → fallback», лог без текста вопроса
- [x] src/server/actions/floating-assistant.ts — askFloatingAssistant за requireDataCtx
- [x] src/components/assistant/floating-assistant-popup.tsx — попап-чат (десктоп-карточка с хвостиком, мобильный bottom-sheet, Enter, история в памяти)
- [x] src/components/shell/ai-fab.tsx — FAB на десктопе тоже, coral-токены
- [x] src/components/shell/shell.tsx — FAB открывает попап; скрытие на /ai-assistant; панель DIG-46 осталась на кнопке шапки
- [x] src/components/shell/ai-guide.tsx — пилюля/панель гида на десктопе сдвинуты левее FAB

## e2e

- [x] e2e/floating-assistant.spec.ts — FAB над таб-баром (360), попап → вопрос → ответ fallback без реального OpenRouter; FAB скрыт на /ai-assistant; десктоп 1440 — карточка ~400 px у правого края
- [x] e2e/assistant.spec.ts — панель DIG-46 на мобильном открывается кнопкой шапки (FAB теперь — попап DIG-72)
- [x] e2e/ai-guide.spec.ts — актуальный локатор плавающей AI-кнопки (кнопка, не ссылка)

## Гейты

- [x] vitest (новые + регресс), lint, typecheck, gates
- [x] e2e: floating-assistant, assistant, cabinet-shell, ai-guide — зелёные
- [x] grep репозитория по `sk-or-` пуст; ключ только в env
