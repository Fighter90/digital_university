// Конфигурация Prisma 7: URL подключения живёт здесь (не в schema.prisma).
// Значение берётся ТОЛЬКО из окружения (.env: DATABASE_URL, см. .env.example).
// Секреты в коде запрещены (AGENTS.md, чек-лист security-гейта) — без переменной
// запуска падает сразу, а не уходит с дефолтными кредами.
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'DATABASE_URL is not set — скопируйте .env.example в .env и заполните (см. README).'
  );
}

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: { url },
};
