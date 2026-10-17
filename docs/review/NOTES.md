# Review Notes

Working notes: architecture, environment, live-run observations and open questions. Findings belong in the feature files; this file holds context.

## Architecture at a glance

- **Backend:** Django 5.0.3 + DRF 3.15, SimpleJWT (1-day access, 30-day refresh), psycopg 3, Postgres 16 locally and Neon (eu-west-2) in production. Dependencies are managed with uv.
- **Frontend:** React 18 + Vite 5 + TypeScript, Tailwind 3 + shadcn (Radix), framer-motion, `@3d-dice/dice-box`, dotlottie, pusher-js. Deployed to Vercel as an SPA (`vercel.json` rewrite).
- **Realtime:** Pusher private channels: `campaign-{id}-pings`, `campaign-{id}-chat`, `user-{id}-notifications`, `trade-{uuid}`, `battle-{id}`.
- **Email:** Resend HTTP API (password reset and feedback reports).
- **Local dev:** `docker compose up` brings up db :5432, backend :8000, frontend :5173 and pgweb :8081.
- **Size:** about 163 backend Python modules (excluding migrations) and 405 frontend TS/TSX files (about 74k lines including tests).

### Largest files (refactor candidates)

| Lines | File |
| --- | --- |
| 1968 | `backend/apps/battles/views/shared.py` |
| 1799 | `frontend/src/features/battles/routes/BattlePostbattle.tsx` |
| 1277 | `backend/apps/campaigns/views.py` |
| 1182 | `frontend/src/features/battles/routes/BattleActive.tsx` |
| 1173 | `frontend/src/features/battles/routes/BattlePrebattle.tsx` |
| 1070 | `frontend/src/features/warbands/routes/Warband.tsx` |
| 1033 | `backend/apps/battles/views/lifecycle.py` |
| 964 | `frontend/src/features/items/hooks/useAcquireItemDialogShared.tsx` |
| 908 | `frontend/src/features/items/routes/Items.tsx` |
| 887 | `frontend/src/features/items/components/ItemFormDialog.tsx` |
| 852 | `frontend/src/features/battles/components/postbattle/postbattle-utils.ts` |
| 730 | `backend/apps/trades/views.py` |
| 724 | `frontend/src/features/campaigns/routes/CampaignLayout.tsx` |
| 723 | `backend/apps/warbands/views/warbands.py` |

## Early infrastructure red flags (spotted before the deep-dive)

These are detailed and measured in `features/08-infrastructure-performance.md`.

1. **The production image runs Django's dev server.** `backend/Dockerfile` has `CMD ["/app/entrypoint.sh"]`, and `entrypoint.sh` ends with `exec python manage.py runserver 0.0.0.0:8000`. `gunicorn==25.0.1` is a dependency but is never invoked. Unless Render's start command overrides this, production serves every request through `runserver`.
2. **No persistent DB connections.** `settings.py:94` calls `dj_database_url.config(default=...)` without `conn_max_age`, so each request opens a fresh TLS connection to Neon.
3. **`DEBUG` defaults to on.** `settings.py:28` defaults `DJANGO_DEBUG` to `"1"`. If it isn't explicitly set to `0` on Render, production records every SQL query in memory per request and serves debug error pages.
4. **LocMem cache.** Throttling state is per process, so it isn't shared across workers once gunicorn is used.
5. **Migrations on every boot.** `entrypoint.sh` runs `migrate --noinput` on each container start, which adds to cold-start time (relevant if Render spins the service down).

## Live-run observations (2026-10-16, local Docker)

**Setup**
- Registered the local test account `claude-tester@example.test`, joined the "Shards" campaign (join code `0KP35E`), and created the warband "Claude Test Crows" with one hero.

**What worked**
- Registration, campaign join, overview (roster, battle history, critical events, trades), warband sheet, treasury ledger, logs with filters, and the skills, wargear, bestiary, hired swords, rules and house rules pages.
- Creating a warband: starting gold 531 gc.
- Creating a hero: race sets the stat caps, recruit cost is deducted (531 → 471) and the rating updates (0 → 5).

