# Accompanying Documentation (EN) — companion to docs/accompanying-docs-ru.md

> The English mirror of the accompanying-documentation map. The Russian version is canonical.

## 1. Documentation map

| File/folder | Purpose | Maintainer |
|---|---|---|
| `README.md` / `README.en.md` | The project showcase: what it is, stack, quick start, jury accounts, links | Operator |
| `docs/user-guide-ru.md` / `docs/user-guide-en.md` | **User guide**: every student and staff screen with step-by-step instructions | Team / documenter agent |
| `docs/admin-guide-ru.md` / `docs/admin-guide-en.md` | **Administrator guide**: infrastructure, secrets, deployment, migrations, seed, backups, diagnostics, incidents | Operator |
| `docs/accompanying-docs-ru.md` / `-en.md` | This file — the map of accompanying documents | Team |
| `docs/wiki/*.md` (5+5) | The GitHub wiki: architecture, swarm, SDD, LLM, modules, runbook, screens map, QA regression (RU+EN) | Team |
| `docs/architecture.md` | The classic architecture reference (Next.js, Prisma, DB schema) | Team |
| `docs/security.md` | Security in plain words (IDOR, passwords, keys) | Team |
| `docs/deploy.md` | The stand infrastructure, DNS, TLS, the deploy procedure | Operator |
| `docs/help.md` / `docs/assistant.md` | Short help and assistant descriptions (early versions; the live ones are /guide and the FAB) | Team |
| `docs/figma-screens.md` | The «screen ↔ task ↔ Figma frame» map | Team |
| `docs/design/screenshots/` | Layout screenshots (desktop/mobile) for the README | Agents |
| `docs/sdd/SDD-GUIDE.md` | The SDD process (OpenSpec) — rules and flow | Team |
| `openspec/specs/` | The current system truth (deltas after archive) | The swarm (after merge) |
| `openspec/changes/<id>/` | Task change folders: proposal / tasks / delta-spec | Each task's executor |
| `CHANGELOG.md` | The change chronology by versions/dates | The swarm documenter |
| `docs/ai-log/` | The AI swarm journal: what each agent did per task | The swarm documenter |
| `docs/BRANCHES-ARCHIVE.md` | The head SHAs of deleted branches (after the repository cleanup) | Operator |
| `docs/wiki/RUNBOOK.md` | Operations: deploy, seed, regression, incidents | Operator |
| `e2e/**` · `tests/**` | Automated tests: Playwright (38 specs, desktop 1440 + mobile 360) and Vitest (1900+) | Swarm / team |

## 2. CHANGELOG.md — how to read and maintain it

- Format: reverse chronology; one entry per merged task.
- Each block: date, task/PR number, «Added / Changed / Fixed», user-facing wording (not commit messages).
- Maintained by the **documenter** of the swarm (`CHLOG_FIXED` → the block); manual edits are allowed as long as the style holds.
- Example:

```markdown
## 2026-11-17
- **Added** the «Guide» screen (/guide): the «How to use the portal»
  walkthrough with a TOC, search and instructions for every section (DIG-70).
- **Fixed** the double sidebar in the Shell (a DIG-48 merge artifact).
```

## 3. docs/ai-log/ — the AI swarm journal

- One file per task (`docs/ai-log/dig-xx-*.md`): what the executor did, the review rounds (the RETURN findings), the security verdict, the final STORY block.
- Purpose: transparency of the AI development for the jury; a breakdown of «how decisions were made».
- Maintained by the **documenter**; the format is free but three blocks are mandatory: «What was done», «Review findings and how they were closed», «STORY» (1–3 sentences in the user's voice).

## 4. OpenSpec (openspec/) — specifications

- `openspec/specs/<capability>/spec.md` — the **current truth** after archive: requirements with WHEN/THEN scenarios.
- `openspec/changes/<change-id>/` — active/completed change folders: `proposal.md` (why/what/non-goals), `tasks.md` (the checklist), `specs/**/spec.md` (the delta ADDED/MODIFIED/REMOVED).
- Lifecycle: create a change → implement → gates/review/security → merge → `openspec archive <change>`.
- Validation: `openspec validate` (mandatory before merge).
- The list of closed capabilities: request-machine (DIG-30/32), cabinet-shell (DIG-14/20), gradebook+insight (DIG-26/27/66), deanery-tickets (DIG-39), people (DIG-37), feedback (DIG-40), msp-catalog (DIG-68), events-screen (DIG-43), dpo-catalog (DIG-42), i18n (DIG-69), motion (DIG-71), help+guide (DIG-38/70), and more.

## 5. Linear — task management

- The project «Цифровой деканат — ЛК студента (хакатон)», the Digital_university team.
- Task identifiers: DIG-6…DIG-72; each task ↔ the branch `pochtasergeia/dig-XX-…` ↔ a PR.
- The `swarm` label — taken by the swarm; statuses: Todo (queue) → In Progress (taken) → Done (merged & deployed).
- Task comments — the swarm reports (what was done, gates, review rounds).
- After a squash merge the branch is deleted automatically; the head SHAs of merged branches — `docs/BRANCHES-ARCHIVE.md`.

## 6. Glossary

| Term | Meaning |
|---|---|
| **ЗД-2026-XXXXXX** | The number of a canonical student request (the DIG-30/32 order wizard) |
| **SR-2026-XXXXX** | A service request number (the prototype's legacy numbering) |
| **TS-2026-XXXXX** | A deanery ticket number (DIG-39) |
| **DIG-30 canon** | The unified request status dictionary (10 values) and the transition machine |
| **SLA** | The staff response deadline per request (3 days; overdue highlighted) |
| **Owner-scope** | The principle: a data query is always filtered by the session owner (the IDOR ban) |
| **Unified 404** | Non-existent and foreign objects answer identically (no existence oracle) |
| **Fail-closed** | Missing data/secret → a safe denial (e.g. the role = student) |
| **The DataDb port** | The data-access interface; pages never bypass it |
| **RAG** | Retrieval-Augmented Generation: an LLM answer built over retrieved guide chunks |
| **FAB** | Floating Action Button — the floating AI-assistant button |
| **Gates** | lint/typecheck/build/test — the mandatory filter before review |
| **Salvage** | Restoring an orphaned branch: WIP commits → merge main → union resolve → gates |

## 7. Prototype limitations (non-goals)

- Real personal data, university integrations, payments — forbidden by the concept.
- Domain data lives in the process memory (memory-db): a restart resets it to the seed; the Prisma domain layer is future work (DIG-10/50).
- E-mail/Telegram/push notification channels are simulated in the prototype.
- Voice features depend on browser support.
- The AI assistant is scoped to the portal guide (RAG) with a demo fallback.

## 8. Maintaining the documentation going forward

1. After each feature merge: update `CHANGELOG.md` (the documenter does it automatically) and, if the UI changed, `docs/user-guide-*.md`.
2. After infrastructure/secret changes: `docs/admin-guide-*.md` + `docs/wiki/RUNBOOK.md`.
3. New architectural decisions: `docs/wiki/ARCHITECTURE.md` + `docs/architecture.md`.
4. Single-source rule: the details live in docs/; the README is only the showcase and links.
5. The documentation is maintained by the same swarm pipeline (task DIG-59 is the precedent).
