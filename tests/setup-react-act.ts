// Общее тестовое окружение React (vitest, setupFiles — выполняется до кода
// теста). React 18+ требует явного объявления «act-окружения»: без флага
// каждый вызов act() в render-тестах пишет в stderr предупреждение
// «The current testing environment is not configured to support act(...)»
// и засоряет вывод тест-гейтов (замечание ревью r3 DIG-66).
// Флаг только включает штатный тестовый режим React; на поведение
// ассертов он не влияет.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
