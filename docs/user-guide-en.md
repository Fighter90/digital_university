# User Guide (EN)

> «Digital Deanery» — a student portal. A hackathon concept prototype: all data is fictional. Live: https://ostrovok.store
>
> **Languages:** the interface is available in Russian and English — the **RU | EN** switch is in the right part of the header. Your choice persists across visits.

## 1. Sign-in & security

### 1.1. How to sign in
1. Open https://ostrovok.store — you land on the overview page describing the capabilities.
2. Press **«Войти в кабинет» / «Sign in»** — the login form opens.
3. Enter the login and password (for the jury — the demo accounts from the table below), or use the quick-login buttons under the form.
4. Press **Sign in**. After a successful sign-in a student lands on **/dashboard** and a staff member lands on **/staff**.

| Role | Login | Password | Who |
|---|---|---|---|
| Student | `anna.smirnova` | `anna-demo-2026` | Anna Smirnova, 2nd-year CS: good grades, requests in progress |
| Student | `ilya.petrov` | `ilya-demo-2026` | Ilya Petrov: debts and retakes — for the «bad path» scenarios |
| Staff | `dean.kovaleva` | `dean-demo-2026` | Maria Kovaleva, the IT-faculty deanery (the `/staff` cabinet) |

### 1.2. Sign-in protection
- **Rate limit:** at most 30 attempts per 15 minutes per IP; beyond that — «Too many attempts, wait N minutes».
- **Account lockout:** 5 wrong passwords in a row temporarily lock the account.
- **Sessions:** a sign-in creates a 30-day session; **Settings → Security** lists active sessions (device, IP, date) — revoke any of them.
- **Sign out:** the «Sign out» button in the profile menu deletes the session and both cookies (`__Host-session`, `__Host-role`) and lands you on a signed-out notice.
- **Password recovery:** the «Forgot password?» link is a prototype stub (real e-mail delivery is out of the concept's scope).

### 1.3. Data isolation
The portal shows **only your data**: other people's requests, tickets and grades are technically unreachable — any query for a foreign object returns the same unified 404, and the attempt is written to the audit log. The «Found an error in a grade? Write to the deanery» link on the performance page is the legitimate way to report a mismatch.

## 2. Home (/dashboard)

- **The «Your week» hero**: a greeting with the date, the day summary (moved / cancelled / retake in N days), and tile links: GPA (the credit-weighted average), Credits (of 240), Debts (retake required / all done), Requests in progress.
- **Quick actions**: «Order a certificate», «Write to the deanery».
- **Widgets** (order and visibility configured in Settings → Widgets): Today (lessons with moved/cancelled marks), Deadlines, Tasks, Performance, Requests, News, Events.
- **Recent notifications**: the bell panel mirrors the latest events; «All notifications» opens the full hub.
- **Configure notifications** — a direct link to the notification settings.

Tiles and blocks are clickable — each leads to its section.

## 3. Schedule (/schedule)

### 3.1. Views
- **Day**: the lesson feed on the left; on desktop — the **lesson details panel** of the selected lesson on the right.
- **Week**: a Google-Calendar-style grid with drag-scrolling (DIG-28) and a compact mode.
- **Month**: a compact overview; the mobile view is a vertical feed.

### 3.2. Lesson details
Click a lesson → a side panel: the time (with a live «until the end» countdown), the room/online link, the teacher (the name links to their directory card), homework and materials, and **prominent badges**: rescheduled (hatching + reason) and cancelled (struck-through title). The panel closes with the ✕ or Esc; on close, focus returns to the lesson card.

### 3.3. Calendar subscription (ICS)
On **Grades → Session** — an ICS link: subscribe to the schedule and deadlines in your system calendar (Apple Calendar, Google Calendar). The URL contains a personal token — do not share it with third parties; revoke it in settings.

## 4. Performance (/grades)

- **Summary**: a GPA ring (the credit-weighted average), credits (of 240), the group rating («top N%», the formula expands), a debts traffic light, an empty-state hint about the first credit test.
- **AI dynamics** (the «What changed» card): an explanation of how your average moved over the month, an interactive chart with per-date points and a breakdown of the works that moved the grade. Fully offline — no external services.
- **Gradebook**: all disciplines with grades/debts; a discipline card — the control plan (test / lab / exam items).
- **Session**: consultations, exams, retakes with the admission status.

## 5. Requests & certificates (/requests)

### 5.1. The 3-step wizard
1. **Type** — pick a document (e.g. «Enrollment certificate · for a bank»).
2. **Data** — verify the pre-filled fields (name, group, gradebook); some purposes require an extra field.
3. **Confirmation** — the request gets a **ЗД-2026-XXXXXX** number (the canonical scheme) or an **SR-2026-XXXXX** service number.

### 5.2. Lifecycle
Statuses: **Submitted → Accepted → In progress → Ready → Issued**; side branches: **Needs a data fix** (the deanery awaits corrections — the card says what exactly), **Needs rework** (with the staff member's reason), **Rejected**, **Cancelled**. Every event lands in the card's history with the author and date. A status change triggers a notification on the channels you picked (push/e-mail/Telegram — simulated in the prototype).

### 5.3. PDF & authenticity
When the certificate is **Ready/Issued** — the card shows **«Download PDF»**. The PDF contains the document data, a QR code and a verification code. Anyone can verify authenticity on the public **/verify/<code>** page — without signing in. Re-generating yields the same code (the QR stays valid).

### 5.4. Limits
- Re-ordering the same certificate «for the same recipient» is blocked for 24 hours (the DIG-30 re-order window) — the wizard shows an honest warning.
- A document-level duplicate («for a bank» vs «for the draft board») is not blocked — different key values.

## 6. Deanery tickets (/deanery)

- The left column — your tickets with **TS-2026-XXXXX** numbers; the right — a chat with the manager.
- **A new ticket**: pick a subject (curriculum / grades / transfer / academic leave / other), the body, attachments (file names).
- The deanery manager replies in the chat; an unread reply is dotted in the list.
- Opening the chat marks the staff replies as read.

## 7. Feedback to the management (/feedback)

- **Type**: Proposal / Complaint / Thank-you.
- **Recipient**: Deanery, Academic office, Program management, University management.
- **Body + attachments**, an **Anonymous** toggle — the author is hidden from the management (but you keep the link to your item).
- After sending — your list of feedback items and a card with the confirmation and status.

## 8. Tasks (/tasks)

A manual task tracker: what is expected of you — course deadlines (automatic) and your own items. Open tasks feed the badge on the «Tasks» menu item and the sidebar pill.

## 9. News (/news)

University news and announcements with categories; a click opens the full article. Read items are marked (the state persists).

## 10. Directory (/people)

Teachers and staff of your faculty. Highlights:
- **«My teachers»** — a personal block: those teaching your disciplines.
- **«Upcoming classes»** (staff only) — their schedule.
- A person card: contacts, disciplines, «Book a consultation» (a stub).
- On a lesson card the teacher's name is clickable and leads straight to the directory.

## 11. Events (/events)

- The poster feed: lectures, hackathons, career days, culture; the filters «This week / Career / Online».
- **«Sign up»** — your seat is fixed; clicking again cancels. «N seats left»; «No seats» disables the button.
- An event card: description, date/venue or the stream link.

## 12. МСП — student startups (/msp)

A student project catalog in the Product Hunt spirit:
- The card feed: a letter logo, the title, tagline, tags, the vote counter. Sortings «New» / «Top of the week».
- **«▲ Support»** — one vote per project; clicking again removes it. Only students vote.
- **«Launch of the day»** — the project with the most votes.
- A launch card: description, team, comments (you can reply).
- **«Launch a project»**: name, tagline, description, tags — your project appears in the feed (the slug is auto-generated).
- All projects are fictional — no real commerce.

## 13. Additional education (/dpo)

Three tabs:
- **Catalog**: programs (academic hours, online/on-site/hybrid format, cost), filters by format, price and duration (combinable). «Enroll» — the program appears in «My programs».
- **My programs**: cards with a progress bar and a status (Active / Completed).
- **Documents**: contracts, acts, receipts, certificates. «Download» activates after graduation (a stub in the prototype).

## 14. Finance (/finance)

Summary: study form (budget/contract), stipend (kind, amount, next payout date), debts or «none». Contracts and payments in a list, documents. No real payments in the prototype — demonstration data only.

## 15. FAQ (/help) and the Guide (/guide)

- **FAQ**: frequent questions by category with search; if there is no answer — «Didn't find one» → forward the question to a deanery ticket or the AI assistant.
- **Guide**: a detailed walkthrough with a TOC, search and step-by-step instructions for every section (this document is the extended version).

## 16. AI assistant

- **The /ai-assistant screen**: action cards («What is graded», «What about debts», «How to order a certificate»…), a chat with session history.
- **The floating button** (bottom-right): a popup chat — ask a question without leaving the screen. The answer is grounded in the built-in portal guide (RAG): the assistant answers only from the official guide; if the data is missing it honestly suggests opening /guide or creating a ticket.
- If the external AI is unavailable — the assistant works in demo mode showing a relevant guide chunk.
- Limits: at most 10 questions per minute; a question up to 1000 characters.
- **Voice input**: a microphone in search and forms (dictation); schedule read-aloud is toggled by a flag in settings.
- **Grade dynamics AI** — a separate card on /grades (see section 4).

## 17. Notifications

- **The bell** in the header: an unread counter; a click opens the panel of the latest 5 notifications with deep links; «Configure notifications».
- **The notification hub** (/notifications): the full feed, mark-as-read, type filters (schedule, grades, requests, news, system, tasks, tickets).
- **Channels & quiet hours**: in Settings, per category you pick channels (push/e-mail/Telegram) and a quiet window (e.g. 22:00–08:00 — nothing disturbs you at night).

## 18. Search (⌘K / Ctrl+K)

Global portal search: sections, requests by number, events, the guide. Opens by the hotkey or the magnifier button in the header; works on mobile too.

## 19. Settings (/settings)

| Tab | What is configurable |
|---|---|
| Home | The order and visibility of the home widgets (a drag list) |
| Notifications | The «category × channel» matrix (push/e-mail/Telegram), quiet hours |
| Security | Password change (with the current one), active sessions with revocation |
| MCP token | A personal token to connect the portal to external AI assistants (Claude, ChatGPT): grades, schedule, requests |
| Theme | Light / dark / system |
| Language | RU/EN (duplicates the header switch) |

## 20. For the deanery staff (/staff)

Sign in on the same /login screen as `dean.kovaleva` — the **deanery cabinet** opens (students cannot access it: any /staff* path returns HTTP 403).

- **Request queue** (/staff/requests): your faculty's requests by status; overdue ones highlighted by SLA (3 days to respond); type/deadline filters; «Take into work».
- **Request card**: student data and parameters, the event history, buttons of the allowed transitions (Accept → In progress → Ready → Issued; Data fix / Needs rework / Reject / Cancel — with a mandatory reason ≥ 5 characters), **«Generate PDF»** for a completed certificate (a document with QR verification).
- **Tickets** (/staff/appeals): faculty incoming, a chat with reply templates, «Resolved».
- **Announcements**: publish an announcement to a faculty or group, with a preview.
- **Summary**: requests today, average response time, overdue.
- A status change is instantly visible to the student; the student notification is sent automatically.

## 21. Mobile version

The portal is designed from **360 px**: a bottom tab bar (Home, Schedule, Grades, Requests, More), «More» opens the full section list, the lesson-details side panel becomes a bottom sheet, forms and chats are full-screen. Every screen is verified at 360×800 and 1440×900.

## 22. Prototype limitations

- All data is fictional; there is no real enrollment, payment or university integration.
- Voice input/read-aloud depends on browser support (Chrome — yes, Firefox — partially).
- The AI assistant is limited to the portal guide and does not answer general questions.
