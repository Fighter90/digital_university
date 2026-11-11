## DIG-XX · <заголовок задачи>

- **Дата:** ГГГГ-ММ-ДД
- **Оркестратор:** scripts/swarm/orchestrator.mjs (детерминированный, без LLM)
- **Агенты:** executor → gates → reviewer → security → documenter (GLM-5.3, opencode run)
- **Раундов dev↔review:** N
- **Гейты:** lint/typecheck/test/build — результат
- **Ревью:** RETURN → ACCEPT (ключевые замечания ревьюера)
- **Security:** PASS (или FAIL + как исправили)
- **PR:** ссылка
- **Итог исполнителя:** краткое DEV_SUMMARY
- **История:** 1–3 предложения для людей
