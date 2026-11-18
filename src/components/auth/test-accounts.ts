// DIG-81 — единый источник чипов тестовых аккаунтов экрана входа: их же
// импортирует тест согласованности сида (tests/demo-seed-consistency.test.ts).
// Канон идентичности (BUG-07, вариант задачи «ФИО ↔ логины»): фамилия в чипе
// совпадает с фамилией в логине и с ФИО профиля в demo-сиде
// (src/server/data/demo-seed.ts) и prisma-сиде (prisma/seed-data.ts).
// Логины/пароли demo-набора и сида БД едины (DIG-50); пароли публичны
// by design (конкурсный прототип) — плейнтекст живёт здесь и в README,
// «Тестовые аккаунты». Данные вымышленные (AGENTS.md).
export interface TestAccount {
  label: string;
  login: string;
  password: string;
  role: 'STUDENT' | 'STAFF';
}

export const TEST_ACCOUNTS: readonly TestAccount[] = [
  {
    label: 'Анна Смирнова · ПИ-21',
    login: 'anna.smirnova',
    password: 'anna-demo-2026',
    role: 'STUDENT',
  },
  {
    label: 'Илья Петров · ЭК-11',
    login: 'ilya.petrov',
    password: 'ilya-demo-2026',
    role: 'STUDENT',
  },
  {
    label: 'Сотрудник деканата',
    login: 'dean.kovaleva',
    password: 'dean-demo-2026',
    role: 'STAFF',
  },
];
