---
description: Запустить рой по задачам Linear с меткой swarm (dev → гейты → ревью → security → PR → Linear)
---
Запусти рой репозитория по навыку `swarm` (каноничное описание —
`.agents/skills/swarm/SKILL.md`): preflight, запуск
`node scripts/swarm/orchestrator.mjs --max ${ARGUMENTS:-1}` в фоне,
сопровождение по логу, фикс-форвард при сбоях оркестратора и отчёт пользователю
на его языке.
