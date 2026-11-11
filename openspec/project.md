# Контекст проекта для агентов OpenSpec

- Продукт: «Цифровой деканат будущего» — прототип ЛК студента (конкурс).
- Стек: Next.js 15 App Router + TypeScript, Prisma + PostgreSQL, Tailwind (Inter),
  NextAuth (bcrypt), Vitest + Playwright, Docker Compose + Caddy.
- Правила: AGENTS.md (запреты: реальные ПДн, секреты в коде, бренд вуза).
- Экраны: Figma dP2lFEahhw1gBbMRKX7BD2, карта — docs/figma-screens.md.
- Данные: только вымышленные; плашка «Концепт для конкурса» на каждой странице.
- Мобильный минимум: 360 px; e2e на 360×800.
- Безопасность: фильтрация по сессии (IDOR), хэши паролей, rate limit входа.

rules:
  proposal:
    - Кратко: зачем, что, non-goals. <= 400 слов.
  tasks:
    - Шаги <= 2 часов, каждый проверяем.
  specs:
    - Каждый Requirement с хотя бы одним Scenario WHEN/THEN.
