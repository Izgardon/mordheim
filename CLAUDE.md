# Mordheim Project

Mordheim Chronicler: a campaign manager for the Mordheim tabletop game. Django + DRF backend (`backend/`), React + Vite + TypeScript frontend (`frontend/`).

**Production:** backend on Render (Starter, Frankfurt), Postgres on Neon (eu-west-2, London), frontend on Vercel. Every SQL query crosses Frankfurt ↔ London, so **query count is latency**.

## Product principles (from William)

- **A guide, not a gatekeeper.** The tabletop rules and house rules change all the time, so the app warns ("above race maximum", "warband over size") and lets the player continue. Add a hard block only where William has asked for one (today: the hero and hired-sword caps when adding new units directly). When unsure, warn and allow, and ask before blocking.
- **Soft delete** records (dead and dismissed units, etc.) rather than deleting rows.
- **Don't preserve old-campaign quirks** when a rule changes, unless William says otherwise.
- **Lossy actions say so plainly** (e.g. "all carried items are lost; move them to the stash first").
- **No fluff text** (William, 1 Nov 2026). Don't add helper sentences that explain what the page already shows or how a control works ("The rest stay listed, greyed out", "every setting at or below it"). A line earns its place only if the player would otherwise get something wrong: a warning, a lossy action, a number they need. When in doubt, leave it out.

## Engineering rules (must follow)

The full rules and the definition of done are in **`docs/ENGINEERING_RULES.md`**. Read it before changing code. The review findings and the improvement plan are in `docs/review/` (start with `docs/review/PLAN.md`). The non-negotiables:

- **The server owns business rules** (costs, XP thresholds, level-ups, permissions, battle outcomes). The frontend displays them and never re-implements them.
- **Query budgets.** Every list or detail endpoint uses `select_related` / `prefetch_related`, runs no queries in loops, and has an `assertNumQueries` test. The query count must not grow with row count.
- **Thin views, logic in services** (`apps/<app>/services/`). Serializers don't run un-prefetched queries.
- **Gold, stock and XP change atomically** (`F()` or `select_for_update` inside `transaction.atomic`). Every gold change writes its ledger row in the same transaction. One-shot actions (finalise battle, complete trade, level-up) are idempotent.
- **Permissions are enforced server-side on every endpoint.** The API returns capability flags (`can_edit`, ...) and the UI never shows an action the server will reject.
- **Never block a response on Pusher or Resend.** Dispatch on commit, in the background, with short timeouts. Realtime events carry the change, not a "refetch everything" ping.
- **Heroes, henchmen and hired swords share code.** Express their differences as configuration, never copy-paste. Backend: `apps/warbands/units/` (registry `kinds.py`, behaviour differences in `hooks.py`, shared `services/`, generic views on `WarbandScopedView`); visible units go through `on_roster()` / `kind.visible()` only. Frontend: one card for every kind (`features/warbands/components/roster/UnitCard`, its kind read from `unit-view.ts`), the unit API in `features/warbands/units/`, and one sheet query (`useWarbandSheet`) gated by its `capabilities`.
- **Frontend server state uses TanStack Query.** No ad-hoc `fetch` in `useEffect`, no server data copied into global context, and mutations invalidate only the affected query keys. Global context holds only small, rarely-changing app state.
- **Size limits:** backend files ≤ 400 lines and functions ≤ 60; frontend route files and components ≤ 250 lines. Split anything bigger by concern.
- **Every bug fix ships with a test that fails before the fix.** Frontend tests sit next to the code (no duplicate `__tests__/` copies).
- **Refactors and behaviour changes never share a PR.**
- **Green on every commit:** backend tests + ruff + ruff format + mypy; frontend `vitest run` + `tsc --noEmit`.

## Current gotchas

