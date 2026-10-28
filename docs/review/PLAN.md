# Improvement Plan

How we turn the review into a better app: one shared foundations pass, then one feature at a time. Each feature pass is also the moment to add or tweak functionality.

Rules for all work: [../ENGINEERING_RULES.md](../ENGINEERING_RULES.md). They're condensed in the repo `CLAUDE.md`.

**Decisions (William, 2026-10-16):**
- Foundations pass first, then warband roster.
- TanStack Query is the frontend server-state layer.
- The rules go in `CLAUDE.md`.

## Phase 0: Foundations (once, before any feature pass)

These cut across every feature. Doing them first means each feature pass applies a settled pattern instead of inventing one.

Branch: `chore/foundations` off `main`. One commit per step, grouped into five PRs. **PR 0-A is deployable on its own**, so production gets faster before the rest of Phase 0 is finished. IDs refer to [PERFORMANCE.md](PERFORMANCE.md) (`PERF-`), [BUGS.md](BUGS.md) (`BUG-` / `SEC-`), [IMPROVEMENTS.md](IMPROVEMENTS.md) (`IMP-`) and [TEST_PLAN.md](TEST_PLAN.md).

### 0.0 Prep
- [x] Commit the review docs + `CLAUDE.md` to the branch
- [x] Remove the review's local test data (user `claude-tester@example.test`, its membership and the "Claude Test Crows" warband), with William's OK
- [x] Render facts: start command, env var names (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DATABASE_URL` pooled or direct, `RATE_LIMIT_NUM_PROXIES`, `FRONTEND_URL`, `DEFAULT_FROM_EMAIL`), Vercel `VITE_API_BASE_URL`
- [ ] Measure Render → Neon RTT from the Render shell (snippet in `features/08`). This decides PERF-06 (moving Neon to Frankfurt)

### PR 0-A · Production speed and safety (deploy as soon as it's green)
- [x] **0.1 Test safety:** test settings force Resend and Pusher off; an autouse guard fails any real outbound HTTP (IMP-05, AUTH-CQ-01). *Must land first: the backend suite currently sends a real Resend request*
- [x] **0.2 Serve properly:** `backend/gunicorn.conf.py` (gthread, 2 workers × 8 threads, timeouts, access log with timings). gunicorn auto-loads it, so Render's existing start command uses it with no dashboard change; production currently runs **one sync worker**. The Docker image also uses gunicorn, with `runserver` kept for docker-compose dev only (PERF-01, PERF-03, IMP-06)
- [x] **0.3 DB connections:** `conn_max_age` + `conn_health_checks`, Neon pooled-endpoint guidance (PERF-02)
- [x] **0.4 Secure defaults:** `DEBUG` off unless set, fail startup on a missing or default `SECRET_KEY` in production, throttle proxy count, `wait_for_db` honours `DATABASE_URL` and times out, migrations off the request-serving boot path (SEC-01, SEC-02, SEC-04 part, SEC-16, BUG-25, PERF-07, IMP-07)
- [x] **0.5 Compression:** gzip JSON responses (PERF-04)
- [x] **0.6 External calls off the request path:** Pusher and Resend dispatched on commit in the background, with short timeouts; failures logged, never a 500. This stops retries double-counting kills (PERF-11, BUG-01)
- [x] **0.7 Battle list:** fix the N+1 (78 → constant queries) and remove the duplicate and focus-triggered fetches (PERF-10)
- [x] **0.8 Security hotfix:** sanitise location content and stop rendering it raw (SEC-03)
- [x] **0.9 Don't log users out on transient errors:** only a 401 from refresh clears tokens (BUG-02)

**Status: merged to main and deployed on 2026-10-17 with the rest of Phase 0 and pass 1 (`7cc3831`). The deploy checklist below still applies (items 1–4 and 6–7 are yours; item 5 is confirmed).** Steps 0.1–0.9 are done, plus local realtime moved to soketi (dev only). Notes:
- Step 0.5's Django gzip half was dropped: Render's edge already Brotli-compresses API responses.
- Step 0.7's frontend dedupe moved to 0.19.
- SEC-04 (`RATE_LIMIT_NUM_PROXIES`) is waiting on the X-Forwarded-For chain the new access log records.

Browser smoke test passed:
- The overview uses `battles/?open=1`.
- Realtime chat reaches a second user through the background dispatcher.
- With the backend stopped, the app keeps the session and shows Retry, then recovers through refresh.

#### PR 0-A deploy checklist
1. **Deploy.** Render's existing start command picks up `backend/gunicorn.conf.py` automatically, and `migrate` applies `campaigns.0013_sanitize_location_content`.
2. **Check the Render deploy log:**
   - `Using worker: gthread`
   - two `Booting worker with pid` lines
   - access-log lines ending in `NNNms` with an `xff="..."` field
3. **Watch Render memory for a day.** 2 workers × 8 threads should fit in 512 MB. If memory is tight, set `WEB_CONCURRENCY=1` and `GUNICORN_THREADS=12`.
4. **Set `RATE_LIMIT_NUM_PROXIES`** to the number of proxy hops shown in `xff` (likely 1). Until then, throttles key on the raw header.
5. **Vercel:** `curl -sI https://mordheim-eight.vercel.app/assets/<hashed>.js` should show `cache-control: public, max-age=31536000, immutable`.
6. **Rotate the secrets shared in chat:**
   - Neon `neondb_owner` password, then update `DATABASE_URL` on Render
   - `DJANGO_SECRET_KEY`, using 50+ characters; this logs users out once
   - Pusher secret
7. **Optional: turn on email** so password reset and feedback reports work. Set `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL` (on a Resend-verified domain), `FRONTEND_URL=https://mordheim-eight.vercel.app` and `FEEDBACK_REPORT_TO_EMAIL`.

### PR 0-B · Green and guarded

**Status: complete and pushed as `chore/foundations-0b`.** Backend: ruff, format and mypy all clean (51 → 0). Frontend: `tsc` 94 → 0 (two real defects fixed with tests), duplicate tests removed and 2 stale tests fixed (131 passing). CI workflow with backend coverage (66% baseline). Query budgets cover 27 endpoints. ESLint (typescript-eslint + react-hooks; one latent hook-order crash in CampaignSettings fixed with a test) and a one-off Prettier commit (in `.git-blame-ignore-revs`) are in, and CI runs lint and format checks.
- [x] **0.10** A formatting-only commit (`ruff format`, 54 files), then `ruff check` fixes, then mypy to zero (IMP-02)
- [x] **0.11** `tsc --noEmit` to zero, real defects first (wrong argument counts in the warband save hooks, missing-module imports) (IMP-01)
- [x] **0.12** Fix the 3 failing frontend tests; delete the 12 duplicate test files, keeping the copy next to the code (IMP-04)
- [x] **0.13** `lint` / `typecheck` npm scripts, ESLint + Prettier with a clean baseline, GitHub Actions CI for both apps (IMP-03)
- [x] **0.14** Query-budget harness (one `QUERY_BUDGETS` dict starting at today's counts), `assertNumQueries` baselines for the heavy endpoints, and the repeatable load-test script (PERF-09, TEST_PLAN T0-5, T0-10)
- [~] **0.14b** Test factories (campaign, warband, units, battle) + `freezegun`; a frontend harness with MSW 2, `renderWithProviders` and a `matchMedia` helper; coverage reporting (TEST_PLAN T0-4, T0-6, T0-9)
- [ ] **0.14c** Playwright with soketi (a local Pusher stand-in), `seed_e2e` users and a request-budget fixture. It can trail into Pass 1, where the first multi-user e2e is written (TEST_PLAN T0-8)

### PR 0-C · Backend query quick wins (small, behaviour-neutral, aimed at the slowest screens)

**Status: complete and pushed as `chore/foundations-0c` (stacked on 0-B).** Measured on the reference campaign: heroes detail 33 → 14 and henchmen / hired-sword detail 18 → 11, all now constant as units grow; summary 12 → 7; warband detail, items, logs and resources 5–6 → 3; `/players/` 3 per warband → 7 in total; repeat battle-state reads 7 with a write → 5 with none. The gold rule now lives in one service (trades reuses it).
- [x] **0.15** The warband 5-query preamble becomes opt-in per handler (PERF-21)
- [x] **0.16** `ItemAvailability` prefetch on unit details: Edit click 38–96 → about 13–35 queries (PERF-22)
- [x] **0.17** Battle state GET makes no writes: 8 → 4 queries per refetch (PERF-35)
- [x] **0.18** Batched warband rating + a gold aggregate: `/players/` at constant ≤ 6 queries (PERF-25, PERF-41)

### PR 0-D · TanStack Query foundation

**Status: complete and pushed as `chore/foundations-0d` (stacked on 0-C).** The campaign payload carries the caller's permission codes, and unchanged GETs revalidate to empty 304s. PERF-13 was scaled down to this safe part: a version-keyed server body cache would need invalidation that bulk updates and seeders bypass, so it moves to the catalogue pass. Frontend: TanStack Query 5.104.1 with a `["campaign", id, ...]` key scheme; the campaign shell no longer waits for catalogues (cold overview 20 → 14 requests, catalogues load on demand and stay cached 5 min); permissions come from the campaign payload (9 per-page fetches removed); one shared open-battles query; pull-to-refresh refetches instead of reloading (it still remounts the page so screens not yet on TanStack refresh too, which goes away as they migrate); BUG-21, BUG-22 and BUG-59 fixed with tests. Browser-verified: no catalogue requests on campaign entry, Items reuses the cached list, an overview revisit makes only the 6 overview-tab requests. After pulling, rebuild the frontend container (new dependencies).
- [x] **0.19** `QueryClient` provider, query-key conventions, `api-client` integration, devtools in dev (IMP-08, PERF-14)
- [x] **0.20** Catalogue queries shared and cached, the campaign shell no longer blocking on 5 catalogues, server ETag + cache for the catalogue (PERF-12, PERF-13)
- [x] **0.21** Campaign, membership and permissions loaded once per campaign (PERF-15)
- [x] **0.22** Pull-to-refresh invalidates queries instead of reloading the page (PERF-16)
- [x] **0.23** The api-client fixes that belong to this layer (BUG-21, BUG-22, BUG-59)

### PR 0-E · Frontend platform

**Status: complete and pushed as `chore/foundations-0e` (stacked on 0-D).** Entry bundle 2,472 kB → 321 kB (560 → 103 kB gzip), and CI now fails the build above 110 KiB gzip (`npm run size`). Every route is lazy; Lottie (and its 1.5 MB of WASM) is replaced by a CSS spinner; the dice engine and pusher load on first use. One shared realtime client with ref-counted channels sits above the signed-in routes, catches up after a reconnect, and offers navigation in a toast (sonner) instead of forcing it. Shared `getErrorMessage`, route error boundaries with Retry, and ErrorState/EmptyState. Frontend tests 173 → 235; each bug fix has a test that fails on the old code. Browser-verified: overview with no console errors; a chat message sent as Raider 2 arrived live in Raider 1's chat over one connection; the warband page renders. **After pulling, rebuild the frontend container (sonner in, Lottie out) and clear `node_modules/.vite`.** The first load after the clear shows 504 "Outdated Optimize Dep" while Vite re-optimises; reload.

Decisions on the open questions (mine; change any of them):
- The dice engine still warms up when a roller mounts, so the first roll isn't slower.
- No automatic navigation to prebattle, even when idle on Overview: the toast is enough (guide, not gatekeeper).
- The chat draft stays until the server accepts it, and dismissing an invite waits for the server. Both are intended.
- The CSP stays **report-only** until violations have been watched in production. Check the browser console on a dice roll, the landing video, chat and a warband link before enforcing; `frame-src` and `img-src` will probably need widening for user content.

Not done, moved to the passes: `wanted_poster.png` (1.6 MB, only loaded by the hidden bulletin tab) still needs converting to WebP offline; framer-motion `LazyMotion`; font preconnect; a "Reconnecting..." chip; battle-state catch-up on reconnect (BUG-19, pass 3); the `warband:updated` window bus and the Warband page's own fetch loop (pass 1: one cold warband visit fetches `summary/` 3 times and the warband list twice); the ~150-site `getErrorMessage` rollout (done per pass). Still worth a manual check: pull-to-refresh rubber-banding on a real iPhone, and the "The app was updated" Reload path after a deploy.

- [x] **0.24** Route-level code splitting; drop Lottie for a CSS spinner; lazy-load dice and framer-motion (PERF-17). Dice is lazy; framer-motion now ships only in the Warband chunk
- [x] **0.25** One realtime client with typed subscriptions; handlers patch the query cache (PERF-18, IMP-14). Handlers invalidate keys; patching from payloads comes per pass
- [x] **0.26** `getErrorMessage`, error boundaries, toasts, shared Error/Empty states (IMP-10, IMP-11)
- [x] **0.27** Remaining platform bugs: SEC-15 (report-only), BUG-19 (platform part), BUG-20 (part), BUG-23, BUG-24 (platform part), BUG-26, BUG-57, BUG-58, BUG-60, BUG-61, plus PERF-39 and PERF-43

### Designs for sign-off (written alongside, implemented in the feature passes)
- [~] **0.28** Shared unit abstraction: heroes, henchmen and hired swords, backend + frontend (IMP-24)
- [~] **0.29** One scoped-view permission pattern + capability flags in API responses (IMP-25)

The mega-store split (PERF-19, IMP-09) happens gradually: each feature pass moves its data to TanStack Query, and the store shrinks as it goes.

## Phase 1: Feature passes, one at a time

**Order:** pain × dependency. Warband is the screen you flag most, and battles build on warband units.

| Order | Feature | File | Why here |
| --- | --- | --- | --- |
| 1 | Warband roster | [features/03-warband-roster.md](features/03-warband-roster.md) | The slowest and most-used screen; it introduces the shared unit abstraction |
| 2 | Economy and trades | [features/04-warband-economy-trades.md](features/04-warband-economy-trades.md) | Same models as roster; gold and ledger correctness under concurrency |
| 3 | Battles | [features/05-battles.md](features/05-battles.md) | Slow mid-game; the largest files; depends on roster and economy |
| 4 | Campaigns | [features/02-campaigns.md](features/02-campaigns.md) | Overview performance, permissions, locations and encampments |
| 5 | Catalogue | [features/06-catalogue.md](features/06-catalogue.md) | Caching is a quick win; data-quality fixes |
| 6 | Auth and core | [features/01-auth-core.md](features/01-auth-core.md) | Small; mostly hardening |

Frontend platform ([07](features/07-frontend-platform.md)) and infrastructure ([08](features/08-infrastructure-performance.md)) findings are handled in Phase 0, plus whichever feature pass they touch.

The order may shift once all the review files are in. A P0 bug can jump the queue.

### The loop for each feature pass

1. **Brief (me → you).** A one-page summary of the feature: how it works today, its P0/P1 findings, the proposed changes, and the questions for you.
2. **Your changes (you → me).** Add new functionality or tweaks to the feature's **"Planned changes"** section (template below). This is the moment to reshape the feature, since the code is being reworked anyway.
3. **Lock behaviour.** Write characterisation tests for the behaviour we're keeping, plus query-count baselines. These make the refactor safe.
4. **Fix.** P0/P1 bugs and performance, each with a regression test. → **PR A**
5. **Refactor to the rules.** Split long files, de-duplicate, apply the data-layer pattern. No behaviour change. → **PR B**
6. **Build your changes.** New and tweaked functionality. → **PR C**
7. **Verify.** Tests, lint and typecheck; query counts before and after; the feature's manual QA script run in the browser (desktop and mobile).
8. **Close out.** Mark findings fixed in the feature file, update the status table, note follow-ups.

Separate PRs keep each one reviewable, and a refactor that changes behaviour is easy to spot. Small features can merge PR A and PR B if the diff stays readable.

### "Planned changes" template (added to each feature file)

```md
## Planned changes

| ID | Type | Change | Notes / acceptance | Status |
| --- | --- | --- | --- | --- |
| ROST-NEW-01 | New | e.g. duplicate a hero | copies stats/items, charges recruit cost | Proposed |
| ROST-TWEAK-01 | Tweak | e.g. Create hero shouldn't charge gold until Save | gold deducted on Save only | Agreed |
```

Types: **New** (new functionality), **Tweak** (change to existing behaviour), **Remove** (drop or hide something).

## Status

| Pass | Brief | Your changes | Tests locked | Fix PR | Refactor PR | Feature PR | Done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Foundations | — | — | — | 0-A | 0-B to 0-E | — | **Merged to main and deployed 2026-10-17** (`7cc3831`); design 0.28 built in pass 1, 0.29 in part (`WarbandScopedView`, `capabilities`) |
| 1 Warband roster | [Done](briefs/pass-1-warband-roster.md) | Answered 2026-10-17 | 119 backend + 527 frontend tests | PR A done incl. part 2 | Done | Done | **Merged to main and deployed 2026-10-17** (`7cc3831`) |
| 2 Economy and trades | [Done](briefs/pass-2-economy-trades.md) | Answered 2026-10-17 | 90 backend + 89 frontend tests | Done | Done | Done | 2026-10-18 |
| 3 Battles | [Done](briefs/pass-3-battles.md) | Answered 2026-10-18 | 80 backend (2 expected failures) + 26 frontend tests (`pass3/battles`) | Done | Done | Done | 2026-10-20 |
| 4 Campaigns | [Done](briefs/pass-4-campaigns.md) | Answered 2026-10-18 | 79 backend (3 expected failures) + 53 frontend tests | Done | Done | Done | **Merged to main and deployed 2026-10-20** (`3d0cf09`) |
| 5 Catalogue | [Done](briefs/pass-5-catalogue.md) | Answered 2026-10-19 | 114 backend (4 expected failures) + 108 frontend tests | Done | Done | Done (CAT-NEW-01 replaced by the bestiary rewrite) | **Merged to main and deployed 2026-10-23** (`02dd927f`) |
| 6 Auth and core | [Done](briefs/pass-6-auth-core.md) | Answered 2026-10-19 | 98 backend (6 expected failures) + 75 frontend tests | Done | Done | Done (`pass6/pr-c`, 2026-10-28) | PR A and B **merged to main and deployed 2026-10-23** (`02dd927f`); PR C built on `pass6/pr-c`, waiting for its two-player browser check |

## After the passes

Work William has asked for since passes 5 and 6 (PR A and B) were deployed.

- **The bestiary rewrite: merged to main and deployed 2026-10-28,** with fresh migrations (the production schema was wiped first). The plan is `docs/review/plans/bestiary-hirelings.html`. It replaced pass 5's CAT-NEW-01 (bestiary and hired-sword edit panels). Pass 6's PR C is built on `pass6/pr-c` (its browser check is next); grading (`plans/grades-settings-warbands.html`) follows. Left from its final two-player check:
  - **A question for William:** on the warband page, a group where only some members ride shows the mount's M and save, while the battle screens show foot stats.
  - **Creature group members** are named "Henchman 6", "Henchman 7" in battle.
  - **At 1280 px:** the Bestiary cards' stat lines scroll sideways, the header tab strips show scrollbars, and two forms clip.
  - **The dramatis persona card** prints its name twice.
  - **The postbattle section picker** has no accessible name.
  - **Realtime gaps:** only beast writes send `warband.changed`. Purchases, renames, roster saves, XP, transfers and sales don't yet.
  - **Unchecked:** the Skills and Spells pages may list one row fewer than the database.
- **An easier email sender (asked 2026-10-20).** Production sends no email today: `RESEND_API_KEY` isn't set, and Resend only delivers to other people's addresses once a domain is verified, which is why email verification waits for a custom domain. Compare low-effort senders on these points:
  - Can it send to any address without a domain we own (e.g. a verified single sender, or SMTP through a free mailbox)?
  - Free-tier limits.
  - Deliverability and spam-folder risk.
  - How it plugs in: everything goes through `_queue_email` and `_post_to_resend` in `apps/users/emails.py` (password reset, feedback report), and `email_configured()` is the one switch (pass 6 PR B), so a swap is one function plus settings.
  - Whether it still suits a custom domain later.

  Bring a recommendation; pass 6's BUG-56 (503 `email_unavailable` when no sender is configured) works with any provider.

  **Researched 2026-10-26 (awaiting William's choice):**
  - **With a domain (best):** a cheap domain (about $5 a year for .uk at Cloudflare Registrar) plus Resend's free tier, with no code change.
  - **With no domain:** Gmail SMTP with an app password, after `emails.py` moves to `django.core.mail`; `django-anymail` then makes the provider a settings choice. Render blocks SMTP only on free web services.
  - **Either way:** the settings guard should also reject `resend.dev` From addresses.
