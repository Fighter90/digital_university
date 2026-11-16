# Tasks: экран «Новости и объявления» — DIG-36

- [x] 1. Red-first: `tests/news-catalog.test.ts` — контракт каталога новостей:
  уникальные id, непустые поля, 4 темы с точными метками, 3 скоупа с точными
  метками; `newsForScope` (по группе/факультету, сортировка свежие сверху),
  `newsForTopic`, важные объявления (в т.ч. «изменился порядок пересдач»),
  обложки-файлы существуют на диске с alt, вложения ведут на существующие
  файлы; QA-тексты («ёлочки», без двойных пробелов, без точки в заголовке).
  Падало до реализации.
- [x] 2. Red-first: `tests/news.test.ts` — слой данных: `getNewsPage` —
  дефолтный скоуп группы (Анна: только ПИ-21, без ЭК-11), вкладки
  факультет/вуз, фильтр темы, совместный фильтр, `scopeDefaulted` для
  сотрудника; `getNewsArticle` (+isRead); `markNewsRead` owner-scoped
  (отметка Ильи не видна Анне), идемпотентно, неизвестный id — false.
  Падало до реализации.
- [x] 3. Red-first: `tests/news-page.test.tsx` — контракт /news (SSR):
  заголовок «Новости и объявления», полоса «Важно» с «Прочитано», вкладки
  (дефолт «Моя группа»), пилюли тем, карточки (обложка img с alt +
  loading="lazy", дата, источник, заголовок, 2 строки), пустое состояние,
  статья (/news/[id]): заголовок, дата, автор, абзацы, вложения,
  «Поделиться ссылкой», markNewsRead при открытии, 404 на неизвестный id,
  скелетон в Suspense. Падало до реализации.
- [x] 4. Red-first: `e2e/news.spec.ts` — чёрный ящик: дефолтная вкладка
  группы, чужие новости не видны, фильтр темы, объявление «Важно» →
  статья → «Прочитано» после возврата, «Поделиться ссылкой», 404,
  360 px — одна колонка + горизонтальный скролл пилюль, 1440 px —
  несколько колонок, сотруднику — факультетский скоуп. Падало до реализации.
- [x] 5. `src/lib/news-catalog.ts` — вымышленный каталог (15 записей: группа
  ПИ-21/ЭК-11, факультет ИТ/ЭК, вуз), типы, метки, `findNews`,
  `newsForScope`, `newsForTopic`, `importantOf`, обложки с alt, вложения.
- [x] 6. Слой данных: тип `NewsReadRow`, порт
  (`listNewsReadIdsByStudent`, `markNewsReadByStudent`), memory-адаптер
  (`newsRead` в seed), `src/server/data/news.ts` (`getNewsPage`,
  `getNewsArticle`, `markNewsRead` — whitelist каталога, `listDeaneryNews`
  из каталога), barrel `@/server/data`, demo-сид (у Анны одно прочитанное
  объявление).
- [x] 7. Экран `/news` (+ скелетон): страница (RSC, searchParams
  scope/topic), полоса объявлений «Важно» с «Прочитано», вкладки скоупа
  (клиентский radiogroup ссылок), пилюли тем, сетка карточек, пустое
  состояние; компоненты `src/components/news/*`.
- [x] 8. Страница `/news/[id]`: обложка (alt, lazy), мета (дата, источник,
  автор), абзацы, вложения (статичные файлы), «Поделиться ссылкой»
  (clipboard + fallback), notFound на неизвестный id, markNewsRead при
  открытии.
- [x] 9. Обложки `public/news/covers/*.svg` (4 темы) и вложения
  `public/news/files/*.txt` (вымышленные); блок новостей на главной ведёт
  на `/news/<id>` (sections.tsx + тест главной).
- [x] 10. Зелёные гейты: узкие vitest-прогоны, полный `pnpm test`,
  `pnpm lint`, `pnpm typecheck`, `node scripts/swarm/gates.mjs`, e2e
  `e2e/news.spec.ts` (оба вьюпорта).
- [x] 11. Change-папка openspec/changes/dig-36-news-screen (proposal, tasks,
  delta-спека news) — задачи отмечаются по ходу.
- [x] 12. Раунд 2 (замечание ревью — красный гейт typecheck): tsc читал
  устаревшие route-types из `.next/types` (валидаторы роута
  `schedule/[id]/ics`, переведённого DIG-28 на `session/ics`) — TS2307.
  Герметичный `npm run typecheck`: чистка `.next/types` + `.next-dev/types`,
  перегенерация `next typegen` (пересоздаёт `routes.d.ts` из next-env.d.ts),
  затем `tsc --noEmit`. Контракт зафиксирован в `tests/build-hermetic.test.ts`
  (red-first). Попутно разминирован календарный тест `/grades` (пустой
  семестр): фикстурная контрольная 14.11.2026 ушла в прошлое — время
  зафиксировано fake-timers внутри теста. Гейты: green (lint/typecheck/
  build/test).
- [x] 13. Раунд 3 (замечания ревью, все исправлены): 1) спека↔код —
  `decoding="async"` заявлен в proposal/спеке, в исходнике `<Image>` его не
  было (next/image ставит его по умолчанию) — атрибут сделан явным в
  news-card и на странице статьи, SSR-контракт зафиксирован в
  tests/news-page.test.tsx (рендер-тест: lazy + decoding + alt);
  2) e2e/news.spec.ts — удалён мёртвый пустой if-блок с комментарием
  (memory-стор пересоздаётся на прогон, он не нужен);
  3) news/[id]/page.tsx — убран дублированный абзац комментария;
  4) typecheck-скрипт кроссплатформенный: `node -e` + `fs.rmSync` вместо
  POSIX-only `rm -rf` (контракт — tests/build-hermetic.test.ts, red-first,
  `npm run typecheck` проверен вручную). Попутно в tasks.md п.5 исправлено
  число записей каталога: 15, а не 14.
