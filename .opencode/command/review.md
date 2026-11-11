---
description: Независимое ревью диффа текущей ветки агентом reviewer (VERDICT: ACCEPT/RETURN)
---
Сформируй дифф текущей ветки с origin/main (`git diff origin/main...HEAD`) и
вызови агента-ревьюера свежим контекстом:

opencode run --agent reviewer "ЗАДАЧА: <id> — <title>. Дифф:\n<DIFF>…</DIFF>"

Покажи пользователю вердикт и замечания. Ветка: ${ARGUMENTS:-текущая}.
