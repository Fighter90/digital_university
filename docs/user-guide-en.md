# User Guide (EN) — companion to docs/user-guide-ru.md

> The English mirror of the user guide. The Russian version (`docs/user-guide-ru.md`) is canonical and contains the full step-by-step walkthrough of every screen for students and staff. This file lists the same coverage in English for quick reference.

## Coverage map (sections mirror the RU guide 1:1)

1. **Sign-in & security** — demo jury accounts, rate limiting (30/15 min per IP), account lockout, sessions with revocation, sign-out, data isolation (unified 404 + audit).
2. **Home /dashboard** — «Your week» hero, tiles (GPA/Credits/Debts/Requests), quick actions, configurable widgets, recent notifications.
3. **Schedule /schedule** — Day/Week/Month views, drag-scroll, lesson details panel (?event=), rescheduled/cancelled badges, teacher link to the directory, ICS subscription.
4. **Performance /grades** — GPA ring, credits, group rating, debts traffic light, empty-state hint; AI grade-dynamics chart; gradebook; discipline card; session exams; first-test hint.
5. **Requests /requests** — the 3-step wizard, canonical status machine (Submitted → Accepted → In progress → Ready → Issued; Needs a data fix / Needs rework / Rejected / Cancelled), ЗД-/SR- numbers, 24 h re-order window, PDF download, public QR verification at /verify/<code>.
6. **Deanery tickets /deanery** — TS-numbered tickets, manager chat, unread dots, attachments.
7. **Feedback /feedback** — proposal/complaint/thank-you, recipients, anonymous mode, own list.
8. **Tasks /tasks** — manual tasks + course deadlines, menu badge.
9. **News /news** — feed, categories, read state.
10. **Directory /people** — «My teachers», person cards, teacher links from lesson cards.
11. **Events /events** — poster feed, filters, sign-up/cancel, seats left.
12. **МСП /msp** — startup catalog, one-vote toggle voting, comments, launch of the day, «Launch a project».
13. **Additional education /dpo** — catalog (format/price/duration filters), my programs with progress, documents.
14. **Finance /finance** — study form, stipend, debts, contracts and payments (demo only).
15. **FAQ /help & Guide /guide** — categories with search; a detailed walkthrough with TOC and search; «not found» → deanery ticket or AI.
16. **AI assistant** — the assistant screen with action cards; the floating corner assistant (FAB) with OpenRouter + RAG over the guide (10 questions/min, 1000-char limit, offline fallback); voice input & read-aloud; grade-dynamics AI.
17. **Notifications** — bell panel, hub, per-category channel matrix, quiet hours.
18. **Search ⌘K** — global search across sections/requests/events/guide.
19. **Settings** — widget order, notification matrix + quiet hours, password change, active sessions, MCP token, theme, language.
20. **For staff** — /staff cabinet: faculty request queue with SLA highlighting, request card with allowed transitions and mandatory rework reasons, certificate PDF, ticket chat with reply templates, announcements, summary; students get 403 on /staff*.
21. **Mobile** — designed from 360 px: bottom tab bar, full-screen sheets, verified at 360×800 and 1440×900.
22. **Prototype limitations** — fictional data, no real payments/integrations, voice depends on the browser, the AI assistant is guide-scoped.

## Demo accounts

| Role | Login | Password |
|---|---|---|
| Student | `anna.smirnova` | `anna-demo-2026` |
| Student | `ilya.petrov` | `ilya-demo-2026` |
| Staff | `dean.kovaleva` | `dean-demo-2026` |

## Languages

The **RU | EN** switch sits in the header. EN translates the interface (menus, page titles, statuses, forms, empty states); demo content (names, courses, news) stays Russian by design. `document.documentElement.lang` follows the locale; dates format per locale. The choice persists in the `du-locale` cookie.
