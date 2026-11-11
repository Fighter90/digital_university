# Tasks: серверная часть успеваемости — DIG-25

- [x] 1. Red-first: `tests/performance.test.ts` — 40 контрактов: накопленная
  оценка (текущая/минимальная/максимальная, нормировка весов, дедуп
  пересдач, maxScore ≤ 0, robustness без плана), семестры (московский
  календарь, метки, сортировка, предыдущий), средневзвешенное и
  арифметическое округление (половина вверх), `needForTargetPure`
  (граница 69.5→70, secured, unreachable, нет оценок, экзамен сдан,
  экзамена нет, шкала 60-балльного экзамена), перцентиль и формулировка
  («Вы входите в 40% лучших в группе»), агрегат `getPerformance`
  (накопленные по дисциплинам, завершённые с итогом и кредитом,
  безоценочные дисциплины, сортировка, GPA семестр/всё время/дельта,
  кредиты 9/240, рейтинг 2 из 5 с competition ranking при равных GPA,
  группа из одного, студент без оценок, долги ASSIGNED/OVERDUE/CLOSED),
  `needForTarget` по ctx (все статусы на демо-данных), IDOR (сотрудник —
  ROLE_MISMATCH + аудит; чужая/несуществующая дисциплина — единообразный
  null + OWNERSHIP_DENIED; NaN-цель — null; в данных Анны нет чужих ФИО,
  Илья видит только ЭК-11). Падало до реализации (модулей не существовало).
- [x] 2. `src/lib/performance-math.ts` — чистые формулы без серверных
  импортов (см. proposal).
- [x] 3. Порт DIG-12 + in-memory адаптер: `listDisciplinesByGroup`,
  `listDisciplineElementsByGroup`, `listGradesByGroup` (вход агрегата
  рейтинга), типы `DisciplineRow`/`DisciplineElementRow`, seed-ключи
  `disciplines`/`elements`.
- [x] 4. `src/server/data/performance.ts` — `getPerformance`,
  `needForTarget`; barrel `@/server/data` экспортирует функции и типы.
- [x] 5. Демо-сид: дисциплины с кредитами ПИ-21/ЭК-11, планы контроля,
  4 сокурсника с итогами весны 2025/26 (рейтинг Анны 2/5), пересдачи
  PROG (просрочена) и DISC (закрыта); существующие строки сидов не менялись
  (дедлайны главной и сводка-герой детерминированно прежние).
- [x] 6. `docs/grading.md` — правила шкалы, округления (арифметическое до
  целого; блокирующих элементов нет), семестров, кредитов, рейтинга и
  перцентильной формулировки, долгов и доступа.
- [x] 7. Зелёные гейты: `npx vitest run tests/performance.test.ts` 40/40;
  полный `npm test`; lint; typecheck; `node scripts/swarm/gates.mjs`.
- [x] 8. Change-папка openspec/changes/dig-25-performance-server
  (proposal, tasks, delta-спека performance).
