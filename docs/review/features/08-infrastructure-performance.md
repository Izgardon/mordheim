# Infrastructure and Performance

> Scope: `backend/Dockerfile`, `backend/entrypoint.sh`, `backend/wait_for_db.py`, `backend/.dockerignore`, `backend/pyproject.toml`, `docker-compose.yml`, `backend/config/settings.py` (database, `DEBUG`, caches, throttling, CORS, logging, security, static files), `backend/config/urls.py` and every app `urls.py`, `backend/apps/core/views.py` (health, keep-awake), `backend/apps/realtime/services.py` and every Pusher call site, `backend/apps/users/emails.py` (Resend), the warband, campaign, battle and catalogue list views measured below, `frontend/vercel.json`, `frontend/src/config/env.ts`, `frontend/src/lib/api-client.ts`, and the `frontend/src/features/*/api` files plus the hooks that call them on load. Measurements were taken on 2026-10-16 against the local Docker stack (`mordheim-backend-1`, `mordheim-db-1`).

## Summary

The app is slow on Render with several users because each screen costs far more database round trips and Python CPU than the deployment can absorb, and nothing in the stack bounds or hides that cost. A cold campaign overview makes 18 API calls, which run **249 SQL queries** (including the per-request JWT user lookup) and about **220 ms of server CPU** measured on a fast desktop core. In production every one of those queries is a network round trip from Render (Frankfurt, per `docs/ENGINEERING_RULES.md`) to Neon (London). Every request also opens a fresh TLS connection to Neon, because `CONN_MAX_AGE` is 0. If Render uses the Dockerfile, the server is Django's `runserver`: one process, with the autoreloader polling about 700 files a second, on a 0.1 to 0.5 vCPU instance. One endpoint dominates. `GET /campaigns/<id>/battles/` is an N+1 that runs **78 queries and returns 100 KB**, all to find at most one open battle. The overview fetches it twice on load, and **2 to 4 more times every time a user switches back to the tab**. At 10 ms per query that endpoint alone takes about 0.9 s; at 30 ms, about 2.4 s. Locally, `runserver` stops scaling at about 25 req/s, where one core is saturated: p95 rose from 96 ms with 1 client to 2.3 s with 20. Two gunicorn workers doubled throughput, but a 0.5 vCPU instance cannot give them a second core, so the durable fix is to cut queries and CPU per screen. Indexes and data volume are not the problem: the database is 16 MB and the largest table has 385 rows. Top five findings:

1. **INFRA-PERF-01**: the battle list is an N+1 (2 queries per battle). The overview fetches it 2 times on load and 2 to 4 times on every tab focus.
2. **INFRA-PERF-02**: the production image serves requests with `runserver` (autoreloader on, one process, no timeouts). gunicorn is installed but never started.
3. **INFRA-PERF-03**: there are no persistent DB connections. Every request pays a new TLS handshake to Neon: +5 ms locally, +56 ms per request in a 10 ms-RTT emulation.
4. **INFRA-PERF-05**: warband endpoints run a fixed 5-query preamble, have item-availability N+1s in the detail lists (37 queries for 2 heroes), and repeat the rating queries for each warband.
5. **INFRA-PERF-06**: every campaign screen waits for 5 catalogue downloads (380 KB, 72 ms of CPU) with no HTTP caching, and the Items page downloads the 170 KB item list a second time.

## How it is deployed

**What the image does at boot** (`backend/Dockerfile:28`, `backend/entrypoint.sh:4-6`)

1. `python /app/wait_for_db.py` loops until it can connect. It builds its conninfo **only** from `POSTGRES_DB/USER/PASSWORD/HOST/PORT` (`wait_for_db.py:8-14`) and ignores `DATABASE_URL`. It has no timeout.
2. `python manage.py migrate --noinput` runs on every container start.
3. `exec python manage.py runserver 0.0.0.0:8000` starts the dev server, without `--noreload`.

**What serves requests.** Unless Render overrides the start command, the server is `runserver`: a single Python process (plus a supervising parent) that starts one thread per connection without limit, while Django's `StatReloader` thread polls every loaded module file once a second. `gunicorn==25.0.1` is in `pyproject.toml:15` but nothing invokes it. Git history points both ways:
- Commit `98b571d` ("adding gunicorn", 2026-02-08) added gunicorn, `DATABASE_URL` support and `requirements.txt` changes together, with no Dockerfile change. That looks like a native Render Python service with a gunicorn start command.
- Commit `f58a407` (2026-02-27) deleted `requirements.txt` in favour of uv and a multi-stage Dockerfile. A native service whose build command was `pip install -r requirements.txt` would have broken then, so Render was either switched to Docker (which would mean `runserver`) or reconfigured.

The repo alone can't settle this.

**DB connection behaviour.** When `DATABASE_URL` is set, `settings.py:94` calls `dj_database_url.config(default=...)` with no `conn_max_age` or `conn_health_checks`. So `CONN_MAX_AGE=0`: Django opens a connection on the first query of each request and closes it when the request ends. The Neon URL left commented in `backend/.env` is the **direct** endpoint (no `-pooler` in the host), in `eu-west-2`, with `sslmode=require&channel_binding=require`. Each request therefore pays TCP, TLS and SCRAM-SHA-256-PLUS authentication through Neon's proxy before its first query. Measured locally without TLS, a connection costs 3.8 ms p50, and closing the connection after each request added 5.2 ms per request (10.3 → 15.5 ms mean over a three-endpoint loop). Across a WAN with TLS, expect about 5 RTTs plus the Neon proxy's auth time, roughly 50 to 150 ms.

**Other runtime facts**
- `CACHES` is LocMem and used only for throttle counters (`settings.py:165-170`). No application data is cached, and there are no `ETag` or `Cache-Control` headers.
- The frontend calls `${VITE_API_BASE_URL || "/api"}` (`frontend/src/config/env.ts:1`). `vercel.json` has only the SPA fallback, so production must set `VITE_API_BASE_URL` to the Render origin. That makes the API cross-origin, and every distinct URL is preflighted (AUTH-PERF-03).
- External calls run in the request thread. Pusher `trigger` is called from `apps/battles/views/shared.py:390-435` (inside `on_commit`, which still runs before the response), `apps/trades/views.py:401,449,519-520,567,595,640,681,728`, `apps/campaigns/views.py:1226,1275` and `apps/notifications/views.py:95,141,150`. Resend `requests.post(timeout=10)` runs in `apps/users/emails.py:32,112` (AUTH-PERF-05). The Pusher client keeps a `requests.Session` (connections are reused) and has a **5 s** default timeout.
- `KeepAwakeView` answers only `HEAD` and never touches the DB (`apps/core/views.py:13-17`; see AUTH-PERF-06).

**What William needs to confirm** (each changes a priority below)

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | Render service type (Docker or native) and the exact start command | If Docker, production runs `runserver` (INFRA-PERF-02 stays P0) and `wait_for_db.py` must find `POSTGRES_*` variables or boot hangs (INFRA-BUG-02) |
| 2 | Render plan (Free 0.1 CPU, Starter 0.5 CPU, Standard 1 CPU) and region | CPU budget per request (INFRA-PERF-07); whether the 10-30 ms/query projections apply |
| 3 | Is `DJANGO_DEBUG=0` set? Is `DJANGO_SECRET_KEY` set? | INFRA-SEC-01, AUTH-SEC-01 |
| 4 | Is `DATABASE_URL` the `-pooler` host or the direct host? Neon plan, compute size and autosuspend delay | Connection limits and cold starts (INFRA-PERF-03, INFRA-PERF-10) |
| 5 | Measured RTT from a Render shell to Neon (snippet in the Manual QA script) | Turns every projection in this file into a real number |
| 6 | What pings `/api/keep-awake/`, and how often? | Spin-down behaviour (INFRA-PERF-10) |

## Measurements

**Method.** The database and backend ran on the same Docker host, so each query costs about 0.1 ms locally. That is why local times understate production by an order of magnitude. Settings were as in compose (`DEBUG=1`, `CONN_MAX_AGE=0`). The requester was user 1, the owner of campaign 1 "Shards" (38 battles, 21 ended, 1 stuck active), via `rest_framework.test.APIClient.force_authenticate`.

`force_authenticate` skips SimpleJWT's user lookup. With a real bearer token the same request makes one more query (campaign detail: 3 → 4, verified), so all projections add 1 query per request. Each GET was run once to warm up, then measured 3 times (median), inside a transaction that was rolled back. The rollback matters because the battle state and roster GETs issue an `UPDATE` (INFRA-PERF-09); nothing was persisted. Query counts exclude savepoint statements. "CPU ms" is `time.process_time()` in the server process. Other reviewers were using the same container at the same time, so a few milliseconds of noise is possible.

**Projection.** `local ms + (queries + 1) × RTT`, at 10 ms and 30 ms per query. That brackets Frankfurt→London (typically 10-20 ms) with headroom for Neon proxy overhead. With today's config, add about 5 × RTT per request for the new connection (+50 / +150 ms). It also excludes the slowdown of a fractional vCPU (INFRA-PERF-07).

### Endpoint query counts

