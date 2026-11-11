# Рой агентов «Цифрового деканата» — архитектура

> Рой по образцу проверенного роя career-ops-ui: задача из Linear проходит полный
> цикл — разработка → тест-гейты → ревью свежим контекстом → security-гейт →
> документация → PR → (по флагам) merge → деплой — без человека в цикле.
> Запуск: `node scripts/swarm/orchestrator.mjs --max 1` (из корня репозитория).

## Схема

```
                 LINEAR (digital_university, команда DIG, Todo + метка `swarm`)
                                       │  pick (GraphQL, детерминированно)
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR scripts/swarm/orchestrator.mjs — конечный автомат:              │
│ git / npm / gh / opencode run / Linear GraphQL. Он НИКОГДА не решает,        │
│ какой код писать.                                                            │
└────┬──────────────┬───────────────┬────────────────┬────────────────┬────────┘
     │ claim        │ diff          │ diff           │ тексты         │ git+gh
     ▼              ▼               ▼                ▼                ▼
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌────────────┐   ┌────────────┐
│ LINEAR  │   │ EXECUTOR  │   │ REVIEWER  │   │ SECURITY   │   │ DOCUMENTER │
│ clerk   │   │ (GLM)     │   │ (GLM,     │   │ (GLM,      │   │ (GLM)      │
│ (без    │   │ red-first │   │ свежий    │   │ свежий     │   │ changelog  │
│ LLM)    │   │ на ветке  │   │ контекст) │   │ контекст)  │   │ + story    │
│ InProg/ │   └─────┬─────┘   └─────┬─────┘   └─────┬──────┘   └─────┬──────┘
│ Done    │         │               │ ACCEPT        │ PASS           │
└─────────┘         ▼               │               │                ▼
              ┌──────────┐          │        ┌──────▼─────┐   docs/ai-log/
              │ TESTER   │◀─ RETURN ┘        │  (FAIL →   │   + CHANGELOG
              │ (без LLM)│   (≤3 раунда)     │   executor)│   (пишет
              │ gates.mjs│◀──────────────────┘            │   оркестратор)
              └──────────┘                                 └────────────┘
                    PR → человек merge (или --merge) → [--deploy → ostrovok.store]
```

## Роли

| Роль | На чём | Что делает | Промпт |
|---|---|---|---|
| **Orchestrator** | Node, без LLM | Конечный автомат: выбор задачи, ветка, вызов агентов, парсинг маркеров, git/gh, Linear через GraphQL | `orchestrator.mjs` + `linear.mjs` |
| **Executor** | GLM (`opencode run --agent executor`) | Реализует задачу red-first на ветке `swarm/dig-xx`; коммитит; печатает `DEV_SUMMARY` | `.opencode/agent/executor.md` |
| **Tester** | **без LLM** | Детерминированные гейты `lint → typecheck → test → build` (`gates.mjs`); красный вывод возвращается исполнителю | `gates.mjs` |
| **Reviewer** | GLM, **свежий контекст** | Видит ТОЛЬКО дифф и задачу (не рассуждения исполнителя). Вердикт `VERDICT: ACCEPT / RETURN` | `.opencode/agent/reviewer.md` |
| **Security** | GLM, **свежий контекст** | IDOR, секреты, ПДн, хэши паролей, бренд, инъекции. `SECURITY_VERDICT: PASS/FAIL` | `.opencode/agent/security.md` |
| **Documenter** | GLM | Человеческая история: changelog + non-goal + `STORY:` (3 предложения) | `.opencode/agent/documenter.md` |
| **Linear clerk** | Node, без LLM | GraphQL-клиент: pick, claim, комментарии, Done. Надёжнее и дешевле LLM-клерка career-ops | `linear.mjs` |
| **Deployer** | bash, без LLM | rsync → docker compose up на сервере → health-check | `deploy.sh` |

Все LLM-роли — одна модель **GLM-5.3** (zai-coding-plan) через локальный `opencode run`.
Независимость ревью обеспечивает **свежий контекст**: ревьюер и security получают
только задачу и дифф, никогда — рассуждения исполнителя.

## Цикл по шагам

1. **Pick** — GraphQL: первая задача Todo с меткой `swarm` (приоритет ↓, номер ↑).
2. **Claim** — статус In Progress + комментарий «🎯 Рой принял задачу».
3. **Develop** — ветка `gitBranchName` задачи (или `swarm/dig-xx`); executor кодит red-first.
4. **Tester** — `node scripts/swarm/gates.mjs`; зелёный → дальше, красный → вывод исполнителю.
5. **Review** — ревьюер судит дифф; RETURN → замечания исполнителю (макс 3 раунда);
   нет вердикта — meta-verdict-проход.
6. **Security** — независимый чек-лист; FAIL → исполнителю как замечания раунда.
7. **Document** — documenter печатает тексты; ai-log и CHANGELOG пишет оркестратор.
8. **PR** — push ветки → `gh pr create` → комментарий в Linear со ссылкой.
   Человек merge'ует (или `--merge`); `--deploy` добавляет деплой на ostrovok.store.
9. **Done** — при `--merge`: Linear Done + комментарий-доказательство, ветка удалена.

## Как скормить задачу роему

1. Задача в команде **DIG**: заголовок — одно действие, описание — критерии приёмки.
   Держи задачу МАЛЕНЬКОЙ — один цикл = одна задача.
2. Статус **Todo** + метка **`swarm`** — метка единственный триггер претензии.
3. `node scripts/swarm/orchestrator.mjs --max N` (флаги ниже). Повторный запуск
   безопасен: лок-файл в `.task-board/lock`.

## Флаги и предохранители

- `--max N` (по умолчанию 1) · `--rounds N` (3) · `--dry-run` (только выбор) ·
  `--no-pr` (стоп после ACCEPT+security+document) · `--merge` (squash-merge) ·
  `--deploy` (после merge деплой) · `--pin DIG-XX` / `SWARM_PIN_ISSUE`.
- Дерево должно быть чистым, ветка — `main`; лок блокирует второй экземпляр.
- Любой сбой → комментарий «⚠️ Рой споткнулся…» в задаче; задача остаётся
  In Progress; ветка сохраняется для человека. Доска — источник истины.
- Исполнитель работает под `opencode run` (автономия направлена владельцем);
  остальные роли пермиссионно ограничены агент-файлами.

## Перенесённые уроки career-ops-роя

- Маркерные контракты (`DEV_SUMMARY`, `VERDICT`, `SECURITY_VERDICT`, `STORY`) —
  только exit-код гейтов и последние строки вывода являются истиной.
- Рефлог-спасение: ветка пересоздаётся без `-B`, потерянные коммиты чэрри-пикаются.
- «Уже в main»: если работа исполнителя уже в main — задача закрывается Done с доказательством.
- Push ветки до `gh pr create` (ветка обязана быть на origin).
- Meta-verdict: если ревьюер дал анализ без строки вердикта — отдельный мини-проход.
- Висящий воркер не вешает оркестратор (detached process group + таймаут).

## Осознанные упрощения v1

- Параллелизм (worktree × 3 из DIG-5) отложен: циклы последовательные, `--max N` — очередь.
- Деплой-нога включается флагом `--deploy` и требует готового `deploy/docker-compose.yml` (задача DIG-7).
- CHANGELOG ведётся по принципу Keep a Changelog (ru), версии проставляет человек.
