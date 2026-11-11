# SDD-процесс проекта (OpenSpec)

Проект ведётся по **spec-driven development**: спецификация — единственный
источник правды, код догоняет спеки, а не наоборот.

## Артефакты

```
openspec/
├── config.yaml          # схема spec-driven + контекст проекта
├── project.md           # контекст для агентов (стек, ограничения)
├── specs/<capability>/  # ТЕКУЩАЯ правда системы (после archive)
└── changes/<change-id>/ # предложение изменений: proposal → tasks → delta
```

## Поток одной задачи

```
Linear задача (DIG-XX)
   │
   ├─ есть change-папка? → нет: создать openspec/changes/dig-xx-<slug>/
   │      proposal.md (зачем, что, non-goals)
   │      tasks.md (чек-лист шагов ≤2ч)
   │      specs/<capability>/spec.md (delta: ADDED/MODIFIED/REMOVED)
   │
   ├─ executor реализует по tasks.md, отмечает выполненное
   ├─ гейты + ревью + security (рой)
   ├─ PR merge
   └─ openspec archive <change> → delta вливается в specs/
```

## Правила

1. **Спека прежде кода.** Если поведение меняется — сначала delta-спека.
2. **Каждая спека проверяема**: каждый Requirement имеет Scenario с WHEN/THEN.
3. **Изменение спеки только через change-папку** — никаких правок specs/ напрямую.
4. После merge — `openspec archive` (вручную или следующей задачей роя).
5. Команды: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`, `openspec validate`.