| Endpoint | Screen | Queries | Local ms | of which CPU ms | Bytes | Prod @10 ms/query | Prod @30 ms/query |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `GET /auth/me/` | App shell (every full load) | 0 | 0.5 | 0.5 | 72 | 10 ms | 30 ms |
| `GET /notifications/` | App shell (every full load) | 1 | 1.2 | 1.0 | 2 | 21 ms | 61 ms |
| `GET /campaigns/` | Campaigns list | 2 | 3.7 | 3.1 | 1,576 | 34 ms | 94 ms |
| `GET /campaigns/1/` | Campaign layout (every campaign screen) | 3 | 4.0 | 3.2 | 782 | 44 ms | 124 ms |
| `GET /warbands/?campaign_id=1` | Campaign layout | 4 | 4.4 | 3.7 | 673 | 54 ms | 154 ms |
| `GET /campaigns/1/battles/` | Campaign layout + overview panel + every tab focus | **78** | 72.3 | 55.7 | 102,260 | 862 ms | 2442 ms |
| `GET /items/?campaign_id=1` | Campaign layout prefetch; Items page | **14** | 59.4 | 55.8 | 169,987 | 209 ms | 509 ms |
| `GET /skills/?campaign_id=1` | Layout prefetch; Skills page | 4 | 5.0 | 4.3 | 102,944 | 55 ms | 155 ms |
| `GET /spells/?campaign_id=1` | Layout prefetch; Spells page | 4 | 4.7 | 4.0 | 41,139 | 55 ms | 155 ms |
| `GET /special/?campaign_id=1` | Layout prefetch | 4 | 4.8 | 4.0 | 60,524 | 55 ms | 155 ms |
| `GET /races/?campaign_id=1` | Layout prefetch | 4 | 3.3 | 2.7 | 4,611 | 53 ms | 153 ms |
| `GET /campaigns/1/players/` | Overview | 13 | 9.1 | 7.1 | 528 | 149 ms | 429 ms |
| `GET /campaigns/1/battle-history/` | Overview | 3 | 6.2 | 5.4 | 6,242 | 46 ms | 126 ms |
| `GET /campaigns/1/pivotal-moments/` | Overview | 2 | 3.4 | 2.9 | 4,719 | 33 ms | 93 ms |
| `GET /campaigns/1/top-killers/` | Overview | 2 | 4.3 | 3.6 | 646 | 34 ms | 94 ms |
| `GET /campaigns/1/trade-requests/?status=completed` | Overview (trades) | 3 | 3.9 | 3.0 | 2 | 44 ms | 124 ms |
| `GET /campaigns/1/bulletin/` | Overview | 2 | 2.1 | 1.8 | 136 | 32 ms | 92 ms |
| `GET /campaigns/1/active-battles/` | Settings | 3 | 3.2 | 2.5 | 2,243 | 43 ms | 123 ms |
| `GET /campaigns/1/members/` | Settings | 4 | 3.6 | 2.9 | 490 | 54 ms | 154 ms |
| `GET /campaigns/1/permissions/me/` | Warband + every catalogue page | 1 | 1.4 | 1.2 | 399 | 21 ms | 61 ms |
| `GET /campaigns/1/rules/` | House rules | 2 | 2.0 | 1.7 | 590 | 32 ms | 92 ms |
| `GET /campaigns/1/messages/` | Chat menu (on open) | 2 | 2.2 | 1.8 | 252 | 32 ms | 92 ms |
| `GET /item-properties/?campaign_id=1` | Items page | 2 | 4.0 | 3.5 | 93,865 | 34 ms | 94 ms |
| `GET /bestiary/?campaign_id=1` | Bestiary | 4 | 4.5 | 3.9 | 59,260 | 54 ms | 154 ms |
| `GET /hired-swords/?campaign_id=1` | Hired swords | 6 | 10.9 | 9.7 | 86,853 | 81 ms | 221 ms |
| `GET /warbands/2/bestiary-favourites/` | Bestiary | 3 | 2.6 | 2.1 | 2 | 43 ms | 123 ms |
| `GET /warbands/2/` | Warband page | 5 | 5.4 | 4.5 | 671 | 65 ms | 185 ms |
| `GET /warbands/2/summary/` | Warband page; layout (own) | 12 | 9.1 | 7.3 | 597 | 139 ms | 399 ms |
| `GET /warbands/2/heroes/` | Warband page | 14 | 11.6 | 9.5 | 1,618 | 162 ms | 462 ms |
| `GET /warbands/2/henchmen-groups/` | Warband page | 11 | 9.1 | 7.4 | 1,563 | 129 ms | 369 ms |
| `GET /warbands/2/hired-swords/` | Warband page | 13 | 11.3 | 9.3 | 2,620 | 151 ms | 431 ms |
| `GET /warbands/2/heroes/detail/` | Warband edit mode | **37** | 26.2 | 21.5 | 5,868 | 406 ms | 1166 ms |
| `GET /warbands/2/henchmen-groups/detail/` | Warband edit mode | **20** | 15.5 | 12.7 | 3,054 | 226 ms | 646 ms |
| `GET /warbands/2/hired-swords/detail/` | Warband edit mode | **36** | 27.4 | 22.9 | 8,027 | 397 ms | 1137 ms |
| `GET /warbands/2/items/` | Warband warchest (on open) | 6 | 5.3 | 4.2 | 95 | 75 ms | 215 ms |
| `GET /warbands/2/logs/` | Warband logs tab | 6 | 7.3 | 6.2 | 26,086 | 77 ms | 217 ms |
| `GET /warbands/2/trades/` | Warband trades tab | 7 | 7.4 | 6.2 | 8,411 | 87 ms | 247 ms |
| `GET /warbands/2/resources/` | Postbattle | 6 | 5.0 | 4.0 | 112 | 75 ms | 215 ms |
| `GET /warbands/2/restrictions/` | Warband edit | 5 | 4.6 | 3.5 | 299 | 65 ms | 185 ms |
| `GET /warbands/1/` | Warband page | 5 | 4.8 | 4.0 | 669 | 65 ms | 185 ms |
| `GET /warbands/1/summary/` | Warband page; layout (own) | 12 | 8.8 | 7.0 | 407 | 139 ms | 399 ms |
| `GET /warbands/1/heroes/` | Warband page | 11 | 8.4 | 6.8 | 486 | 128 ms | 368 ms |
| `GET /warbands/1/henchmen-groups/` | Warband page | 10 | 10.8 | 9.0 | 459 | 121 ms | 341 ms |
| `GET /warbands/1/hired-swords/` | Warband page | 13 | 10.6 | 8.6 | 1,573 | 151 ms | 431 ms |
| `GET /warbands/1/heroes/detail/` | Warband edit mode | 11 | 8.3 | 6.7 | 694 | 128 ms | 368 ms |
| `GET /warbands/1/henchmen-groups/detail/` | Warband edit mode | 10 | 7.8 | 6.3 | 630 | 118 ms | 338 ms |
| `GET /warbands/1/hired-swords/detail/` | Warband edit mode | **25** | 18.7 | 15.4 | 3,755 | 279 ms | 799 ms |
| `GET /warbands/1/items/` | Warband warchest (on open) | 6 | 5.3 | 4.2 | 48 | 75 ms | 215 ms |
| `GET /warbands/1/logs/` | Warband logs tab | 6 | 5.9 | 4.7 | 9,040 | 76 ms | 216 ms |
| `GET /warbands/1/trades/` | Warband trades tab | 7 | 6.3 | 5.2 | 2,588 | 86 ms | 246 ms |
| `GET /warbands/1/resources/` | Postbattle | 6 | 5.1 | 4.1 | 112 | 75 ms | 215 ms |
| `GET /warbands/1/restrictions/` | Warband edit | 5 | 4.5 | 3.6 | 299 | 64 ms | 184 ms |
| `GET /campaigns/1/battles/38/state/?sinceEventId=0&view=postbattle` | Battle pages | 7 (incl. 1 UPDATE) | 6.0 | 4.7 | 8,553 | 86 ms | 246 ms |
| `GET /campaigns/1/battles/38/state/?sinceEventId=0&view=full` | Battle pages | 7 (incl. 1 UPDATE) | 6.3 | 5.0 | 8,596 | 86 ms | 246 ms |
| `GET /campaigns/1/battles/38/rosters/` | Battle pages | **28** (incl. 1 UPDATE) | 19.7 | 15.7 | 7,147 | 310 ms | 890 ms |
| `GET /campaigns/1/battles/40/state/?sinceEventId=0&view=active` | Battle pages | 7 (incl. 1 UPDATE) | 5.9 | 4.6 | 1,855 | 86 ms | 246 ms |
| `GET /campaigns/1/battles/40/state/?sinceEventId=0&view=prebattle` | Battle pages | 7 (incl. 1 UPDATE) | 6.2 | 4.7 | 2,550 | 86 ms | 246 ms |
| `GET /campaigns/1/battles/40/rosters/` | Battle pages | **28** (incl. 1 UPDATE) | 23.5 | 19.2 | 7,147 | 314 ms | 894 ms |

Queries exclude the JWT user lookup; the projections include it. **Bold** = 20+ queries or 40+ ms CPU. There is no pagination anywhere, so "logs page 1" is the whole log. `auth/me` is 1 query with a real token.

**Worst offenders: the repeated SQL and the code responsible**

