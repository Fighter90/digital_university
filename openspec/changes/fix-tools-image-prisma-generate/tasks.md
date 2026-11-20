# Tasks: fix-tools-image-prisma-generate

- [x] 1. Диагностика: лог деплоя → seed падает на teacherEmail; серверный
      runner не содержит prisma/ (standalone) → сид идёт в tools-контейнере;
      в Dockerfile.tools generate стоит до COPY . . (затирается rsync-снапшотом).
- [x] 2. Фикс Dockerfile.tools: `RUN pnpm exec prisma generate` после `COPY . .`
      + комментарий-маячок.
- [x] 3. Локально `pnpm exec prisma generate` → src/generated содержит teacherEmail.
- [ ] 4. PR → merge → передеплой → в логе нет `[seed] failed`, health ok.
