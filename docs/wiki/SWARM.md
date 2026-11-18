# Рой агентов (Swarm)

## Запуск
```bash
nohup bash scripts/swarm/supervisor.sh > /tmp/swarm-supervisor-dig.log 2>&1 &
# лог оркестратора: /tmp/swarm-orch-digital-university.log
node scripts/swarm/orchestrator.mjs --max 1 --dry-run   # только показать очередь
```

## Конвейер
supervisor → orchestrator (Linear Todo + метка swarm) → ветка dig-XX от origin/main →
раунды **executor** (GLM-5.3-flash, таймаут 30 мин, до 2 повторов при code=null) →
**gates** (lint/typecheck/build/test, build под .next-build.lock) →
**reviewer** (fresh context, ACCEPT/RETURN) → **security** (IDOR/секреты, PASS/FAIL) →
**documenter** (changelog + ai-log + STORY) → push + PR (squash) → Linear Done.

## Промпт-контракт executor'а
- red-first тесты; только файлы задачи; без новых зависимостей.
- conventional commits «— DIG-XX»; НЕ пушить; PR делает оркестратор.
- финал строго `DEV_SUMMARY: status: done|…|blocked`.
- статус Linear не читать — им владеет оркестратор.

## Rate-limit и сбои
- «Usage limit reached for 5 hour…» → cooldown 180 с, повторы до 2 на раунд.
- После раундов: `commits on branch: N; blocked → using done` — гейты по ветке.
- Машина спит → executor умирает → страх-коммиты каждые ~10 минут обязательны.

## Сальвадж-процедура (ветка отстала от main)
1. wip-коммит сохранённых файлов.
2. `git merge origin/main` → union-резолв (обе стороны; дедуп импортов/словарей; ремонт склеек «})),  getO»).
3. tsc → gates green → force-push ветки (DIRTY→CLEAN) → merge PR.

## Параллельные агенты
Изолированный worktree + ветка + запрет портов 3000–3010 и .next-build.lock;
агент делает PR, merge — оператор. Практика: 3 конвейера одновременно (рой + 2 агента).