| Endpoint | Repeated signature (count per request) | Responsible code |
| --- | --- | --- |
| `GET /campaigns/1/battles/` (78) | `SELECT battle.* FROM battle WHERE id = ?` ×38 and `SELECT battle_participant.* … JOIN auth_user … JOIN warband WHERE battle_id = ?` ×38 | `apps/battles/views/lifecycle.py:70-79` loops over every battle the user ever joined and calls `_battle_snapshot(battle.id)` (`apps/battles/views/shared.py:154-162`), which re-fetches the battle and its participants. Grows by 2 queries per battle, forever. |
| `GET /warbands/2/heroes/detail/` (37), `…/hired-swords/detail/` (36), `…/henchmen-groups/detail/` (20) | `SELECT item_availability … WHERE item_id = ?` ×5-9, `SELECT item_availability_restriction … WHERE item_availability_id = ?` ×8-9, `SELECT restriction … WHERE id = ? LIMIT 21` ×3-8 | `ItemDetailSerializer.availabilities` (`apps/warbands/serializers/heroes.py:77`) serializes `availabilities → restriction_links → restriction`, but the views prefetch only `…__item__property_links__property` (`apps/warbands/views/heroes.py:111-120`, `hired_swords.py:114-124`, `henchmen.py:143-153`). That is 1 + A + R queries per distinct item. |
| `GET /campaigns/1/players/` (13) | `SELECT hero.xp, hero.large … WHERE warband_id = ?`, `SELECT henchmen_group … COUNT(henchman) …`, `SELECT hired_sword.rating, xp …`, each ×3 (once per warband) | `apps/campaigns/views.py:586-596` calls `WarbandSummarySerializer().get_rating(warband)` (`apps/warbands/serializers/warbands.py:95-119`, 3 queries) per warband. With 8 players that is 24 queries. |
| Every `/warbands/<id>/…` endpoint (5 before any work) | `warband ⋈ campaign ⋈ campaign_settings`, `warband_resources`, `restriction ⋈ warband_restrictions`, `restriction ⋈ campaign_settings_item_settings`, `campaign_membership ⋈ campaign_role` | `WarbandObjectMixin.get_warband` (`apps/warbands/views/mixins.py:28-36`) always prefetches resources, restrictions and item settings, even for heroes, logs or trades. The warband page loads 5 such endpoints in parallel, so 20 queries are preamble. |
| `GET /warbands/2/summary/` (12) | `hero`, `henchmen_group`, `hired_sword` each queried twice (rating aggregate, then list) plus `warband_trades` | `WarbandSummarySerializer` (`apps/warbands/serializers/warbands.py:95-119` and the list fields) |
| `GET /items/?campaign_id=1` (14 queries, **56 ms CPU, 170 KB**) | No N+1: prefetches are batched. The cost is DRF serializing 245 items × availabilities × restrictions × properties × bestiary entries | `apps/items/views.py:69-94`, `ItemSerializer` |

### Per-screen load cost

The counts below sum the endpoints each screen calls on load, traced from the route components and hooks. All campaign screens are children of `CampaignLayout` (`frontend/src/app/routes/routes.tsx:66-95`). A **cold** load (hard refresh or first entry) also pays:
- the app shell: `/auth/me`, then `/notifications/`
- the layout: `getCampaign`, then the five catalogue prefetches it blocks on (`CampaignLayout.tsx:390`, `LoadingScreen` at `:580`), `warbands/?campaign_id`, then `summary`, plus `listCampaignBattles` (`:521`, skipped on battle routes)

"In-app" means navigating from another campaign screen, with the layout already loaded. Queries include the +1 JWT lookup per request.

**Critical path** is the longest chain of dependent requests for one user on an idle server: `Σ(queries × RTT) + 5 × RTT per hop (new connection) + 2 × local CPU` (0.5 vCPU). It excludes browser↔Render latency and CORS preflights, so real wall time is higher.

| Screen | Requests | Queries | Server CPU (local) | Payload | Aggregate DB time @10 / @30 ms | Critical path @10 / @30 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Campaigns list (cold) | 3 | 6 | 5 ms | 2 KB | 0.06 / 0.18 s | 0.15 / 0.43 s |
| **Campaign overview (cold)**: shell + layout + overview (players, completed trades, battle history, pivotal moments, top killers, bulletin, `BattleActionPanel` battle list) | 18 | **249** | 222 ms | 584 KB | 2.5 / 7.5 s | **1.4 / 3.8 s** (me → campaign → items → battle list) |
| **Overview, user switches back to the tab** (`focus` + `visibilitychange` in both `CampaignLayout.tsx:562-564` and `BattleActionPanel.tsx:88-90`, 4 × battle list) | 4 | **316** | 223 ms | 399 KB | 3.2 / 9.5 s | 1.3 / 3.0 s |
| Warband page, own warband (in-app): detail, then summary + heroes + hired swords + henchmen + `permissions/me` | 6 | 62 | 39 ms | 7 KB | 0.62 / 1.9 s | 0.34 / 1.0 s |
| Warband page, other player's warband (in-app) | 6 | 58 | 37 ms | 4 KB | 0.58 / 1.7 s | 0.33 / 0.95 s |
| Warband page (cold refresh) | 17 | 201 | 181 ms | 480 KB | 2.0 / 6.0 s | 0.8 / 2.1 s |
| Warband "Edit" click (`heroes/detail`; henchmen and hired-sword detail when those sections are edited) | 1-3 | 38-96 | 22-57 ms | 6-17 KB | 0.4-1.0 / 1.1-2.9 s | 0.4 / 1.2 s |
| Prebattle or active battle (in-app): state, then rosters | 2 | 37 | 24 ms | 9 KB | 0.37 / 1.1 s | 0.5 / 1.5 s |
| Postbattle (in-app): state, then rosters + resources | 3 | 44 | 24 ms | 15 KB | 0.44 / 1.3 s | 0.5 / 1.5 s |
| Active battle (cold refresh) | 12 | 97 | 110 ms | 381 KB | 0.97 / 2.9 s | 1.0 / 2.6 s |
| Each realtime battle event, **per other participant** (`useBattleState.ts:120-125` refetches state) | 1 | 8 (incl. 1 UPDATE) | 5 ms | 2-9 KB | 0.08 / 0.24 s | 0.13 / 0.39 s |
| Items page (in-app): items again + item properties + `permissions/me` | 3 | 20 | 60 ms | 258 KB | 0.20 / 0.60 s | 0.3 / 0.7 s |
| Skills / Spells page (in-app) | 2 | 7 | 6 ms | 41-101 KB | 0.07 / 0.21 s | 0.1 / 0.3 s |
| Bestiary page (in-app) | 3 | 11 | 7 ms | 58 KB | 0.11 / 0.33 s | 0.1 / 0.3 s |
| Hired swords page (in-app) | 2 | 9 | 11 ms | 85 KB | 0.09 / 0.27 s | 0.14 / 0.38 s |

**What "multiple users" does to this.** Take six players opening the overview within a few seconds of each other, which is a normal game night.
- That is about 1,500 queries and about 1.3 s of desktop-core CPU. On a 0.5 vCPU instance that is at least 2.7 s of pure CPU queueing before any network wait; on Free (0.1 vCPU), at least 13 s.
- Each player who switches tabs and comes back adds another 316 queries and about 0.45 s of Starter CPU.
- Each overview fires about 16 requests in quick succession. Under `runserver` (unbounded threads) with no pooling, each in flight holds its own Neon connection, so peak connection counts can approach Neon's per-compute `max_connections` (about 100 on the smallest computes). That part is Speculative.

### Concurrency: runserver vs gunicorn

**Setup.** A GET-only load script ran inside the backend container (threads + `urllib`, a real JWT generated in-process and never printed). Each client looped over a heavy mix with no side effects: battle list, items catalogue, warband 2 heroes, warband 2 summary, players, warband 2 hired-swords detail, campaign detail. Each concurrency level ran for 15 s after a 2 s warm-up. Host: 16 cores, no container CPU limit. `DEBUG=1`. `runserver` was the stack's own `:8000`; gunicorn was started on `:8001` with `-w 2 --threads 4` and stopped afterwards (process list and a refused connection on `:8001` both confirmed it was gone).

**A. Real local Postgres (about 0.1 ms per query)**

| Server | Clients | req/s | p50 | p95 | max | Battle list p50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| runserver | 1 | 25.5 | 22 ms | 96 ms | 134 ms | 83 ms |
| runserver | 5 | 25.1 | 152 ms | 551 ms | 669 ms | 498 ms |
| runserver | 20 | 23.7 | 589 ms | **2,300 ms** | 2,610 ms | 2,190 ms |
| gunicorn -w 2 --threads 4 | 1 | 25.6 | 21 ms | 94 ms | 145 ms | 83 ms |
| gunicorn -w 2 --threads 4 | 5 | 52.2 | 65 ms | 274 ms | 493 ms | 233 ms |
| gunicorn -w 2 --threads 4 | 20 | 51.5 | 373 ms | **801 ms** | 1,104 ms | 583 ms |

`runserver` is flat at about 25 req/s because one process with the GIL can use only one core, and the work is CPU-bound (about 80% of local request time is Python CPU; see the table above). Two gunicorn workers double throughput only because this machine has spare cores. **On a 0.5 vCPU instance, the instance itself is the ceiling**, so worker count alone won't fix it. Cutting CPU and queries per screen will.

**B. Emulated remote database.** To see the production shape, the same mix was run against temporary servers that sleep 10 ms per query and 50 ms (5 RTT) per new connection. This used an `execute_wrapper` and a `connection_created` hook in a temporary WSGI module under `/tmp` in the container. No repo files were touched, and the temporary files were deleted afterwards.

