// DIG-14: тип пользователя кабинета, безопасный для клиентских компонентов.
// requireUser() (DIG-11, реальная сессия) + resolveShellUser (DIG-50) дают
// объект этой формы; клиент получает только поля, нужные для отрисовки
// (никаких хэшей/токенов).
export type ShellUser = {
  name: string;
  email: string;
  group: string;
};
