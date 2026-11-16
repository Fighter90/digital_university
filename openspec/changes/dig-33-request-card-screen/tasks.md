# DIG-33 — tasks

## Тесты (red-first)

- [x] `tests/request-time-format.test.ts` — один форматтер, явная зона
      Europe/Moscow, суффикс «МСК», независимость от host-пояса.
- [x] `tests/request-card-view.test.ts` — «Ведёт» по последнему
      STAFF-событию, ожидаемая дата по SLA от последнего «вперёд»-перехода,
      секции параметров + мета мастера + вложения, размеры файлов.
- [x] `tests/request-detail-page.test.tsx` — контракт SSR карточки:
      шапка (номер+копирование, пилюля, степпер, срок, ведёт), блок
      доработки с формой, блок документа (превью/скачать/проверить/email),
      параметры, таймлайн с «МСК», действия (отмена, вопрос).
- [x] `tests/request-card-actions.test.ts` — вопрос → обращение с темой
      «Вопрос по заявке ЗД-…» (владелец да, чужой/staff — отказ),
      email-отправка (только мгновенная READY/ISSUED владельца).
- [x] `tests/access-control.test.ts` — `/verify` (без кода) публичен.
- [x] `tests/demo-canonical-requests.test.ts` — seeded-заявки Ильи
      (READY мгновенная + NEEDS_FIX) с валидной историей.
- [x] `e2e/request-card.spec.ts` — Анна (read-only): шапка/копирование,
      форма доработки, блок документа, параметры/вложения, таймлайн МСК,
      чужой «ЗД-…» → единый 404; Илья (мутации): исправление → «Подана» +
      событие, отмена, вопрос, email.

## Реализация

- [x] `src/lib/request-labels.ts` — formatRequestDate/formatReadyBy:
      явная зона Europe/Moscow, суффикс «МСК» у времени.
- [x] `src/lib/request-card-view.ts` — чистые помощники карточки.
- [x] `src/server/data/canonical-requests.ts` —
      createRequestQuestionAppeal, sendRequestDocumentByEmail.
- [x] `src/server/actions/requests.ts` — createRequestQuestionAction,
      sendRequestDocumentByEmailAction (ctx из живой сессии).
- [x] `src/app/(cabinet)/requests/[number]/page.tsx` — каноническая
      карточка по составу задачи; legacy-мир (SR-…) без изменений,
      кроме единого времени.
- [x] Компоненты: copy-request-number, request-fix-form,
      request-question-form, request-email-button, request-history-timeline.
- [x] `src/app/api/requests/[number]/document/route.ts` — `?inline=1`
      → Content-Disposition: inline (превью).
- [x] `src/app/verify/page.tsx` + форма ввода кода; гвард: `/verify`.
- [x] `src/server/data/demo-seed.ts` — заявки Ильи + мета мастера
      (вложения) в заявках «нужна доработка».

## Проверка

- [x] vitest: новые и соседние тесты зелёные.
- [x] lint + typecheck.
- [x] e2e: request-card + requests + data-isolation (desktop-1440 и
      mobile-360) зелёные.

## Раунд 2 (замечания ревью)

- [x] Убран неиспользуемый импорт `isTerminalRequestStatus` из
      `src/app/(cabinet)/requests/[number]/page.tsx` (ESLint
      no-unused-vars, предупреждение в next build).
- [x] Сборочный флейк `ENOENT routes-manifest.json → standalone`:
      след гонки двух параллельных сборок за один `.next`
      (stale lock, pid мёртв); лечение — очистка `.next` и
      одиночный прогон, гейты повторно зелёные
      (lint/typecheck/build/test = pass).