| Server (10 ms/query emulated) | Clients | req/s | p50 | p95 | Campaign detail p50 | Battle list p50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| runserver, `CONN_MAX_AGE=0` (today) | 1 | 2.8 | 223 ms | 939 ms | 102 ms | 937 ms |
| runserver, `CONN_MAX_AGE=0` | 5 | 12.7 | 256 ms | 1,034 ms | 104 ms | 1,019 ms |
| runserver, `CONN_MAX_AGE=0` | 20 | 24.9 | 552 ms | 2,202 ms | 190 ms | 2,090 ms |
| gunicorn 2×4, `CONN_MAX_AGE=0` | 5 | 13.2 | 243 ms | 1,003 ms | 102 ms | 975 ms |
| gunicorn 2×4, `CONN_MAX_AGE=0` | 20 | 20.8 | 859 ms | 1,789 ms | 498 ms | 1,492 ms |
| gunicorn 2×4, `CONN_MAX_AGE=600` + health checks | 1 | 3.3 | 167 ms | 880 ms | **46 ms** | 879 ms |
| gunicorn 2×4, persistent | 5 | 16.0 | 181 ms | 952 ms | 46 ms | 939 ms |
| gunicorn 2×4, persistent | 20 | 24.3 | 787 ms | 1,641 ms | 383 ms | 1,387 ms |
| gunicorn 2×4, persistent, `DEBUG=0` | 5 | 15.7 | 181 ms | 941 ms | 46 ms | 928 ms |
| gunicorn 2×12, persistent, `DEBUG=0` | 5 | 16.0 | 170 ms | 944 ms | 46 ms | 919 ms |
| gunicorn 2×12, persistent, `DEBUG=0` | 20 | **49.6** | **262 ms** | 1,180 ms | **50 ms** | 1,101 ms |

**What this shows**
- **Query count dominates once the DB is remote.** The single-user p50 of the mix went from 21 ms to 223 ms. The battle list went from 83 ms to about 935 ms at 10 ms per query (it would be about 2.4 s at 30 ms).
- **Persistent connections save about 56 ms per request** (campaign detail 102 → 46 ms) and add 18-25% throughput at 1-5 clients. The saving grows with real TLS and Neon proxy cost.
- **Thread slots matter under latency.** With 8 slots (2×4), 20 clients queue (campaign detail p50 383 ms). With 24 slots (2×12), the same load gave 49.6 req/s and a 50 ms campaign detail. `runserver`'s unbounded threads were not the bottleneck in the latency-bound emulation, which is exactly why gunicorn alone won't make Render fast. The gains come from bounded, pooled concurrency, no reloader, and the query and CPU cuts.
- **`DEBUG=0` made no measurable difference** to latency (181 vs 181 ms). Flipping the default is a security fix, not a speed fix.
- **The autoreloader burns CPU while idle.** The idle `runserver` child used **0.38-0.43 s of CPU per 10 s** (three samples, `/proc/9/stat`), which is `StatReloader` polling 696 module files. That is about 4% of a fast desktop core. On a slower 0.5 vCPU share it is roughly 8-15% of the budget, and on Free (0.1 vCPU) roughly 40% or more, spent before any request arrives (estimate).
- **Memory.** The `runserver` pair uses 59 MB + 132 MB RSS. Two gunicorn workers plus a master fit in 512 MB.

### Indexes and data volume

- **Volume** (exact `count(*)`, local copy of production-shaped data): the database is 16 MB. The largest tables are `item_property_link` 385, `battle_event` 262, `item_availability` 257, `skill` 253, `item` 245, `warband_log` 178, `battle_participant` 75 and `battle` 38. The `pg_stat_user_tables.n_live_tup` estimates are stale (for example `battle` shows 0), so `ANALYZE` has not run since the data was loaded (local only).
- **Indexes are adequate.**
  - Django indexes every FK, and the hot composite filters already have composite indexes: `battle (campaign_id, status)`, `battle (status, created_at)`, `battle_event (battle_id, id)`, `battle_participant (battle_id, user_id)` unique and `(user_id, status)`, `notification (user_id, is_resolved, created_at)`, `trade_request (campaign_id, status)` and `(to_user_id, status)`, `campaign_pivotal_moment (campaign_id, battle_ended_at)`, `warband (campaign_id, user_id)` unique.
  - At this size every plan is trivially fast. **Indexes are not a factor in the Render slowness.**
- **Small gaps, for when data grows** (INFRA-PERF-11): `warband_log (warband_id, created_at)` (the logs view filters by warband and orders by `-created_at`, unpaginated), `warband_trades (warband_id, created_at)` (the summary orders trades), `campaign_message (campaign_id, created_at)` (chat pages by `-created_at`). `feature__iexact` on logs can't use a plain index.
- **Redundant indexes.** About 18 single-column FK indexes are covered by the leading column of a composite or unique index: `battle.campaign_id`, `battle_event.battle_id`, `battle_participant.battle_id`, `campaign_membership.campaign_id`, `notification.user_id`, `trade_request.campaign_id`, `trade_request.to_user_id`, `warband.campaign_id`, `warband_items.warband_id`, `warband_resources.warband_id`, `warband_restrictions.warband_id`, `item_property_link.item_id`, `item_availability_restriction.item_availability_id`, `warband_bestiary_favourite.warband_id`, `bestiary_entry_item.bestiary_entry_id`, `hired_sword_profile_restriction.hired_sword_profile_id`, `campaign_membership_permission.membership_id`, `campaign_settings_item_settings.campaignsettings_id`. The cost is minor write amplification.
- `pg_stat_statements` is not installed locally, so that part was skipped. Neon supports it, and its console "Monitoring → Queries" view will show the production equivalent of the tables above.

## Performance

### INFRA-PERF-01 · P0 · The battle list is an N+1 returning every battle ever, fetched 2 times per overview load and 2 to 4 times per tab focus
- **Where:**
  - `backend/apps/battles/views/lifecycle.py:65-79`
  - `backend/apps/battles/views/shared.py:154-162`
  - `frontend/src/features/campaigns/routes/CampaignLayout.tsx:508-575`
  - `frontend/src/features/campaigns/components/overview/BattleActionPanel.tsx:58-102`
- **What:**
  - The view loads every battle the user has joined in the campaign, then calls `_battle_snapshot(battle.id)` per battle, which runs 2 more queries. Measured: **78 queries, 102 KB, 56 ms CPU** for 38 battles, growing by 2 queries and about 2.7 KB per battle.
  - Both callers only want the single resumable battle. `getResumableBattleForUser` (`frontend/src/features/battles/utils/battle-session.ts:19-42`) discards ended and canceled battles, which are 37 of the 38.
  - `CampaignLayout` (on every campaign screen except battle routes) and `BattleActionPanel` (on the overview) each fetch it on mount, and each listens to `focus`, `visibilitychange`, `online` and three battle events.
- **Impact:**
  - It is the single largest cost in the app: 32% of the cold overview's queries, and 100% of the 316 queries a user generates just by returning to the tab.
  - About 0.9 s per call at 10 ms/query and 2.4 s at 30 ms, plus 56 ms of desktop CPU (much more on a fractional vCPU).
  - With several players alt-tabbing during a game, this endpoint alone can saturate the instance.
- **Fix:**
  1. Backend: add a `status` filter (or a dedicated `GET /campaigns/<id>/battles/current/`) and prefetch participants:
     ```python
     OPEN = [Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE]
     battles = (
         Battle.objects.filter(campaign_id=campaign_id, participants__user=request.user)
         .distinct()
         .order_by("-created_at")
         .prefetch_related(
             Prefetch("participants",
                      queryset=BattleParticipant.objects.select_related("user", "warband").order_by("id"))
         )
     )
     if request.query_params.get("status") == "open":
         battles = battles.filter(status__in=OPEN)
     payload = [_battle_snapshot_from(b, list(b.participants.all())) for b in battles]  # no per-battle queries
     ```
     (Refactor `_battle_snapshot` into a version that takes already-loaded objects.)
  2. Frontend: call `?status=open`, and fetch once per screen. Lift the list into one shared hook or store used by both `CampaignLayout` and `BattleActionPanel`, and debounce or deduplicate the focus and visibility handlers to at most one call per 30 s. Better still, rely on the existing Pusher `battle:*` events.
  3. Add an `assertNumQueries` budget (INFRA-TEST-01).
  - Expected: 78 → about 4 queries (constant), 102 KB → under 3 KB, and the tab-return cost drops from 316 queries to about 5.
- **Effort:** S (backend) + S (frontend) · **Confidence:** Confirmed (measured)

### INFRA-PERF-02 · P0 · The production image serves requests with `runserver`, autoreloader on; gunicorn is never started
- **Where:** `backend/entrypoint.sh:6`; `backend/Dockerfile:28`; `backend/pyproject.toml:15`
- **What:** `exec python /app/manage.py runserver 0.0.0.0:8000`, with no `--noreload`. Django documents `runserver` as not for production. It is one process (GIL-bound) with unbounded per-connection threads. It has no worker timeout or recycling, no keep-alive tuning, and no backpressure, and its `StatReloader` thread polls every loaded module file once a second.
- **Impact:**
  - Measured locally: throughput is pinned at about 25 req/s whatever the concurrency, with p95 2.3 s at 20 clients against 0.8 s for gunicorn `-w 2 --threads 4`.
  - The idle reloader used 0.4 s CPU per 10 s, which on a 0.1-0.5 vCPU instance is a meaningful slice of the whole budget.
  - Unbounded threads plus a new DB connection per request let a burst open dozens of simultaneous Neon connections.
  - A hung request (for example a slow Pusher or Resend call) is never killed.
  - P0 *if* Render runs the Dockerfile (open question 1). If Render's start command is already gunicorn, downgrade to P2 (the image is still wrong for anyone who deploys it).
