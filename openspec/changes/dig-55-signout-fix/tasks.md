# DIG-55 — задачи

- [x] Red-first: юнит-тесты UserMenu («Выйти» — submit server action, форма
      не размонтируется до отправки), middleware (no-store на защищённых,
      sliding не на POST), страницы /login (?signedOut=1 → role="status")
- [x] `signOutAction` / `signOutAllDevicesAction`: удаление сессии в БД +
      сброс `__Host-session` и `__Host-role` + redirect `/login?signedOut=1`
- [x] Экран входа: сообщение об успешном выходе (`role="status"`)
- [x] `UserMenu`: «Выйти» — submit-форма вместо ссылки-заглушки; без
      `onClick={setOpen(false)}` на кнопке выхода
- [x] Middleware: `Cache-Control: no-store` на защищённых экранах; sliding
      renewal только на GET/HEAD (мутящие POST не пере-выдают куки)
- [x] e2e (desktop-1440): «Выйти» → `/login?signedOut=1` с сообщением →
      кука `__Host-session` удалена → Back не возвращает кабинет
- [x] e2e password-change (profile-settings): выход завершается на
      `/login?signedOut=1`
