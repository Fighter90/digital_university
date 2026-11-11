import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads its configuration from this file (not from schema.prisma's
// datasource url and not from package.json). DATABASE_URL comes from .env.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
