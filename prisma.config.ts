// Конфигурация Prisma 7: URL подключения живёт здесь (не в schema.prisma).
// Значение берётся из окружения (.env: DATABASE_URL, см. .env.example).
const url = process.env.DATABASE_URL ?? 'postgresql://dig:change_me@localhost:5432/digital_university';

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: { url },
};
