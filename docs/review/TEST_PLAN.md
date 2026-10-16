# Test Plan

> Built from docs/review/features/*.md on 2026-10-16.

This file consolidates the "Test plan" sections of the eight feature files into one plan. The feature files stay the source of truth for each finding; every proposed test keeps its source ID (`AREA-TEST-NN`). Where two or more files proposed the same test, the row lists all IDs and lives under the area named first; the other areas point to it. 206 source test IDs become 169 table rows plus 11 Playwright scenarios.

Rules this plan follows: `docs/ENGINEERING_RULES.md` §3 (testing) and §4 (definition of done), and the pass order in `PLAN.md` (Phase 0 foundations, then 1 roster, 2 economy and trades, 3 battles, 4 campaigns, 5 catalogue, 6 auth and core).

## Strategy

### Test pyramid

| Layer | Tools | What it is for | Proposed rows |
| --- | --- | --- | ---: |
| Backend unit | Django `SimpleTestCase` / `TestCase`, plain functions, `subprocess` for settings imports | Services and pure rules: XP thresholds, gold derivation, `parse_unique_to`, seeders, settings guards, `wait_for_db` | 12 |
| Backend API | DRF `APITestCase` + `APIClient` (`force_authenticate`; a real JWT only in auth tests), the query-budget helper (`CaptureQueriesContext`), `TransactionTestCase` + threads for races, `freezegun` for TTLs, model factories | Per endpoint: happy path, permission denied, validation error, not found (§3); query budgets; concurrency for gold, trades, joins, level-ups and finalisation | 94 |
| Frontend unit | Vitest | Pure modules: `api-client` refresh logic, realtime client, notification mappers, mutation mergers, exploration table | 9 |
| Frontend component / hook | Vitest + Testing Library + `user-event`, MSW 2, `renderWithProviders` | What the user sees and does; request counts per screen; hooks via `renderHook` (counted here) | 48 |
| End-to-end | Playwright, 2-3 browser contexts, soketi (Pusher-compatible) in docker compose | Golden path and multi-user realtime (battles, trades, chat), reconnects, permissions, request budgets in a real browser | 11 |
| Manual | 2-3 browsers + a phone-width viewport | Release session (57 steps), smoke after deploy (11 steps), one decision-dependent row | 1 row + scripts |
| CI / infra | GitHub Actions, size-limit, container smoke, load script | Keep green green; bundle size; image boots gunicorn; before/after numbers for perf PRs | 5 |

Existing tests (138 backend, 115 unique frontend cases) stay and form most of the characterisation base for the battles and campaigns passes.

### Principles

- **The server is the source of truth**, so rules (costs, XP, permissions, outcomes) are tested at the API level. Frontend tests assert behaviour and request counts, not business rules the server owns.
- **Characterisation before refactor.** Each pass first pins today's behaviour of the code it will restructure (Kind `C`). If a characterisation test has to pin a known bug, it names the finding and flips in the fix PR.
- **Every bug fix ships with a test that fails before the fix** (Kind `R`, naming the finding).
- **Budgets are constant-in-N.** A budget test asserts both an absolute ceiling and that the count does not change when the fixture grows (2 vs 8 warbands, 1 vs 10 items, 0 vs 30 ended battles).
- **Mock only at process boundaries:** Resend, Pusher, DiceBox, `matchMedia`, the clock. Never mock the ORM. New frontend request-count tests use MSW instead of `vi.mock` of API modules.
- **Concurrency tests are few and targeted:** `TransactionTestCase`, two threads and a `threading.Barrier`, tagged `slow`.
- **Test data comes from factories**, not from the seeded catalogue (seeder tests excepted).

### What not to test

- Django, DRF, SimpleJWT, Radix, pusher-js or dice-box internals; DRF's own validation of declared field types.
- Implementation details: store shape, hook internals, CSS class names, snapshot dumps of large trees.
- Static content: `rules-content.ts`, seeded catalogue rows one by one (only resolution invariants, CAT-TEST-13).
- Real Pusher or Resend from any automated test (the guard in T0-1 makes this impossible).
- Rules duplicated on the frontend once the server owns them: BATL-TEST-24 is deleted when BATL-CQ-03 removes the exploration table copy.
- Pixel or visual regressions, 3D dice physics, perceived performance on real phones (manual only).

### Legend for the area tables

- **Level:** `unit`, `API`, `component` (includes hooks and MSW integration), `manual`, `CI`.
- **Kind:** `C` characterisation (passes today; write before that pass's refactor) · `R: ID` regression for that finding (fails today; lands with the fix) · `B` query or request budget (baseline at today's count in 0.4, tightened by the named fix) · `N: ID` acceptance test for a planned change, written with PR C · `G` guard or infrastructure.
- **Phase:** `0.1`-`0.5` are PLAN.md Phase 0 steps; `Pass 1`-`Pass 6` are feature passes. `↑` marks a cheap P0/P1 fix in a file an earlier step already touches; this plan recommends pulling it forward.

## Test infrastructure work (do first, Phase 0)

Effort follows README: S < 2 h, M half to one day, L multi-day.

| # | Task | Detail | Effort | PLAN |
| --- | --- | --- | --- | --- |
| T0-1 | Test settings that force external services off, plus a no-network guard | `config/settings_test.py`: import `settings`, then override (after `load_dotenv()` and compose `env_file` have injected real keys) `RESEND_API_KEY = ""`, `PUSHER_APP_ID/KEY/SECRET/CLUSTER = ""`, a fixed `FRONTEND_URL`, `PASSWORD_HASHERS = [MD5]` (PBKDF2 at 720,000 iterations costs 0.08 s per hash). `manage.py` defaults to it when `argv[1] == "test"`. `config/test_runner.py` (`TEST_RUNNER`) patches `requests.adapters.HTTPAdapter.send` for the whole run to raise "real HTTP in tests"; this is the Django-runner equivalent of an autouse fixture and also covers the Pusher client, which uses `requests`. Tests that assert payloads (the feedback email helper) keep patching `requests.post` locally. Patch `send_password_reset_email` in `test_password_reset_request_is_rate_limited_by_ip` (today it makes a real Resend call, AUTH-CQ-01). No test currently mocks Pusher, so battle, trade and chat tests may also be calling Pusher if the container's `.env` has keys. Frontend equivalent: MSW `onUnhandledRequest: "error"` (T0-6). Covers AUTH-TEST-15 | S | 0.2 |
| T0-2 | Remove the 12 duplicate frontend test files | Delete the `__tests__/` copies listed below and keep the copies beside the code (ENGINEERING_RULES §3; FE-CQ-02). BATL-CQ-07 proposed the opposite; §3 decides. Diff each pair first (they should differ only in import path and CRLF/LF). In a separate refactor-only commit, move the 16 unique `__tests__/` files beside their units and add `*.ts text eol=lf` and `*.tsx text eol=lf` to `.gitattributes` (it covers only `*.sh` today). Result: 53 files → 41, 152 cases → 115 | S | 0.2 |
| T0-3 | Fix the 3 failing frontend tests | (1) `MobileLayout.test.tsx` "reloads when pulled down from the top past the refresh threshold": make the gesture simulation drive the current threshold logic so "Release to refresh" appears; FE-TEST-08 rewrites it once FE-PERF-02 removes the reload. (2, 3) `RaritySection` "shows spent heroes and preserves the stored roll display" fails twice because it exists twice; after T0-2 one copy remains, and it must match "Spent Hero" and " (spent)" as separate text nodes (function matcher or accessible name). Also clear the tsc errors in the 4 test files that fail `tsc --noEmit` | S | 0.2 |
| T0-4 | Factories and fixtures for campaign + warband + units + battle | `_create_user` is copy-pasted in 5 test files and `_create_campaign` in 2. Add `apps/core/testing/factories.py` (factory_boy, or plain builders): user, campaign (settings, roles and permissions seeded as the views do, memberships), warband (with starting-gold trade), hero / henchmen group (+ living and dead henchmen) / hired sword with N items × A availabilities × R restrictions and skills, specials, spells; catalogue item; battle with participants in a given status, events and drafts; trade request. Plus `build_reference_campaign(scale=...)` mirroring the measured shape (campaign "Shards", warband "Monks": 2 living + 1 dead hero, 3 + 1 dead henchmen groups, 3 + 1 dead hired swords, about 4 items per unit, 38 battles of which 21 ended) for budget tests. Add `freezegun` and `factory-boy` to the `dev` extra | M | 0.4 |
| T0-5 | Query-budget helper | `apps/core/testing/queries.py`: `assert_max_queries(test, budget, label)` (excludes `SAVEPOINT` / `RELEASE` statements, as the measurements did, and prints the captured SQL on failure); `assert_constant_queries(test, request_fn, grow_fn)` (count, grow the fixture, count again, assert equal); `assert_no_writes(ctx)` (no INSERT/UPDATE/DELETE). `QUERY_BUDGETS` dict in one module, initialised to today's measured counts so the suite passes, lowered by each fix (INFRA-TEST-04) | S | 0.4 |
| T0-6 | Frontend harness | MSW 2 with handlers per API module and `onUnhandledRequest: "error"`; `renderWithProviders` (router, QueryClient, auth, realtime mock) in `src/test/`; a `mockMatchMedia(matches)` helper, because `setup.ts` stubs `matchMedia` to always `false` and every test renders the desktop branch; a `countRequests(path)` helper | S-M | 0.5 |
| T0-7 | CI workflow (GitHub Actions) | `.github/workflows/ci.yml` on every push and PR. Backend job: Postgres 16 service, `uv sync --frozen --extra dev`, `ruff check`, `ruff format --check`, `mypy`, `manage.py test`, coverage, `manage.py check --deploy` with production-like env (INFRA-TEST-15). Frontend job: `npm ci`, new `typecheck` script (`tsc --noEmit`), `lint` once ESLint lands (FE-CQ-01), `vitest run --coverage`, `vite build` + size-limit (FE-TEST-27). Lint and type steps become required as soon as 0.2 reaches zero errors (ruff 34, format 54 files, mypy 51, tsc 98 today). E2E job on `main`, nightly and manual dispatch, plus PRs touching battles, trades or realtime | S (workflow); M to get green | 0.3 |
| T0-8 | Playwright with seeded users | `e2e/` package and `playwright.config.ts` with `desktop` and `mobile` (390×844, touch) projects. docker compose `e2e` profile: fresh DB, backend under gunicorn with Resend off and relaxed rate limits, built frontend (`vite preview`), and a **soketi** container; backend and frontend Pusher config gain a host override so e2e never touches the real Pusher app. `manage.py seed_e2e --reset` (built on T0-4) creates users A (owner), B, C, D with test passwords kept in `e2e/fixtures/`, campaign "E2E Shards" with a fixed join code, warbands with leader, henchmen group of 2, hired sword, stash and gold, and a custom "Axe" override. Global setup logs each user in through the API and saves `storageState`. Fixtures: multi-context users, `requestBudget(page, {max, unique})` via `page.on("request")`, `expectNoDocumentReload` via `framenavigated`. Time-dependent paths call management commands (backdate a trade, `expire_stale_battles`) through `docker compose exec`, never through test-only API routes. Traces and video on failure | M-L | 0.5 |
| T0-9 | Coverage reporting | Backend `coverage run --source=apps manage.py test` + XML artifact; frontend `@vitest/coverage-v8` with a 60% floor on `lib/`, `stores/` and `features/realtime/` once their tests exist (report-only until then); summary in the CI job | S | 0.3 |
| T0-10 | Load-test script | Commit `scripts/loadtest.py` (INFRA-TEST-10) before 0.1 so the first deploy has "before" numbers | S | 0.1 |

**The 12 duplicate files to delete** (keep the sibling beside the code):

1. `frontend/src/features/battles/components/active/__tests__/ActiveHenchmenGroupCard.test.tsx`
2. `frontend/src/features/battles/components/active/__tests__/ActiveParticipantRoster.test.tsx`
3. `frontend/src/features/battles/components/active/__tests__/ActiveUnitCard.test.tsx`
4. `frontend/src/features/battles/components/postbattle/__tests__/postbattle-utils.test.ts`
5. `frontend/src/features/battles/components/shared/__tests__/BattleDesktopSubnav.test.tsx`
6. `frontend/src/features/battles/components/shared/__tests__/BattleUnitStatsAndItems.test.tsx`
7. `frontend/src/features/battles/utils/__tests__/battle-session.test.ts`
8. `frontend/src/features/items/components/AcquireItemDialog/__tests__/RaritySection.test.tsx`
9. `frontend/src/features/items/hooks/__tests__/useAcquireItemDialogShared.test.tsx`
10. `frontend/src/features/items/utils/__tests__/acquire-item-costs.test.ts`
11. `frontend/src/features/warbands/components/shared/forms/__tests__/UnitStatsGrid.test.tsx`
12. `frontend/src/features/warbands/components/shared/unit_details/__tests__/UnitKillHistoryTooltip.test.tsx`

## Current coverage

Counted from the test files on 2026-10-16 (test methods for the backend; `it`/`test` calls for the frontend). Totals match the NOTES.md baseline.

| Area | Backend today | Frontend today | Well covered | Not covered at all |
| --- | --- | --- | --- | --- |
| 01 Auth and core | `users/tests/test_feedback_report_api.py` 6; `core/tests/test_rate_limiting.py` 19 test methods (01 file says 21) | `FeedbackReportCard.test.tsx` 5 | Every throttle scope incl. `Retry-After`, per-IP isolation, health/keep-awake exempt; feedback endpoint and email payload | Register, login, refresh, `/me`, reset request and confirm (hit only as throttle targets); token expiry and revocation; health semantics; settings guards; `api-client`, `auth-store`, `storage`, `ProtectedRoute`, `AuthCard`, `ForgotPassword`, `ResetPassword` |
| 02 Campaigns | `campaigns/tests/test_campaigns_api.py` 36 (create, PATCH, house-rule effects 8, list scoping, join max players, players busy flags, restrictions 4, battle history, pivotal moments, top killers 3, bulletin 3, encampments/locations 4, member permissions 1); plus battles tests for pivotal generation and active-battles list/owner cancel; chat and ping throttles | 5 files, 15 cases (`RosterTable` 3, `UnitsTable` 1, `BulletinBoardTab` 4, `FeedbackReportCard` 5, `WarbandSettingsCard` 2) + `useCampaignCatalogs` 2 | Creation defaults, house-rule clone and remap, restriction effects | Role change, removal, campaign delete, double or concurrent join, house-rule PATCH, chat GET/POST, `/permissions/` and `/permissions/me`, starting-gold rewrite, owner-only PATCH; `CampaignLayout`, `useCampaignOverview`, `CampaignSettings`, `MembersCard`, house-rule UI, `CampaignChatMenu`, Locations, Encampments, `StartBattleDialog`, `BattleActionPanel` |
| 03 Warband roster | `warbands/tests/test_warbands_api.py` 18 (item cost defaults, henchmen and hired-sword XP seeding and `no_level_ups`, hired-sword cap); battles tests: kill history 4, leader reassignment, `no_level_ups` XP skip | 17 files (2 duplicated), 43 cases (38 unique): save hooks for henchmen and hired swords, `useWarbandLoader`, desktop edit actions, mobile top bar helpers, `no_level_ups` cards, stats grid, kill tooltip, shells | Henchmen and hired-sword level-up seeding; loader stale-response merge | Hero CRUD, hero XP → level-ups, level-up endpoint bodies, leader invariant from roster paths, permission matrix, hero cap with dead heroes, dead-henchmen sync, summary gold and rating; `useWarbandSave`, hero creation, level-up hooks, trade badge gating, `pending-purchases`, race picker keyboard, `useWarbandUpdateListener` |
| 04 Economy and trades | 6 of the 18 warbands tests (item `cost` defaulting); trade-request throttle; battles tests for reward and upkeep ledger rows | `items/` 3 unique files, 9 cases, each duplicated (one failing): acquire costs 5, `RaritySection` 3, acquire dialog 1 | Persisted item-cost rules | Item sales, transfers, stash DELETE, resources, logs, treasury, gold derivation, every trade view, trade channel auth, trade notifications; `TradeSessionDialog`, `useWarbandTradeSession`, `TradesTab`, `LogsTab`, stash, `useUnitItemMenu`, resources, `pending-purchases`, `getSignedTradePrice` |
| 05 Battles | `battles/tests/test_battles_api.py` 57 (3,979 lines, one class): create, busy, reported results, start/finish/cancel permissions, postbattle save and finalise, kills, pivotal moments, state views, config persistence | 21 files (7 duplicated), 64 cases (41 unique): `postbattle-utils` 9, session/state/active utils, unit cards, subnav, notes dialog, 4 route tests | Lifecycle happy paths and creator-only rules; postbattle application | Custom thresholds, cancel in postbattle, query counts, concurrency, realtime failure, decline/leave/expiry, kill edits, injury log lifecycle; `useBattleState` socket and refresh, finalise/leave flows, start/finish/cancel dialogs, `BattleActionPanel`, `StartBattleDialog`, notification approve/decline |
| 06 Catalogue | `items/tests/test_seed_items.py` 1; `spells/tests/test_spells_api.py` 1; shared with campaigns (house rules 8, item settings and restrictions 6) and warbands (cost defaults 6) | `app-store.test.tsx` 2, `useCampaignCatalogs` 2, items 9 unique | House-rule clones | Skills, special, races, restrictions, bestiary, hired-sword and favourite endpoints; `parse_unique_to`; seeders; merge/shadow semantics; permission gates; budgets; Items/Skills/Spells/Bestiary/HiredSwords routes and forms; the `CampaignLayout` gate |
| 07 Frontend platform | n/a | `tooltip` 4, `MobileLayout` 3 (1 failing), `url-utils` 3, `app-store` 2 | Tooltip interactions | `api-client`, `auth-store`, `realtime.ts`, `useNotifications` and the realtime menus, `ProtectedRoute`, routes and 404, `CampaignLayout`, `DiceRoller`, `Dialog` mobile, `ScrollToTop`. Tooling: no MSW, no coverage, no e2e, no `typecheck` script |
| 08 Infrastructure | No `assertNumQueries` or `CaptureQueriesContext` anywhere; throttle tests force `NUM_PROXIES=1` | n/a | n/a | Settings safety, connection settings, `wait_for_db`, container start command, Pusher failure handling; no CI (no `.github/`), no load script |
| **Total** | **138 tests in 7 files** (battles, campaigns, core, items, spells, users, warbands). No tests in bestiary, features, logs, notifications, races, realtime, restrictions, skills, special, trades | **53 files, 152 cases; 41 unique files, 115 unique cases; 3 failures (2 test names)** | | |

## Query budget tests

These become `QUERY_BUDGETS` entries (T0-5, INFRA-TEST-04). "Measured today" is from `CaptureQueriesContext` with `force_authenticate` on the local production-shaped data (feature 08 Measurements, 03 and 04 tables): it excludes the JWT user lookup, which adds 1 query per request in production. Tests use the same convention. Rows marked (est.) were counted from code; (derived) budgets come from a finding's "Fix" rather than a proposed test. Every endpoint in the 08 Measurements table not listed here is locked at its measured count.

| Endpoint | Measured today | Budget after fixes | Source (finding → test) | Tightened in |
| --- | --- | --- | --- | --- |
| `GET /campaigns/:id/battles/` (open / `current/`) | 78 (38 battles, +2 per battle) | ≤ 4, constant 0 vs 30 ended | INFRA-PERF-01, CAMP-PERF-01, BATL-PERF-01 → CAMP-TEST-02 / BATL-TEST-06 / INFRA-TEST-01 | ↑ after 0.1 |
| `GET /campaigns/:id/players/` | 13 at 3 warbands (4 + 3W) | ≤ 6, constant 2 vs 8 warbands | CAMP-PERF-03, INFRA-PERF-05 → CAMP-TEST-01 / INFRA-TEST-03 | Pass 4 (or 1) |
| `/campaigns/` · `/campaigns/:id/` · `battle-history/` · `pivotal-moments/` · `top-killers/` · `members/` · `messages/` | 2 · 3 · 3 · 2 · 2 · 4 · 2 | Same, constant in rows | CAMP-TEST-03 | 0.4 (lock) |
| `GET /auth/me/` (real JWT) | 1 | 1 | AUTH-TEST-08 | Pass 6 |
| `GET /health/`, `HEAD` and `GET /keep-awake/` | 0 (1 with a token; garbage token → 401) | 0 with any header | AUTH-PERF-04/06 → AUTH-TEST-14 | Pass 6 |
| `GET /warbands/:id/summary/` | 12 | ≤ 6 | ROST-PERF-04, ECON-PERF-05 → ROST-TEST-01, ECON-TEST-14 | Pass 1 |
| `GET .../heroes/` · `henchmen-groups/` · `hired-swords/` | 14 · 11 · 13 | ≤ 10 each, constant | ROST-PERF-03/11 → ROST-TEST-01 | Pass 1 |
| `GET .../heroes/detail/` · `hired-swords/detail/` · `henchmen-groups/detail/` | 37 · 36 · 20 (+ about 3 per distinct item) | ≤ 12 (INFRA ceiling 14), constant 1 vs 10 items | ROST-PERF-02, INFRA-PERF-05 → ROST-TEST-01 / INFRA-TEST-02 | Pass 1 |
| `GET .../heroes/:id/` | 35 | ≤ 12 (derived) | ROST-PERF-02/06 | Pass 1 |
| `PATCH .../heroes/:id/ {xp}` | about 77 (51 for the response) | ≤ 12 | ROST-PERF-01 → ROST-TEST-02 | Pass 1 |
| `GET /warbands/:id/items/` | 6 | ≤ 4 | ECON-PERF-04 → ECON-TEST-14 | Pass 2 |
| `GET /warbands/:id/logs/` | 6 (whole log, unpaginated) | ≤ 4 per page | ECON-PERF-06 → ECON-TEST-14 / -15 | Pass 2 |
| `POST /warbands/:id/item-transfers/` | about 58 stash → hero, about 98 hero → hero (est.) | ≤ 15 | ECON-PERF-03 → ECON-TEST-14 | Pass 2 |
| `POST /warbands/:id/item-sales/` | about 18 stash, about 58 unit (est.) | ≤ 12 | ECON-PERF-03 → ECON-TEST-14 | Pass 2 |
| `POST .../trade-requests/:uuid/offer/` | 4-8 + full ledger load | ≤ 6 | ECON-PERF-02/05 → ECON-TEST-14 | Pass 2 |
| One purchase → new `POST /warbands/:id/purchases/` | about 140 over about 8 requests | about 10-12 in 1 request (derived) | ECON-PERF-01 → ECON-TEST-13 | Pass 2 |
| `GET .../battles/:id/state/` | 7 incl. 1 UPDATE | ≤ 4, no writes, constant in participants and events | BATL-PERF-03/09, INFRA-PERF-09 → BATL-TEST-05 / INFRA-TEST-05 | Pass 3 |
| `GET .../battles/:id/rosters/` | 28 incl. 1 UPDATE | ≤ 28 with no UPDATE; lower once rosters are snapshotted | BATL-PERF-07 → INFRA-TEST-05 | Pass 3 |
| `POST .../finalize-postbattle/` (5 heroes, 2 hired swords, 8 henchmen, 1 find) | about 62-70 (est.) | ≤ 30 | BATL-PERF-04 → BATL-TEST-07 | Pass 3 |
| Pending reported results (to be routed) | N+1 | Constant with 5 pending | BATL-BUG-09 → BATL-TEST-15 | Pass 3 |
| `GET /items/?campaign_id=` | 14 | ≤ 8, constant after +50 items; 304 revalidation ≤ 2 | CAT-PERF-07, CAT-PERF-02 → CAT-TEST-07 / -06 | Pass 5 |
| `skills/` · `spells/` · `special/` · `races/` · `bestiary/` · `hired-swords/` · `item-properties/` | 4 · 4 · 4 · 4 · 4 · 6 · 2 | Same, constant after growth (`restrictions/` locked at its first measurement) | CAT-TEST-07 | 0.4 (lock) |
| `GET /bestiary/:id/` · `/hired-swords/:id/` | 43 · 45 | ≤ 12 | CAT-PERF-04 → CAT-TEST-08 | Pass 5 |
| House-rule PATCH, title only | about 70 + one UPDATE per owned row (est.) | Rule row only; no clone rewrite | CAMP-PERF-08 → CAMP-TEST-14 | Pass 4 |

**Frontend request budgets** (asserted with MSW in Vitest or the Playwright `requestBudget` fixture):

| Screen or action | Today | Budget | Test |
| --- | --- | --- | --- |
| Login / register | 3 `/auth/me`, 3 `/notifications/`, 3 Pusher auth / 2 `/auth/me` | 1 / 1 / 1; register 0 `/auth/me` | AUTH-TEST-22 |
| Cold campaign overview | about 18 requests, `/battles/` twice | ≤ 12, no endpoint twice | FE-TEST-05, E2E-09 |
| Return to the overview tab | 4 × `/battles/` (316 queries) | ≤ 1 per 30 s | FE-TEST-07 group |
| Overview → Warband → Overview | 7 per revisit | 0 within `staleTime` | FE-TEST-06 |
| Warband page after the layout | 5 requests in 2 stages | ≤ 2; roster visible < 2 s on 3G | ROST-TEST-25 (E2E-01) |
| Buy one item | about 8 requests | 1 | ECON-PERF-01; E2E-01; manual step 36 |
| Battle action, per other participant | 1 full state GET (8 queries) | Patch from the event; GET only on a version gap | BATL-TEST-21 |
| Entry JS chunk | 2.42 MB | ≤ 250 KB gzip | FE-TEST-27 |

## Proposed tests by area

### 01 Auth and core (`AUTH`; owning pass: Pass 6)

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-TEST-01 | API | Register with valid email, password, name | 201 `{access, refresh, user}`; email lowercased; `username == email`; `first_name == name` | P1 | C | Pass 6 |
| AUTH-TEST-02 | API | Register `Foo@X.com` when `foo@x.com` exists | 400 `{"email": [...]}`; no second user | P1 | C | Pass 6 |
| AUTH-TEST-03 | API | Register with `12345678`, `password`, `short`, and password equal to the email | 400 with all validator messages | P2 | R: AUTH-CQ-04 | Pass 6 |
| AUTH-TEST-04 | API | Register with a 151-character email or name | 400, not 500 | P2 | R: AUTH-BUG-07 | Pass 6 |
| AUTH-TEST-05 | API | Login: correct / wrong password / unknown email / inactive user | 200 with tokens / identical 400 "Invalid credentials" for all three failures | P1 | C | Pass 6 |
| AUTH-TEST-06 | API | Login with `Owner@Example.COM` for `owner@example.com` | 200 | P2 | C (verify; a failure is a new bug) | Pass 6 |
| AUTH-TEST-07 | API | Refresh with valid, expired (freezegun +31 days) and garbage tokens | 200 new `access` / 401 `token_not_valid` / 401 | P1 | C | Pass 6 |
| AUTH-TEST-08 | API | `GET /auth/me` with valid, missing and expired tokens | 200 `{id, email, name}` within `assertNumQueries(1)` / 401 / 401 | P1 | C + B | Pass 6 |
| AUTH-TEST-09 | API | Password reset for existing and unknown email (`send_password_reset_email` mocked) | Identical status and body; mock called once, for the existing user, with a URL starting with `FRONTEND_URL` and containing `uid` and `token` | P1 | C | Pass 6 |
| AUTH-TEST-10 | API | Reset confirm with a valid token, then the same token again | 200; new password logs in, old fails; reuse 400 "Invalid or expired token" | P1 | C | Pass 6 |
| AUTH-TEST-11 | API | Reset confirm after `PASSWORD_RESET_TIMEOUT` (freezegun) | 400 | P2 | C | Pass 6 |
| AUTH-TEST-12 | API | Reset confirm with uid `YWJj`, `!!!`, base64 of a huge number, empty | 400, never 500 | P2 | R: AUTH-BUG-06 | Pass 6 |
| AUTH-TEST-13 | API | With `CHECK_REVOKE_TOKEN`: issue tokens, reset password, call `/me` with old access and `/refresh` with old refresh | 401; the refreshed access also fails on `/me` | P1 | R: AUTH-SEC-04 | Pass 6 |
| AUTH-TEST-14 | API | Health and keep-awake via GET and HEAD, with no header and with `Bearer garbage` | 2xx every case, 0 queries | P3 | R: AUTH-PERF-04, AUTH-PERF-06 | Pass 6 |
| AUTH-TEST-15 | unit | Suite-wide guard: `RESEND_API_KEY` empty; any real `requests` call fails | No external HTTP during the suite | P1 | G: AUTH-CQ-01 | 0.2 (T0-1) |
| AUTH-TEST-16 | unit | `_send_resend_email` when `requests` raises, and on Resend 4xx/5xx | Returns `False` and logs; never raises | P3 | R: AUTH-CQ-02, AUTH-PERF-05 | 0.1 |
| AUTH-TEST-17 | unit | Throttle identity with `NUM_PROXIES=1` and XFF `"6.6.6.6, 203.0.113.9"` | Bucket keyed on `203.0.113.9`; a rotating spoofed prefix doesn't reset the count | P2 | C (pins the intended config; the production gap is caught by AUTH-TEST-18) | Pass 6 |
| AUTH-TEST-19 / FE-TEST-01 | unit | `apiRequest`: three concurrent requests get 401; refresh succeeds | Exactly one `POST /auth/refresh/`; all three retried once with the new token and resolve | P1 | C (before wrapping `api-client` in Query) | 0.5 |
| AUTH-TEST-20 / FE-TEST-02 | unit | `refreshAccessToken` fails with 401, 503, network error | 401 clears both tokens and throws `ApiError` 401; 503 and network keep the tokens | P1 | R: AUTH-BUG-01 | ↑0.5 |
| AUTH-TEST-21 | unit | The retried request gets 401 again | Throws; one refresh; no loop | P2 | C | 0.5 |
| AUTH-TEST-22 / FE-TEST-04 | component | `AuthProvider` `signIn` / `signUp` with MSW | One `/auth/me` on login, none on register | P2 | R: AUTH-PERF-02 | Pass 6 |
| AUTH-TEST-23 | component | Boot with a cached user while `/me` is pending; boot where `/me` returns 500 | Children render immediately; on 500 tokens kept and a retry UI shows | P1 | R: AUTH-PERF-01, AUTH-BUG-01 | ↑0.5 (500 case) / Pass 6 |
| AUTH-TEST-24 / FE-TEST-03 | component | Token refresh (`auth:tokens-changed`) while a protected child holds typed state | Child mount count stays 1, state survives, no `/auth/me` refetch | P1 | R: AUTH-BUG-02 | Pass 6 |
| AUTH-TEST-25 / FE-TEST-20 | component | Seed store notifications as user A, `signOut`, sign in as B in the same tab | Store empty for B; no A notifications | P2 | R: AUTH-BUG-03 | Pass 6 |
| AUTH-TEST-26 | component | `AuthCard` with 429 + `Retry-After`, a fetch `TypeError`, a two-message password error | Friendly throttle text, offline hint, both password messages | P3 | R: AUTH-UX-01 | Pass 6 |
| AUTH-TEST-27 | component | `ResetPassword` with missing params, mismatched passwords, success | Submit disabled with explanation; "Passwords do not match"; success state with a Sign in link | P3 | N: AUTH-UX-05 | Pass 6 |
| AUTH-TEST-28 / FE-TEST-18 (deep link) | component | Logged out at `/campaigns/1/settings` or `/campaigns/1/battles/2/active`, then login | Redirect to `/` with `state.from`; lands back on the original URL | P3 | R: AUTH-UX-02, FE-UX-03 | Pass 6 |
| AUTH-TEST-29 | component | `FeedbackReportCard` with 2001 characters typed, and on success | Capped at 2000 with a counter; success toast | P3 | N: AUTH-UX-04 | Pass 6 |
| AUTH-TEST-31 / FE-TEST-29 | API + manual | Location content `<img src=x onerror=alert(1)>` saved, fetched, rendered | Stored or returned sanitised (no `onerror`); no alert when expanded | P1 | R: AUTH-SEC-02 | ↑Pass 4 (Locations live in campaigns) |

Elsewhere: AUTH-TEST-18 → 08 (with INFRA-TEST-07); AUTH-TEST-30 → 07 (with FE-TEST-13).

### 02 Campaigns (`CAMP`; Pass 4)

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| CAMP-TEST-01 / INFRA-TEST-03 | API | `GET /campaigns/:id/players/` with 2 vs 8 warbands | Same count both times, ≤ 6 | P0 | B: CAMP-PERF-03, INFRA-PERF-05 | 0.4 baseline → Pass 4 (Pass 1 if the batched rating service lands with the summary fix) |
| CAMP-TEST-03 | API | Budgets for `/campaigns/`, `/campaigns/:id/`, `battle-history/`, `pivotal-moments/`, `top-killers/`, `members/`, `messages/` | Each ≤ its measured constant, independent of row counts | P1 | B (lock) | 0.4 |
| CAMP-TEST-05 | API | Owner deletes a player's warband (kick); player deletes own; admin or other player tries | Per the chosen policy (owner 204, other player 403); battle history behaviour asserted | P1 | R: CAMP-BUG-01 | Pass 4 |
| CAMP-TEST-06 | API | Admin PATCHes `in_progress=true` | Matches the CAMP-BUG-02 policy, and the UI gate matches | P1 | R: CAMP-BUG-02, CAMP-BUG-11 | Pass 4 |
| CAMP-TEST-07 | component | Start campaign, then remount the overview (navigation) | Start button stays hidden; layout `campaign.in_progress` is true | P1 | R: CAMP-BUG-03 | Pass 4 |
| CAMP-TEST-08 | unit | Every code passed to `has_campaign_permission` exists in `PERMISSION_SEED`; `MembersCard` renders every code from `GET /permissions/` | Passes; catches drift such as `manage_spells` | P1 | R: CAMP-BUG-04 | Pass 4 |
| CAMP-TEST-09 | API | Join the same code twice; join when full; join with a lowercase code | 400 "Already a member"; 400 "Campaign is full"; 201 | P1 | C | Pass 4 |
| CAMP-TEST-10 | API | (TransactionTestCase) Two threads join the last seat; one user joins twice concurrently | Exactly one succeeds; no 500 | P2 | R: CAMP-BUG-05 | Pass 4 |
| CAMP-TEST-11 | API | Remove a player who is in an inviting/active battle, has a pending trade and an invite notification, and owns an encampment | Battle canceled, trade declined, notifications resolved, encampment unassigned, warband per policy | P1 | R: CAMP-BUG-06 | Pass 4 |
| CAMP-TEST-12 | API | Owner can't be removed or demoted; admin can't remove or change roles; owner promotes and demotes | 400 / 403 / 200 as specified | P1 | C | Pass 4 |
| CAMP-TEST-13 | API | Ownership transfer | Old owner becomes admin, new owner is owner, atomic | P2 | N: CAMP-UX-02 | Pass 4 (PR C) |
| CAMP-TEST-14 | API | PATCH a house rule's title only | No clone or availability rows rewritten (IDs unchanged), small query count | P2 | R: CAMP-PERF-08, CAT-BUG-08 | Pass 4 |
| CAMP-TEST-15 | API | PATCH / DELETE a generated clone via `/items/:id/` | 403; owned `HeroItem` rows intact | P1 | R: CAMP-BUG-07 | Pass 4 |
| CAMP-TEST-16 | API | Toggle half-price armour off and on for a hero who bought armour at 50 gc | Stored purchase cost preserved (or the documented behaviour); multi-availability items never become `None` | P2 | R: CAMP-BUG-07 | Pass 4 |
| CAMP-TEST-17 | API | Base armour item re-subtyped, then the rule edited | Owned rows remapped to the source, not deleted | P2 | R: CAMP-BUG-07 | Pass 4 |
| CAMP-TEST-18 / CAT-TEST-15 | API | POST the same effect rule twice, and toggle it from two threads | One rule (or idempotent); exactly one clone per source item (12 today); owned rows point at clones | P2 | R: CAMP-BUG-09, CAT-BUG-08 | Pass 4 |
| CAMP-TEST-19 | component | `CommonRulesSheet` with one POST failing | Successful rules added; error shown; retry doesn't duplicate | P2 | R: CAMP-BUG-09 | Pass 4 |
| CAMP-TEST-20 | API | Chat GET pagination with `before` over 51+ messages; POST blank / over 2000 chars / non-member | 50 per page, ordered; 400 / 400 / 404 (the Pusher-failure part is in INFRA-TEST-06) | P1 | C | Pass 4 |
| CAMP-TEST-21 / FE-TEST-16 | component | `CampaignChatMenu`: history load fails; send fails (429) | Error state with Retry instead of "No messages yet"; draft restored with inline error; no unhandled rejection | P2 | R: CAMP-BUG-08, FE-BUG-03 | Pass 4 |
| CAMP-TEST-22 | API | Campaign create with negative or huge `max_heroes`, `starting_gold` | 400, no orphan `Campaign` row | P2 | R: CAMP-BUG-10 | Pass 4 |
| CAMP-TEST-23 | API | Change starting gold when the oldest trade is not "Starting Gold" | Only the starting-gold trade changes; log written | P3 | R: CAMP-BUG-12 | Pass 4 |
| CAMP-TEST-24 | component | `CampaignSettings` re-rendered as owner → admin → player | No hook-order error; correct tabs and cards per role | P2 | R: CAMP-CQ-04 (the role → cards mapping doubles as C) | Pass 4 |
| CAMP-TEST-25 | component | `MembersCard` permission toggle success and failure, role toggle, remove dialog | Optimistic update then reconcile; rollback and error on failure | P2 | C (today's toggles) → N (optimistic + rollback rule) | Pass 4 |
| CAMP-TEST-26 | API + component | Locations and Encampments delete and `explorable` | Permission-gated; log entry on explorable | P3 | N: CAMP-UX-03 | Pass 4 (PR C) |
| CAMP-TEST-27 | API | Players endpoint for users without a display name | Never returns email; display-name fallback | P3 | R: CAMP-SEC-01 | Pass 4 |
| CAMP-TEST-28 | API | Campaign delete | No `Notification` rows left for that `campaign_id` | P3 | R: CAMP-BUG-06 | Pass 4 |

Elsewhere: CAMP-TEST-02 → 05 (battle list budget); CAMP-TEST-04 → 07 (split into the battle-list dedupe and the catalogue gate rows); CAMP-TEST-20 Pusher part → 08.

### 03 Warband roster (`ROST`; Pass 1)

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| ROST-TEST-01 / INFRA-TEST-02 | API | `summary`, `heroes`, `henchmen-groups`, `hired-swords` and the three `detail/` lists on 3 units × 4 items × 2 availabilities × 2 restrictions; again with 1 vs 10 distinct items | Constant in item count; detail ≤ 12 (INFRA ceiling 14), list ≤ 10, summary ≤ 6 | P1 | B: ROST-PERF-02/03/04, INFRA-PERF-05 | 0.4 baseline → Pass 1 |
| ROST-TEST-02 | API | `PATCH heroes/:id {xp}` query budget | ≤ 12; response still includes items, skills, specials, spells | P1 | B: ROST-PERF-01 | 0.4 baseline → Pass 1 |
| ROST-TEST-03 | API | Group with 1 living + 1 dead henchman; PATCH with only the living one in `henchmen` | Dead row still exists; group kill-history total unchanged | P1 | R: ROST-BUG-02 | Pass 1 |
| ROST-TEST-04 / BATL-TEST-01 / BATL-TEST-02 | API | Finalise postbattle with custom thresholds: hero `[3,7]` +4 XP from 0; hero `[1,3,10]` 0 → 3; hired-sword and henchmen thresholds that differ | `level_up == 1`; `level_up += 2`; each kind uses its own table (hired swords not the henchmen defaults) | P1 | R: ROST-BUG-01 = BATL-BUG-01 | Pass 1 (shared `apply_xp`) |
| ROST-TEST-05 | API | Postbattle for a `half_rate` hired sword with `xp_earned=2` | XP +1.0 | P1 | R: ROST-BUG-01 | Pass 1 |
| ROST-TEST-06 | API | Hero XP 0 → 13 → 3 → 13 via PATCH | Total `level_up` equals the thresholds ≤ 13, each counted once | P2 | R: ROST-BUG-03 | Pass 1 |
| ROST-TEST-07 | API | `max_heroes=2`, one dead and one living hero; POST a hero with `ignore_max_heroes` set | 201 (dead heroes don't count); the client flag is ignored | P2 | R: ROST-BUG-05 | Pass 1 |
| ROST-TEST-08 | API | POST a leader hero when a leader exists; PATCH a hero `dead`; DELETE the leader | Exactly one living leader after each | P2 | C | Pass 1 |
| ROST-TEST-09 | API | Level-up: advance `WS` at race maximum; advance `"Foo"`; no advance; `level_up=0` | 400 each; `level_up` unchanged | P2 | R: ROST-BUG-08, ROST-BUG-10 | Pass 1 |
| ROST-TEST-10 | API | (TransactionTestCase) Two concurrent level-up POSTs, `level_up=1` | Exactly one succeeds | P3 | R: ROST-BUG-10 | Pass 1 |
| ROST-TEST-11 | API | Permissions matrix over GET / PATCH / POST / DELETE / level-up: non-member, member viewer, owner, `manage_warbands` member, admin; warband DELETE by admin | 404; GET 200 and writes 403; 200; 200; 200; admin DELETE 403 | P1 | C (lock before the ROST-CQ-02 permission helper) | Pass 1 |
| ROST-TEST-12 | component | `HenchmenSummaryCard` with `half_rate=true`, click "+" | `onSave` called with `xp + 0.5` | P2 | R: ROST-BUG-09 | Pass 1 |
| ROST-TEST-13 | component | `HeroCardHeader` / `HeroSummaryCard` with `canEdit=false` | Trade badge not a button; no XP +/-; pending skill click inert | P2 | R: ROST-BUG-07, ECON-BUG-17 | Pass 1 |
| ROST-TEST-14 | component | `HeroCardHeader` trade confirm with the API rejecting 403 | Error shown, dialog closable, no unhandled rejection | P3 | R: ROST-BUG-07 | Pass 1 |
| ROST-TEST-15 | component | (hook) `useWarbandSave`: changed and unchanged heroes, removed ids, purchases | PATCH only changed heroes; DELETE removed; one summary GET; leader required only when heroes exist | P2 | C (before splitting hero edit state out of `Warband.tsx`) | Pass 1 |
| ROST-TEST-16 | component | (hook) `useWarbandSave` for a hero created in-session with edited XP | Sends `level_up: 0` | P3 | R: ROST-BUG-13 | Pass 1 |
| ROST-TEST-17 | component | (hook) `useHenchmenLevelUp` LGT path, mocked API | One promote call; group level-up consumed; a failed second step leaves nothing half-done | P2 | R: ROST-BUG-04 | Pass 1 |
| ROST-TEST-18 | component | (hook) `useWarbandMobileTopBar` with an unmemoised `handleSaveChanges` and `isMobile && isEditing` | Render count stays bounded (< 5) | P1 | R: ROST-PERF-07 | Pass 1 |
| ROST-TEST-19 / FE-TEST-21 | component | Race picker / `SearchableDropdown`: focus, type, ArrowDown, Enter; Tab from the input | Selected without a mouse; `aria-expanded` toggles; list stays open while focus is inside | P2 | R: ROST-UX-02, FE-UX-05 | Pass 1 |
| ROST-TEST-20 | component | Desktop `HeroSummaryCard`: Tab to the card | Expand button focusable, works with Enter | P2 | R: ROST-UX-03 | Pass 1 |
| ROST-TEST-21 | unit | `commitPendingPurchases` with 3 entries | Today: document ordering and failure behaviour. After the fix: one batched call | P3 | C → R: ROST-PERF-05, ECON-PERF-09 | Pass 1 (C) → Pass 2 (R) |
| ROST-TEST-22 | API | PATCH a hero with a race, item or skill id from another campaign | 400 / ignored | P3 | R: ROST-SEC-01 | Pass 1 |
| ROST-TEST-24 | API | Kill-history query plan after the index migration (`EXPLAIN`, in a test or by hand) | Index scan | P3 | R: ROST-PERF-10 | Pass 1 |
| ROST-TEST-26 | unit | `count_new_level_ups` / `count_new_henchmen_level_ups` with Decimal half steps and string inputs | Correct counts; no `ValueError` on `"4.5"` | P3 | C (verify; a failure is a bug, cf. the `henchmen.py:36` mypy error in NOTES) | Pass 1 |

Elsewhere: ROST-TEST-23 → 04 (with ECON-TEST-12); ROST-TEST-25 → E2E-01.

### 04 Economy and trades (`ECON`; Pass 2)

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| ECON-TEST-01 | API | Trade where side A selects a trader and both lock | 200, `completed`, items and gold moved, trader `trading_action=False` | P1 | R: ECON-BUG-01 | Pass 2 |
| ECON-TEST-02 | API | `item-transfers` stash → a dead or missing hero | 404; stash quantity unchanged | P1 | R: ECON-BUG-02 | Pass 2 |
| ECON-TEST-03 | API | Transfer hero → hero and hero → stash, quantity 2 | Rows moved, `cost` preserved, response shape valid | P1 | C | Pass 2 |
| ECON-TEST-04 | API | Sale from the stash and from a unit | Quantity decremented or row removed; one "Sold" row; summary gold up by exactly `price` | P1 | C | Pass 2 |
| ECON-TEST-05 | API | (TransactionTestCase, 2 threads) Two concurrent sales of the last stash copy | Exactly one succeeds, one "Sold" row | P2 | R: ECON-BUG-06 | Pass 2 |
| ECON-TEST-06 | API | (threads or stale-object simulation) Both participants lock at the same time | Both flags true, trade completes, no trader lost | P1 | R: ECON-BUG-04 | Pass 2 |
| ECON-TEST-07 | API | Lock with a stale `offer_version` | 409, not locked | P2 | R: ECON-BUG-05 | Pass 2 |
| ECON-TEST-08 | API | An offered item is sold between offer and completion | 400 with a reason; both flags reset; traders restored | P2 | R: ECON-BUG-11 | Pass 2 |
| ECON-TEST-09 | API | Offer: gold above balance, item not in stash, quantity above stock, non-participant, expired | 400 / 400 / 400 / 403 / 400; expired becomes `expired` with traders restored | P1 | C (expiry part R: ECON-BUG-16) | Pass 2 |
| ECON-TEST-10 | API | Accept or decline a pending request after `expires_at` | 400, `expired`, recipient notification resolved | P2 | R: ECON-BUG-16 | Pass 2 |
| ECON-TEST-11 | unit | Gold per action type, Group children, unknown action | Matches the enum mapping; children counted once | P1 | C → R: ECON-BUG-07 | Pass 2 |
| ECON-TEST-12 / ROST-TEST-23 | API | Mixed ledger: buy, sell, trade sent/received, upkeep, reward, group header with children | `summary.gold == Warband.gold == recompute_gold()` == the signed sum == frontend `getSignedTradePrice` | P1 | C (summary today) → R: ECON-BUG-07, ECON-CQ-01 | Pass 2 |
| ECON-TEST-13 | API | New purchase endpoint: insufficient gold; success; two concurrent purchases over budget | No item or ledger row; item + ledger + log; only one succeeds, gold never negative | P1 | R: ECON-BUG-03, ECON-PERF-01 | Pass 2 |
| ECON-TEST-14 | API | Budgets: summary, items, logs page, transfer, sale, offer update | ≤ 6 / ≤ 4 / ≤ 4 / ≤ 15 / ≤ 12 / ≤ 6 (fails today) | P1 | B: ECON-PERF-03/04/05/06 | 0.4 baseline → Pass 2 |
| ECON-TEST-15 | API | Logs pagination and feature filter | Page size honoured, newest first, `next` link, filter applied on the server | P2 | R: ECON-PERF-06 | Pass 2 |
| ECON-TEST-16 | API | Resource delta update; resource sale endpoint | `F()` delta applied, negative totals rejected, sale atomic | P3 | R: ECON-BUG-15 | Pass 2 |
| ECON-TEST-17 | API | Item from another campaign posted to `/items/` and `item-transfers` (unit PATCH: ROST-TEST-22) | 400 / 404 | P3 | R: ECON-SEC-01 | Pass 2 |
| ECON-TEST-19 | component | `TradeSessionDialog`: partner payload arrives during a pending local edit; Accept right after the partner changes | Draft not reverted; Accept briefly disabled; countdown visible | P2 | R: ECON-BUG-12, ECON-UX-01 | Pass 2 |
| ECON-TEST-20 | component | (hook) `useWarbandTradeSession`: change `?tab=`; receive `offer_updated` | Socket not recreated; `getWarbandSummary` not called | P2 | R: ECON-PERF-02 | Pass 2 |
| ECON-TEST-21 | component | `TradesTab` with a group header whose children cost 120 | Shows "−120 gc" in expense style; adding an entry updates the total once | P2 | R: ECON-BUG-08, ECON-PERF-08 | Pass 2 |
| ECON-TEST-22 | component | (hook) `useAcquireItemDialogShared`: `createWarbandTrade` rejects; rare item after quantity 3 was chosen | Error shown, dialog stays open; ledger says quantity 1 | P1 | R: ECON-BUG-03, ECON-BUG-18 (also C before the ECON-CQ-05 split) | Pass 2 |
| ECON-TEST-23 | unit | `applyItemMutationResult` for hero → hired sword and hero → henchmen moves | Target merged into the correct list; heroes unchanged apart from the source | P2 | R: ECON-BUG-09 | Pass 2 |
| ECON-TEST-24 | component | Warband route viewing another warband during an active trade | Trade dialog not rendered | P2 | R: ECON-BUG-13 | Pass 2 |
| ECON-TEST-27 | component | `LogsTab` with server pagination and batch children | Fetches by page; child logs grouped under the header | P3 | R: ECON-PERF-06 | Pass 2 |
| ECON-TEST-28 | manual | "Buy again" on an owned base Axe in a campaign with an Axe override | Price follows the agreed override rule (manual step 38) | P3 | R: ECON-BUG-14 (needs a decision) | Pass 2 |

Elsewhere: ECON-TEST-18 → 08 (INFRA-TEST-06); ECON-TEST-25 → E2E-03; ECON-TEST-26 → E2E-10.

### 05 Battles (`BATL`; Pass 3)

The existing 57 API tests are the characterisation base for splitting `shared.py` and `lifecycle.py`; only the gaps below are new.

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| CAMP-TEST-02 / BATL-TEST-06 / INFRA-TEST-01 | API | Current / open battle list (`?status=open` or `battles/current/`) with 0-2 vs 20-30 ended battles | Identical count, ≤ 4; payload holds only open battles | P0 | B: INFRA-PERF-01, CAMP-PERF-01, BATL-PERF-01 | 0.4 baseline → ↑ right after 0.1 |
| BATL-TEST-03 / BATL-TEST-04 | API | Creator `cancel-battle/`, and owner `active-battles/:id/cancel/`, in postbattle after one participant finalised | 400 (or the "close postbattle" path); wins/losses and the confirmed participant's status unchanged | P1 | R: BATL-BUG-02 | Pass 3 |
| BATL-TEST-05 / INFRA-TEST-05 | API | `GET state` for 3 participants and 50 events, and `rosters`, each twice within 30 s | No UPDATE/INSERT (at minimum on the second GET if presence is throttled instead of removed); state ≤ 4, constant in participants and events | P1 | B + R: BATL-PERF-03, BATL-PERF-09, INFRA-PERF-09 | 0.4 baseline → Pass 3 |
| BATL-TEST-07 | API | Finalise a fixture warband (5 heroes, 2 hired swords, 8 henchmen, 1 find) | ≤ 30 (record the current baseline first) | P2 | B: BATL-PERF-04 | 0.4 baseline → Pass 3 |
| BATL-TEST-09 | API | Same kill submitted twice with one `Idempotency-Key` | One event, `kill_count` +1 | P2 | R: BATL-BUG-05 | Pass 3 |
| BATL-TEST-10 | API | Postbattle draft raises a unit's kills from 1 to 3, then finalise | Permanent kills equal the value shown; pivotal moments use the same number | P1 | R: BATL-BUG-04 | Pass 3 |
| BATL-TEST-11 | API | Record a kill, then POST `/config/` with a stale `unit_information_json` (`kill_count: 0`) | `kill_count` and `out_of_action` preserved (merge-patch) | P2 | R: BATL-BUG-06 | Pass 3 |
| BATL-TEST-12 | API | Invitee declines during inviting | Battle cancelled (or participant removed); invitee not busy; creator notified | P2 | R: BATL-BUG-08 | Pass 3 |
| BATL-TEST-13 | API | Freeze time past each TTL (inviting, prebattle, active, postbattle) and run the sweeper | Expected transitions; postbattle auto-skips and ends once; pivotal moments generated once | P1 | R: BATL-BUG-03 | Pass 3 |
| BATL-TEST-14 | API | Serious-injury roll in draft, then "leave without saving"; and with finalise | No `serious_injury` log; with finalise exactly one per unit | P2 | R: BATL-BUG-10 | Pass 3 |
| BATL-TEST-15 | API | Pending reported results endpoint with 5 pending | Constant query count; resolves after approve/decline; "clear all" doesn't hide action-required items | P2 | R + B: BATL-BUG-09 | Pass 3 |
| BATL-TEST-16 | API | (TransactionTestCase, 2 threads) Two participants finalise concurrently | Both confirmed; one `battle_ended`; pivotal moments and trading reset once; no deadlock | P2 | C (guards the BATL-PERF-04/06 lock narrowing) | Pass 3 |
| BATL-TEST-17 | API | `item_used` with a unit not owned, an item not owned, a 50 KB payload | 400 each | P3 | R: BATL-BUG-12, BATL-SEC-02 | Pass 3 |
| BATL-TEST-18 | API | Reported result with `battle_date` tomorrow | 400 | P3 | R: BATL-BUG-09 | Pass 3 |
| BATL-TEST-19 | API | Locked participant query SQL | Contains `FOR UPDATE OF "battle_participant"` | P3 | R: BATL-PERF-06 | Pass 3 |
| BATL-TEST-20 | component | `BattlePostbattle` on mobile: tap the back chevron | Navigates away; `confirmBattlePostbattle` not called | P2 | R: BATL-UX-01 | Pass 3 |
| BATL-TEST-21 | component | (hook) `useBattleState` receives 5 socket events in 100 ms | One GET; a response older than the current `state_version` is discarded | P2 | R: BATL-PERF-02, BATL-BUG-06 | Pass 3 |
| BATL-TEST-22 | component | (hook) `useBattleState` on `visibilitychange` → visible, and Pusher `connected` after `unavailable` | Refetches once | P2 | R: BATL-BUG-07 | Pass 3 |
| BATL-TEST-24 | unit | Exploration table parity: frontend vs a backend-exported JSON fixture, totals 0-40 | Same amounts (delete once BATL-CQ-03 removes the copy) | P3 | C | Pass 3 |
| BATL-TEST-27 | component | Postbattle kill stepper and finalise summary | Summary lists stat changes, kills, level-ups and consumed items | P3 | N: BATL-UX-04 | Pass 3 (PR C) |

Elsewhere: BATL-TEST-01/02 → 03 (ROST-TEST-04); BATL-TEST-08 → 08; BATL-TEST-23 → 07; BATL-TEST-25 → E2E-02; BATL-TEST-26 → E2E-05.

### 06 Catalogue (`CAT`; Pass 5)

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| CAT-TEST-01 | API | Each list endpoint (`items`, `skills`, `spells`, `special`, `races`, `restrictions`, `bestiary`, `hired-swords`, `item-properties`) with a non-member's `campaign_id` | 404; base-only list still 200 without `campaign_id` | P1 | C (verify) | Pass 5 |
| CAT-TEST-02 | API | Campaign custom skill "Infiltration" (type Skaven); list skills | Only the Skaven base "Infiltration" hidden; other types remain | P1 | R: CAT-BUG-03 | Pass 5 |
| CAT-TEST-03 | API | Player with default perms creates a custom item, then PATCHes and DELETEs it | Create 201; edit/delete per the chosen model: 200/204 for own entries, 403 for others | P1 | R: CAT-BUG-04 | Pass 5 |
| CAT-TEST-04 | API | DELETE a custom item that is in a hero's loadout and a stash | 409 with usage count; owned rows untouched | P1 | R: CAT-BUG-01 | Pass 5 |
| CAT-TEST-05 | API | POST `/api/restrictions/` as a random user | 403 or 405 | P1 | R: CAT-SEC-01 | Pass 5 |
| CAT-TEST-06 | API | `GET /api/items/?campaign_id=1` twice with `If-None-Match`; then create a custom item | Second is 304 with ≤ 2 queries; after the create, 200 with a new ETag | P1 | N + B: CAT-PERF-02 | Pass 5 |
| CAT-TEST-07 | API | Budgets for each list endpoint (items 14 today, others 4-6), then add 50 items | Counts don't grow with rows; items ≤ 8 after CAT-PERF-07 | P1 | B | 0.4 baseline → Pass 5 |
| CAT-TEST-08 | API | `GET /api/bestiary/:id/` and `/api/hired-swords/:id/` for an entry with 8 equipment items | ≤ 12 queries (43 / 45 today) | P2 | B: CAT-PERF-04 | 0.4 baseline → Pass 5 |
| CAT-TEST-09 | API | POST item with `availabilities=[{"cost": -5, "rarity": 1}]` | 400 with field errors; no item row | P2 | R: CAT-BUG-05 | Pass 5 |
| CAT-TEST-10 | API | POST hired sword with `skill_ids=[999999]` | 400; no orphan `BestiaryEntry` | P2 | R: CAT-BUG-05 | Pass 5 |
| CAT-TEST-11 | API | `?campaign_id=abc` on each list | 400, not 500 | P3 | R: CAT-BUG-07 | Pass 5 |
| CAT-TEST-12 | unit | (command) Seed, add a campaign override "Axe" and a half-price-armour rule, run `seed_all` again | Succeeds; base rows updated; campaign rows untouched; no duplicates | P1 | R: CAT-BUG-02 | Pass 5 |
| CAT-TEST-13 | unit | (data) Replay `seed_bestiary` resolution against the committed JSON | Zero unresolved equipment, skills, spells; no entry with S0 and A>0 | P2 | R: CAT-BUG-06 | Pass 5 |
| CAT-TEST-14 | unit | `parse_unique_to` table: "Goblins only", "Khemri Setting", "Shadow Warriors - Shadow Weavers", "Dark Elves, Lizardmen, Norse and Marauders only", "Pirates only, one per model", every key in `_RESTRICTION_CORRECTIONS` | Matches the docstring examples and corrections | P2 | C | Pass 5 |
| CAT-TEST-16 | API | Member of campaign A links campaign B's custom skill id to A's bestiary entry | 400 | P3 | R: CAT-SEC-02 | Pass 5 |
| CAT-TEST-18 | component | `Skills.tsx` as a player without `manage_skills` | No Edit button on custom skills | P2 | R: CAT-BUG-04 | Pass 5 |
| CAT-TEST-19 | component | `Items.tsx`, item with 2 availabilities, mobile viewport | Two rows, each with its restriction label | P3 | R: CAT-UX-03 | Pass 5 |
| CAT-TEST-20 | component | `NewSkillDialog` opened twice | `listSkills` called at most once (cache) | P2 | R: CAT-PERF-03 | Pass 5 |
| CAT-TEST-21 | component | `HiredSwords.tsx` sorting | Original array order unchanged | P3 | R: CAT-BUG-11 | Pass 5 |

Elsewhere: CAT-TEST-15 → 02 (CAMP-TEST-18); CAT-TEST-17 → 07; CAT-TEST-22 → E2E-11.

### 07 Frontend platform (`FE`; Phase 0 unless a pass is named)

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| FE-TEST-07 / CAMP-TEST-04 (battles) / BATL-TEST-23 / INFRA-TEST-11 | component | `CampaignLayout` + overview (`BattleActionPanel`) with MSW; fire `focus` and `visibilitychange` together | Battle list fetched once on mount; at most one more per 30 s debounce window | P0 | R: CAMP-PERF-01, INFRA-PERF-01 (frontend half) | 0.5 |
| CAMP-TEST-04 (catalogue) / CAT-TEST-17 / INFRA-TEST-12 | component | `CampaignLayout` with the 5 catalogue requests still pending | Shell and overview render and the overview fetches start; the Warband route shows its own skeleton; lookups resolve later | P0 | R: CAMP-PERF-02, CAT-PERF-01, INFRA-PERF-06 | 0.5 |
| FE-TEST-05 | component | Render `/campaigns/1` with MSW and count requests by path | Each endpoint at most once; total ≤ 12 (about 18 today); no duplicate `/battles/` | P1 | B: FE-PERF-01 | 0.5 |
| FE-TEST-06 | component | Overview → Warband → Overview within `staleTime` | Second Overview makes 0 requests; Warband doesn't refetch cached warband or summary | P1 | N: FE-PERF-01 (TanStack Query) | 0.5 |
| FE-TEST-08 | component | `MobileLayout` pull past the threshold | No `location.reload`; active queries refetched; "Refreshing..." until settled | P2 | R: FE-PERF-02 (replaces the test fixed in T0-3) | 0.5 |
| FE-TEST-09 | component | `CampaignLayout`: flip the `matchMedia(960px)` mock with a stateful page mounted | Page not remounted; state preserved | P2 | R: FE-BUG-01 | Pass 4 (`CampaignShell` split) |
| FE-TEST-10 | component | Warband mobile edit override active, then a notification is added to the store | Top bar still shows Save and Cancel | P2 | R: FE-BUG-02 | Pass 1 |
| FE-TEST-11 | unit | Realtime client: two `useChannel` hooks on one channel; unmount one, then both | One `subscribe`; unsubscribe only after the last; one Pusher instance | P1 | R: FE-PERF-05, BATL-PERF-10 | Pass 3 |
| FE-TEST-12 | component | (hook) `useNotifications` with mocked realtime: change `currentBattleSession` and `tradeSession` | No resubscribe and no `/notifications/` refetch | P1 | R: FE-PERF-05, ECON-PERF-10, BATL-PERF-10 | Pass 2 |
| FE-TEST-13 / AUTH-TEST-30 | unit | Pusher channel auth after a token change (mocked pusher-js); `pusher:subscription_error` with 401 | `headersProvider` returns the current token; token refresh, then resubscribe with the new header | P2 | R: AUTH-BUG-08, FE-BUG-04 | Pass 3 |
| FE-TEST-14 | unit | `notification-mappers` extracted from `useNotifications.ts:29-145` | Trade, invite and result payloads map correctly; malformed → `null` | P2 | C (extract and pin before splitting `useNotifications`) | Pass 2 |
| FE-TEST-15 | component | `NotificationsMenu`: accept trade, API rejects 400 | Menu stays open, row shows the error, no unhandled rejection | P2 | R: FE-BUG-03 | Pass 2 |
| FE-TEST-17 | component | `DiceRoller` with a mocked DiceBox: mount and unmount 5 times | Engine constructed once; no extra `window` resize listeners | P2 | R: FE-PERF-07, BATL-PERF-08 | Pass 3 |
| FE-TEST-18 (404) | component | Router: unknown path `/nope` | `NotFound` shown, not a redirect to `/` | P2 | R: FE-UX-03 | Pass 6 |
| FE-TEST-19 | component | Throw inside a route component | `errorElement` renders with Retry; the shell stays intact | P2 | N: FE-UX-01 | 0.5 |
| FE-TEST-27 | CI | `vite build` with size-limit | Entry chunk ≤ 250 KB gzip; job fails on regression | P2 | G: FE-PERF-03 | 0.3 |
| FE-TEST-28 | CI | `tsc --noEmit`, `eslint .`, `vitest run` on every push | All green | P1 | G: FE-CQ-01 | 0.3 |

Elsewhere: FE-TEST-01, -02, -03, -04, -20, -29 → 01; FE-TEST-16 → 02; FE-TEST-21 → 03; FE-TEST-22 to -26 → E2E.

### 08 Infrastructure and performance (`INFRA`; Phase 0)

| ID | Level | Scenario | Expected | Pri | Kind (covers) | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| INFRA-TEST-04 | API | Table-driven budget for every endpoint in the 08 Measurements table on the reference fixture (`QUERY_BUDGETS`) | Each within budget; budgets in one dict so a PR that raises one is visible | P1 | G + B | 0.4 |
| INFRA-TEST-06 / BATL-TEST-08 / ECON-TEST-18 / CAMP-TEST-20 (Pusher) | API | `pusher.Pusher.trigger` (or `send_battle_event`) raises or times out during a battle `unit-kill`, trade create / offer / lock / completion, and a chat POST | 2xx (chat 201); DB change persisted once; error logged; no duplicate rows; remaining queued events still sent | P1 | R: INFRA-BUG-01, BATL-BUG-05, ECON-PERF-07, CAMP-PERF-07 | 0.1 |
| INFRA-TEST-07 / AUTH-TEST-18 | unit | (subprocess) Import settings with `DJANGO_DEBUG` unset; `DEBUG=0` with the default `SECRET_KEY`; without `RATE_LIMIT_NUM_PROXIES` or `FRONTEND_URL` | `DEBUG is False`; `ImproperlyConfigured` in each bad case | P1 | R: INFRA-SEC-01, AUTH-SEC-01, AUTH-BUG-05, AUTH-SEC-03 | 0.1 |
| INFRA-TEST-08 | unit | Import settings with `DATABASE_URL` set | `CONN_MAX_AGE > 0` and `CONN_HEALTH_CHECKS is True` | P1 | R: INFRA-PERF-03 | 0.1 |
| INFRA-TEST-09 | unit | (script) `wait_for_db` with only `DATABASE_URL` set; with an unreachable host and a 2 s timeout | Uses the URL; exits non-zero after the timeout without printing the password | P2 | R: INFRA-BUG-02 | 0.1 |
| INFRA-TEST-10 | CI | (load, optional) `scripts/loadtest.py` GET mix (battle list, items, heroes, summary, players, hired-swords detail, campaign detail), 1/5/20 clients × 15 s, against staging before and after each perf PR | p50 / p95 / req/s recorded in the PR; target p95 < 500 ms at 5 clients against Neon | P1 | G | 0.1 (T0-10), then every perf PR |
| INFRA-TEST-13 | CI | (container) Build the image, run it with `DATABASE_URL` pointing at a test Postgres | Process is gunicorn, not `runserver`; `/api/health/` 200 within 30 s | P2 | R: INFRA-PERF-02 | 0.1 |
| INFRA-TEST-14 | API | With `DEBUG=False` and `LOGGING` configured, hit a view that raises | Traceback emitted to stdout via `django.request` | P3 | R: INFRA-CQ-01 | 0.1 |
| INFRA-TEST-15 | CI | `python manage.py check --deploy` with production-like env | No errors | P3 | G: INFRA-SEC-01, INFRA-SEC-02 | 0.3 |

Elsewhere: INFRA-TEST-01, -05 → 05; INFRA-TEST-02 → 03; INFRA-TEST-03 → 02; INFRA-TEST-11, -12 → 07.

## End-to-end scenarios (Playwright)

Runs against the T0-8 stack: fresh DB seeded by `seed_e2e`, gunicorn backend, built frontend, soketi instead of Pusher. Each scenario opens one browser context per user from saved `storageState`; C uses the `mobile` project (390×844, touch) where noted. Every scenario also asserts: no console errors, no unhandled promise rejections, no 5xx responses. Budgets that only hold after a fix start as recorded baselines and are tightened in that pass.

**E2E-01 Golden path** (sources: ENGINEERING_RULES §3 proposed e2e; ROST-TEST-25; CAMP-TEST-09). Users: new user N, seeded owner A. Phase 0.5 skeleton, completed through Pass 3.
1. N registers on `/` with a unique email → lands on `/campaigns`; at most one `/auth/me/`.
2. N joins "E2E Shards" with the join code typed in lowercase → card shows role Player.
3. N creates a warband → header gold equals the campaign's starting gold; Treasury shows the starting-gold row.
4. N adds a hero (race chosen by keyboard) with recruit cost 20 → gold −20, rating > 0; adds a henchmen group of 2.
5. N buys a common item ×2 for the hero → gold falls by the total; Treasury "Bought <item> x 2"; a log entry; one purchase request after ECON-PERF-01 (about 8 today).
6. Reload the warband with a 3G CDP profile → ≤ 2 API requests after the layout; roster visible < 2 s (ROST-TEST-25).
7. A invites N to a battle; N accepts from the bell; both ready; A starts. N records a kill on A's unit and puts one of A's henchmen out of action → A sees both within 2 s.
8. A ends the battle with N as winner; both finalise (N gives the hero enough XP to cross a threshold and adds a find).
9. Assert: battle in History; N's wins +1; hero shows "Level Up!"; N levels up a stat → stat +1, `level_up` consumed, log written; find in N's stash.
10. N requests a trade with A; A accepts; N offers the bought item, A offers 10 gc; both accept → `completed`; item in A's stash, gold moved, ledger rows on both sides.
11. N sends a chat message → appears in A's chat without reload.

**E2E-02 Battle with realtime** (BATL-TEST-25, FE-TEST-22). Users: A, B desktop; optional C mobile. Campaign seeded with custom hero thresholds to catch BATL-BUG-01. Pass 3.
1. A opens the overview → ≤ 1 `/battles/` request.
2. A creates a battle inviting B (and C) → B's bell badge increments within 2 s without reload.
3. B accepts from the bell → A's overview shows prebattle; when the last invitee accepts, every client navigates to prebattle.
4. B deselects a unit and adds a temporary stat edit → visible on A without reload. Both ready; A's Start is disabled until all are ready.
5. A starts → all clients on Active. On A: OOA a hero, wound +/-, record a kill on B's unit → each appears on B within 2 s.
6. A ends the battle (A wins); both finalise.
7. Assert: battle `ended`; wins/losses +1 exactly once each; XP and pending level-ups follow the campaign thresholds; kills on the warband sheet; warband logs written; no page made duplicate `/battles/` calls.

**E2E-03 Trade lifecycle** (ECON-TEST-25). Users: A, B. Pass 2.
1. A requests a trade; B accepts → both on `/warband?trade=<uuid>` with a visible countdown.
2. A selects a trader hero and offers 2 items + 10 gc; B offers 1 item → each side sees the other's offer within 1 s; no `GET /summary/` per edit.
3. Both lock → `completed`; both stashes and gold updated; ledger rows on both sides; trader marked spent; notifications cleared.
4. Variants: B declines (A sees declined, nothing moves); A cancels before B accepts (B's notification disappears); expiry (backdate `expires_at` by management command → dialog closes with a message, trader restored, notification gone).

**E2E-04 Chat unread** (FE-TEST-23). Users: A on two contexts (A1 desktop, A2 as A's second device), B. Pass 4.
1. B's chat menu closed; A1 sends 2 messages → B's unread badge shows 2; opening shows each message once and clears the badge.
2. A2 (same user) does not count A1's messages as unread.
3. Intercept B's send with 429 → draft restored and inline error (CAMP-BUG-08).

**E2E-05 Reconnect and phase catch-up** (BATL-TEST-26, FE-TEST-24). Users: A, B in an active battle. Pass 3.
1. `context.setOffline(true)` for B; A ends the battle; B back online → B lands on postbattle without a manual reload.
2. Stop the soketi container for 10 s mid-battle; A records a kill → B shows a "Reconnecting" chip; restart soketi → B shows the kill without reload.

**E2E-06 Stale battle** (derived from BATL-TEST-13 and BATL-BUG-03). Seed an active B vs C battle whose last activity is 3 days old. Pass 3.
1. B's overview shows the idle state and the agreed exit actions instead of a bare "Rejoin Battle".
2. Run `expire_stale_battles` (or trigger the lazy sweep through `battles/current/`) → the battle transitions per the policy; B and C are no longer busy; B can start a new battle with C.
3. Owner A in Settings → Active battles sees the battle's age; "Cancel" is hidden for postbattle and "Close postbattle" offered.

**E2E-07 Permissions** (derived from ROST-TEST-11/13, ECON-BUG-17, ECON-SEC-02, CAMP-TEST-11). Users: A owner, B player, C with `manage_warbands`. Pass 1 (steps 1-3), Pass 4 (step 4).
1. B opens A's warband → no Edit buttons, Trade badge not a button, no XP +/-, no stash kebabs, resource controls or "Add Trade Entry".
2. B's API context POSTs `/api/warbands/<A>/item-sales/` → 403.
3. C changes XP on A's hero → saved.
4. A removes B mid-trade → B's trade actions return 403, B's trade channel auth fails, B's notifications for the campaign disappear.

**E2E-08 Session resilience** (FE-TEST-26). User: A. Phase ↑0.5 (step 3 in Pass 6).
1. Route `/api/auth/me/` to 503 and load `/campaigns` → tokens still in localStorage; "server unavailable" screen with Retry.
2. Remove the route and click Retry → campaigns render.
3. Replace the access token with garbage, type into an open dialog, click a tab → exactly one `POST /auth/refresh/`, no loading overlay, dialog text intact.

**E2E-09 Mobile campaign entry** (FE-TEST-25). User: C on `mobile`. Phase 0.5 (baseline), tightened by FE-PERF-01/02.
1. Cold entry to `/campaigns/<id>` → within the request budget (≤ 12, no endpoint twice).
2. Pull to refresh → data refetched; `framenavigated` never fires.

**E2E-10 Two-tab purchase race** (ECON-TEST-26). User: A in two tabs. Pass 2.
1. Tab 2 moves an item off Hero X to the stash.
2. Tab 1 (stale) buys an item for Hero X → Hero X holds the purchase plus the correct remaining items; nothing duplicated; stash correct (ECON-BUG-03).

**E2E-11 Campaign override item** (CAT-TEST-22). Seeded custom "Axe" at 25 gc. User: B. Pass 5.
1. B opens Wargear → one "Axe" row with a "Custom" badge showing the base price.
2. Acquire dialog charges 25 gc; the ledger records 25 gc.

## Manual QA

### Release session script

Run before each release. During a feature pass, run that feature's group plus the smoke list (ENGINEERING_RULES §4).

**Setup.** Accounts: **A** owner (Chrome), **B** player who becomes admin (Firefox or a Chrome guest profile), **C** player on a phone or DevTools 390×844, **D** latecomer (fourth profile). Local Docker stack or staging, with Resend unset or patched locally and Pusher (or soketi) configured. DevTools Network open with "Preserve log" on A and C; `docker logs -f mordheim-backend-1` as the server log. Steps marked (local) stop services or change server settings: never run them on production. Each line reads action → expected (finding being verified).

**A. Auth and session**
1. A registers a new account → lands on `/campaigns`; ≤ 1 `/auth/me/`, 1 `/notifications/`, 1 Pusher auth (AUTH-PERF-02).
2. Register with an existing email in another case → "User already exists"; with `password` → all validator messages; with a 200-character alias → field error, not "Request failed (500)" (AUTH-BUG-07, AUTH-UX-01).
3. Log out → landing, both tokens gone from Local Storage. Wrong password → "Invalid credentials"; correct one → one `/auth/me/`. Reload `/campaigns/1` → campaign requests start without waiting on `/auth/me` (AUTH-PERF-01).
4. Type a chat draft, set `mordheim_token` to `x`, open a warband → exactly one `POST /auth/refresh/`, no loading overlay, draft kept; A's second tab doesn't remount (AUTH-BUG-02).
5. Set both tokens to `x` and click anything → redirect to `/` with a "session expired" message, no loop; after login, back on the same page (AUTH-UX-02).
6. (local) `docker stop mordheim-backend-1`, reload → "Can't reach the server" with Retry, tokens intact; start it and Retry → still logged in (AUTH-BUG-01).
7. (local) Forgot password for an existing and an unknown email → same message, similar timing. Reset link: mismatch error, weak-password errors, success state with Sign in; reuse → "Invalid or expired token"; new password works, old fails; `/reset-password?uid=YWJj&token=x` → "Invalid or expired token", not 500. Same account logged in on B → B's next action returns 401 and lands on login (AUTH-BUG-06, AUTH-UX-05, AUTH-SEC-04).
8. (local, `RATE_LIMIT_ENABLED=1`) Register 4 accounts from one machine within an hour → all succeed; any throttle message is human-readable (AUTH-BUG-04).
9. Campaign Settings → Send report: blank blocked, 2000-character cap with counter, success toast; 4 sends in a minute → readable throttle message (AUTH-UX-04).
10. Landing at 375×667 and 667×375, register mode with the on-screen keyboard → every field, the submit button and errors reachable; same on `/reset-password` (AUTH-UX-07).

**B. Campaigns and membership**
11. A creates a Standard campaign with 3 seats → role Owner, "1 / 3". B joins; C joins with the code in lowercase; D → "Campaign is full"; C again → "Already a member". Raise to 4 seats; D joins from two browsers at once → one membership, no error page (CAMP-BUG-05).
12. A opens the campaign with Network cleared → overview renders before the 5 catalogues finish, no endpoint twice, ≤ 1 `/battles/`; tab away and back → ≤ 1 `/battles/`; Overview → Warband → Overview within 30 s → 0 new calls; leave and re-enter → catalogues 304 or cached, no loading screen (CAMP-PERF-01/02, FE-PERF-01, CAT-PERF-02).
13. A promotes B to Admin; B reloads → Campaign tab visible, no Campaign Systems or Delete cards; "Start campaign" works for B or isn't offered (CAMP-BUG-02).
14. A starts the campaign, goes to Warband and back → "Start campaign" hidden, "Start battle" shown; C sees "Start battle" without reloading (CAMP-BUG-03, CAMP-UX-04).
15. A opens C's permissions → Manage encampments, Manage bestiary and spell/special editing are listed; grants Manage house rules → C reloads House Rules and sees "Add rule" (CAMP-BUG-04).
16. C adds "Half Price Armour" and "Improved Shields" → each armour once at half price with a House rule badge, shields "(n+ CC)", no Edit on generated items. C buys Heavy Armour, edits only the rule title → quick, price kept; deletes the rule → item reverts to base and stays on the hero (CAMP-BUG-07, CAMP-PERF-08).
17. A kicks a player who still has a warband → succeeds or isn't offered; battle history still reads correctly (CAMP-BUG-01). C sets up a battle with B (left in prebattle) and a trade request; A removes C → B can start a new battle, C's notifications are gone, C's warband isn't listed, the dialog text matched (CAMP-BUG-06).
18. In a Marienburg campaign: Locations and Encampments in the nav and mobile tabs; create, edit and delete a location and an encampment; assign an encampment owner; toggle encampments off → disabled card and other members' nav updates (CAMP-UX-03).
19. (local) Location content `<img src=x onerror="alert(document.domain)">`; B expands it → nothing executes; stored content sanitised (AUTH-SEC-02).

**C. Catalogue**
20. Wargear → Weapons: "Axe" shows a Custom badge, author and base price; "Blowpipe" has two rows, each with its restriction, also at 375 px; search and expand stay responsive on a phone (CAT-UX-01, CAT-UX-03, CAT-PERF-06).
21. Bestiary: Giant Spider S is not 0; Bounty Hunter opens with one detail request and ≤ 12 queries in the server log (CAT-BUG-06, CAT-PERF-04).
22. As a plain player: "Add skill" visible, no Edit pencil on custom skills they didn't create; a custom "Infiltration" (Combat) leaves other types' base entries listed; a custom "Gromril Armour" at 1 gc is rejected or needs `manage_items` (CAT-BUG-03, CAT-BUG-04).
23. A tries to delete a custom item a hero carries → blocked "in use by 1 unit"; "Learn new skill" twice → skills list not downloaded again; `GET /api/items/?campaign_id=abc` → 400 (CAT-BUG-01, CAT-PERF-03, CAT-BUG-07). As A, grant "Manage bestiary" to a player → they can add and edit a bestiary entry (CAT-BUG-04).

**D. Warband roster**
24. A opens their warband → ≤ 2 API requests after the layout; expanding a hero twice makes no repeat detail request (ROST-PERF-03, ROST-PERF-06).
25. Hero XP "+" → one PATCH; henchmen XP "+" → PATCH only, no `GET summary/`; a half-rate group's "+" adds 0.5 (ROST-PERF-01, ROST-PERF-04, ROST-BUG-09).
26. B views A's warband → no Edit buttons, non-clickable Trade badge, no XP +/-, no stash kebabs, resource controls or "Add Trade Entry"; `curl -X POST /api/warbands/<A>/item-sales/` with B's token → 403 (ROST-BUG-07, ECON-BUG-17).
27. Edit Heroes → Add hero (recruit 20) → gold, Cancel and Dismiss behave as agreed for ROST-UX-01; a hero added with Leader ticked then Cancel → one crown (ROST-BUG-06). Max heroes 3 with 2 living + 1 dead → a new hero is allowed and saved (ROST-BUG-05).
28. Hero XP 3 → 13 → 3 → 13 → the thresholds count once in total (ROST-BUG-03). Level-up dialog at race maximum → WS can't go above it (ROST-BUG-08). Two tabs, one pending level-up, confirm in both → only one applies (ROST-BUG-10).
29. A and C (`manage_warbands`) both open the warband; C makes hero X leader; A clicks XP "+" on the old leader without reloading → after reload the crown stays on X (ROST-BUG-11).
30. Henchmen group with a level-up and 2+ members: Lad's Got Talent → new hero, group one member fewer, "Level Up!" gone; repeat going Offline after the first request → nothing half-done (ROST-BUG-04).
31. (throwaway warband) After a battle where a henchman died, rename the group and Save → the dead henchman and his kills remain; top killers unchanged (ROST-BUG-02).
32. Keyboard only: race picker type, ArrowDown, Enter selects; desktop card expands with Tab and Enter (ROST-UX-02, ROST-UX-03).
33. Phone 375×812: Edit Heroes → no "Maximum update depth exceeded", idle CPU quiet (ROST-PERF-07); a trade request arrives → Save and Cancel stay (FE-BUG-02); switching tab with unsaved edits warns (ROST-UX-01, FE-UX-04); the chat badge and connection survive entering and leaving edit mode (CAMP-PERF-09).

**E. Economy**
34. Header gold equals the hand-summed Treasury; group rows show negative totals (ECON-BUG-08). Logs show "Page 1 of N" and load by page; Warband → Logs → Treasury → Logs re-downloads nothing (ECON-PERF-06, ECON-PERF-08).
35. Sell 1 of a stash item with quantity ≥ 2 → quantity −1, gold + price, one "Sold" row, one request. Move stash → hero → henchmen group → the group never appears among heroes, hero name unchanged (ECON-BUG-09). Open Move to Hero X, delete X in another tab, confirm → error, stash item kept (ECON-BUG-02).
36. Buy a common item ×2 → one request, "Bought <item> x 2", gold down by the total. Block `*/api/warbands/*/trades/` and buy → visible error, no item (ECON-BUG-03). Two tabs each buying more than half the gold → second rejected, gold never negative (ECON-TEST-13).
37. Resource "+" ×3 → one PATCH after 1 s; C changes the same resource at once → both changes kept; delete asks for confirmation (ECON-BUG-15, ECON-UX-03). A changes starting gold mid-campaign → confirmation warning; treasury updates without reload; only the starting-gold row changes (CAMP-BUG-12).
38. "Buy again" on the owned base Axe → charged per the agreed override rule; record the result for the owner (ECON-BUG-14, ECON-TEST-28).

**F. Trades (A and B)**
39. A → Trade → B; B accepts from the bell → both on their warband with the trade dialog and a visible countdown (ECON-UX-01).
40. Offers both ways show on the other side within about 1 s with no `GET /summary/` per edit; switching Warband / Treasury / Logs opens no new WebSocket or Pusher auth; 5 quick clicks on one item end at ×5 (ECON-PERF-02, ECON-BUG-12).
41. B changes the offer and A accepts within half a second → the lock is rejected or the UI refreshes (ECON-BUG-05). Both click Accept on "3-2-1", five times → completes every time (ECON-BUG-04). A trade with a trader hero → completes, hero spent, overview Trades lists item values (ECON-BUG-01, ECON-BUG-10).
42. A offers a stash item, sells it in another tab, both lock → clear error on both screens and flags reset (ECON-BUG-11). A trade left to expire (or with a shortened window locally) → dialog closes with a message, trader restored, B's notification gone; cancel before accept → B's notification disappears (ECON-BUG-16).
43. During an active trade A opens B's warband → no trade dialog with B's stash (ECON-BUG-13). (local) Wrong `PUSHER_SECRET`, edit an offer → request succeeds and state stays consistent (ECON-PERF-07).

**G. Battles** (A desktop, B second browser, C phone; set hero thresholds to `[1, 3, 5]` first)
44. A's overview: `/battles/` ≤ 1 on load and after a tab return. A starts a battle with B and C → invites arrive in under 3 s; C declines → C isn't busy and A is notified (BATL-PERF-01, BATL-BUG-08). Recreate; B and C accept → all three navigate to prebattle.
45. Each player deselects a unit and adds a temporary stat edit with a note and a custom unit → visible to the others without reload. B readies, unreadies, readies; A's Start stays disabled until all are ready; A leaves and returns → auto-unreadied.
46. A starts → all on Active. On C: OOA a hero, fast wound +/-, record a kill on B's unit, use a single-use item → A and B update within about 2 s; touch targets ≥ 44 px; undo available for the kill and the item use (BATL-UX-05, BATL-UX-03).
47. C goes Offline, A records a kill, C back Online → C catches up without reload. Lock C's screen while A ends the battle → on unlock C is on postbattle (BATL-BUG-07). The End battle dialog states what gets recorded and allows "No winner" (BATL-UX-06).
48. On B's postbattle: roll exploration, reroll one die, reload → exploration kept (BATL-BUG-11); raise a hero's kills by 1 (note it); mark a henchman dead; roll a serious injury twice → the warband log has no injury entry yet (BATL-BUG-10); add a find and gold; untick upkeep.
49. A and B finalise within a second of each other → both succeed; a status strip shows C pending (BATL-UX-02). C taps the back chevron → navigates away without skipping (BATL-UX-01); C returns and finalises.
50. Results: Battle History shows the right winners; wins/losses +1 exactly once; XP and level-ups follow the campaign thresholds (BATL-BUG-01, ROST-BUG-01); kills equal the step 48 value (BATL-BUG-04); used item gone, find in the stash, gold and upkeep in the ledger; pivotal moments on the overview; the finalise summary listed stat changes, kills, level-ups and consumed items (BATL-UX-04).
51. New A+B battle, end it with A winning; the owner tries Cancel in Settings → Active battles → refused or replaced by "Close postbattle"; counters change only through finalise (BATL-BUG-02). An A+B battle left active with A's browser closed → B has a way out, and the owner sees its age with End and Close actions (BATL-BUG-03).
52. A reports a result (B and C participants, A winner); B approves from the bell; C clicks "Clear all" → the pending result is still approvable from the overview; repeat with C declining → cancelled for everyone, no wins/losses change (BATL-BUG-09, FE-UX-07).

**H. Chat, notifications and platform**
53. A and B chat live; B sends 13 messages in a minute → the 13th errors and keeps its text; scrolling past 50 loads older ones; A's closed menu counts B's messages but not A's own from another device (CAMP-BUG-08, FE-UX-07). B blocks `*/battles/*/join/` and accepts an invite from the menu → error shown, menu stays open; "Clear" asks before discarding actionable items (FE-BUG-03).
54. Sign out A and sign in B in the same tab → no A notifications and no "Rejoin Battle" (AUTH-BUG-03).
55. Phone 390×844: bottom nav plus dice, chat and bell in the top bar; scroll Warband halfway and tap Skills → page starts at the top (FE-BUG-05); pull to refresh → no document reload (FE-PERF-02). At 900 px type into a hero form, widen to 1000 px → value and form survive (FE-BUG-01).
56. Dice roller open, roll, close ×20 → worker count stays at 1 (FE-PERF-07). `/campaigns/1/nope` → not-found page; a battle URL opened while logged out → lands there after login (FE-UX-03). Keyboard only: roll dice, accept a notification, add a skill through a searchable dropdown, with a visible focus ring (FE-UX-05).
57. A deletes the campaign by typing "delete" → it disappears for everyone, with no leftover notifications (CAMP-BUG-06).

**Performance check (perf PRs only, staging, from the 08 manual script).** Record the Render service type, start command, plan and env flags (never paste values); run the `SELECT 1` latency snippet from a Render shell, and again after 10 idle minutes; hard-refresh the overview on "Fast 4G" and note requests, preflights, `content-encoding`, the slowest call and time to first render; have 4-6 people open the overview and switch tabs twice while watching Render CPU and the gunicorn access log; run INFRA-TEST-10. Put before and after numbers in the PR.

### Smoke test after deploy (production)

Use a dedicated "Smoke" campaign with two of your own accounts, so no real campaign data changes.

1. `curl -i https://<api>/api/health/` → 200 in under 1 s; keep-awake answers HEAD (and GET after AUTH-PERF-06), or is gone on a paid plan.
2. Render logs: gunicorn workers booted, access-log lines carry `ms`, no tracebacks; migrations ran (INFRA-PERF-02, INFRA-CQ-01).
3. Request an unknown API path → JSON 404, never Django's debug page (INFRA-SEC-01).
4. Log in → one `/auth/me/`; API calls same-origin with no `OPTIONS` preflights (after the AUTH-PERF-03 rewrite); `Content-Security-Policy` present on the document (FE-SEC-01).
5. Open the Smoke campaign overview → no long "Preparing the campaign..." wait; ≤ 1 `/battles/`; JSON gzip or br encoded; note the load time next to the previous deploy's.
6. Switch to another tab and back → ≤ 1 battle-list request.
7. Open the Smoke warband → roster renders within the request budget; click XP "+" then "−" → both save.
8. Second account on a phone: send a chat message → appears on the first device within 2 s, no error.
9. Request a password reset for your own account → email arrives and the link points at the Vercel domain (AUTH-BUG-05).
10. No requests to `mordheimer.net`, `lottie.host`, `jsdelivr` or `unpkg`; console clean (FE-SEC-01, FE-BUG-07).
11. Render and Neon dashboards 10 minutes later: CPU, memory and p95 in their normal range.

## Order of work

Aligned with PLAN.md. Every pass follows the loop: lock (characterisation + budget baselines) → fix (PR A, one regression test per bug) → refactor (PR B, suite unchanged and green, budgets may only fall) → build (PR C, acceptance tests) → verify (suite, budgets before/after in the PR, that pass's manual steps, smoke after deploy).

**Phase 0 (once)**
- **Before 0.1:** T0-1 (no-network guard; AUTH-TEST-15) and T0-10 (load script) so 0.1 starts safe and with "before" numbers.
- **0.1 Production perf quick wins:** INFRA-TEST-07 / AUTH-TEST-18, INFRA-TEST-08, INFRA-TEST-06 group (Pusher off the request path), AUTH-TEST-16 (Resend off the request path), INFRA-TEST-09, INFRA-TEST-13, INFRA-TEST-14; INFRA-TEST-10 before and after.
- **0.2 Get green:** T0-2 (12 duplicates), T0-3 (3 failures), clear ruff / format / mypy / tsc, add `lint` and `typecheck` scripts.
- **0.3 Guardrails:** T0-7 CI, T0-9 coverage, FE-TEST-27, FE-TEST-28, INFRA-TEST-15.
- **0.4 Query-budget harness:** T0-4 factories, T0-5 helper, INFRA-TEST-04 with every budget row at today's count (CAMP-TEST-01/03, ROST-TEST-01/02, ECON-TEST-14, BATL-TEST-05/07, CAT-TEST-07/08). Then pull forward the P0 battle list: CAMP-TEST-02 / BATL-TEST-06 / INFRA-TEST-01 tightened to ≤ 4.
- **0.5 TanStack Query foundation:** T0-6 MSW harness; characterise `api-client` (AUTH-TEST-19 / FE-TEST-01, AUTH-TEST-21); ↑ AUTH-BUG-01 (AUTH-TEST-20 / FE-TEST-02, AUTH-TEST-23 500 case); the FE-TEST-07 and CAT-TEST-17 groups; FE-TEST-05, -06, -08, -19. T0-8 Playwright with E2E-09 and E2E-08 (steps 1-2) as the first scenarios; the E2E-01 skeleton through step 6.
- **0.6 Shared unit design:** no tests; the design notes which tests pin unit behaviour (ROST-TEST-04/05/06/09/11).

**Pass 1 Warband roster.** Lock: ROST-TEST-08, -11, -15, -21 (C), -26; ROST-TEST-01/02 baselines; the existing 18 warbands tests and the battles kill-history tests. Fix: ROST-TEST-03, -04 group, -05, -06, -07, -09, -10, -12, -13, -14, -16, -17, -18, -22, -24; FE-TEST-10; tighten ROST-TEST-01/02 (and CAMP-TEST-01 if the batched rating service lands here). Build: ROST-TEST-19 / FE-TEST-21, ROST-TEST-20, plus tests for the pass's planned changes. Verify: E2E-01 steps 1-6, E2E-07 steps 1-3, manual 24-33.

**Pass 2 Economy and trades.** Lock: ECON-TEST-03, -04, -09, -11, -12 / ROST-TEST-23, -22 (C part), FE-TEST-14; ECON-TEST-14 baseline. Fix: ECON-TEST-01, -02, -05 to -08, -10, -13, -15, -16, -17, -19, -20, -21, -22, -23, -24, -27; ROST-TEST-21 flips to R; FE-TEST-12, FE-TEST-15; tighten ECON-TEST-14. Decide ECON-BUG-14 and run ECON-TEST-28. Verify: E2E-03, E2E-10, E2E-01 steps 5 and 10, manual 34-43.

**Pass 3 Battles.** Lock: the existing 57 tests plus BATL-TEST-16 and -24; BATL-TEST-05 and -07 baselines. Fix: BATL-TEST-03/04, -05, -09 to -15, -17 to -22; FE-TEST-11, FE-TEST-13 / AUTH-TEST-30, FE-TEST-17; tighten the budgets. Build: BATL-TEST-27. Verify: E2E-02, E2E-05, E2E-06, E2E-01 steps 7-9, manual 44-52.

**Pass 4 Campaigns.** Lock: CAMP-TEST-03 (already in 0.4), -09, -12, -20, -24 (role mapping), -25 (today's toggles); FE-TEST-09 before the `CampaignShell` split. Fix: CAMP-TEST-01 (if not done), -05 to -08, -10, -11, -14 to -19, -21 / FE-TEST-16, -22, -23, -27, -28; AUTH-TEST-31 / FE-TEST-29 unless already pulled forward. Build: CAMP-TEST-13, -26. Verify: E2E-04, E2E-07 step 4, E2E-01 step 11, manual 11-19, 53, 57.

**Pass 5 Catalogue.** Lock: CAT-TEST-01, -14; CAT-TEST-07/08 baselines. Fix: CAT-TEST-02 to -06, -09 to -13, -16, -18 to -21; tighten budgets. Verify: E2E-11, manual 20-23.

**Pass 6 Auth and core.** Lock: AUTH-TEST-01, -02, -05 to -11, -17. Fix: AUTH-TEST-03, -04, -12, -13, -14, -22 / FE-TEST-04, -23 (cached user), -24 / FE-TEST-03, -25 / FE-TEST-20, -26, -28 / FE-TEST-18, FE-TEST-18 (404). Build: AUTH-TEST-27, -29. Verify: E2E-08 step 3, manual 1-10 and 54.

**Recommended pull-forwards** (each is small and touches a file an earlier step already changes): the battle list fix after 0.1 (P0); AUTH-BUG-01 in 0.5 (P1; users get logged out exactly when Render struggles); AUTH-SEC-02 sanitisation as soon as possible (P1 stored XSS that can read 30-day refresh tokens).
