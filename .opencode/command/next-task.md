---
description: Взять следующую задачу Linear (Todo + метка swarm) и провести её цикл до PR
---
Возьми следующую задачу: `node scripts/swarm/orchestrator.mjs --max 1 ${ARGUMENTS}`.
Сопровождай цикл: показывай вехи (выбор задачи → claim → разработка → гейты →
вердикт ревью → security → PR), relay-и важное пользователю, при сбое
классифицируй (баг оркестратора vs проблема задачи) и фикс-форвард по навыку
`swarm`. Логи: `.task-board/log/cycle-*.log`.
