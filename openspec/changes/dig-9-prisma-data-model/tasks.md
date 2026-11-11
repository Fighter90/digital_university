# Задачи: dig-9-prisma-data-model

- [x] Тест-контракт `tests/prisma-schema.test.mjs` написан и падает до реализации (red).
- [x] `prisma/schema.prisma`: 27 моделей + перечисления, все FK проиндексированы.
- [x] Единый словарь `RequestStatus` из 8 значений, без синонимов.
- [x] Миграция `20261111000000_init` сгенерирована (`prisma migrate diff --from-empty`).
- [x] Ручные фрагменты: sequence `request_number_seq`, CHECK номера `ЗД-ГГГГ-NNNNNN`,
      CHECK `Grade.value` 0..10, FTS `FaqArticle.search` (russian, GENERATED STORED) + GIN.
- [x] `prisma.config.ts` (Prisma 7): `schema`, `migrations.path`, `datasource.url` из `DATABASE_URL`.
- [x] Миграция применена на чистой БД (postgres:16-alpine, `prisma migrate deploy`).
- [x] Smoke на БД: поиск FTS по словоформе «справках», CHECK-и отклоняют плохой номер и оценку 15,
      sequence выдаёт 1, 2.
- [x] ER-диаграмма (mermaid) и правила будущих миграций — в `docs/architecture.md`.
- [x] `node --test tests/prisma-schema.test.mjs` — 13/13 зелёные.
