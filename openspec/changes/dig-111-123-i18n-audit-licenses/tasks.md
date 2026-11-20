# Tasks — DIG-111/DIG-123 аудит переводов и лицензии

## Red

- [x] tests/i18n-audit.test.ts: рантайм-аудит словарей (парность,
      плейсхолдеры, EN без кириллицы, RU без калек, двойные пробелы,
      терминология МСП/ДПО/statement). Подтверждён красный до правок
      словарей: 5 падений из 9.

## Правки словарей (закрытый список)

- [x] RU-кальки: «Отправить на email» → «Отправить на почту»;
      «ФИО, email или телефон…» → «ФИО, эл. почта или телефон…»;
      «Проверьте ФИО, email…» → «…эл. почту…»; «Email виден
      преподавателям» → «Эл. почта видна преподавателям»;
      канал «Email» → «Почта»; «visa-центров — со суммой» →
      «визовых центров — с суммой».
- [x] EN-терминология: menu.msp «Startups» → «SME»; menu.dpo «Extra
      education» → «Continuing education»; заявление — application
      (requests.subtitle, empty.requestsDesc, finance.action.materialAid.desc).
- [x] Артефакты: transcript.groupCourse / transcript.semesterLine —
      двойные пробелы → одиночные (RU и EN).

## Сопровождающие правки

- [x] Обновлены юнит-тесты, фиксирующие прежние строки:
      i18n-en-cabinet (SME), people-page (плейсхолдер), transcript-pdf
      (строка итогов семестра).
- [x] Обновлены e2e-ожидания: e2e/people.spec.ts (плейсхолдер),
      e2e/request-card.spec.ts (подпись кнопки письма).
- [x] Комментарии в коде, цитирующие прежние подписи UI: requests.ts,
      canonical-requests.ts, people.ts, request-email-button.tsx,
      people-browser.tsx, people-catalog.ts.

## Артефакты аудита и лицензий

- [x] scripts/i18n-audit.mjs — скрипт-аудит (код выхода 0/1) →
      TRANSLATION-AUDIT.md с глоссарием и исключениями.
- [x] LICENSES.md — таблицы «пакет → лицензия → использовано для»,
      шрифты (Inter — OFL 1.1), иконки (lucide-react — ISC), собственные
      PDF/XLSX-писатели, системные ffmpeg/say.
- [x] THIRD_PARTY_LICENSES.md — указатель на LICENSES.md.

## Гейты

- [x] lint / typecheck / build / test — зелёные
      (node scripts/swarm/gates.mjs).
