# Mordheim Chronicler: Full App Review

Started 2026-10-16. A feature-by-feature review covering **performance**, **code quality**, **UI/UX and bugs**, and a **test plan**.

The headline problem driving this review: the deployed app (backend on Render, DB on Neon) slows down badly once several people use it at the same time.

## How to read this

| File | What it is |
| --- | --- |
| [PLAN.md](PLAN.md) | **The plan:** foundations pass, then feature-by-feature passes, plus status |
| [../ENGINEERING_RULES.md](../ENGINEERING_RULES.md) | Base rules every change must follow, and the definition of done |
| [NOTES.md](NOTES.md) | Architecture notes, environment, live-run observations, open questions |
| [PERFORMANCE.md](PERFORMANCE.md) | Consolidated, prioritised performance plan (start here for the Render slowness) |
| [BUGS.md](BUGS.md) | Consolidated bug register, every bug from every feature file |
| [IMPROVEMENTS.md](IMPROVEMENTS.md) | Consolidated code-quality and UX improvements |
| [TEST_PLAN.md](TEST_PLAN.md) | Full test plan: current coverage, gaps, proposed cases, manual QA scripts |
| `features/*.md` | Deep-dive per feature area (the source of truth for each finding) |

### Feature files

| # | File | Area | ID prefix |
| --- | --- | --- | --- |
| 1 | [features/01-auth-core.md](features/01-auth-core.md) | Auth, users, password reset, feedback email, health/keep-awake, throttling | `AUTH` |
| 2 | [features/02-campaigns.md](features/02-campaigns.md) | Campaign list/create/join, overview, settings, members and permissions, house rules, chat/pings/bulletin, pivotal moments, locations and encampments | `CAMP` |
| 3 | [features/03-warband-roster.md](features/03-warband-roster.md) | Warband CRUD, heroes, henchmen, hired swords, XP and level-ups, stat blocks, loadouts | `ROST` |
| 4 | [features/04-warband-economy-trades.md](features/04-warband-economy-trades.md) | Stash, buy/sell/transfer items, resources, treasury ledger, warband logs, player-to-player trades | `ECON` |
| 5 | [features/05-battles.md](features/05-battles.md) | Battle lifecycle (invite → prebattle → active → postbattle), reported results, combat events, finalisation | `BATL` |
| 6 | [features/06-catalogue.md](features/06-catalogue.md) | Items, skills, spells, specials, races, restrictions, bestiary, hired sword profiles, seeders, rules content | `CAT` |
| 7 | [features/07-frontend-platform.md](features/07-frontend-platform.md) | App store, routing, desktop/mobile layouts, API client, realtime (Pusher), notifications, shared UI, dice roller, bundle | `FE` |
| 8 | [features/08-infrastructure-performance.md](features/08-infrastructure-performance.md) | Deployment, Django settings, DB connections, measured query counts per endpoint, concurrency/load behaviour | `INFRA` |

## Finding format

Every finding gets a stable ID: `<AREA>-<KIND>-<NN>`, e.g. `BATL-PERF-03`.

- **KIND:** `PERF` (performance), `CQ` (code quality), `UX` (UI/UX improvement), `BUG` (defect), `SEC` (security)
- **Severity**
  - **P0:** broken, data loss or corruption, security hole, or the main cause of the production slowness
  - **P1:** a major user-visible problem or a big performance cost; fix soon
  - **P2:** moderate; worth scheduling
  - **P3:** minor or polish
- **Effort:** **S** (< 2h), **M** (half to one day), **L** (multi-day)
- **Confidence**
  - **Confirmed:** reproduced, measured, or unambiguous in code
  - **Likely:** strong evidence but not reproduced
  - **Speculative:** worth checking

Entry template:

```md
### BATL-PERF-03 · P1 · Short title
- **Where:** `backend/apps/battles/views/shared.py:1751`
- **What:** what is wrong, concretely
- **Impact:** who or what suffers, and how badly
- **Fix:** the recommended change (sketch code if useful)
- **Effort:** S | M | L · **Confidence:** Confirmed | Likely | Speculative
```

## Status

| Phase | Status |
| --- | --- |
| Live run and initial observations | Done (see NOTES.md) |
| Feature deep-dives (8 areas) | Done (about 315 findings across 8 files) |
| Baseline: tests, lint, typecheck | Done (see NOTES.md) |
| Engineering rules + plan | Done (`../ENGINEERING_RULES.md`, `PLAN.md`, condensed in `CLAUDE.md`) |
| Consolidation (PERFORMANCE / BUGS / IMPROVEMENTS / TEST_PLAN) | Done: 51 PERF items, 84 bugs + 16 security, 98 improvements, 169 tests + 11 e2e scenarios |
| Phase 0 checklist | Done (PLAN.md); waiting on William's go-ahead to start PR 0-A |
