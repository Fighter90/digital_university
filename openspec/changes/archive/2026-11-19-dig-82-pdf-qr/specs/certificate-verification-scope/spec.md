# DIG-82 — delta: certificate-verification — скоуп выдачи кода мгновенного документа

## ADDED Requirements

### Requirement: Скоуп выдачи кода мгновенного документа

Требование «Скоуп выдачи кода мгновенного документа» — обязательное (MUST):

#### Scenario: Контекст не студент или `studentId` входа
- **WHEN** контекст не студент или `studentId` входа не совпадает с контекстом
- **THEN** `getOrCreateDocumentVerification` отвечает null и пишет отказ в аудит (`ROLE_MISMATCH` / `OWNERSHIP_DENIED` через `denyAccess`); чужой номер заявки отвечает тем же единым 404 роута (IDOR исключён).
