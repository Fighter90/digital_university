# Tasks: dig-82-pdf-qr

## Red (тесты прежде реализации)

- [x] `tests/helpers/qr-decode.ts` — тестовый декодер QR-матрицы
  (BCH + Рида–Соломона + byte-mode), общий для unit и e2e.
- [x] `tests/enrollment-certificate-pdf.test.ts` — red: ссылка в строках,
  отсутствие обещания «QR появится», round-trip декод QR, точный подсчёт
  модулей в контенте PDF, инвариант нижнего поля.
- [x] `tests/transcript-pdf.test.ts` — red: те же контракты + плотная
  выписка (6 семестров) выталкивает блок с QR на новую страницу.
- [x] `tests/verify-data.test.ts` — red: `getOrCreateDocumentVerification`
  (регистрация, idемпотентность, синтетический ключ выписки, скоуп).
- [x] Red-прогон зафиксирован: 12 failed / 31 passed.

## Green (реализация)

- [x] `src/lib/enrollment-certificate-pdf.ts` — опция `verifyUrl`, QR из
  `pdf/qr.ts` вместо пунктирной рамки, перенос строк блока (55 символов),
  перенос блока на новую страницу при нехватке места, экспорт
  `certificateQrMatrix`.
- [x] `src/lib/transcript-pdf.ts` — то же + экспорт `transcriptQrMatrix`.
- [x] `src/server/data/certificates.ts` — `getOrCreateDocumentVerification`
  (owner-scope + аудит через `denyAccess`, 30 дней, crypto-код).
- [x] `src/server/data/index.ts` — экспорт новой функции слоя.
- [x] `src/app/api/requests/[number]/document/route.ts` — код из реестра,
  `verifyUrl` в оба шаблона; `newVerificationCode` (Math.random) убран.
- [x] `src/app/api/grades/transcript/route.ts` — то же для выписки мимо
  заявки (синтетический ключ на студента).

## Проверка

- [x] Юнит: точный подсчёт тёмных модулей QR в контенте PDF (парсер —
  аналог требования «pdfimages находит изображение»).
- [x] Юнит: QR декодируется в verify-URL (round-trip BCH/RS).
- [x] e2e (`e2e/request-card.spec.ts`, desktop-1440 + mobile-360):
  скачать PDF → «сканирование» QR → `/verify/<код>` → карточка
  «Документ действителен».
- [x] `npm run lint` / `npm run typecheck` / `npm test` — зелёные
  (143 файла, 1986 тестов); `node scripts/swarm/gates.mjs` — green.