- **Fix:** Make gunicorn the image's server and keep `runserver` for local dev only.
  ```sh
  # backend/entrypoint.sh
  #!/usr/bin/env sh
  set -e
  python /app/wait_for_db.py
  if [ "${RUN_MIGRATIONS_ON_BOOT:-1}" = "1" ]; then python /app/manage.py migrate --noinput; fi
  exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" --threads "${GUNICORN_THREADS:-8}" --worker-class gthread \
    --timeout 60 --graceful-timeout 30 --keep-alive 5 \
    --max-requests 1000 --max-requests-jitter 100 \
    --access-logfile - --access-logformat '%(h)s "%(r)s" %(s)s %(b)s %(M)sms'
  ```
  ```yaml
  # docker-compose.yml, backend service: keep autoreload locally
  command: sh -c "python wait_for_db.py && python manage.py runserver 0.0.0.0:8000"
  ```
  Sizing:
  - **Starter** (0.5 CPU, 512 MB): `WEB_CONCURRENCY=2`, `GUNICORN_THREADS=8`. That is 16 request slots and at most 16 DB connections. Memory is about 2 × 130 MB + master, judging by the measured `runserver` child's 132 MB.
  - **Free** (0.1 CPU): `WEB_CONCURRENCY=1`, `GUNICORN_THREADS=8`.
  - **Standard** (1 CPU, 2 GB): 3 × 8.

  Threads are what matter here: the emulation showed 8 slots queueing at 20 clients while 24 slots did not. If Render is a native service, put the same command in its Start Command field. Set Render's health-check path to `/api/health/`.
- **Effort:** S · **Confidence:** Confirmed (code and local measurement); production impact Likely pending question 1

### INFRA-PERF-03 · P0 · No persistent DB connections: every request opens a new TLS connection to Neon
- **Where:** `backend/config/settings.py:93-105`
- **What:** `dj_database_url.config(default=...)` defaults to `conn_max_age=0`, and the `POSTGRES_*` branch sets no `CONN_MAX_AGE` either. Django connects on a request's first query and disconnects at the end. The commented production URL is Neon's direct endpoint with `sslmode=require&channel_binding=require`.
- **Impact:**
  - Locally (no TLS, same host) a connect costs 3.8 ms, and close-per-request added 5.2 ms per request (+50%).
  - With 10 ms/query and a 5-RTT connect emulated, persistent connections cut campaign detail from **102 → 46 ms** and the mix's p50 from 223 → 167 ms.
  - Real Neon connects add TLS 1.3, SCRAM-SHA-256-PLUS and proxy authentication, so 50-150 ms per request is typical from another city. The cold overview pays it 18 times, about 4 of them on the critical path.
  - Combined with `runserver`'s unbounded threads, connection counts are unbounded, a risk against Neon's per-compute limit.
- **Fix:**
  ```python
  DEBUG = _env_bool("DJANGO_DEBUG", False)   # see INFRA-SEC-01
  CONN_MAX_AGE = _env_int("DB_CONN_MAX_AGE") or 600

  if os.environ.get("DATABASE_URL"):
      DATABASES = {
          "default": dj_database_url.config(
              default=os.environ["DATABASE_URL"],
              conn_max_age=CONN_MAX_AGE,
              conn_health_checks=True,   # one cheap SELECT 1 per request; survives Neon autosuspend
              ssl_require=not DEBUG,
          )
      }
  else:
      DATABASES = {"default": {..., "CONN_MAX_AGE": CONN_MAX_AGE, "CONN_HEALTH_CHECKS": True}}
  ```
  Notes:
  - Health checks cost 1 RTT per request, far cheaper than a reconnect. They prevent a 500 on the first request after Neon suspends the compute.
  - With gunicorn 2 × 8, the direct endpoint stays at 16 connections or fewer, which is fine.
  - If you move to the `-pooler` host (several instances or workers), also set `DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True` (required for PgBouncer transaction mode). If prepared-statement errors appear, add `"OPTIONS": {"prepare_threshold": None}`.
  - Longer term, Django 5.1+ adds a native psycopg pool (`"OPTIONS": {"pool": True}`), which is a reason to move to 5.2 LTS.
  - `CONN_MAX_AGE` only helps under a real server: with `runserver` each request runs in a new thread, so connections can't be reused. **This depends on INFRA-PERF-02.**
- **Effort:** S · **Confidence:** Confirmed (local and emulated measurement); the production magnitude is Likely

