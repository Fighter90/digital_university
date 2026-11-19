# Proposal: режим доступности «Крупный текст и без эффектов» (DIG-86)

## Зачем

Функция для людей с плохим зрением: по тумблеру в «Настройках» эффекты
убираются (анимации/тени/плавные появления), текст становится крупнее по
всему кабинету. Сегодня есть только «Уменьшить анимацию» (DIG-44,
строка настроек) и системный prefers-reduced-motion — крупного
«a11y-режима в один клик» с плоским статичным интерфейсом нет.

## Что

- Cookie `du-a11y` (значения `large-text` / `no-effects` /
  `large-text,no-effects`) — как du-locale (DIG-69): не нужен data-слой.
- Server action `setA11y` (owner-scoped: `requireDataCtx` — только владелец
  сессии, whitelist значений, IDOR невозможен).
- Вкладка «Настройки → Доступность» (`?tab=accessibility`) с двумя
  клавиатурными тумблерами (role="switch"), подписи RU/EN.
- Root layout читает cookie → ставит `a11y-large-text` / `a11y-no-effects`
  на `<html>` server-side, до первой отрисовки.
- globals.css: `a11y-large-text` — базовый размер 125% (диапазон
  «112,5%+», rem-масштаб), усиленные веса, крупные отступы;
  `a11y-no-effects` — animation: none, transition-duration: 0, тени
  отключены, reveal-секции видимы сразу (контент никогда не скрыт).
- Существующие prefers-reduced-motion и `html.reduce-motion` (DIG-44)
  не ломаются; тумблер работает независимо от системной настройки.
  Токены дизайн-системы не переопределяются (контракт DIG-13).

## Non-goals

- Не трогаем «Вид → размер шрифта» и «Уменьшить анимацию» (DIG-44) —
  a11y-режим лишь приоритетнее задаёт font-size корня.
- Не добавляем поле в строку настроек (cookie достаточно для прототипа,
  паттерн du-locale).
- Не меняем поведение `prefers-reduced-motion` и dark.css.

## DoD

- Юнит red-first `tests/a11y-mode.test.tsx` (28 сценариев): cookie-контракт,
  классы на `<html>` по кукам (SSR root layout), CSS-контракт
  (125% ≥ 112,5%, transition-duration 0, animation none, тени, reveal),
  состояние тумблеров из cookie, i18n-паритет RU/EN.
- Смежные тесты зелёные (settings-page, i18n, design-tokens,
  micro-animations), gates green.
