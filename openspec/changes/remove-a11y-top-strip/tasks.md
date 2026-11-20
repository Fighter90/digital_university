# Tasks: remove-a11y-top-strip

- [x] 1. Red-first: переписать `tests/a11y-version-places.test.tsx` — полоска
      отсутствует на Shell и лендинге, футер работает (RU/EN, plain, hidden-поля).
      Подтверждён red: 2 failed (полоска ещё рендерится) / 4 passed.
- [x] 2. Убрать `variant="strip"` из `src/components/shell/shell.tsx` и
      `src/components/landing/landing-content.tsx` (комментарии-маячки на месте).
- [x] 3. e2e `zz-dig-106-107-regress.spec.ts`: два клика по полоске → клик по
      футер-ссылке (`a11y-version-footer` > `a11y-version-link`).
- [x] 4. Зелёный прогон: `vitest run tests/a11y-version-places.test.tsx
      tests/a11y-version.test.tsx` → 31/31.
- [ ] 5. Lint + typecheck + коммит + PR + merge.
- [ ] 6. Полный e2e по доступности (dig-106-107, desktop+mobile) после merge.
