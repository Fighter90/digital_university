# observability Specification

## Purpose
Наблюдаемость: health-эндпоинт без секретов для ops/security-проверок состояния хранилища.
## Requirements
### Requirement: Health-эндпоинт без секретов

`GET /api/health` ДОЛЖЕН (MUST) возвращать
`{ ok: true, authStore: 'prisma' | 'memory' }` без секретов и
идентификаторов — достаточно для ops/security-проверки «memory-store
не активен на проде».

#### Scenario: проверка статуса хранилища на проде

- **WHEN** ops-скрипт запрашивает `GET /api/health` на проде
- **THEN** ответ содержит `ok: true` и `authStore: 'prisma'`; в теле нет
  секретов, токенов и идентификаторов пользователей