- Backend tests run through `config.test_runner.NoNetworkTestRunner`. It blanks the Resend and Pusher credentials and raises `ExternalNetworkCallError` on any non-loopback connection, so mock external services in tests; never re-enable them.
- Local realtime runs through **soketi** (a Pusher-compatible server in `docker-compose.yml`, port 6001). Compose overrides the `PUSHER_*` / `VITE_PUSHER_*` values from the `.env` files, which still hold production Pusher credentials, so never run the backend or Vite outside compose with those `.env` values.
- Vite doesn't typecheck on build; `npm run typecheck` (and CI) does.
- **Data is disposable during the review** (William, 2026-10-18): local and production databases may be wiped and reseeded with `manage.py seed_all`, so don't write backfills or data repairs. Every migration must still run on an empty database. A wiped production database reseeds itself: gunicorn's `when_ready` hook starts `manage.py seed_catalogue_if_empty` in the background, which runs `seed_all` until a book hired sword (seeded last) exists.
- **Migrations were reset to a fresh `0001` per app in the bestiary rewrite** (150 files became 21; battles, bestiary and campaigns split into `0001` + `0002` over foreign-key cycles). A database migrated before the reset must be wiped (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` plus the grants) before it migrates again, because its `django_migrations` rows clash with the new names. Three hand-written migrations hold what an empty database still needs: `campaigns/0003_seed_roles_and_permissions` (a frozen copy of `campaigns/constants.py`; a new code needs a new data migration), `core/0002_catalogue_version_row` and `battles/0003_battle_event_kill_killer_index` (raw SQL the models don't declare).
- **Gold and stash changes go through the services**: `apps/warbands/services/ledger.py` (`record`, which writes the signed row and moves the stored `Warband.gold`; `manage.py check_gold` compares the two) and `apps/warbands/services/stash.py`. Purchases are one `POST warbands/<id>/purchases/`; warnings (overspend, a spent trading action, a failed rarity roll) are returned, never refused.
- **Campaign access goes through `CampaignScopedView` and `apps/campaigns/access.py`** (one named rule per endpoint, deny by default). The campaign detail's `capabilities` are what the UI gates on: frontend campaign screens read `features/campaigns/capabilities.ts`, and a lint rule makes a `campaign.role` check an error. An **archived campaign is read-only everywhere** (campaign routes, warbands, battles, trades, the custom catalogue, joining): writes answer 403 `campaign_archived` unless the view lists the method in `allow_archived`. Campaign-wide changes ride `private-campaign-{id}-events` (`campaign.updated`; `warband.changed {warband_id}`, sent after commit by every `WarbandScopedView` write that succeeds (`announce_change()`, once per request), by finalise, an approved reported result and a completed trade, and skipping the writer's socket (every warband write sends `X-Pusher-Socket-Id`), makes other members' open pages of that warband read it again); changes for one member go to their `private-user-{id}-notifications` channel.
- **The catalogue framework is `apps/core/catalogue/`**: the kinds registry (`kinds.py`), the generic views and one write path, versions and Revert (a campaign's version replaces a book entry through `replaces`, never the name; find the current entry with `current.py`, move copies with `remap.py`), archive and removal (`archive.py`) and the badge fields. Lists are cached per kind, campaign, catalogue version and query, so **any code that writes catalogue rows must call `core.catalogue.cache.bump`** (it also sends `catalogue.changed`). The list cache is off in tests unless a test turns it on (`catalogue_cache_on()`).
- **Settings and grades (grading phase 1)**: only settings carry a grade (`CampaignType`: `grade`, `sort_order`, `always_on`; Mordheim is split into Mordheim 1a, 1b, 1c, 2a and Grade 3). A campaign stores the settings it ticked (`Campaign.campaign_types`); picking a grade is a preset. `apps/campaigns/in_play.py` holds the visibility rule: an entry is in play when its setting is ticked or always on, or it has none (custom entries; rows not graded yet count as Mordheim's). Catalogue lists read for a campaign carry `setting_id` and `in_play`. The reference pages and Search everything list only what is in play (William, 1 Nov 2026: `features/reference/in-play.ts`; their Setting filter offers Mordheim 1a to 2a as one "Mordheim"); the store, the hire picker, the level-up pickers and the warband type picker grey the rest with a warning. A warband has a `warband_type` (and `counts_as`); warband types and groups live in `apps/warbands/models/types.py`. `seed_settings`, `seed_warband_types` and the item, skill and hired-sword seeders read `backend/catalogue_import/out/` in place (rebuild it with `python -I catalogue_import/build.py`).
- **Items and who can buy, hire and learn (the items rebuild)**: an item's rules are `ItemRuleLink` rows (a shared `ItemRule` by slug, worded the item's own way only where it differs, or a rule of its own) with D6 tables as `{columns, rows}`, placed in the text by `{{table:N}}`; its prices are `ItemAvailability` rows (cost, dice and multiplier, cost note, label, rarity with null as Common, a note shown when buying). Who may buy a price row, hire a hired sword or dramatis persona, or learn a special skill is `for_everyone` plus lines naming warband types or groups, each included or excluded (`WarbandAccess`). **The server decides what a warband sees** (`apps/warbands/services/who_can.py`, `GET warbands/<id>/who-can/`): a line naming its type or a type it counts as, then one naming its group, then everyone unless an exclusion names it, else "Not usually available" (a warning, never a block); a setting not ticked reads the same, and a campaign's own entry is always in play. The pages show it and never re-derive it. A purchase sends the chosen row (and a dice row's roll); the owned copy keeps what was paid. `seed_items` upserts by name and variant and archives a book item the import drops.
- **Henchmen loadouts**: a henchmen group's item rows (`HenchmenGroupItem`) are what every member carries, one copy each, and a `HenchmanItemGap` (member, row, reason `short`/`lost`/`used`/`kit_taken`, `left`) records a member who lacks one; a row's copies are its living members less those gaps. `apps/warbands/services/loadouts.py` holds the rule: a group takes copies as one row (a purchase buys one for each living member; copies moved in arm the oldest members and gap the rest) and gives up a whole row (moves, sales), and `units/services/members.py` does a member's part (a recruit's kit from the stash or without, a dismissed member's share to the stash or with him, "Take his kit", filling or leaving a gap: `gaps/<gap>/`, `members/<member>/take-kit/`). Nothing matches copies to members by row order any more: in battle each member carries the rows he has no gap on (and rides the group's mount only then), a dead member deletes nothing, a lost horse or used item is a gap, and a member whose kit was taken is left out of prebattle at first (`outReason`). Rating and the warband's mounts count a ridden row once per carrier. The dramatis personae come from the catalogue import too (`catalogue_import/personae.py` → `out/dramatis-personae.json`, which `seed_dramatis_personae` reads).
- **Fees and skill lists**: a hired sword's, dramatis persona's and warband hireling's `hire_fee` and `upkeep_fee` are each one JSON fee (`apps/hirelings/fees.py`: `kind` gold, replaces_hero, special or none; `gold`; `dice` and `dice_multiplier`; `{resource, amount}` lines; a `note`), read from mordheimer by `catalogue_import/fees.py`. A hire (`hirelings/hire/`, also `source: custom`) pays what it sends: the gold, else the fee's gold plus the dice roll; each resource line from the counter it names, else from the counter of its name (`match_counter`, with the aliases in `RESOURCE_NAMES`), never below 0 (`units/services/fee_payments.py`), noted on the Hire ledger row. A fee in his rules warns; one in a hero's place is free, counts towards the heroes' cap (`CapSpec.others`, the summary's `hero_count`) and not the hired swords', and may let a hero go (`dismiss_hero_id`). Upkeep is suggested from the fee (none: no camp row); the draft's entry keeps its `resources` (`resource_id` null: not paid; left out: the counter of its name) and Ready pays them (`postbattle/rewards.py: upkeep_charge`). A Skill, Spell or Special advance raises a hero's or hired sword's `pending_skills` (`pending_spells`, `pending_specials`), picked later from the card with the unit's PATCH. A skill may be `large_only` (the pages warn for any other unit) and carry a `learn_note`; William's skill list decisions live in `overrides.json` (`skill_lists`, `drop_skills`, `extra_skills`, `skill_descriptions`: `catalogue_import/skill_lists.py`), and `seed_skills` reads the import's `out/skills.json`.
- **Bounties** (`apps/bounties/`, under `campaigns/<id>/bounties/`): a player puts gold on another warband's hero. A `Bounty` is soft (nothing is held: posting warns when the poster's open bounties come to more than he holds) and its target is SET_NULL with the hero's name and warband saved, so it stays open when he dies or leaves. A `BountyClaim` names the claimant's unit (keys like battle_kill's killer), optionally a kill and a battle (`candidates.py` suggests his live kills and out-of-actions of the target since the bounty was posted) and accepts the claimant's part; the poster's accept pays it (`services/payment.py`: both warbands locked lowest id first, `Bounty` ledger rows on both, below 0 with a warning) and closes the other claims, or he declines, and the claimant can take it back. Only the poster withdraws. The poster's `bounty_claim` notification waits in the bell (`answerable`); every write sends `bounty.changed` (the bounty) on the campaign's events channel and `bounty_claim*` to the parties' own channels. A paid claim tied to a battle writes a `bounty_claimed` pivotal moment, which `regenerate_pivotal_moments` keeps; the chronicle's `bounty` kind reads the table.
- **Battle numbers, rounds and notes**: a battle's `number` (`apps/battles/services/numbering.py`, William: "greatest games played between the players") is the most games any of its warbands has played, this one included (started normal battles not cancelled, approved reported results, no player who declined or left); set when the battle is made and for good at the start (a reported result: its last approval), and migration `battles/0008` numbered the old ones. Pages show "Battle N" through `features/battles/utils/battle-number.ts`. Start anyway (`round/ {action: force}`) is the creator's or a battle manager's only (capability `force_round`, 403 `force_round_not_allowed`). An approved reported result counts a game off missing units as finalise does. Per-unit battle notes are `unit_information_json[key].notes`, saved by `useNotesAutosave`. The CSP in `frontend/vercel.json` is enforced (not report-only): a new external origin needs adding there.
- **Production startup guards** (`DJANGO_DEBUG` off): `DJANGO_SECRET_KEY` must be 50+ characters; `RATE_LIMIT_NUM_PROXIES` defaults to 1 (Render's proxy) with a warning, and a value that isn't a whole number stops startup; with `RESEND_API_KEY` set, `FRONTEND_URL` (https) and `DEFAULT_FROM_EMAIL` must be real (not at example.com, and not Resend's shared `resend.dev` sender, which delivers only to the Resend account's owner). `manage.py` hides these messages behind `AppRegistryNotReady`; gunicorn shows them.
- **Sessions:** every token carries the user's session key (`UserAccount.session_key`, claim `sk`). A reset, a password change or sign-out-others sets a new one, and old tokens get 401 `session_ended`. **A 401 only ever means "not authenticated"** (a wrong current password is a 400), because the frontend signs out on a 401 after a refresh. Frontend: `lib/session.ts` owns the tokens and the cached user; nothing else writes them. An answer that lands after the session has moved on (signed out, another account) is ignored: `profileLoaded(token, user)` checks `session.isFor(token)`, and `updateUser` takes only the signed-in user (BUG-170).
- **A deleted account stays as a user row** (`apps/users/services/deletion.py`, AUTH-NEW-05): first name "Former player", username `deleted-<id>`, no email, an unusable password, inactive, so its warbands, battles, ledger and encampments keep their owner as retired records. `display_name` already shows "Former player"; anything new that lists, counts or emails users must skip inactive ones.

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

### Demo campaign

`docker compose exec backend python manage.py seed_demo_campaign` (re)builds the played demo campaign "The Shattered Crown" (DEBUG and a local database only): sign in as `captain@mordheim.test`, password `password`.

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
