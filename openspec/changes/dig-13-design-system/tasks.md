# Tasks: DIG-13 — Дизайн-система

## 1. Red-first тесты

- [x] 1.1 `tests/design-tokens.test.ts` — токены в globals.css (точные значения),
  шрифт Onest в layout.tsx, AA-пары контраста (WCAG), радиусы/тени, штриховка
  «переноса», инвентарь компонентов, stroke 1.8, dev-guard `/design`.
- [x] 1.2 `tests/ui-components.test.tsx` — рендер и поведение: Button (варианты/размеры),
  Chip (активный), Badge (словарь), Stepper (5 шагов, состояния), ProgressRing,
  Toggle (aria-checked), Segmented (radiogroup + стрелки), Avatar (инициалы),
  Skeleton, EmptyState, ErrorState, Toast.
- [x] 1.3 `e2e/design-system.spec.ts` — `/design` на 1440 и 360, кольцо фокуса
  с клавиатуры, скриншоты в `docs/design/screenshots/`.
- [x] 1.4 Установить jsdom + @testing-library/react, убедиться что тесты красные.

## 2. Токены и шрифт

- [x] 2.1 globals.css: палитра, статусы + ink, типы занятий, радиусы, тени,
  градиент, штриховка переноса, глобальный `:focus-visible`.
- [x] 2.2 layout.tsx: Onest (400–800, latin+cyrillic), `--font-sans` → Onest,
  заголовки 800 + tracking.
- [x] 2.3 THIRD_PARTY_LICENSES.md: Inter → Onest (OFL).

## 3. Компоненты `src/components/ui`

- [x] 3.1 Icon (lucide, stroke 1.8), barrel `index.ts`.
- [x] 3.2 Button (primary-градиент/secondary/ghost/danger; 40/48).
- [x] 3.3 Chip, Card, StatTile, Badge (единый словарь).
- [x] 3.4 Stepper (done/current/pending/rejected/ready), ProgressRing.
- [x] 3.5 Toggle, Segmented (День/Неделя/Месяц).
- [x] 3.6 Sheet (справа / снизу на мобильном), Dialog, Tooltip (base-ui).
- [x] 3.7 Toast, Skeleton, EmptyState, ErrorState, Avatar.

## 4. Галерея и проверки

- [x] 4.1 `/design` — dev-only, все компоненты и состояния, плашка «Концепт»
  (из layout).
- [x] 4.2 `npx vitest run` зелёный; `npm run lint`, `npm run typecheck` зелёные.
- [x] 4.3 e2e зелёный (1440 + 360), скриншоты приложены в `docs/design/screenshots/`.
- [x] 4.4 Коммит conventional с `DIG-13`.