**Observed issues** (now tracked in the feature files)
- A stale active battle (#40, active since 2026-04-22) leaves both warbands showing "In Active Battle". Nothing expires abandoned battles.
- On someone else's warband, the compact hero card's **Trade** badge is clickable for non-owners: `HeroCardHeader.tsx` has no `canEdit` check, while `HeroExpandedCard` has one. The backend returns 403, so the click fails silently or with an error.
- Wargear shows Axe at 25 gc, but the treasury log records "Axe (5 gc)" for a recruit. This needs checking: it could be a catalogue price, a house-rule repricing, or a display problem.
- "Add skill" and "Add item" are visible to a plain player. Check whether they are gated server-side only.

**Not testable in this session**
- The 3D dice and the overlay menus (chat, notifications). The browser pane was hidden, so `requestAnimationFrame` never fired. This is a harness limitation, not an app bug.

## Production environment (confirmed by William, 2026-10-16)

| Question | Answer |
| --- | --- |
| Render plan | **Starter** (0.5 CPU, 512 MB, always on). Free was "really slow"; Starter "works but still slow" |
| Render region | **Frankfurt (EU Central)** |
| Neon region | eu-west-2 (London) |
| Cold starts | Shouldn't happen: UptimeRobot pings the service, and Starter doesn't spin down anyway |
| Slowest areas | **Everything, especially the warband sheet**, plus battle pages mid-game and the campaign overview |
| Runtime | **Native Python** (`PYTHON_VERSION=3.12.7`, uv). The Dockerfile is used only for local dev |
| Start command | `uv run python manage.py migrate --noinput && uv run gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` |
| Env vars set (names only) | `CORS_ALLOWED_ORIGINS` (`https://mordheim-eight.vercel.app`), `DATABASE_URL` (**Neon `-pooler` endpoint**, `sslmode=require&channel_binding=require`), `DJANGO_ALLOWED_HOSTS` (`mordheim-1.onrender.com`), `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY`, `DJANGO_SETTINGS_MODULE`, `PUSHER_APP_ID` / `KEY` / `SECRET` / `CLUSTER`, `PYTHON_VERSION` |
| Env vars **not** set | `WEB_CONCURRENCY`, `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL`, `FEEDBACK_REPORT_TO_EMAIL`, `FRONTEND_URL`, `RATE_LIMIT_NUM_PROXIES` |

What this means:

- **Production runs gunicorn with its defaults: one sync worker.** That serves one request at a time, not `runserver` as the review first assumed. gunicorn defaults to `workers=1`, sync worker class and no threads unless `WEB_CONCURRENCY` or flags say otherwise; neither is set. Every request from every user queues behind the one in flight, and each request spends most of its time waiting on Frankfurt → London round trips. A cold campaign overview (18 requests, ~249 queries) occupies the only worker for seconds, and a second player's requests wait behind it. **This is almost certainly the main reason the app "slows down massively" with several users.** To verify, count the `Booting worker with pid` lines in the Render deploy log: one line means one worker.
- **`DATABASE_URL` already uses Neon's pooler** (PgBouncer, transaction mode). Persistent Django connections (`conn_max_age`) are still worth it, because the client → pooler TLS handshake is the expensive part. With transaction pooling, set `DISABLE_SERVER_SIDE_CURSORS = True`. Django 5 + psycopg 3 uses client-side parameter binding by default, which is compatible.
- **`DEBUG=0` and `DJANGO_SECRET_KEY` are set,** so SEC-01 and SEC-02 are not live P0s in production. The startup guards are still worth adding. The secret values were shared in the review chat on 2026-10-16, so the Neon password, `SECRET_KEY` and Pusher secret should be rotated.
- **Email is not configured in production.** `RESEND_API_KEY` is unset, so password-reset emails are silently skipped and feedback reports fail (BUG-56 confirmed). `FRONTEND_URL` is also unset, so reset links would point at localhost even with a key.
- **Throttles key on the raw `X-Forwarded-For`,** because `RATE_LIMIT_NUM_PROXIES` is unset (SEC-04).
- **Local dev and the test suite publish to the production Pusher app.** `backend/.env` and `frontend/.env` hold the same app ID and key as Render. Local events go to the same channel names production uses (`private-campaign-1-chat`, `private-battle-1`, ...). Local and tests should use a separate free Pusher app, or soketi, or have Pusher off.
- **Every SQL query crosses Frankfurt ↔ London.** Typical RTT is about 12–20 ms, so query count per request translates directly into latency. An endpoint doing 100 queries costs about 1.5–2 s of pure network wait before any Python runs.
- **New connections cost several RTTs.** Without `conn_max_age`, every request also pays for a TCP + TLS + Postgres auth handshake: roughly 3–5 RTT, about 60–100 ms, and more if the Neon compute has idled.
- **0.5 CPU is small.** With `runserver` (one process, a thread per request, the GIL) or a badly sized gunicorn, concurrent users queue behind each other's slow, I/O-bound requests.
- **The warband sheet is the main target.** It is the screen William flags most, so its query count is the first thing to cut (see `features/03-warband-roster.md` and `features/08-infrastructure-performance.md`).

## Baseline: tests, lint, typecheck (2026-10-16)

| Check | Result |
| --- | --- |
| Backend tests (`manage.py test`, in container) | **138 passed**, 0 failed (33 s) |
| Frontend tests (`vitest run`, in container) | **149 passed, 3 failed** (152 tests, 53 files) |
| Backend `ruff check` | **34 errors**: 24 unsorted imports, 6 UP017, 2 DJ012, 1 B905, 1 unused import; 31 auto-fixable |
| Backend `ruff format --check` | **54 files** would be reformatted (204 already formatted) |
| Backend `mypy` | **51 errors in 15 files** |
| Frontend `tsc --noEmit` | **98 errors**, 79 of them in non-test files. The frontend has no `lint` or `typecheck` npm scripts, and Vite doesn't typecheck on build |

The backend CLAUDE.md says ruff, ruff format and mypy must pass before every commit. They currently don't, and nothing enforces it: there's no CI and no pre-commit hook.

Notable mypy errors:
- `apps/warbands/views/warbands.py:94-133`: models typed as `object`, which suggests a dynamic model-lookup helper with no typing.
- `apps/warbands/views/henchmen.py:36`: returns `Decimal | int` where `int` is declared. XP is a decimal field, so it's worth checking whether half-rate XP truncates.
- `apps/warbands/views/kill_history.py:28,45`: `int(None)` is possible if a query parameter is missing.

Frontend `tsc` error mix:
- 23 × TS2345 and 20 × TS2322 (type mismatches)
- 18 × TS6133 (unused variables, e.g. `onSaveOverride` declared but never used in `ActiveUnitCard.tsx:61` and `ActiveHenchmenGroupCard.tsx:61`)
- 8 × TS18047 "possibly null" in `postbattle-utils.ts:366-385` (`sum`/`total` may be null in the exploration dice maths)

The full output is in the session scratchpad and can be regenerated with `docker exec mordheim-frontend-1 npx tsc --noEmit`.

The frontend failures are test drift, not app crashes:

1. `src/layouts/mobile/__tests__/MobileLayout.test.tsx`: "reloads when pulled down from the top past the refresh threshold". The test expects "Release to refresh", but the indicator stays at "Pull to refresh" under jsdom. The gesture simulation and the threshold logic have diverged.
2. and 3. `RaritySection.test.tsx` "shows spent heroes and preserves the stored roll display" fails **twice**, because the same test exists both in `AcquireItemDialog/RaritySection.test.tsx` and `AcquireItemDialog/__tests__/RaritySection.test.tsx`. The component now renders "Spent Hero" and " (spent)" as separate text nodes, so `getByText("Spent Hero")` no longer matches.

## Open questions for William

1. Does the frontend on Vercel call the Render URL directly (`VITE_API_BASE_URL`)?
2. Do local dev and production share the same Pusher app? The local `frontend/.env` has real Pusher keys.
3. Roughly how many people are on at once when it gets slow? (2–3 for a battle? 6 for a campaign night?)