### INFRA-PERF-04 · P1 · Every query is a WAN round trip between Render (Frankfurt) and Neon (London)
- **Where:** deployment topology (`docs/ENGINEERING_RULES.md` principle 2; the Neon host in `backend/.env` is `eu-west-2`)
- **What:** Render has no London region. Neon has an AWS Frankfurt region (`eu-central-1`), which would put the DB in the same metro as the app. Today every query pays Frankfurt↔London latency (typically 10-20 ms) plus Neon proxy overhead.
- **Impact:** This multiplies everything above. The cold overview's critical path is about 99 queries: about 1.0 s of pure DB latency at 10 ms, about 3.0 s at 30 ms, against about 0.15 s at 1.5 ms in-region. Even after the N+1 fixes, a same-region DB makes every screen roughly 5-10× cheaper in latency.
- **Fix:**
  1. Measure first (Manual QA step 2). If `SELECT 1` takes 8 ms or more:
  2. Create a Neon project in `aws-eu-central-1`, restore with `pg_dump`/`pg_restore` (or Neon's import), switch `DATABASE_URL`, and keep the old project read-only for a week.
  3. If Render's region is not Frankfurt (open question 2), move whichever side is cheaper so they match.
- **Effort:** M · **Confidence:** Likely (topology from repo docs; RTT not measured from Render)

### INFRA-PERF-05 · P1 · Warband endpoints: a fixed 5-query preamble, availability N+1s in the detail lists, and repeated rating queries
- **Where:**
  - `backend/apps/warbands/views/mixins.py:28-36`
  - `backend/apps/warbands/views/heroes.py:111-120`, `hired_swords.py:114-124`, `henchmen.py:143-153`
  - `backend/apps/warbands/serializers/heroes.py:72-100`
  - `backend/apps/warbands/serializers/warbands.py:95-119`
  - `backend/apps/campaigns/views.py:586-596`
- **What:**
  - (a) `get_warband` always prefetches resources, restrictions and campaign item settings: 5 queries before any endpoint logic, even for heroes, logs or trades.
  - (b) The detail lists serialize `item.availabilities → restriction_links → restriction` without prefetching them: 3 extra queries per distinct item (37 queries for 2 heroes with 5 items, 36 for hired swords).
  - (c) `get_rating` runs 3 aggregate queries per call. The summary then re-queries the same tables for its lists, and `players` calls it once per warband.
- **Impact:**
  - The warband page (in-app) costs 62 queries, of which 20 are preamble. That is 0.34-1.0 s on the critical path.
  - The Edit button costs another 38-96 queries.
  - The overview's `players` call grows by 3 queries per player.
  - All of this grows with roster size: every new item a hero carries adds about 3 queries to the detail endpoints.
- **Fix:**
  ```python
  # mixins.py: make the heavy prefetch opt-in
  def get_warband(self, warband_id, extra_prefetch=None):
      qs = Warband.objects.select_related("campaign", "campaign__settings")
      if extra_prefetch:
          qs = qs.prefetch_related(*extra_prefetch)
      return qs.filter(id=warband_id).first()
  # pass extra_prefetch=["resources", "restrictions", "campaign__settings__item_settings"] only where serialized

  # heroes.py (and the hired-sword / henchmen equivalents)
  .prefetch_related(
      "hero_items__item__property_links__property",
      "hero_items__item__availabilities__restriction_links__restriction",
      ...
  )
  ```
  For ratings, compute all warbands in 3 grouped queries:
  ```python
  hero = dict(Hero.objects.filter(warband__campaign_id=cid, dead=False).values("warband_id")
              .annotate(r=Sum(Case(When(large=True, then=20), default=5) + Coalesce("xp", 0)))
              .values_list("warband_id", "r"))
  # same for HenchmenGroup (× alive henchmen count) and HiredSword
  ```
  Alternatively, store `rating` on `Warband` and update it in the same transaction as roster changes. Reuse the already-fetched lists inside `WarbandSummarySerializer`.
  - Expected: warband page 62 → about 30 queries; `heroes/detail` 38 → about 13 (constant); `players` 14 → about 6 (constant).
- **Effort:** M · **Confidence:** Confirmed (measured, SQL signatures above)

### INFRA-PERF-06 · P1 · Every campaign screen waits on five catalogue downloads with no HTTP caching, and the Items page downloads the item list again
- **Where:**
  - `frontend/src/features/campaigns/routes/CampaignLayout.tsx:314-406,579-581`
  - `frontend/src/features/items/routes/Items.tsx:247`
  - `backend/apps/items/views.py:69-94`
- **What:**
  - On entering a campaign, the layout shows "Preparing the campaign..." until items, skills, spells, specials and races have all loaded: 5 requests, about 380 KB, 72 ms of desktop CPU (56 ms of it for items alone).
  - This is repeated on every hard refresh, on every screen, including battle pages used at the table on phones.
  - The responses carry no `ETag` or `Cache-Control`, so the browser re-downloads them.
  - The Items page then calls `listItems` again (170 KB, 56 ms CPU) instead of using the prefetched lookups.
- **Impact:**
  - Adds the slowest catalogue call (about 0.2-0.5 s plus CPU) to the critical path of every cold campaign load.
  - Item serialization is the second most expensive CPU consumer, so on a fractional vCPU it slows everyone else's requests.
  - About 0.6 MB per cold campaign load on mobile data.
- **Fix:**
  1. Don't block rendering on lookups. Render the route, and let the components that need lookups (dialogs, edit forms) await them.
  2. Cache the serialized catalogue on the server per `(campaign_id, catalogue_version)`. Bump a `catalogue_version` integer on `Campaign` whenever an item, skill, spell, special or race for that campaign (or a global one) is written, and serve with a weak `ETag` = version plus `Cache-Control: private, max-age=0, must-revalidate`, so repeat loads are a 304 with no serialization. LocMem is fine per worker; Redis (Render Key Value) if you want it shared.
  3. Make Items reuse `lookups.availableItems`.
  4. Check whether Render or its edge compresses JSON (look for `content-encoding` in devtools). If not, the 170 KB item list is about 20 KB gzipped.
- **Effort:** M · **Confidence:** Confirmed (measured payloads and call graph)

### INFRA-PERF-07 · P1 · CPU per request is high for a 0.1-0.5 vCPU instance; size the instance and workers to match
- **Where:** Render plan (open question 2); the serializers measured above
- **What:**
  - About 80% of local request time is Python CPU: battle list 56 ms, items 56 ms, hired-swords detail 23 ms, heroes detail 22 ms, rosters 16-19 ms (`DEBUG=1`; `DEBUG=0` was not measurably faster).
  - Render's Free plan gives 0.1 vCPU and Starter 0.5 vCPU, both on cores slower than a desktop. A cold overview needs about 220 ms of desktop CPU: about 0.45 s or more on Starter and 2.2 s or more on Free, per user, before any DB wait.
  - With `runserver`, all of it is serialized through one GIL.
- **Impact:** Concurrency turns CPU into queueing. Six players loading the overview at once need 2.7 s or more of Starter CPU (13 s or more on Free). That matches "fine alone, slow with several people".
- **Fix:**
  - Do INFRA-PERF-01/05/06 first; they remove most of the CPU.
  - Run at least Starter, not Free (Free also spins down; INFRA-PERF-10). Re-measure with the gunicorn access log's `%(M)s` timing after the fixes, and move to Standard (1 CPU) only if p95 is still high under real load.
  - Use the worker and thread sizing in INFRA-PERF-02.
- **Effort:** S (configuration) · **Confidence:** Likely (CPU measured locally; Render plan unknown)

### INFRA-PERF-08 · P2 · Pusher triggers run synchronously inside write requests, and each battle event makes every other participant refetch state
- **Where:**
  - `backend/apps/realtime/services.py:103-177`
  - `backend/apps/battles/views/shared.py:377-436`
  - `backend/apps/trades/views.py:401,449,519-520,567,595,640,681,728`
  - `backend/apps/campaigns/views.py:1226,1275`
  - `frontend/src/features/battles/hooks/useBattleState.ts:116-129`
- **What:**
  - `transaction.on_commit` callbacks run in the request thread as soon as the outer `atomic()` exits, so the HTTPS call to Pusher (keep-alive session, **5 s timeout**) is part of every battle write's response time.
  - Trades call `send_trade_event` and `send_user_notification` inline, sometimes two in a row (`:519-520`). Chat messages send inline after `create`.
  - Every battle event is a bare "something changed" signal. Each other participant then GETs the full state (8 queries including an `UPDATE`; INFRA-PERF-09).
- **Impact:**
  - Each realtime-emitting write gains a Pusher round trip (about 20-50 ms Frankfurt→Pusher EU on a warm connection, more on a cold TLS handshake).
  - A Pusher slowdown stalls every write for up to 5 s per trigger and holds a gunicorn thread.
  - In an N-player battle each action costs N−1 extra state requests.
  - Failures also turn successful writes into 500s (INFRA-BUG-01).
- **Fix:**
  ```python
  # apps/realtime/dispatch.py
  _pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="realtime")

  def dispatch_after_commit(fn, *args, **kwargs):
      def run():
          try:
              fn(*args, **kwargs)
          except Exception:
              logger.exception("realtime dispatch failed: %s", fn.__name__)
      transaction.on_commit(lambda: _pool.submit(run), robust=True)
  ```
  - Use it for every `send_*` call, construct `pusher.Pusher(..., timeout=3)`, and drop the re-raises.
  - Put the changed state (or the new events since `last_event_id`) in the battle event payload, so clients merge it instead of refetching. This is the ENGINEERING_RULES "realtime events carry the change" rule.
- **Effort:** M · **Confidence:** Confirmed (code); latency figures Likely

### INFRA-PERF-09 · P2 · The battle state and roster GETs write to the database on every call
- **Where:** `backend/apps/battles/views/lifecycle.py:523,535`; `backend/apps/battles/views/shared.py:499-506`
- **What:** `_touch_participant` runs `UPDATE battle_participant SET connection_state, last_seen_at[, last_event_id]` on every state or roster GET (measured: 1 UPDATE in each). Battle writes take `select_for_update()` on the same participant rows (`shared.py:509-524`).
- **Impact:**
  - Each refetch costs one more round trip, a WAL write, and a possible lock wait behind a concurrent battle write, multiplied by the fan-out in INFRA-PERF-08.
  - GETs are no longer safe to retry or cache.
- **Fix:** Update presence at most once per 30-60 s (`if participant.last_seen_at is None or now - participant.last_seen_at > timedelta(seconds=30)`), or move presence to Pusher presence channels. Update `last_event_id` only when it changes.
- **Effort:** S · **Confidence:** Confirmed (measured)

### INFRA-PERF-10 · P2 · Cold starts: migrations on every boot, Neon autosuspend, and Render free-tier spin-down
- **Where:** `backend/entrypoint.sh:4-5`; `backend/apps/core/views.py:13-17`; Neon project settings
- **What:**
  - Every container start runs `wait_for_db` then `migrate`. Even with nothing to apply, `migrate` loads the migration graph and runs `post_migrate` (content types and permissions for about 20 apps), dozens of round trips to Neon on a slow CPU.
  - The keep-awake endpoint keeps Render's process warm but never touches the DB. Neon (on free and launch plans) suspends the compute after about 5 minutes idle, so the first request after a quiet spell pays a Neon cold start of several hundred ms or more.
  - On Render Free the service also spins down after 15 minutes idle, and a boot is tens of seconds.
- **Impact:** The first user of an evening (or after any quiet spell) waits seconds. Deploys and restarts take longer. Not the multi-user slowdown, but it compounds it.
- **Fix:**
  - Move `migrate` to Render's pre-deploy command (paid plans), or keep it in the entrypoint behind `RUN_MIGRATIONS_ON_BOOT` (as above).
  - On a paid Render plan, drop the keep-awake pinger (no spin-down).
  - If Neon cold starts hurt, raise or disable Neon's autosuspend delay (paid), or point the keep-awake at a view that runs `SELECT 1` no more than every 4 minutes. That costs Neon compute hours, so decide consciously.
  - See also AUTH-PERF-06.
- **Effort:** S · **Confidence:** Likely

### INFRA-PERF-11 · P3 · Unbounded list endpoints and minor index gaps
- **Where:**
  - `backend/apps/warbands/views/warbands.py:531-545` (logs)
  - `backend/apps/battles/views/lifecycle.py:65-79` (battles)
  - `backend/apps/campaigns/views.py:1239-1253` (messages, bounded at 50)
  - DRF settings: no `DEFAULT_PAGINATION_CLASS`
- **What:**
  - Warband logs (178 rows locally, 26 KB for warband 2) and trades return every row, ordered by `created_at`, on a single-column `warband_id` index.
  - Composite indexes `(warband_id, created_at)` on `warband_log` and `warband_trades`, and `(campaign_id, created_at)` on `campaign_message`, are missing.
  - About 18 redundant single-column indexes are listed under Measurements.
- **Impact:** Fine today. Payload and sort cost grow linearly over a long campaign.
- **Fix:** Paginate logs and trades with cursor pagination (`?before=<id>&limit=50`) and add the composite indexes:
  ```python
  class Meta:
      indexes = [models.Index(fields=["warband", "-created_at"], name="warband_log_wb_created_idx")]
  ```
  Leave the redundant indexes until the next migration touches those models.
- **Effort:** S · **Confidence:** Confirmed

### INFRA-PERF-12 · P3 · Vercel static assets get no long-lived cache headers
- **Where:** `frontend/vercel.json:1-11`
- **What:** The config has only `filesystem` + SPA fallback routes. Vite's hashed `/assets/*` files get Vercel's default `Cache-Control: public, max-age=0, must-revalidate`, so browsers revalidate every asset on each visit.
- **Impact:** One extra round trip per asset per cold visit (304s). Minor next to the API costs, but free to fix.
- **Fix:**
  ```json
  { "routes": [
      { "src": "/assets/(.*)", "headers": { "cache-control": "public, max-age=31536000, immutable" }, "continue": true },
      { "handle": "filesystem" },
      { "src": "/.*", "dest": "/index.html" }
  ] }
  ```
  Consider an `/api/(.*)` rewrite to Render to remove CORS preflights (AUTH-PERF-03).
- **Effort:** S · **Confidence:** Likely (Vercel default not observed in this session)

## Recommended fix order

Work top to bottom. The impact estimates are for one user on an idle server at 10-30 ms per query unless stated otherwise.

1. **Answer the six deployment questions** (15 min). Run the Manual QA step 2 RTT snippet from a Render shell. Every later step gets a real number.
2. **gunicorn + persistent connections + safe defaults** (INFRA-PERF-02, INFRA-PERF-03, INFRA-SEC-01; S, about 1-2 h). Expect about 50-150 ms off every request, no reloader CPU burn, at most 16 bounded Neon connections, killed hung requests, and the debug-page leak closed. Deploy this first: it is configuration only.
3. **Fix the battle list and its callers** (INFRA-PERF-01; S+S, half a day). Cold overview 249 → about 100 queries; tab return 316 → about 5; critical path about 99 → about 34 queries (about 1.4 s → about 0.5-0.7 s at 10 ms). This is the biggest single win.
4. **Pusher off the request path and robust `on_commit`** (INFRA-PERF-08, INFRA-BUG-01; S-M). Writes lose 20-50 ms (seconds during a Pusher incident) and stop returning false 500s.
5. **Warband N+1s and preamble** (INFRA-PERF-05; M, one day). Warband page 62 → about 30 queries; Edit 38-96 → about 13-35; `players` constant.
6. **Co-locate DB and app** (INFRA-PERF-04; M), if step 1 shows 8 ms or more per query. Every remaining query gets about 5-10× cheaper.
7. **Unblock and cache the catalogue** (INFRA-PERF-06; M). Cold campaign entry loses about 0.2-0.5 s and about 370 KB; repeat visits are 304s; the Items page halves its cost.
8. **Stop writing on battle GETs** (INFRA-PERF-09; S).
9. **Logging, a request-timing log and Dockerfile hygiene** (INFRA-CQ-01, INFRA-CQ-02, INFRA-BUG-02; S). Production 500s become visible, and slow endpoints can be found from Render logs.
10. **Right-size the Render plan** (INFRA-PERF-07). Only after 2-7, using real p95s from the access log.
11. **Polish** (INFRA-PERF-10, INFRA-PERF-11, INFRA-PERF-12, INFRA-SEC-02, INFRA-CQ-03).

After steps 2, 3 and 5 the cold overview should be about 90 queries in total, with a critical path of about 27 (me 1 → campaign 4 → items 15 → players 7; estimate). That is roughly 0.45-1.1 s for one user at 10-30 ms, and the server keeps headroom for six. Unblocking the catalogue (step 7) takes the path down to about 12 queries.

## Bugs

### INFRA-BUG-01 · P1 · A Pusher failure turns a committed battle or trade write into a 500 and drops the remaining notifications
- **Where:**
  - `backend/apps/battles/views/shared.py:406-421` (`raise` at `:412`, `:421`)
  - `backend/apps/realtime/services.py:108-118`, `:139-149`
  - `backend/apps/trades/views.py:449,519-520,567,595,640,681,728` (no `try` at all)
  - `backend/apps/campaigns/views.py:1275`
- **What:**
  - Battle notifications are queued with `transaction.on_commit(...)` (non-robust), and the callbacks re-raise any Pusher exception. In Django 5.0 a non-robust `on_commit` callback that raises propagates out of the `atomic()` exit into the view, *after* the commit, and the remaining queued callbacks are discarded.
  - Trade and chat calls raise straight from the view after the DB change.
- **Impact:** During a Pusher outage, timeout or credentials problem:
  - A battle action, trade completion (`:595`, after the trade is applied) or chat message is saved, but the user gets a 500. They retry, and may double-apply where the action isn't idempotent.
  - The other participants never get the event.
  - Each failure can also take up to 5 s first.
- **Fix:** Use `transaction.on_commit(fn, robust=True)` (Django 4.2+), and delete the `raise` in `_send_*_after_commit` and in `services.py`. Better, route everything through the background `dispatch_after_commit` in INFRA-PERF-08. Add the INFRA-TEST-06 regression test.
- **Effort:** S · **Confidence:** Confirmed (code path; Django semantics)

### INFRA-BUG-02 · P2 · `wait_for_db.py` ignores `DATABASE_URL` and never times out
- **Where:** `backend/wait_for_db.py:7-23`; `backend/entrypoint.sh:4`
- **What:** The script connects using `POSTGRES_HOST` (default `db`), `POSTGRES_USER` and so on, while Django uses `DATABASE_URL` when it is set. It loops forever with a 1 s sleep and prints the exception each time.
- **Impact:** A Docker deploy that sets only `DATABASE_URL` (the documented Neon path) hangs at "Waiting for database..." and never boots. A deploy where `POSTGRES_*` points somewhere stale waits on the wrong host while Django would have connected fine. The script also tells you nothing about which variables it used.
- **Fix:**
  ```python
  url = os.environ.get("DATABASE_URL")
  conninfo = url if url else psycopg.conninfo.make_conninfo(...)
  deadline = time.monotonic() + int(os.environ.get("DB_WAIT_TIMEOUT", "60"))
  while True:
      try:
          with psycopg.connect(conninfo, connect_timeout=5):
              return
      except Exception as exc:
          if time.monotonic() > deadline:
              raise SystemExit(f"Database not reachable: {exc.__class__.__name__}")
          time.sleep(2)
  ```
  Don't print the URL, because it contains the password.
- **Effort:** S · **Confidence:** Confirmed (code); production effect depends on question 1

## Code quality

### INFRA-CQ-01 · P2 · No `LOGGING` config: 500 tracebacks are silent when `DEBUG` is off, and nothing records request timings
- **Where:** `backend/config/settings.py` (no `LOGGING`; app loggers in `apps/realtime/services.py:13`, `apps/battles/views/shared.py`)
- **What:**
  - Django's default logging sends `django.request` errors to `console` only when `DEBUG=True`, and to `mail_admins` (no `ADMINS`, so nowhere) when `DEBUG=False`. With `DJANGO_DEBUG=0` on Render, unhandled exceptions return 500 and leave **no traceback in Render's logs**.
  - The app's own `logger.info(...)` calls (for example "Sending battle event after commit") are dropped. `runserver` logs request lines without durations.
- **Impact:** You can't see production errors or find slow endpoints from logs, which is exactly the visibility this slowdown needs.
- **Fix:**
  ```python
  LOGGING = {
      "version": 1, "disable_existing_loggers": False,
      "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
      "handlers": {"stdout": {"class": "logging.StreamHandler", "formatter": "plain"}},
      "root": {"handlers": ["stdout"], "level": os.environ.get("LOG_LEVEL", "INFO")},
      "loggers": {"django.request": {"handlers": ["stdout"], "level": "WARNING", "propagate": False},
                  "django.db.backends": {"level": "WARNING"}},
  }
  ```
  Add gunicorn's access log with `%(M)sms` (INFRA-PERF-02). Optionally add a 20-line middleware that logs `path, status, ms, len(connection.queries)` when a request exceeds 500 ms (query counting needs `connection.force_debug_cursor` or a `CaptureQueriesContext`-style `execute_wrapper`).
- **Effort:** S · **Confidence:** Confirmed (Django default logging behaviour)

### INFRA-CQ-02 · P2 · Dockerfile hygiene: the lockfile is ignored, the uv image is unpinned, the container runs as root, and migrations live in the entrypoint
- **Where:** `backend/Dockerfile:3,10-11,14-28`; `backend/entrypoint.sh:5`
- **What:**
  - The builder copies only `pyproject.toml` and runs `uv sync --no-dev --no-install-project` without `--frozen`/`--locked`, so `uv.lock` is never used and transitive versions float on every build.
  - `ghcr.io/astral-sh/uv:latest` is unpinned.
  - There is no non-root user and no `HEALTHCHECK`. `EXPOSE 8000` is hard-coded, while Render injects `$PORT`.
- **Impact:** Non-reproducible builds: a dependency release can change production behaviour without a commit. It is also a slightly larger attack surface.
- **Fix:**
  ```dockerfile
  COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/
  COPY pyproject.toml uv.lock /app/
  RUN uv sync --no-dev --no-install-project --frozen
  ...
  RUN useradd --create-home app && chown -R app /app
  USER app
  ```
  Pin to whatever uv version you use locally. Keep the entrypoint as in INFRA-PERF-02, and bind `${PORT:-8000}`.
- **Effort:** S · **Confidence:** Confirmed

### INFRA-CQ-03 · P3 · Settings hygiene
- **Where:** `backend/config/settings.py:27-31,60-69,107-130,161`
- **What:**
  - Env parsing is inconsistent: `DEBUG` uses `== "1"` while other flags use `_env_bool`.
  - Unused session, CSRF and messages middleware and apps are loaded for a JWT-only API (no admin is installed).
  - DRF's default renderers include `BrowsableAPIRenderer` in production.
  - There is no `STATIC_ROOT` (fine while no static files are served, but `collectstatic` would fail).
  - There is no development/production split, so every production-sensitive value is a `getenv` with a development default.
- **Impact:** Easy to misconfigure. A small per-request overhead and HTML API pages exposed in production.
- **Fix:**
  - Use `_env_bool` everywhere.
  - Set `REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = ("rest_framework.renderers.JSONRenderer",)` unless `DEBUG`.
  - Drop `SessionMiddleware`, `MessageMiddleware` and `django.contrib.messages` and `sessions` if nothing uses them (check the tests).
  - Add a startup assertion block for production (see INFRA-SEC-01).
- **Effort:** S · **Confidence:** Confirmed

## Security

### INFRA-SEC-01 · P1 (P0 if unset on Render) · `DEBUG` defaults to on
- **Where:** `backend/config/settings.py:28`
- **What:** `DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"`: if the variable is missing, production runs with `DEBUG=True`.
- **Impact:**
  - Any unhandled error renders Django's technical 500 page to the public, including settings (partially masked), installed apps, the request and local variables.
  - Debug also stores every SQL query per request.
  - Combined with the `SECRET_KEY` fallback (AUTH-SEC-01) and the throttle identity issue (AUTH-SEC-03), one missing variable on Render exposes a lot.
- **Fix:**
  ```python
  DEBUG = _env_bool("DJANGO_DEBUG", False)
  if not DEBUG:
      from django.core.exceptions import ImproperlyConfigured
      if SECRET_KEY == "dev-secret-key" or len(SECRET_KEY) < 50:
          raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set")
      if os.environ.get("RATE_LIMIT_NUM_PROXIES") is None:
          raise ImproperlyConfigured("RATE_LIMIT_NUM_PROXIES must be set behind Render's proxy")
  ```
  Compose already sets `DJANGO_DEBUG: "1"` for local dev, so dev is unaffected. Run `python manage.py check --deploy` in CI with production-like environment variables.
- **Effort:** S · **Confidence:** Confirmed (code); production value unknown

### INFRA-SEC-02 · P3 · No HTTPS hardening settings
- **Where:** `backend/config/settings.py` (no `SECURE_*`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS`)
- **What:** Render terminates TLS and forwards plain HTTP. Django is never told (`SECURE_PROXY_SSL_HEADER`), so `request.is_secure()` is False, and no HSTS header is sent. Cookies are unused today (JWT in a header), so the cookie flags are latent.
- **Impact:** Low today. It matters as soon as anything uses cookies (for example an httpOnly refresh cookie; see AUTH-SEC-04) or builds absolute URLs.
- **Fix:** When `not DEBUG`:
  ```python
  SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
  SECURE_HSTS_SECONDS = 31536000
  SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
  ```
  Leave `SECURE_SSL_REDIRECT` off (Render already redirects).
- **Effort:** S · **Confidence:** Confirmed

Cross-references, not repeated here: AUTH-SEC-01 (`SECRET_KEY` fallback signs JWTs), AUTH-SEC-03 (LocMem throttles are per process; `NUM_PROXIES` unset lets clients spoof `X-Forwarded-For`), AUTH-PERF-03 (CORS preflights), AUTH-PERF-04 (JWT user lookup per request), AUTH-PERF-05 (Resend in the request path), AUTH-PERF-06 (keep-awake).

## Test plan

### Existing coverage

- There is no `assertNumQueries` or `CaptureQueriesContext` anywhere in `backend/apps` (14 test files). No endpoint has a query budget, so every N+1 above slipped in unnoticed.
- `backend/apps/core/tests/test_rate_limiting.py` covers throttle rates and confirms health and keep-awake are exempt (`:442-450`). It forces `NUM_PROXIES=1`, which hides the production misconfiguration noted in AUTH-SEC-03.
- There are no tests for settings safety (`DEBUG` default, `SECRET_KEY`, connection settings), `wait_for_db`, the container start command, or Pusher failure handling.
- There is no CI (no `.github/`), and no load-test or benchmark script in the repo.

### Gaps and proposed tests

| ID | Level | Scenario | Expected | Priority |
| --- | --- | --- | --- | --- |
| INFRA-TEST-01 | Backend integration | `GET /campaigns/<id>/battles/` with 2 battles vs 20 battles for the user (`CaptureQueriesContext`) | Same count both times, ≤ 5 queries; `?status=open` returns only open battles | P0 |
| INFRA-TEST-02 | Backend integration | `heroes/detail`, `hired-swords/detail`, `henchmen-groups/detail` with 1 item vs 10 distinct items, each with 2 availabilities × 2 restrictions | Constant count, ≤ 14 | P1 |
| INFRA-TEST-03 | Backend integration | `GET /campaigns/<id>/players/` with 2 vs 8 warbands | Constant count, ≤ 7 | P1 |
| INFRA-TEST-04 | Backend integration | Table-driven query budget for every endpoint in the Measurements table (`assertNumQueries(budget)` with a seeded fixture campaign) | Each endpoint within budget; budgets live in one dict so a PR that raises one is visible | P1 |
| INFRA-TEST-05 | Backend integration | Battle `state` and `rosters` GET twice within 30 s | No `UPDATE` in the second request's captured queries | P2 |
| INFRA-TEST-06 | Backend integration | Patch `pusher.Pusher.trigger` to raise or time out; run a battle unit-kill, a trade completion and a chat post | 2xx response, DB change persisted, error logged, no 500 | P1 |
| INFRA-TEST-07 | Backend unit | Import settings with `DJANGO_DEBUG` unset | `DEBUG is False`; with `DEBUG` False and the default `SECRET_KEY`, `ImproperlyConfigured` is raised | P1 |
| INFRA-TEST-08 | Backend unit | Import settings with `DATABASE_URL` set | `CONN_MAX_AGE > 0` and `CONN_HEALTH_CHECKS is True` | P1 |
| INFRA-TEST-09 | Script unit | `wait_for_db` with only `DATABASE_URL` set, and with an unreachable host and a 2 s timeout | Uses the URL; exits non-zero after the timeout without printing the password | P2 |
| INFRA-TEST-10 | Load (manual or CI-optional) | Commit a GET-only `scripts/loadtest.py` (the mix used here: battle list, items, heroes, summary, players, hired-swords detail, campaign detail; 1/5/20 clients × 15 s) and run it against staging before and after each perf PR | Record p50/p95/req/s in the PR. Target after fixes: p95 < 500 ms at 5 clients against Neon | P1 |
| INFRA-TEST-11 | Frontend (Vitest + RTL) | Mount the overview, then fire `focus` and `visibilitychange` | `listCampaignBattles` is called once on mount and at most once per debounce window on focus | P1 |
| INFRA-TEST-12 | Frontend (Vitest + RTL) | `CampaignLayout` with catalogue requests still pending | The overview route content renders; lookups resolve later | P2 |
| INFRA-TEST-13 | Container smoke | Build the image, run it with `DATABASE_URL` pointing at a test Postgres | Process is gunicorn (not `runserver`); `/api/health/` returns 200 within 30 s | P2 |
| INFRA-TEST-14 | Backend integration | With `DEBUG=False` and `LOGGING` configured, hit a view that raises | Traceback is emitted to stdout via `django.request` | P3 |
| INFRA-TEST-15 | CI | `python manage.py check --deploy` with production-like env | No errors | P3 |

### Manual QA script

Run before and after each fix in the order above. All steps are read-only.

1. **Confirm the deployment.** In the Render dashboard, record the service type, start command, plan, region, instance count and health-check path. In Environment, confirm `DJANGO_DEBUG=0`, a long `DJANGO_SECRET_KEY`, `RATE_LIMIT_NUM_PROXIES`, and whether `DATABASE_URL` has `-pooler` in the host. Do not paste values into tickets.
2. **Measure DB latency from Render.** In the Render shell (`python manage.py shell`):
   ```python
   import time
   from django.db import connection
   connection.close(); t = time.perf_counter(); connection.ensure_connection(); print("connect ms", (time.perf_counter() - t) * 1000)
   c = connection.cursor(); t = time.perf_counter()
   for _ in range(20): c.execute("SELECT 1")
   print("per-query ms", (time.perf_counter() - t) / 20 * 1000)
   ```
   Record both numbers. Repeat after 10 idle minutes to see the Neon cold start.
3. **Cold overview.** In Chrome devtools Network (disable cache, "Fast 4G"), hard-refresh `/campaigns/<id>`:
   - Count API requests and preflights.
   - Note the slowest request and the time until "Preparing the campaign..." disappears.
   - Check whether JSON responses have `content-encoding: br/gzip`.
   - Expected today: about 18 API calls, and `battles/` about 100 KB and the slowest.
4. **Tab-return storm.** With the overview open, switch to another tab and back. Count new `battles/` requests: 2-4 today, 0-1 expected after INFRA-PERF-01.
5. **Warband page.** Navigate overview → own warband → another player's warband. Note the request count (6 each) and the time to first full render. Click Edit and note the `heroes/detail` time.
6. **Battle at the table.** Two people (two browsers) in one battle on phones. Perform 5 actions and watch the other device's network panel: one `state` GET per action today. Note the per-action latency on the actor's device.
7. **Multi-user.** Have 4-6 people open the overview at the same time, then each switch tabs twice. Watch the Render metrics (CPU %, memory, response time) and the access log (`%(M)sms` after INFRA-PERF-02). Before the fixes, expect CPU pinned at the plan limit and battle-list calls taking seconds.
8. **Pusher failure (staging only).** Set a wrong `PUSHER_SECRET` on a staging service and perform a battle action and a chat message. Today: 500 but data saved. After INFRA-BUG-01: 2xx and a logged error.
9. **After each deploy,** re-run steps 3-7 and record the numbers next to the "before" values in the PR description.
