---
description: Независимая security-проверка диффа агентом security (IDOR, секреты, ПДн, бренд)
---
Сформируй дифф текущей ветки с origin/main и вызови security-агента:

opencode run --agent security "ЗАДАЧА: <id> — <title>. Дифф:\n<DIFF>…</DIFF>"

Покажи SECURITY_VERDICT и findings. Напомни чек-лист: IDOR, секреты, вымышленные
ПДн, хэши паролей, бренд вуза, rate limit, инъекции. Ветка: ${ARGUMENTS:-текущая}.
