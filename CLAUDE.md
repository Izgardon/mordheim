# Mordheim Project

Mordheim Chronicler: a campaign manager for the Mordheim tabletop game. Django + DRF backend (`backend/`), React + Vite + TypeScript frontend (`frontend/`).

**Production:** backend on Render (Starter, Frankfurt), Postgres on Neon (eu-west-2, London), frontend on Vercel. Every SQL query crosses Frankfurt ↔ London, so **query count is latency**.

## Product principles (from William)

- **A guide, not a gatekeeper.** The tabletop rules and house rules change all the time, so the app warns ("above race maximum", "warband over size") and lets the player continue. Add a hard block only where William has asked for one (today: the hero and hired-sword caps when adding new units directly). When unsure, warn and allow, and ask before blocking.
- **Soft delete** records (dead and dismissed units, etc.) rather than deleting rows.
- **Don't preserve old-campaign quirks** when a rule changes, unless William says otherwise.
- **Lossy actions say so plainly** (e.g. "all carried items are lost; move them to the stash first").

## Engineering rules (must follow)

The full rules and the definition of done are in **`docs/ENGINEERING_RULES.md`**. Read it before changing code. The review findings and the improvement plan are in `docs/review/` (start with `docs/review/PLAN.md`). The non-negotiables:

- **The server owns business rules** (costs, XP thresholds, level-ups, permissions, battle outcomes). The frontend displays them and never re-implements them.
- **Query budgets.** Every list or detail endpoint uses `select_related` / `prefetch_related`, runs no queries in loops, and has an `assertNumQueries` test. The query count must not grow with row count.
- **Thin views, logic in services** (`apps/<app>/services/`). Serializers don't run un-prefetched queries.
- **Gold, stock and XP change atomically** (`F()` or `select_for_update` inside `transaction.atomic`). Every gold change writes its ledger row in the same transaction. One-shot actions (finalise battle, complete trade, level-up) are idempotent.
- **Permissions are enforced server-side on every endpoint.** The API returns capability flags (`can_edit`, ...) and the UI never shows an action the server will reject.
- **Never block a response on Pusher or Resend.** Dispatch on commit, in the background, with short timeouts. Realtime events carry the change, not a "refetch everything" ping.
- **Heroes, henchmen and hired swords share code.** Express their differences as configuration, never copy-paste. Backend: `apps/warbands/units/` (registry `kinds.py`, behaviour differences in `hooks.py`, shared `services/`, generic views on `WarbandScopedView`); visible units go through `on_roster()` / `kind.visible()` only. Frontend: `features/warbands/units/unit-kinds.ts` + editor configs, `components/units/` with per-kind slots, and one `sheet/` query (`useWarbandSheet`) gated by its `capabilities`.
- **Frontend server state uses TanStack Query.** No ad-hoc `fetch` in `useEffect`, no server data copied into global context, and mutations invalidate only the affected query keys. Global context holds only small, rarely-changing app state.
- **Size limits:** backend files ≤ 400 lines and functions ≤ 60; frontend route files and components ≤ 250 lines. Split anything bigger by concern.
- **Every bug fix ships with a test that fails before the fix.** Frontend tests sit next to the code (no duplicate `__tests__/` copies).
- **Refactors and behaviour changes never share a PR.**
- **Green on every commit:** backend tests + ruff + ruff format + mypy; frontend `vitest run` + `tsc --noEmit`.

## Current gotchas

