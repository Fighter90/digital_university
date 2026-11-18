# Как добавить модуль (эталон: /msp, /dpo)

1. Linear задача (метка swarm) + OpenSpec change-папка (proposal/tasks/delta-spec).
2. `types.ts` — Row-интерфейсы В КОНЕЦ файла.
3. `port.ts` — методы в конец owner-scoped секции (list…ByStudent / toggle / append / create).
4. `memory-db.ts` — let-хранилища + MemorySeed-поля + реализация.
5. `index.ts` — экспорт функций и View-типов.
6. `src/server/actions/<модуль>.ts` — validate → requireDataCtx → фасад → revalidatePath.
7. Экраны `(cabinet)/<модуль>/page.tsx` (+ `[slug]` с единым notFound) + loading.tsx.
8. Компоненты `src/components/<модуль>/**`; фильтры — query-параметры.
9. Меню: nav-items + nav-icons + пин-тест cabinet-shell.
10. Тесты: data-контракты (toggle/дубликаты/сортировки) + рендер + i18n паритет.
11. `openspec validate` + gates green → PR → squash-merge → Linear Done.

## Запрещено
- Доступ к данным мимо `@/server/data`; Prisma напрямую из страниц.
- Неролевые мутации (IDOR); оракул существования (чужое ≠ 404).
- Секреты в коде; ослабление CSP/rate-limit.
- Смена RU-строк существующего UI байт-в-байт (ломает тесты).