- Backend tests run through `config.test_runner.NoNetworkTestRunner`. It blanks the Resend and Pusher credentials and raises `ExternalNetworkCallError` on any non-loopback connection, so mock external services in tests; never re-enable them.
- Local realtime runs through **soketi** (a Pusher-compatible server in `docker-compose.yml`, port 6001). Compose overrides the `PUSHER_*` / `VITE_PUSHER_*` values from the `.env` files, which still hold production Pusher credentials, so never run the backend or Vite outside compose with those `.env` values.
- Vite doesn't typecheck on build; `npm run typecheck` (and CI) does.
- **Data is disposable during the review** (William, 2026-10-18): local and production databases may be wiped and reseeded with `manage.py seed_all`, so don't write backfills or data repairs. Every migration must still run on an empty database. A wiped production database reseeds itself: gunicorn's `when_ready` hook starts `manage.py seed_catalogue_if_empty` in the background, which runs `seed_all` until the bestiary (seeded last) exists.
- **Gold and stash changes go through the services**: `apps/warbands/services/ledger.py` (`record`, which writes the signed row and moves the stored `Warband.gold`; `manage.py check_gold` compares the two) and `apps/warbands/services/stash.py`. Purchases are one `POST warbands/<id>/purchases/`; warnings (overspend, a spent trading action, a failed rarity roll) are returned, never refused.
- **Campaign access goes through `CampaignScopedView` and `apps/campaigns/access.py`** (one named rule per endpoint, deny by default). The campaign detail's `capabilities` are what the UI gates on: frontend campaign screens read `features/campaigns/capabilities.ts`, and a lint rule makes a `campaign.role` check an error. An **archived campaign is read-only everywhere** (campaign routes, warbands, battles, trades, the custom catalogue, joining): writes answer 403 `campaign_archived` unless the view lists the method in `allow_archived`. Campaign-wide changes ride `private-campaign-{id}-events` (`campaign.updated`); changes for one member go to their `private-user-{id}-notifications` channel.
- **The catalogue framework is `apps/core/catalogue/`**: the kinds registry (`kinds.py`), the generic views and one write path, versions and Revert (a campaign's version replaces a book entry through `replaces`, never the name; find the current entry with `current.py`, move copies with `remap.py`), archive and removal (`archive.py`) and the badge fields. Lists are cached per kind, campaign, catalogue version and query, so **any code that writes catalogue rows must call `core.catalogue.cache.bump`** (it also sends `catalogue.changed`). The list cache is off in tests unless a test turns it on (`catalogue_cache_on()`).
- **Production startup guards** (`DJANGO_DEBUG` off): `DJANGO_SECRET_KEY` must be 50+ characters; `RATE_LIMIT_NUM_PROXIES` defaults to 1 (Render's proxy) with a warning, and a value that isn't a whole number stops startup; with `RESEND_API_KEY` set, `FRONTEND_URL` (https) and `DEFAULT_FROM_EMAIL` must be real. `manage.py` hides these messages behind `AppRegistryNotReady`; gunicorn shows them.
- **Sessions:** every token carries the user's session key (`UserAccount.session_key`, claim `sk`). A reset, a password change or sign-out-others sets a new one, and old tokens get 401 `session_ended`. **A 401 only ever means "not authenticated"** (a wrong current password is a 400), because the frontend signs out on a 401 after a refresh. Frontend: `lib/session.ts` owns the tokens and the cached user; nothing else writes them.

## Frontend (React + Vite)

Working directory: `frontend/`. Dependencies are managed with npm. Locally it runs in Docker (`docker compose up`).

```bash
npm run test:run       # tests (vitest)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint; exhaustive-deps warnings are capped, new ones fail
npm run format         # prettier --write src (format:check in CI)
```

In Docker: `docker exec mordheim-frontend-1 npm run <script>`. CI (`.github/workflows/ci.yml`) runs all of these, plus the backend's ruff, ruff format, mypy, migration check and coverage-instrumented tests. Formatting-only commits are listed in `.git-blame-ignore-revs`.

## Backend (Django REST API)

Working directory: `backend/`

### Dependencies

Managed with **uv** via `pyproject.toml`. No requirements.txt.

```bash
cd backend
uv sync --all-extras  # install all deps including dev tools
```

### Linting & Formatting

Uses **ruff** (config in `pyproject.toml`). Line length: 120.

```bash
uv run ruff check .        # lint
uv run ruff check --fix .  # lint with auto-fix
uv run ruff format .       # format
```

### Type Checking

Uses **mypy** with django-stubs (config in `pyproject.toml`). Requires `DJANGO_SETTINGS_MODULE` env var.

```bash
DJANGO_SETTINGS_MODULE=config.settings uv run mypy . --config-file pyproject.toml
```

### Pre-commit Requirements

Before committing backend changes, you MUST:

1. Run `uv run ruff check .` and ensure zero errors
2. Run `uv run ruff format --check .` and ensure all files are formatted
3. Run `DJANGO_SETTINGS_MODULE=config.settings uv run mypy . --config-file pyproject.toml` and ensure zero errors

Do not commit code that fails any of these checks.
