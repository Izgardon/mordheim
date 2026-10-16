# Performance Plan

> Built from docs/review/features/*.md on 2026-10-16. Source IDs link to the feature files for full detail.

**Conventions.** Query counts include the per-request JWT user lookup unless marked "excl. JWT". Projections use the formula from [08][08]: queries × RTT at **10 ms and 30 ms per query** (Frankfurt → London is typically 10-20 ms; not yet measured from Render). "Derived" means computed here from a measured count with that formula. Severity and effort follow [README.md](README.md): effort **S** < 2 h, **M** half to one day, **L** multi-day.

## Diagnosis

The app is slow because every screen asks the database far too many questions, and in production each question is a network round trip from Render (Frankfurt) to Neon (London). A cold campaign overview makes **18 API calls and 249 SQL queries**; the warband sheet makes 62 queries over 6 calls; a single hero XP "+" click costs about 77. Every request also opens a brand-new TLS connection to Neon (`CONN_MAX_AGE=0`, about 50-150 ms each), and if Render runs the Dockerfile, requests are served by Django's dev server `runserver`: one process, an autoreloader polling about 700 files a second, no timeouts. The single worst offender is the campaign battle list, an N+1 that runs **78 queries and returns 102 KB** to find at most one open battle. It is fetched twice on every overview load and 2 to 4 more times whenever anyone switches back to the tab (**316 queries per refocus**). The frontend multiplies all of this. There is no client cache, so every mount refetches and the same endpoints are fetched from several components. Every campaign screen waits behind five catalogue downloads (about 380 KB, re-downloaded on every entry, uncompressed, with no HTTP caching). Mobile pull-to-refresh reloads the whole app. Realtime events are bare "something changed" pings, so each battle tap makes every other player refetch full state (8 queries including a write). Writes also wait for synchronous Pusher calls (5 s default timeout) before they respond.

Why it is "fine alone, slow with several people": about 80% of local request time is Python CPU. A cold overview needs about 220 ms of desktop CPU, which is 0.45 s or more on Starter's 0.5 vCPU, so six players opening the overview together is about 1,500 queries and at least 2.7 s of CPU queueing on one instance before any network wait. Adding gunicorn workers alone cannot fix that, because the 0.5 vCPU instance is the ceiling. The durable fix is to cut queries and CPU per screen, then reuse connections and bound concurrency. **Ruled out:** indexes and data volume (the database is 16 MB, the largest table has 385 rows, the hot composite indexes exist, and every plan is trivially fast); `DEBUG` (181 ms vs 181 ms in the emulation, so flipping it is a security fix, not a speed fix); and Render cold starts (Starter never spins down and UptimeRobot pings it). Neon's own autosuspend can still slow the first request after a quiet spell.

## Where the time goes today

| Screen or action | Requests | Queries | Critical path @10 / @30 ms | Top cause | Measured in |
| --- | ---: | ---: | --- | --- | --- |
| Campaigns list (cold) | 3 | 6 | 0.15 / 0.43 s | none significant | [08][08] |
| **Campaign overview (cold)** | 18 | **249** | **1.4 / 3.8 s** (aggregate DB 2.5 / 7.5 s; 222 ms CPU; 584 KB) | Battle list ×2 = 156 queries; catalogue gate puts items (14 q, 170 KB) on the path; 3-4 sequential waves | [08][08] (CAMP's 231 + 17 JWT agrees) |
| **Overview, tab refocus** | 4 | **316** | 1.3 / 3.0 s (aggregate 3.2 / 9.5 s) | `focus` + `visibilitychange` in 2 components → 4 × battle list | [08][08] |
| Overview roster row expand | 3 | 41 | aggregate 0.41 / 1.2 s (derived) | Full unit endpoints fetched to show stat lines | [02][02] |
| **Warband sheet, own (in-app)** | 6 | 62 | 0.34 / 1.0 s | 20 preamble queries; 2-stage loader | [08][08], [03][03] |
| Warband sheet, other player's | 6 | 58 | 0.33 / 0.95 s | Same | [08][08] |
| Warband sheet (cold refresh) | 17 | 201 | 0.8 / 2.1 s | Catalogue gate and battle list before the sheet starts | [08][08] |
| Warband "Edit" click | 1-3 | 38-96 | 0.4 / 1.2 s | `ItemAvailability` N+1 | [08][08], [03][03] |
| Expand hero card / open level-up dialog | 1 each | 36 each | 0.36 / 1.1 s each (derived) | Summary lacks `race`, so detail is fetched; N+1 | [03][03] |
| **Hero XP "+" click** | 1 | ~78 | ~0.8 / 2.3 s (derived) | `refresh_from_db()` drops prefetch: 51 measured for the response alone | [03][03] |
| Henchmen / hired-sword XP click | 2 sequential | ~44-64 | ~0.4-0.6 / 1.3-1.9 s (derived) | PATCH plus a blanket `/summary/` refetch | [03][03] |
| **Item purchase** (Acquire dialog) | ~8 | ~140-150 | ~1.5 s aggregate DB @10 ms | Browser-orchestrated waterfall; all unit item rows deleted and recreated | [04][04] |
| Item move / sell | 2 | ~58-98 | ~0.6-1.0 / 1.7-2.9 s (derived) | Both units re-serialized inside the open transaction | [04][04] |
| **Trade offer edit** / lock | 3 / 4 | ~32 / ~44 | ~0.3 / 1.0 s per edit (derived) + a Pusher call | Self-echo makes both browsers refetch `/summary/` | [04][04] |
| Prebattle or active battle (in-app) | 2 | 37 | 0.5 / 1.5 s | Rosters: 28 queries | [08][08], [05][05] |
| Postbattle (in-app) | 3 | 44 | 0.5 / 1.5 s | Rosters + resources | [08][08] |
| Active battle (cold refresh) | 12 | 97 | 1.0 / 2.6 s | Catalogue gate + rosters | [08][08] |
| **Battle action, per other participant** | 1 each | 8 (incl. 1 UPDATE) | 0.13 / 0.39 s each | Bare event → full state GET. Per tap: N=2 is 18 round trips, N=4 is 34 | [08][08], [05][05] |
| Finalise postbattle (per player) | 1 | ~62-70 inside the battle row lock | lock ~0.6-0.7 s @10 ms (~2 s @30, derived) | Per-row saves; players finalising together serialise | [05][05] (estimated from code) |
| Items page (in-app) | 3 | 20 | 0.3 / 0.7 s | Items list (170 KB) downloaded a second time | [08][08] |
| Skills / Spells page | 2 | 7 | 0.1 / 0.3 s | | [08][08] |
| Bestiary / Hired swords page | 3 / 2 | 11 / 9 | 0.1-0.14 / 0.3-0.38 s | | [08][08] |
| Bestiary / hired-sword detail | 1 | 44 / 46 | ~0.45 / 1.35 s (derived) | Nested item N+1 | [06][06] |
| Login | ~9 (+3 Pusher cycles) | ~9 | 3 serial `/auth/me` | `/auth/me` fired 3 times | [01][01] |
| Mobile pull-to-refresh | ~20 + 2 Pusher auths | full cold load | Full reboot, incl. JS parse | `window.location.reload()` | [07][07] |
| First visit / every deploy | 2.42 MB entry JS (540 KB gzip) + 1.5 MB Lottie WASM | | ~1-2 s main-thread parse on a mid-range phone | No route splitting | [07][07] |

Not included in the projections: +5 × RTT per request for the new Neon connection today (+50 / +150 ms); one CORS preflight per first-seen URL in production ([AUTH-PERF-03][01]); browser↔Render latency; and the slowdown of a fractional vCPU. Six players opening the overview together is about 1,500 queries and at least 2.7 s of Starter CPU; each tab refocus adds 316 queries and about 0.45 s of CPU ([INFRA-PERF-07][08]).

## Targets

Budgets for after Tiers 0-2. They are realistic because each one comes from a source file's proposed fix or test.

**Per screen and action**

| Screen or action | Today: requests / queries | Target: requests / queries | Basis |
| --- | --- | --- | --- |
| Campaign overview (cold) | 18 / 249 | **≤ 12 / ≤ 90**, critical path ≈ 12 queries | INFRA fix order estimate; FE-TEST-05 |
| Overview, tab refocus | 4 / 316 | **≤ 1 / ≈ 5**, and 0 within `staleTime` | INFRA-PERF-01; FE-TEST-07 |
| Overview revisit (in-app) | 7 / ~110 (derived, incl. one battle list) | **0** within `staleTime` | FE-TEST-06 |
| Warband sheet (in-app) | 6 / 62 | **1-2 / ≤ 20** (about 30 interim, before the sheet endpoint) | ROST-PERF-03; INFRA-PERF-05 |
| Warband "Edit" click | 1-3 / 38-96 | **0** (detail served by the sheet) or 1 / ≤ 12 | ROST-PERF-06; ROST-TEST-01 |
| Hero XP click | 1 / ~78 | **1 / ≤ 12** (about 6 with a slim XP endpoint) | ROST-TEST-02 |
| Henchmen / hired-sword XP click | 2 / ~44-64 | **1 / ≤ 12** | ROST-PERF-04 |
| Item purchase | ~8 / ~145 | **1 / ~10-12** | ECON-PERF-01 |
| Item move / sale | 2 / 58-98 | **1 / ≤ 15** (sale ≤ 12) | ECON-TEST-14 |
| Trade offer edit | 3 / ~32 | **1 / ≤ 6**, no summary GETs | ECON-TEST-14 |
| Battle page entry (in-app) | 2 / 37 | state ≤ 4; rosters once per battle, not per phase | BATL-TEST-05; BATL-PERF-07 |
| Battle action, per other participant | 1 / 8 | **0** (patch from the event); fallback 1 / ≤ 4 on a version gap | BATL-PERF-02 |
| Finalise postbattle | ~62-70 inside the lock | **≤ 30**; battle row locked only for the final step | BATL-TEST-07 |
| Items page | 3 / 20 | items from the cache; repeat visits are 304s | INFRA-PERF-06; CAT-TEST-06 |
| Bestiary / hired-sword detail | 44 / 46 | **≤ 12** | CAT-TEST-08 |
| Overview roster row expand | 3 / 41 | **1 / 3-4** | CAMP-PERF-04 |
| Login | ~9 | **3** | AUTH-PERF-02 |
| Entry JS bundle | 540 KB gzip | **≤ 250 KB gzip** (landing ~100 KB) | FE-PERF-03; FE-TEST-27 |
| Load test against Neon | runserver p95 2.3 s at 20 clients (local) | **p95 < 500 ms at 5 clients** | INFRA-TEST-10 |

**Per-endpoint query budgets** (enforced with `assertNumQueries` via `force_authenticate`, so **excl. JWT**; add 1 in production). Each budget must stay constant as rows grow. Keep them in one dict so a PR that raises a budget is visible (INFRA-TEST-04).

| Endpoint | Today (excl. JWT) | Budget | Test ID |
| --- | ---: | ---: | --- |
| `GET /campaigns/:id/battles/current/` (or `?status=open`) | 78 (2 + 2 per battle) | ≤ 4 | CAMP-TEST-02, BATL-TEST-06, INFRA-TEST-01 |
| `GET /campaigns/:id/players/` | 13 (4 + 3 per warband) | ≤ 6 | CAMP-TEST-01 (INFRA-TEST-03 allows 7) |
| `GET /warbands/:id/summary/` | 12 | ≤ 6 | ROST-TEST-01, ECON-TEST-14 |
| `GET /warbands/:id/{heroes,henchmen-groups,hired-swords}/` | 11-14 | ≤ 10 | ROST-TEST-01 |
| `GET /warbands/:id/{…}/detail/` | 20-37 | ≤ 12 | ROST-TEST-01 (INFRA-TEST-02 allows 14) |
| `GET /warbands/:id/sheet/` (new) | 54 over 5 requests | ~15-20 | ROST-PERF-03 |
| `PATCH /warbands/:id/heroes/:id/` (XP only) | ~77 | ≤ 12 | ROST-TEST-02 |
| `POST /warbands/:id/purchases/` (new) | ~140 over 8 requests | ~10-12 | ECON-PERF-01, ECON-TEST-13 |
| `POST item-transfers/` / `POST item-sales/` | ~58-98 / ~18-58 | ≤ 15 / ≤ 12 | ECON-TEST-14 |
| `GET /warbands/:id/items/` / `logs/` (one page) | 6 / 6 (all rows) | ≤ 4 / ≤ 4 | ECON-TEST-14 |
| `POST trade-requests/:uuid/offer/` | 4-8 | ≤ 6 | ECON-TEST-14 |
| `GET battles/:id/state/` | 7 (incl. 1 UPDATE) | ≤ 4, no writes | BATL-TEST-05, INFRA-TEST-05 |
| `GET battles/:id/rosters/` | 28 (incl. 1 UPDATE) | no writes; record the baseline, set the budget in pass 3 | BATL-PERF-07 |
| `POST finalize-postbattle/` (fixture warband) | ~62-70 (estimated) | ≤ 30 | BATL-TEST-07 |
| `GET /items/?campaign_id=` | 14 | 8 on a cache miss; ≤ 2 on a 304 | CAT-PERF-07, CAT-TEST-06/07 |
| Other catalogue lists | 4-6 | constant; ≤ 2 on a 304 | CAT-TEST-07 |
| `GET /bestiary/:id/`, `GET /hired-swords/:id/` | 43 / 45 | ≤ 12 | CAT-TEST-08 |
| Campaign detail, battle-history, pivotal-moments, top-killers, members, messages | 3, 3, 2, 2, 4, 2 | ≤ today's constant | CAMP-TEST-03 |
| `GET /auth/me/` / `GET /health/`, `HEAD /keep-awake/` | 1 / 0-1 (with JWT) | ≤ 1 / 0 | AUTH-TEST-08, AUTH-TEST-14 |

## Fix plan

### Tier 0 — Infrastructure (Phase 0.1): no feature code changes

#### PERF-01 · P0 · Size gunicorn properly (production runs one sync worker); stop serving the image with `runserver`
- **Sources:** [INFRA-PERF-02][08]; production facts in [NOTES.md](NOTES.md)
- **Production (confirmed 2026-10-16):** Render runs natively with `uv run gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` and no `WEB_CONCURRENCY`, no flags and no config file. That means gunicorn's defaults: **one sync worker, one request at a time**. Every user's requests queue behind whichever request is in flight, and each request is dominated by Frankfurt → London query round trips. This is the main multi-user bottleneck, and it is worse than the local `runserver` measurements below, because runserver at least runs requests on parallel threads.
- **Fix for production:** add `backend/gunicorn.conf.py`. gunicorn loads `./gunicorn.conf.py` from the working directory automatically, so the existing Render start command picks it up with **no dashboard change**. The `--bind` on the command line still wins. Contents: `worker_class = "gthread"`, `workers = int(os.environ.get("WEB_CONCURRENCY", 2))`, `threads = int(os.environ.get("GUNICORN_THREADS", 8))`, `timeout = 60`, `graceful_timeout = 30`, `keepalive = 5`, `max_requests = 1000`, `max_requests_jitter = 100`, and the access log with `%(M)sms`. Optionally move `migrate` to Render's pre-deploy command.
- **Problem (local image):** `entrypoint.sh` ends in `exec python manage.py runserver` (no `--noreload`), and gunicorn is installed but never started. Measured locally, `runserver` is pinned at about 25 req/s, with p95 2.3 s at 20 clients versus 0.8 s for gunicorn `-w 2 --threads 4`. The idle reloader burns 0.4 s CPU per 10 s (about 8-15% of a 0.5 vCPU, estimated). Its unbounded threads let bursts open dozens of Neon connections, and hung requests are never killed.
- **Fix:** make gunicorn the image's server and keep `runserver` only in `docker-compose.yml` (`command: sh -c "python wait_for_db.py && python manage.py runserver 0.0.0.0:8000"`):
  ```sh
  exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" --threads "${GUNICORN_THREADS:-8}" --worker-class gthread \
    --timeout 60 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 100 \
    --access-logfile - --access-logformat '%(h)s "%(r)s" %(s)s %(b)s %(M)sms'
  ```
  On Starter, use 2 workers × 8 threads: 16 request slots, at most 16 DB connections, about 2 × 130 MB plus the master in 512 MB. If Render is a native service, put the same command in Start Command. Set the health-check path to `/api/health/`.
- **Expected impact:** bounded, killable concurrency, no reloader CPU burn, and connection reuse becomes possible (PERF-02). In the 10 ms emulation, gunicorn 2×12 with persistent connections served 49.6 req/s at a p50 of 262 ms at 20 clients, against 24.9 req/s and 552 ms for today's setup. On 0.5 vCPU it will not double throughput by itself.
- **Effort:** S · **Plan phase:** 0.1 (P0 only if Render runs the Dockerfile; P2 if the start command is already gunicorn)

#### PERF-02 · P0 · Persistent DB connections with health checks
- **Sources:** [INFRA-PERF-03][08]; ships with [INFRA-SEC-01][08] (`DEBUG` default)
- **Problem:** `dj_database_url.config()` runs without `conn_max_age`, so every request does TCP + TLS + SCRAM auth through Neon's proxy before its first query. Measured: +5.2 ms per request locally (no TLS), and campaign detail **102 → 46 ms** in the 10 ms emulation. A real Neon connect is typically 50-150 ms from another city. A cold overview pays it 18 times, about 4 of them on the critical path.
- **Fix:**
  ```python
  DEBUG = _env_bool("DJANGO_DEBUG", False)          # security fix, same PR
  CONN_MAX_AGE = _env_int("DB_CONN_MAX_AGE") or 600
  DATABASES = {"default": dj_database_url.config(default=os.environ["DATABASE_URL"],
      conn_max_age=CONN_MAX_AGE, conn_health_checks=True, ssl_require=not DEBUG)}
  ```
  Apply the same to the `POSTGRES_*` branch. The direct endpoint is fine at ≤ 16 connections. If you switch to the `-pooler` host, also set `DISABLE_SERVER_SIDE_CURSORS = True` (and `"OPTIONS": {"prepare_threshold": None}` if prepared-statement errors appear). Later, Django 5.2's native psycopg pool is an option. This needs PERF-01: `runserver` starts a thread per request, so it can't reuse connections.
- **Expected impact:** about 50-150 ms off every request (about 0.2-0.6 s off the cold-overview critical path, derived); +18-25% throughput at 1-5 clients in the emulation; connection count bounded.
- **Effort:** S · **Plan phase:** 0.1

#### PERF-03 · P2 · Production request timing and error logs
- **Sources:** [INFRA-CQ-01][08] (code-quality finding; it is the visibility every later step needs)
- **Problem:** there is no `LOGGING`. With `DEBUG=0`, 500 tracebacks never reach Render's logs, and nothing records request durations, so slow endpoints can't be found in production.
- **Fix:** `LOGGING` to stdout (root `INFO`, `django.request` at `WARNING`), the gunicorn access log with `%(M)sms` (PERF-01), and optionally a 20-line middleware that logs `path, status, ms, query count` when a request exceeds 500 ms.
- **Expected impact:** no speed change; it makes every later before/after number visible from Render logs.
- **Effort:** S · **Plan phase:** 0.1

#### PERF-04 · P2 · Compress JSON responses and cache hashed static assets
- **Sources:** [CAT-PERF-02][06] (gzip step), [INFRA-PERF-06][08] (step 4), [INFRA-PERF-12][08], [ECON-PERF-06][04] (no `GZipMiddleware`)
- **Problem:** there is no `GZipMiddleware`, so the items list goes out as 170 KB where gzip would make it 35 KB, and the five catalogues total about 380 KB where gzip would make it about 95 KB (CAT measured). Vite's hashed `/assets/*` get Vercel's default `max-age=0, must-revalidate`, so every asset is revalidated on each visit.
- **Checked in production (2026-10-16):** Render's Cloudflare edge already Brotli-compresses API responses (`Content-Encoding: br` on `/api/health/`), and Vercel Brotli-compresses the bundle. **Django gzip is not needed**; it would only spend the 0.5 CPU. The asset-caching half was real: the 2.4 MB bundle was served with `max-age=0, must-revalidate`. It is fixed in `frontend/vercel.json`, scoped to Vite's hashed filenames so the unhashed `public/assets/` files (dice-box WASM and themes, icon) still revalidate.
- **Original fix proposal:** add `django.middleware.gzip.GZipMiddleware` right after `SecurityMiddleware`, after checking `content-encoding` in devtools in case Render already compresses. In `vercel.json`, add `{ "src": "/assets/(.*)", "headers": { "cache-control": "public, max-age=31536000, immutable" }, "continue": true }` before the filesystem handler.
- **Expected impact:** 3-5× less JSON on the wire (about 0.6 MB → about 0.15 MB per cold campaign load on mobile); no 304 round trip per asset.
- **Effort:** S · **Plan phase:** 0.1

#### PERF-05 · P2 · Same-origin API: Vercel `/api` rewrite, so no CORS preflights
- **Sources:** [AUTH-PERF-03][01], [INFRA-PERF-12][08] (note)
- **Problem:** the SPA calls Render cross-origin with `Authorization` (and `Content-Type` even on GETs), so the browser preflights every distinct URL. Chrome caches a preflight for at most 7200 s per URL, so ID-bearing URLs keep missing. A cold overview's 17-18 calls become about 34 requests.
- **Fix:** add `{ "src": "/api/(.*)", "dest": "https://<render-host>/api/$1" }` before the SPA fallback, set `VITE_API_BASE_URL=/api`, and send `Content-Type` only when there is a body. Measure the extra Vercel → Render hop (both are in Europe) before keeping it.
- **Expected impact:** about half the requests to Render on a cold visit, and one round trip less for each first-seen URL. It also makes a future httpOnly refresh cookie first-party.
- **Effort:** S · **Plan phase:** 0.1

#### PERF-06 · P1 · Measure the Render → Neon RTT, then co-locate the database
- **Sources:** [INFRA-PERF-04][08]
- **Problem:** Render is in Frankfurt and Neon is in London (confirmed in [NOTES.md](NOTES.md)), so every query pays a cross-city RTT plus Neon proxy overhead. The cold overview's critical path is about 99 queries: about 1.0 s at 10 ms against about 0.15 s at 1.5 ms in-region.
- **Fix:** run the Render-shell snippet in 08's Manual QA step 2 (connect ms and per-query ms). If `SELECT 1` takes 8 ms or more, create a Neon project in `aws-eu-central-1` (Frankfurt), restore with `pg_dump`/`pg_restore` or Neon's import, switch `DATABASE_URL`, and keep the old project read-only for a week.
- **Expected impact:** every remaining query becomes roughly 5-10× cheaper in latency, which multiplies with every other item here.
- **Effort:** M · **Plan phase:** 0.1 (after the code quick wins, per 08's order)

#### PERF-07 · P3 · Cold-start hygiene: migrations off boot, keep-awake and Neon autosuspend
- **Sources:** [INFRA-PERF-10][08], [AUTH-PERF-06][01], [AUTH-PERF-04][01] (part 1: health and keep-awake run JWT auth); related bugs [INFRA-BUG-02][08], [INFRA-CQ-02][08]
- **Problem:** every container start runs `migrate` (dozens of Neon round trips on a slow CPU). Keep-awake answers only `HEAD` (GET returns 405), never touches the DB, and is pointless on Starter, which never spins down. Neon still suspends its compute when idle, so the first request after a quiet spell pays a Neon cold start. Rated P2 in INFRA before the Starter plan was confirmed.
- **Fix:** move `migrate` to Render's pre-deploy command, or gate it behind `RUN_MIGRATIONS_ON_BOOT` (already in PERF-01's entrypoint). Delete the keep-awake endpoint and monitor, or if you keep it, accept GET and drop auth and throttles on health and keep-awake. Decide consciously about Neon: raise or disable the autosuspend delay, or ping `SELECT 1` every 4 minutes or less, either of which costs compute hours. Fix `wait_for_db.py` so it uses `DATABASE_URL` and has a timeout (a Docker deploy with only `DATABASE_URL` hangs today).
- **Expected impact:** faster deploys and restarts; no Neon cold start for the first player of the evening (if you pay for it). This is not the multi-user slowdown.
- **Effort:** S · **Plan phase:** 0.1

#### PERF-08 · P1 · CPU budget: 0.5 vCPU is the ceiling; size workers and plan to it
- **Sources:** [INFRA-PERF-07][08]
- **Problem:** CPU per request is high for 0.5 vCPU: battle list 56 ms, items 56 ms, hired-swords detail 23 ms, heroes detail 22 ms, rosters 16-19 ms of desktop CPU. A cold overview needs 0.45 s or more of Starter CPU per user, so concurrency turns into queueing.
- **Fix:** stay on Starter (Free's 0.1 vCPU is not viable). Do PERF-10, 12, 13, 21 and 22 first, since they remove most of the CPU. Then re-measure with the access log and Render metrics, and move to Standard (1 CPU, 2 GB, 3 workers × 8 threads) only if p95 is still high under real load.
- **Expected impact:** the decision is made on real p95s, not guesses.
- **Effort:** S · **Plan phase:** 0.1 (executed last)

### Tier 1 — Cross-cutting backend + frontend (Phase 0.1 / 0.4 / 0.5)

#### PERF-09 · P1 · Query-budget harness and load-test script
- **Sources:** [PLAN.md](PLAN.md) step 0.4, [ENGINEERING_RULES](../ENGINEERING_RULES.md) §1, [INFRA-TEST-04][08], [INFRA-TEST-10][08]
- **Problem:** there is no `assertNumQueries` anywhere in `backend/apps`, which is how every N+1 here slipped in. There is no load script and no CI.
- **Fix:** a test helper plus one budgets dict over a seeded fixture campaign (the Targets table), with scale pairs (2 vs 20 battles, 1 vs 10 items, 2 vs 8 warbands). Record today's counts as baselines so each pass tightens them. Commit `scripts/loadtest.py`: the GET-only mix from 08 (battle list, items, heroes, summary, players, hired-swords detail, campaign detail) at 1/5/20 clients × 15 s. Add MSW request-count tests for the overview (FE-TEST-05).
- **Expected impact:** every later item gets a measurable, regression-proof target.
- **Effort:** S · **Plan phase:** 0.4

#### PERF-10 · P0 · The battle list is an N+1, fetched twice per overview load and up to 4 times per tab refocus
- **Sources:** [INFRA-PERF-01][08], [CAMP-PERF-01][02], [BATL-PERF-01][05], [FE-PERF-01][07] (battles row), [FE-PERF-06][07] (an invite triggers 2 battle-list fetches)
- **Problem:** `CampaignBattleListCreateView.get` calls `_battle_snapshot(battle.id)` for every battle the user ever joined: **78 queries, 102 KB, 56 ms CPU** for 38 battles, growing by 2 queries and about 2.7 KB per battle (INFRA measured). The frontend keeps only the one resumable battle. `CampaignLayout` (every campaign page) and `BattleActionPanel` each fetch it on mount and on `focus`, `visibilitychange`, `online` and 3 `battle:*` events. That is 32% of a cold overview's queries and 100% of the 316 queries per tab refocus.
- **Fix:** backend: add `GET /campaigns/:id/battles/current/` (or `?status=open`) that filters open statuses and the caller's participant status, prefetches participants with `select_related("user", "warband")`, and builds snapshots from loaded objects instead of `_battle_snapshot` (2-3 queries, under 3 KB). Frontend: one shared hook or query key `["battle-current", campaignId]` used by both components; listen to `visibilitychange` only, throttle to once per 30 s, drop `currentBattleSession?.campaignId` from the `useCallback` deps, and lean on the Pusher `battle:*` events.
- **Expected impact:** 78 → about 4 queries per call; cold overview 249 → about 100 queries; tab refocus 316 → about 5; overview critical path about 1.4 s → about 0.5-0.7 s at 10 ms (INFRA). This is the biggest single win.
- **Effort:** S (backend) + S (frontend) · **Plan phase:** 0.4 (budget and backend) / 0.5 (frontend dedupe)

#### PERF-11 · P1 · Pusher and Resend calls off the request path
- **Sources:** [INFRA-PERF-08][08] (synchronous half), [BATL-PERF-05][05], [ECON-PERF-07][04], [CAMP-PERF-07][02], [AUTH-PERF-05][01]; related bugs [INFRA-BUG-01][08] (P1), [BATL-BUG-05][05], [CAMP-BUG-08][02]
- **Problem:** `on_commit` callbacks and trade, chat and notification triggers make blocking HTTPS calls in the request thread (Pusher default timeout 5 s; Resend `timeout=10`). Battle create sends N-1 notifications one after another, and trade accept sends two. Per-call estimates range from 20 to 300 ms (not measured). The callbacks re-raise, so a Pusher hiccup turns a committed write into a 500, which invites duplicate kills and duplicate trade requests on retry. Rated P1 here because of the 5 s stall and the P1 companion bug; the source PERF items are P2/P3.
- **Fix:**
  ```python
  _pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="realtime")
  def dispatch_after_commit(fn, *args, **kwargs):
      def run():
          try: fn(*args, **kwargs)
          except Exception: logger.exception("realtime dispatch failed: %s", fn.__name__)
      transaction.on_commit(lambda: _pool.submit(run), robust=True)
  ```
  Route every `send_*` and both Resend calls through it. Construct `Pusher(..., timeout=2-3)`, use `trigger_batch` for multi-event sends, delete the re-raises, and let the feedback endpoint return 202.
- **Expected impact:** every realtime-emitting write loses one or more Pusher round trips (seconds during a Pusher incident); no false 500s; gunicorn threads are no longer held by third parties.
- **Effort:** S-M · **Plan phase:** 0.1 (per PLAN.md; it's a code change, so ship it as its own PR after the config deploy)

#### PERF-12 · P1 · The campaign shell blocks on 5 catalogue downloads, and the Items page re-downloads items
- **Sources:** [CAMP-PERF-02][02], [CAT-PERF-01][06], [INFRA-PERF-06][08] (steps 1 and 3)
- **Problem:** `CampaignLayout` shows "Preparing the campaign..." until items, skills, spells, specials and races have all loaded: 5 requests, about 380 KB, 30 queries + 5 JWT, 72 ms CPU (56 ms of it for items). The `load*` calls ignore `cacheEntry.loaded`, so this repeats on every layout mount, including battle pages at the table. Nothing in the shell or the overview uses these lists; only `Warband.tsx` and `HouseRules.tsx` read `lookups`. The Items page then calls `listItems` again (170 KB, 56 ms CPU).
- **Fix:** render the shell and `<Outlet>` as soon as `campaign` loads, and let `Warband` and `HouseRules` show their own skeletons. Make `load*` stale-while-revalidate (return the cache if `loaded`). Make Items reuse `lookups.availableItems`. Optionally start the overview fetches in parallel with `getCampaign`.
- **Expected impact:** cold campaign entry loses about 0.2-0.5 s and about 370 KB from the critical path, and the overview critical path drops to about 12 queries (INFRA). The Items page drops its 15-query, 170 KB re-download.
- **Effort:** M · **Plan phase:** 0.5

#### PERF-13 · P1 · Server-side catalogue cache with a versioned ETag
- **Sources:** [CAT-PERF-02][06] (steps 2-3), [INFRA-PERF-06][08] (step 2)
- **Problem:** catalogue responses carry no `ETag` or `Cache-Control`, so every request re-runs the 4-14 queries and re-serializes data that changes only on rare writes. Items serialization is the second-largest CPU consumer.
- **Fix:** add a `catalogue_version` per campaign plus a global one (an `F()`-incremented column on `CampaignSettings`, or a shared cache), bumped by signals on every catalogue model write, inside the house-rule sync, and at the end of each seeder. Cache the rendered body under `(kind, campaign, version, query)` and serve it with an `ETag` and `Cache-Control: private, no-cache`. Do the check after the membership check, so a revalidation is a 304 for 2 queries. LocMem per worker is fine; use Render Key Value if you want it shared. Later (L): a content-hashed static base catalogue on the CDN plus a small campaign delta endpoint.
- **Expected impact:** repeat catalogue loads become 304s with ≤ 2 queries instead of 5-16 queries plus up to 56 ms CPU each (CAT-TEST-06). The browser sends `If-None-Match` automatically, so no client change is needed.
- **Effort:** M · **Plan phase:** 0.5 (otherwise pass 5)

#### PERF-14 · P1 · TanStack Query foundation: shared, de-duplicated server state
- **Sources:** [FE-PERF-01][07], [CAT-PERF-03][06]; related [CAT-CQ-03][06]
- **Problem:** server data is copied into component state by 266 hand-written effects. Nothing is shared or reused across navigation, and the same endpoints are fetched from several places. Examples: `/summary/` from 7 call sites; the skills and spells lists on every New Skill/Spell dialog open (103 KB / 41 KB); bestiary and hired-sword lists (59 KB / 87 KB) uncached in 4 components; and a `DetailCardContent` popup that runs `getItem` then `listItemProperties` in sequence.
- **Fix:** add `QueryClientProvider`, a `queryKeys` factory and `lib/query-client.ts` (`staleTime: 30_000`, `retry: 1` on 5xx and network errors only, `refetchOnWindowFocus`). Per-class `staleTime`: catalogues and permissions 5 min (or `Infinity` with a persister), battles 30 s, overview tabs 60 s, warband `Infinity` with invalidation. Migrate leaf-first, one PR per resource: catalogues (replacing the 6 store caches; dialogs read from the cache; add bestiary and hired-sword keys; add `description` to `ItemPropertySummarySerializer`), then permissions, battle list, overview tabs, warband and notifications.
- **Expected impact:** an overview revisit goes from 7 requests to 0 within `staleTime`; a Warband visit drops its 2 duplicate requests; the cold overview reaches ≤ 12 requests (FE-TEST-05/06).
- **Effort:** M (foundation + catalogues), L overall · **Plan phase:** 0.5, then each feature pass

#### PERF-15 · P2 · Resolve campaign membership and permissions once
- **Sources:** [CAMP-PERF-06][02], [ECON-PERF-04][04] (membership half), [CAT-PERF-03][06] (permissions half), [FE-PERF-01][07] (permissions row)
- **Problem:** a player's write to a feature endpoint pays JWT + `get_membership` + feature flag + permission check before doing any work. `CanEditWarband` repeats the membership query and runs another `exists()`. Each of 9 pages fetches `/permissions/me/` on mount, although the role is already in the campaign payload.
- **Fix:** a small `CampaignMemberMixin.get_membership()` cached on `request`, with `select_related("role", "campaign__settings")` and the permission codes prefetched. `has_campaign_permission` and the warband permission classes read from it. Drop the redundant first query in `_get_campaign_for_user`. Add `permissions: string[]` to the campaign detail serializer, pass it through the layout context, and delete the 9 per-page fetches.
- **Expected impact:** 2-4 fewer round trips per campaign or warband request, and one fewer request per page navigation for every player.
- **Effort:** M · **Plan phase:** 0.5 (frontend); backend helper in pass 1 (warband) and pass 4 (campaign)

#### PERF-16 · P1 · Mobile pull-to-refresh reloads the whole app
- **Sources:** [FE-PERF-02][07]
- **Problem:** pulling past 72 px calls `window.location.reload()`: re-parse 2.42 MB of JS, refetch the Lottie WASM, `/auth/me`, about 20 API calls and 2 Pusher handshakes, and lose all UI state. Players do this at the table to see each other's changes.
- **Fix:** `queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] })`, then await `refetchQueries({ type: "active" })` before hiding "Refreshing...". Before TanStack lands, dispatch an `app:refresh` event handled by the active route. Keep a hard reload only as an error fallback.
- **Expected impact:** each pull goes from about 20 requests plus a full boot to only the active queries.
- **Effort:** S after PERF-14 (M before) · **Plan phase:** 0.5

#### PERF-17 · P1 · One 2.42 MB entry chunk, and a render-blocking first paint
- **Sources:** [FE-PERF-03][07], [CAT-PERF-10][06], [FE-PERF-08][07]
- **Problem:** all 22 routes are imported statically into one 2,420 KB chunk (540 KB gzip), loaded even on the logged-out landing page. Of that, 640 KB is `@lottiefiles/dotlottie-react`, used only by the loading spinner, which also pulls 1.5 MB of WASM from 3 third-party origins. Dice-box adds 193 KB, framer-motion 107 KB and the static rules HTML 79 KB (67 KB of content). The bulletin PNG is 1,627 KB. Fonts load through a CSS `@import` chain with no `preconnect`.
- **Fix:** replace Lottie with a CSS or SVG spinner; lazy-load routes (`React.lazy` + Suspense skeletons), `DiceRoller`/dice-box, the rules content and `pusher-js` (after auth); use framer's `LazyMotion` + `m`; convert the poster to WebP or AVIF; move fonts to `<link rel="preconnect">` + `<link rel="stylesheet">` or `@fontsource`; add a `size-limit` budget (entry ≤ 250 KB gzip).
- **Expected impact:** landing entry about 300-350 KB min (about 100 KB gzip); a campaign page about 600-700 KB across chunks; about 1-2 s less main-thread parse on mid-range phones; 3 fewer origins.
- **Effort:** M · **Plan phase:** 0.5

#### PERF-18 · P2 · One realtime client, with events that update the cache
- **Sources:** [FE-PERF-05][07], [FE-PERF-06][07] (window bus), [BATL-PERF-10][05], [CAMP-PERF-09][02] (chat socket churn), [ECON-PERF-02][04] (trade socket churn), [ECON-PERF-10][04] (notification resubscribe); related [AUTH-BUG-08][01]
- **Problem:** five factories each create their own Pusher client, so a tab holds 2-3 WebSockets. Each re-creation costs a handshake plus a `POST /realtime/pusher/auth/` (2 queries). Subscriptions are torn down and rebuilt on unrelated changes: notifications on `currentBattleSession`, `tradeSession` or the `user` object; the trade socket on every `?tab=` change; chat when mobile edit mode swaps `rightSlot`; `/campaigns` ↔ `/campaigns/:id` navigation. Events are lost during the gaps. Handlers turn events into refetches through an untyped window-event bus.
- **Fix:** one `getClient()` with a ref-counted `subscribe` and a `headersProvider` that reads the current token; a `useChannel(channel, event, handler)` hook that keeps the handler in a ref (deps `[channel, event]`); a single pathless `ProtectedRoute` layout with a `RealtimeProvider` that owns notifications and chat; disconnect on sign-out. Handlers call `setQueryData`, with a debounced `invalidateQueries` only as a fallback. Replace the `CustomEvent` bus.
- **Expected impact:** Pusher connections grow at about 1× users instead of about 2.5× (relevant to Pusher plan caps); no auth POST or `/notifications/` refetch per state change; no lost events or unread-badge resets.
- **Effort:** M · **Plan phase:** 0.5 (client), with handlers moved per feature pass

#### PERF-19 · P2 · One mega-context: every store write re-renders the campaign tree
- **Sources:** [FE-PERF-04][07], [CAMP-PERF-09][02] (re-render half), [ROST-PERF-08][03], [ECON-PERF-10][04] (store half)
- **Problem:** `AppStoreProvider` is one 49-field context with no selectors. `CampaignLayout` builds a fresh outlet context on every render, and there are 0 `React.memo` components. The roster is mirrored into the store on every unit change, giving 3 or more renders per mutation of 1,000-1,800-line route trees on phones. This doesn't add backend load, but it makes a slow backend feel slower.
- **Fix:** short term: `useMemo` the outlet context; split the context into notifications, battle session, trade session and current warband; pass `campaignStarted` to `ExperienceBar` as a prop; make `setCurrentBattleSession` bail out when nothing changed; stop mirroring the roster (store only `{id, campaign_id, name, gold}`); pass `warband` down to unit item menus. Medium term: Zustand with selectors, and server data in TanStack.
- **Expected impact:** about 3 fewer renders per mutation, and unrelated notifications stop re-rendering every card.
- **Effort:** M · **Plan phase:** 0.5 (quick wins), the rest per pass

### Tier 2 — Per feature pass

**Pass 1: Warband roster** (the screen William flags most)

#### PERF-20 · P1 · Mobile edit mode re-renders in an endless effect loop
- **Sources:** [ROST-PERF-07][03]
- **Problem:** while `isMobile && isEditing`, an effect depends on the unmemoised `handleSaveChanges` and calls `setMobileEditState({...})`, which re-renders `Warband`, creates a new handler and re-runs the effect, pushing new JSX into `CampaignLayout` each time. The henchmen and hired-sword sections do the same. The result is continuous CPU, laggy typing and battery drain. Confidence: Likely.
- **Fix:** verify first (375 px viewport; React profiler or the "Maximum update depth" warning). Then `useCallback` or refs for `handleSaveChanges`/`cancelEditing`, only primitives in state, and `setMobileEditState(prev => shallowEqual(prev, next) ? prev : next)`.
- **Expected impact:** stops a render loop on every phone in edit mode.
- **Effort:** S · **Plan phase:** pass 1 (S; can ship any time)

#### PERF-21 · P1 · Warband endpoints run a fixed 5-query preamble
- **Sources:** [ROST-PERF-03][03] (mixin half), [INFRA-PERF-05][08] (a), [ECON-PERF-04][04] (prefetch half)
- **Problem:** `WarbandObjectMixin.get_warband` always prefetches `resources`, `restrictions` (never read anywhere) and `campaign__settings__item_settings`, plus membership: 5 queries + JWT before any work, on 43 handlers. That is 20 of the warband sheet's 62 queries, and half the cost of the lightest economy endpoints.
- **Fix:** `get_warband(warband_id, extra_prefetch=())` with only `select_related("campaign", "campaign__settings")`. Callers opt in where they serialize the data (summary: `resources`; `WarbandSerializer` and `/restrictions/`: `item_settings`). Drop `restrictions` everywhere. Membership comes from PERF-15.
- **Expected impact:** 2-3 fewer queries per warband request; with PERF-22, the warband sheet goes from 62 to about 30 queries (INFRA).
- **Effort:** S · **Plan phase:** pass 1 (S; pull forward)

#### PERF-22 · P1 · `ItemAvailability` N+1 in every unit detail payload
- **Sources:** [ROST-PERF-02][03], [INFRA-PERF-05][08] (b), [ROST-PERF-11][03], [ECON-PERF-03][04] and [ECON-PERF-01][04] (the same serializer N+1 in transfer, sale and PATCH responses)
- **Problem:** prefetches stop at `…_items__item__property_links__property`, so each item row runs 1 + A + R extra queries (availabilities, restriction links, restrictions). Measured: `heroes/detail` **37**, `hired-swords/detail` 36, `henchmen-groups/detail` 20, a single hero 35. A typical 25-40-item warband would need 100-200 per detail call. Join-table prefetches also cost 2 queries per relation.
- **Fix:** a shared `UNIT_PREFETCHES` per unit type, using `Prefetch("hero_items", queryset=HeroItem.objects.select_related("item"))` (and the same for skills, specials and spells) plus `…__item__availabilities__restriction_links__restriction`. Or drop `availabilities` from unit payloads and look up rarity in the cached `lookups.availableItems` (its only consumer). Add `.defer("level_up_history")` on lists. Reuse the same prefetch in `UNIT_TYPE_CONFIG` for the transfer and sale responses.
- **Expected impact:** `heroes/detail` 37 → about 12 and constant; heroes list 14 → 10 and hired swords 13 → 9; the "Edit" click goes from 38-96 to about 13-35 queries (INFRA).
- **Effort:** S · **Plan phase:** pass 1 (S; pull forward)

#### PERF-23 · P1 · Unit PATCH and level-up responses re-query every relation (about 77 queries per XP click)
- **Sources:** [ROST-PERF-01][03]
- **Problem:** `hero.refresh_from_db()` resets the prefetch cache, so serializing the response lazily loads every item, availability, skill, special and spell: 51 queries measured for Monks hero #2, 38 for a hired sword and 23 for a henchmen group. The write path adds about 26 more: lazy `instance.warband.campaign.settings`, and `ensure_single_living_leader` running 1 SELECT + 2 UPDATEs even when nothing changed. The XP saver sends the whole unit.
- **Fix:** remove `refresh_from_db()` and the cache pops, and re-fetch once with `UNIT_PREFETCHES`; select `warband__campaign__settings`; call the leader check only when `is_leader` or `dead` changes; add a slim `PATCH …/xp/` that runs `filter(pk=…).update(xp=…, level_up=F("level_up") + n)` and returns `{id, xp, level_up}`.
- **Expected impact:** ≤ 12 queries per XP click (ROST-TEST-02), or about 6 with the slim endpoint: about 0.8 → about 0.1 s at 10 ms (derived).
- **Effort:** M · **Plan phase:** pass 1

#### PERF-24 · P1 · Warband sheet: 5 requests in 2 sequential stages → one sheet endpoint
- **Sources:** [ROST-PERF-03][03] (sheet half), [FE-PERF-01][07] (warband/summary duplicate row), [ECON-PERF-08][04] (layout and loader both GET `/summary/`)
- **Problem:** `useWarbandLoader` resolves the warband, then fires summary, heroes, hired swords and henchmen in parallel: 54 queries + 5 JWT over 2 serial stages. `CampaignLayout` has already fetched the warband and summary into the store.
- **Fix:** add `GET /warbands/:id/sheet/` and `GET /campaigns/:id/my-warband/sheet/`, returning `{warband, summary, heroes, henchmen_groups, hired_swords}` from one warband fetch, one membership check, aggregated gold (PERF-25) and three prefetched unit querysets. Keep the old endpoints. In the frontend, use one `["warband", campaignId]` query seeded from the layout; until then, skip the loader's warband and summary fetch when the store copy is fresh.
- **Expected impact:** the warband sheet goes from 6 requests and 62 queries to 1-2 requests and about 15-20 queries, in one round-trip stage.
- **Effort:** M · **Plan phase:** pass 1

#### PERF-25 · P2 · Summary computes gold from every ledger row and queries units twice
- **Sources:** [ROST-PERF-04][03] (backend half), [ECON-PERF-05][04], [INFRA-PERF-05][08] (c, summary); related [ECON-CQ-01][04]
- **Problem:** `get_gold` loads every `WarbandTrade` row (all columns, `notes` up to 2,000 chars) into Python on the most-called endpoint, and `_calculate_trade_total` repeats this per offer edit. `get_rating` runs 3 aggregates, and the name lists re-query the same 3 tables: 12 queries in total.
- **Fix:** short term, one `aggregate(Sum(Case(When(…, then=-Abs("price")), default=Abs("price"))))`. Proper fix: `Warband.gold` maintained with `F()` in the same transaction as each ledger insert (ECON-CQ-01). Use one `.values("id", "name", "unit_type", "xp", "large")` query per unit table for both rating and lists, in a shared batched `warbands/services/rating.py` that PERF-41 reuses.
- **Expected impact:** summary 12 → about 6 queries (0 gold queries with the column), and no longer growing with ledger length.
- **Effort:** S (M with the gold column) · **Plan phase:** pass 1 (gold column in pass 2)

#### PERF-26 · P2 · Card expand, level-up dialog and edit mode each refetch heavy detail
- **Sources:** [ROST-PERF-06][03]
- **Problem:** the summary omits `race` (already `select_related`), so every card expand and every level-up dialog fetches `GET heroes/:id/` (35 queries). The result is kept only in local card state, so collapsing and re-expanding fetches again. `loadHeroDetail` is dead code because of the `hasHeroDetail` heuristic.
- **Fix:** add `race` (`RaceSummarySerializer`, no queries), `kills` and `deeds` to the summary serializers. After PERF-22, serve the detail shape from the sheet and delete the summary/detail split and the `hasXDetail` heuristics.
- **Expected impact:** removes 2-3 requests of 13-51 queries per unit inspected.
- **Effort:** S · **Plan phase:** pass 1

#### PERF-27 · P2 · Mutations trigger blanket `/summary/` and list refetches
- **Sources:** [ROST-PERF-04][03] (frontend half), [ECON-PERF-08][04]
- **Problem:** any `emitWarbandUpdate` without a summary triggers `GET /summary/` (13 queries). That includes every henchmen or hired-sword XP click and level-up, although gold can't change. Stash sell and move refetch the whole stash although the response already holds the data. "Move" fetches `/henchmen-groups/` just for names. Treasury "Add entry" and resource "Sell" both emit, and the Treasury and Logs tabs refetch on every tab switch.
- **Fix:** emit without a summary only when gold can change (create, delete, purchase). Apply mutation responses directly (`stash_item`, `removed_stash_item_id`, `summary`), take names from `summary.henchmen_groups`, and keep tab data for the page's lifetime. Later, use `useMutation` + `setQueryData`.
- **Expected impact:** one fewer 13-query request per XP click, Sell, Move or ledger entry.
- **Effort:** S · **Plan phase:** pass 1 (stash and treasury parts in pass 2)

#### PERF-28 · P3 · Henchmen create and update loop single-row writes
- **Sources:** [ROST-PERF-09][03]
- **Problem:** creating N henchmen runs 2N INSERTs (log + trade each); update issues one UPDATE per henchman on every save; neither is atomic.
- **Fix:** `bulk_create` logs and trades, `bulk_update` only changed rows, and wrap both in `transaction.atomic()`.
- **Expected impact:** O(N) → O(1) statements per save.
- **Effort:** S · **Plan phase:** pass 1

#### PERF-29 · P3 · Kill history seq-scans `battle_event` across all campaigns
- **Sources:** [ROST-PERF-10][03]
- **Problem:** filters on unindexed JSON paths (`payload_json #> '{killer,…}'`) with no campaign scoping; `EXPLAIN` shows a Seq Scan (8 queries per hover). The table is small today.
- **Fix:** a partial expression index `WHERE type='unit_kill_recorded'`, or `killer_unit_type`/`killer_unit_id` columns written at kill time; filter on `battle__campaign_id`.
- **Expected impact:** stays fast as events grow.
- **Effort:** S · **Plan phase:** pass 1

**Pass 2: Economy and trades**

#### PERF-30 · P1 · Purchases are browser-orchestrated request waterfalls
- **Sources:** [ECON-PERF-01][04], [ROST-PERF-05][03], [ECON-PERF-09][04]
- **Problem:** one purchase is about 8 requests and 140-150 queries (about 1.5 s of DB time at 10 ms). The dialog opens with 3 GETs for data already on the page; the unit PATCH deletes and recreates every item row; then trade POST + log POST + summary GET + hero detail GET. A roster Save with K deferred purchases runs 2K+1 sequential requests (8 items means 17 round trips), and none of it is atomic.
- **Fix:** add `POST /warbands/:id/purchases/` that, in one transaction, checks item scope, debits gold conditionally (ECON-CQ-01), inserts only the new item rows, writes the ledger and log rows, and returns `{gold, unit_items or stash_item}`. The dialog reads gold and units from page state. The roster Save sends its purchases in the same request (`bulk_create`).
- **Expected impact:** 8 requests / about 145 queries → 1 request / about 10-12 queries; a Save with purchases goes from 2K+1 round trips to 1. It also fixes the partial-payment corruption (ECON-BUG-03).
- **Effort:** L · **Plan phase:** pass 2

#### PERF-31 · P1 · Item transfer and sale rebuild whole units twice, inside the transaction
- **Sources:** [ECON-PERF-03][04]
- **Problem:** `_get_unit_instance` prefetches 11 queries just to check that a unit exists, then both units are re-serialized with Detail serializers plus the summary. The estimates are stash → hero about 58 queries, hero → hero about 98, and sale from a hero about 58. All of it runs inside `transaction.atomic()`, so locks are held for about 1 s on Neon.
- **Fix:** check existence with `.only("id").first()`, do only the row writes inside the transaction, serialize after commit, and return a lightweight `{items, gold}` payload. The N+1 itself is fixed by PERF-22.
- **Expected impact:** ≤ 15 queries per transfer and ≤ 12 per sale (ECON-TEST-14); short transactions.
- **Effort:** M · **Plan phase:** pass 2

#### PERF-32 · P1 · Trade sessions turn every click into 3-4 requests
- **Sources:** [ECON-PERF-02][04] (socket churn is in PERF-18)
- **Problem:** triggers are sent without a `socket_id`, so the sender receives its own event, and on every `offer_updated` and `locked` **both** browsers refetch `/summary/`. One offer edit is about 32 queries plus a Pusher call; one lock is about 44; a six-edit trade is about 250 or more. The 300 ms autosave runs into the 20/min per-user and 60/min per-IP throttles at a shared table.
- **Fix:** stop emitting warband updates on `offer_updated` and `locked`, and refresh only on `completed`/`closed` from the summary in the event. Send `X-Pusher-Socket-Id` and pass `socket_id=` to `trigger`. Raise the debounce to about 600 ms. `_calculate_trade_total` uses the PERF-25 aggregate.
- **Expected impact:** an offer edit becomes 1 request with ≤ 6 queries (ECON-TEST-14), removing most of a trade's queries.
- **Effort:** M · **Plan phase:** pass 2

#### PERF-33 · P2 · Logs and treasury endpoints return every row
- **Sources:** [ECON-PERF-06][04], [INFRA-PERF-11][08] (logs and trades half)
- **Problem:** `GET /logs/` sends all 128 rows (26 KB) to show 12 per page and refetches on every tab open; treasury does the same. There is no `DEFAULT_PAGINATION_CLASS` and no `(warband_id, created_at)` index.
- **Fix:** cursor pagination (`?before=<id>&limit=25-50`), the `feature` filter applied on the server, and `Index(fields=["warband", "-created_at"])` on `warband_log` and `warband_trades`.
- **Expected impact:** a constant page size instead of linear growth over a campaign.
- **Effort:** S · **Plan phase:** pass 2

**Pass 3: Battles** (slow mid-game)

#### PERF-34 · P1 · Each battle action fans out to N-1 full state refetches
- **Sources:** [BATL-PERF-02][05], [INFRA-PERF-08][08] (fan-out half), [FE-PERF-06][07] (battle part)
- **Problem:** clients ignore the event payload and `GET state` (8 queries including a write) with no in-flight guard. Per tap that is about 10 round trips for the actor plus 8 × (N-1): 18 at N=2 and 34 at N=4 (about 0.35 s of DB time per tap for 4 players at 10 ms). Wound +/- and 1 s notes autosaves broadcast too.
- **Fix:** put the changed participant snapshot (1-3 KB, under Pusher's 10 KB limit) and a monotonic `state_version` in `battle.event` and `battle_state_updated`; clients patch locally and refetch only on a version gap. In the meantime, keep one in-flight refresh with a dirty flag, a 250 ms debounce, and drop stale responses. Send notes only on dialog close.
- **Expected impact:** 8 × (N-1) queries per tap → 0 in the normal case (4 on a gap).
- **Effort:** M · **Plan phase:** pass 3 (the debounce is S and can ship earlier)

#### PERF-35 · P1 · The battle state GET writes and re-reads (8 → 4 queries)
- **Sources:** [BATL-PERF-03][05], [INFRA-PERF-09][08], [BATL-PERF-09][05]
- **Problem:** `_touch_participant` UPDATEs `connection_state`, `last_seen_at` and `last_event_id` on every state and roster GET (measured: 1 write each). The client never reads those fields, and each read can wait behind a finalise lock. `_battle_snapshot` then re-reads the battle and all participants: 3 redundant queries.
- **Fix:** remove the touch (or write `last_seen_at` at most every 60 s with a conditional UPDATE, or use a Pusher presence channel), and drop `connection_state` and `last_event_id`. Load the participant with `select_related("battle")` and an `Exists(membership)` annotation, and query participants once.
- **Expected impact:** `GET state` 8 → 4 queries including auth, no writes, and no lock waits; multiplies with PERF-34's fan-out.
- **Effort:** S · **Plan phase:** pass 3 (S; pull forward)

#### PERF-36 · P1 · Finalisation holds the battle row lock for about 60-70 sequential queries
- **Sources:** [BATL-PERF-04][05]
- **Problem:** `finalize-postbattle` validates twice, saves each unit and henchman individually, runs an `exists()` per special and group, does select + save + refresh per find, and writes logs one by one, all under the battle row lock (about 38 + H + S + M + 2G + 3F round trips). Players finalising together serialise: a ~0.6-0.7 s lock in-region, about 5 s cross-region.
- **Fix:** validate once; `bulk_update` units, henchmen and groups; `bulk_create` specials (with `ignore_conflicts` and a unique constraint) and logs; `F()` for stash quantities. Lock only the caller's participant (`of=("self",)`), use an atomic status transition as the idempotency guard, and take the battle row lock only for the final "all confirmed" step.
- **Expected impact:** ≤ 30 queries (BATL-TEST-07), and the battle lock held only briefly.
- **Effort:** M · **Plan phase:** pass 3

#### PERF-37 · P2 · `select_for_update()` with `select_related` locks unrelated user and warband rows
- **Sources:** [BATL-PERF-06][05]
- **Problem:** Django emits `FOR UPDATE` without `OF`, so every battle write also locks the joined `auth_user` and `warband` rows. Stash, trade and hero writes by the same user wait behind battle writes, which widens the deadlock surface.
- **Fix:** `select_for_update(of=("self",))` everywhere a locked query uses `select_related` (`shared.py:520-523`, `:1714`).
- **Expected impact:** concurrent warband writes stop queueing behind battles.
- **Effort:** S · **Plan phase:** pass 3

#### PERF-38 · P2 · Rosters cost 28 queries and are refetched by every phase page
- **Sources:** [BATL-PERF-07][05]
- **Problem:** the roster is rebuilt from live warband tables (a constant 28 queries plus 1 write) by each of prebattle, active and postbattle, so each player fetches it at least 3 times per game. Item entries are computed twice per unit.
- **Fix:** snapshot the roster into the participant at `start` (which also fixes the mid-battle drift, BATL-BUG-13), or hoist `useBattleRosters` to `BattleLayout`. Resolve catalogue rows with one query per catalogue table.
- **Expected impact:** 28 queries per phase entry per player → once per battle.
- **Effort:** M · **Plan phase:** pass 3

#### PERF-39 · P2 · `DiceRoller` leaks an engine on every mount, and postbattle boots two
- **Sources:** [FE-PERF-07][07], [BATL-PERF-08][05] (dice half)
- **Problem:** each mount (every dialog open) creates a Babylon WebGL context, an Ammo physics Worker and a permanent `resize` listener, and unmount terminates none of them. Postbattle mounts two at load. Chrome drops contexts after 16; iOS Safari reloads the tab under memory pressure, losing postbattle progress.
- **Fix:** an app-wide `DiceProvider` singleton that lazily imports dice-box on the first roll and exposes `roll(notation) → Promise<number[]>`; `DiceRoller` becomes a thin button; drop the synthetic `window` resize.
- **Expected impact:** one engine per session instead of one per dialog open.
- **Effort:** M · **Plan phase:** pass 3 (platform component)

#### PERF-40 · P2 · Search-as-you-type hits the server on every keystroke
- **Sources:** [BATL-PERF-08][05] (finds half), [CAT-PERF-08][06]
- **Problem:** the postbattle finds dropdown calls `GET /items/` (170 KB, 14 queries) on open and after every keystroke (150 ms debounce). The item-property search in item forms fires one request per character with no cancellation, so results can arrive out of order.
- **Fix:** filter client-side from the cached campaign catalogue and item properties. If a server search is kept, require 2 or more characters, debounce 250-300 ms and ignore stale responses.
- **Expected impact:** 0 requests per keystroke instead of up to 170 KB and 14 queries each.
- **Effort:** S · **Plan phase:** pass 3 (property search in pass 5)

**Pass 4: Campaigns**

#### PERF-41 · P1 · `/players/` has an N+1 on warband rating (4 + 3W queries)
- **Sources:** [CAMP-PERF-03][02], [INFRA-PERF-05][08] (c, players)
- **Problem:** `get_rating` runs 3 queries per warband: 13 measured at W=3, 28 at W=8 and 52 at W=16. It sits on the overview, Encampments, the trade invite and roster dialogs, and on the post-fix overview critical path. The busy lookup loads full `BattleParticipant` JSON rows just to read the status.
- **Fix:** 3 grouped queries for every warband's rating (PERF-25's service); the busy lookup becomes `.values_list("user_id", "battle__status")`; add a `?fields=basic` variant (2 queries) for Encampments and TradeInviteDialog.
- **Expected impact:** ≤ 6 queries, constant in players (CAMP-TEST-01).
- **Effort:** S-M · **Plan phase:** pass 4 (pull forward to ship with PERF-25)

#### PERF-42 · P2 · Expanding an overview roster row costs 3 requests and about 38 queries
- **Sources:** [CAMP-PERF-04][02]
- **Problem:** the stat preview calls the full heroes, henchmen and hired-sword endpoints (14 + 11 + 13 queries) to render names and 10 stat fields.
- **Fix:** add `GET /warbands/:id/roster-stats/` (or `?view=stats`) with `.only()` on stat columns, or `/players/?include=stats`.
- **Expected impact:** about 41 → 3-4 queries per expand, in 1 request.
- **Effort:** S · **Plan phase:** pass 4

#### PERF-43 · P2 · The overview always fetches the hidden bulletin tab
- **Sources:** [CAMP-PERF-05][02]
- **Problem:** `top-killers` and `bulletin` load on every overview mount, although the tab has no entry point.
- **Fix:** fetch them only when `activeTab === "bulletin"`, or remove the feature until it ships.
- **Expected impact:** 2 requests (6 queries) fewer per overview visit per user.
- **Effort:** S · **Plan phase:** pass 4 (trivial; ship with the overview TanStack migration)

#### PERF-44 · P2 · House-rule sync and catalogue writes run per-row queries
- **Sources:** [CAMP-PERF-08][02], [CAT-PERF-09][06]
- **Problem:** every PATCH, including a title typo fix, re-runs the clone sync (about 70 queries for 8 armours, about 38 for shields) plus one UPDATE per owned row, all in one transaction that locks owned items campaign-wide (about 1 s or more on Neon). Bestiary `_sync_m2m` and item creates do a SELECT + INSERT per id (about 35 queries for one hired sword).
- **Fix:** skip revert and sync when `effect_key` is unchanged; diff availabilities instead of deleting them; `bulk_update(rows, ["item", "cost"])` for remaps; `bulk_create(…, ignore_conflicts=True)` for links.
- **Expected impact:** a text edit costs 0 sync queries; remaps take 3-4 statements; purchases are no longer blocked during edits.
- **Effort:** S (skip on unchanged) / M (bulk rewrite) · **Plan phase:** pass 4 (catalogue writes in pass 5)

#### PERF-45 · P3 · Unbounded campaign lists and a missing chat index
- **Sources:** [CAMP-PERF-10][02], [CAMP-PERF-11][02], [INFRA-PERF-11][08] (messages half)
- **Problem:** battle history, pivotal moments and bulletin have constant query counts but linear payloads (participant JSON blobs are fetched and unused). Chat pages by `id < before` but orders by `-created_at` with only a `campaign_id` index. Fine today.
- **Fix:** `.defer("unit_information_json", "custom_units_json", "selected_unit_keys_json")`; paginate history and pivotal moments (newest 20, `?before=`); cap the bulletin at 50; order chat by `-id` with `Index(fields=["campaign", "-id"])` on messages and bulletin (CAMP's version, which matches the cursor better than INFRA's `created_at` index).
- **Expected impact:** keeps a 30-game, 8-player campaign's overview from growing into hundreds of KB.
- **Effort:** S · **Plan phase:** pass 4

**Pass 5: Catalogue**

#### PERF-46 · P2 · Bestiary and hired-sword detail endpoints are N+1 (43 / 45 queries)
- **Sources:** [CAT-PERF-04][06]
- **Problem:** the serializer reads M2M managers instead of the prefetched through tables, and nested `ItemSerializer` equipment lazily loads properties, availabilities and restrictions (3-5 queries per item).
- **Fix:** the `Prefetch` chain sketched in CAT-PERF-04 (items with `property_links__property` and `availabilities__restriction_links__restriction`), reused for POST and PATCH responses.
- **Expected impact:** 43 / 45 → about 10 queries (≤ 12, CAT-TEST-08).
- **Effort:** S · **Plan phase:** pass 5

#### PERF-47 · P2 · Catalogue lists over-fetch rows and descriptions
- **Sources:** [CAT-PERF-05][06]
- **Problem:** the bestiary sends 86 entries and the page drops the 72 hired swords (about 50 of 59 KB). Descriptions dominate: 49 of 170 KB for items, 81 of 103 KB for skills, 74 of 94 KB for item properties. Pickers need only id, name, type and cost.
- **Fix:** `?exclude_type=Hired Sword` on `/api/bestiary/`; `?view=summary` without `description`, `statblock` or the nested `bestiary_entry`; descriptions loaded on expand. Do this after PERF-13.
- **Expected impact:** 2-5× fewer bytes and less serialization CPU.
- **Effort:** S · **Plan phase:** pass 5

#### PERF-48 · P2 · The Wargear table mounts a full Acquire dialog per row
- **Sources:** [CAT-PERF-06][06]
- **Problem:** about 100-110 rows each run `useAcquireItemDialogShared` (about 28 `useState`, 12 `useEffect`) while closed, and the `columns` memo rebuilds every render, so every keystroke re-renders them all. Confidence: Likely (not profiled).
- **Fix:** one page-level `AcquireItemDialog` driven by `selectedRow`; `useCallback` the handlers; fix the memo deps; `React.memo` the rows.
- **Expected impact:** responsive typing and expanding on low-end phones.
- **Effort:** M · **Plan phase:** pass 5

#### PERF-49 · P3 · The items list runs its prefetch chain twice
- **Sources:** [CAT-PERF-07][06]
- **Problem:** with `campaign_id`, the view runs `exists()`, then separate custom and base querysets with 6-query prefetch chains each: 14 queries against 8 without a campaign.
- **Fix:** one queryset, `Q(campaign_id=cid) | Q(campaign__isnull=True, ~Exists(same name and type in campaign))`, with one prefetch chain. This also fixes the name-only shadowing (CAT-BUG-03).
- **Expected impact:** 14 → 8 queries on a cache miss (moot on a 304 after PERF-13).
- **Effort:** S · **Plan phase:** pass 5

**Pass 6: Auth and core**

#### PERF-50 · P2 · `/auth/me` blocks every page load, and login fires it 3 times
- **Sources:** [AUTH-PERF-01][01], [AUTH-PERF-02][01]
- **Problem:** `ProtectedRoute` shows `LoadingScreen` until `/auth/me` (68 bytes, never changes) returns, adding one serial round trip to every reload, deep link and new tab (three with an expired token). `setToken` + `setRefreshToken` each dispatch an event into a stale closure, so login makes about 9 requests (3× `/auth/me`, 3× `/notifications/`, 3 Pusher cycles) instead of 3.
- **Fix:** persist the user next to the tokens, render the protected tree from the cached user and revalidate `/me` in the background (log out only on a 401, AUTH-BUG-01); add one `setTokens({access, refresh})` that notifies once; make `syncToken` compare against a ref; key effects on `user?.id`.
- **Expected impact:** one serial round trip off every cold load; login goes from about 9 requests to 3.
- **Effort:** S · **Plan phase:** pass 6 (consider pulling forward with PERF-14)

#### PERF-51 · P3 · Every authenticated request pays one `auth_user` lookup
- **Sources:** [AUTH-PERF-04][01] (part 2; part 1 is in PERF-07)
- **Problem:** SimpleJWT runs `SELECT … FROM auth_user` on every request: about 17 queries per cold overview spent on identity.
- **Fix:** optionally, after PERF-02, add a `JWTAuthentication` subclass with a 30-60 s per-process `user_id → user` cache, invalidated on password change. Or accept the cost.
- **Expected impact:** 1 round trip per request.
- **Effort:** M · **Plan phase:** pass 6 (optional)

### Source index

Every PERF finding in the 8 files maps to a canonical item. A source marked "+" is split across items.

- **AUTH:** 01→50, 02→50, 03→05, 04→07+51, 05→11, 06→07
- **CAMP:** 01→10, 02→12, 03→41, 04→42, 05→43, 06→15, 07→11, 08→44, 09→18+19, 10→45, 11→45
- **ROST:** 01→23, 02→22, 03→21+24, 04→25+27, 05→30, 06→26, 07→20, 08→19, 09→28, 10→29, 11→22
- **ECON:** 01→30 (+22), 02→32+18, 03→31 (+22), 04→21+15, 05→25, 06→33, 07→11, 08→27+24, 09→30, 10→19+18
- **BATL:** 01→10, 02→34, 03→35, 04→36, 05→11, 06→37, 07→38, 08→39+40, 09→35, 10→18
- **CAT:** 01→12, 02→04+13, 03→14+15, 04→46, 05→47, 06→48, 07→49, 08→40, 09→44, 10→17
- **FE:** 01→14 (+10, 15, 24), 02→16, 03→17, 04→19, 05→18, 06→18+34 (+10), 07→39, 08→17
- **INFRA:** 01→10, 02→01, 03→02, 04→06, 05→21+22+25+41, 06→12+13+04, 07→08, 08→11+34, 09→35, 10→07, 11→33+45, 12→04+05
- **Companion non-PERF IDs folded in:** INFRA-CQ-01→03; INFRA-SEC-01→02; INFRA-BUG-01, BATL-BUG-05, CAMP-BUG-08→11; INFRA-BUG-02, INFRA-CQ-02→07; ECON-CQ-01→25; CAT-CQ-03→14; AUTH-BUG-08→18

## Fix order at a glance

Step 0: answer the Open questions below and run 08's Render-shell RTT snippet (15 min). Every later number becomes real.

- [ ] 1. **PERF-01** gunicorn instead of `runserver`: bounded concurrency, no reloader burn · S
- [ ] 2. **PERF-02** `CONN_MAX_AGE` + health checks (+ `DEBUG` off): about 50-150 ms off every request · S
- [ ] 3. **PERF-03** `LOGGING` + access-log timings: production numbers become visible · S
- [ ] 4. **PERF-04** gzip + immutable asset headers: 3-5× smaller JSON · S
- [ ] 5. **PERF-09** query-budget harness + load-test baseline: before numbers recorded · S
- [ ] 6. **PERF-10** battle list fix + dedupe: overview 249 → about 100 queries, refocus 316 → about 5 · S+S
- [ ] 7. **PERF-11** Pusher/Resend off the request path: no 5 s stalls, no false 500s · S-M
- [ ] 8. **PERF-12** unblock the catalogue gate: about 0.2-0.5 s off every cold campaign entry · M
- [ ] 9. **PERF-21** warband preamble opt-in: 2-3 queries off 43 handlers · S
- [ ] 10. **PERF-22** `ItemAvailability` prefetch: Edit click 38-96 → about 13-35 queries · S
- [ ] 11. **PERF-35** state GET without writes: 8 → 4 queries per battle refetch · S
- [ ] 12. **PERF-25 + PERF-41** batched rating + gold aggregate: summary 12 → 6, `/players/` constant ≤ 6 · S-M
- [ ] 13. **PERF-20** mobile edit loop (verify, then fix): phone CPU · S
- [ ] 14. **PERF-06** co-locate Neon in Frankfurt if RTT ≥ 8 ms: every query 5-10× cheaper · M
- [ ] 15. **PERF-05** Vercel `/api` rewrite: about half the requests on a cold visit · S
- [ ] 16. **PERF-13** catalogue ETag + server cache: repeat loads are 304s for 2 queries · M
- [ ] 17. **PERF-14** TanStack Query foundation + catalogues: revisits cost 0 requests · M
- [ ] 18. **PERF-15** permissions in the campaign payload + membership once: 1 request less per page · M
- [ ] 19. **PERF-16** pull-to-refresh without a reload: about 20 requests less per pull · S
- [ ] 20. **PERF-17** bundle split, no Lottie: entry 540 → ≤ 250 KB gzip · M
- [ ] 21. **PERF-18** one realtime client + cache-patching handlers · M
- [ ] 22. **PERF-19** split the store, memoise the outlet context · M
- [ ] 23. **PERF-43** stop fetching the hidden bulletin tab · S
- [ ] 24. **PERF-23** lean unit PATCH (+ slim XP endpoint): XP click about 77 → ≤ 12 · M
- [ ] 25. **PERF-24** warband sheet endpoint: 6 requests / 62 queries → 1 / about 20 · M
- [ ] 26. **PERF-26** race/kills/deeds in the summary: no detail fetch per expand · S
- [ ] 27. **PERF-27** no blanket summary refetch after mutations · S
- [ ] 28. **PERF-28** bulk henchmen writes · S
- [ ] 29. **PERF-29** kill-history index · S
- [ ] 30. **PERF-30** server purchase endpoint: about 145 queries → about 12 per purchase · L
- [ ] 31. **PERF-31** lean transfer/sale, serialize after commit: ≤ 15 queries · M
- [ ] 32. **PERF-32** trade self-echo + summary refetch removed: offer edit ≤ 6 queries · M
- [ ] 33. **PERF-33** paginate logs and treasury + indexes · S
- [ ] 34. **PERF-34** battle events carry state: 8 × (N-1) refetch queries per tap → 0 · M
- [ ] 35. **PERF-36** finalisation bulk writes + narrow lock: ≤ 30 queries · M
- [ ] 36. **PERF-37** `select_for_update(of=("self",))` · S
- [ ] 37. **PERF-38** roster snapshot or hoisted roster hook: fetched once per battle · M
- [ ] 38. **PERF-39** DiceRoller singleton · M
- [ ] 39. **PERF-40** client-side search filters · S
- [ ] 40. **PERF-42** roster-stats endpoint: expand 41 → 3-4 queries · S
- [ ] 41. **PERF-44** house-rule skip-on-unchanged + bulk remaps · S/M
- [ ] 42. **PERF-45** paginate campaign lists, defer JSON, chat index · S
- [ ] 43. **PERF-46** bestiary/hired-sword detail prefetch: 45 → about 10 · S
- [ ] 44. **PERF-47** summary views without descriptions · S
- [ ] 45. **PERF-48** one Acquire dialog per page · M
- [ ] 46. **PERF-49** single items queryset: 14 → 8 · S
- [ ] 47. **PERF-50** cached user at boot, one `/auth/me` per login · S
- [ ] 48. **PERF-51** (optional) JWT user cache · M
- [ ] 49. **PERF-07** migrations off boot, keep-awake/Neon decision, `wait_for_db` fix · S
- [ ] 50. **PERF-08** right-size Render from real p95s · S

## Verification

**Tier 0 (config deploy).** Before and after, run 08's Manual QA steps 1-3: record the service type, start command and env vars; run the RTT snippet from a Render shell (connect ms and per-query ms, then again after 10 idle minutes); hard-refresh the overview with devtools on "Fast 4G" and count requests and preflights, find the slowest call and check `content-encoding`. Add the settings tests (INFRA-TEST-07/08) and the container smoke test (INFRA-TEST-13: the process is gunicorn and `/api/health/` returns 200 within 30 s). **Done when** the process is gunicorn, memory stays under 512 MB with 2 workers, Neon connections stay at 16 or fewer, campaign detail p50 drops by roughly the connect cost, and the access log shows `%(M)sms` per request.

**Tier 1 (cross-cutting code).** Every backend change lands with its row from the budgets table (PERF-09) and a scale pair proving the count is constant. Frontend request counts are pinned with tests: FE-TEST-05 (cold overview ≤ 12 requests, no duplicate `/battles/`), FE-TEST-06/07 and CAMP-TEST-04 / BATL-TEST-23 / INFRA-TEST-11 (focus + `visibilitychange` cause at most 1 battle request), INFRA-TEST-12 (the overview renders while catalogues are pending), CAT-TEST-06 (a 304 with ≤ 2 queries), INFRA-TEST-06 / ECON-TEST-18 / CAMP-TEST-20 (a raising Pusher still returns 2xx), FE-TEST-11/12 (one Pusher instance, no resubscribe) and FE-TEST-27 (size-limit). Run `scripts/loadtest.py` against staging before and after each perf PR: 1/5/20 clients × 15 s after a 2 s warm-up, and record p50, p95 and req/s in the PR. 08's emulated-latency setup (an `execute_wrapper` sleeping 10 ms per query plus 50 ms per new connection) reproduces the production shape locally. **Done when** the load test shows p95 < 500 ms at 5 clients against Neon and 08's Manual QA step 4 shows 0-1 `battles/` requests per tab return.

**Tier 2 (feature passes).** Follow the PLAN loop: lock query-count baselines before refactoring (step 3), and put before/after counts in every PR description (definition of done). Run the feature's manual QA script on desktop and at mobile width. Perf-specific checks: 08's Manual QA step 5 (warband: request count and time to first render, Edit timing), step 6 (two phones in one battle: the other device makes 0 `state` GETs per action after PERF-34) and step 7 (4-6 people open the overview and switch tabs twice).

**After each deploy, watch:** Render metrics (CPU % against the 0.5 limit, memory against 512 MB, response time); the gunicorn access log for slow paths; Neon's console, "Monitoring → Queries" (`pg_stat_statements`), plus the connection count and compute cold starts; and the Pusher dashboard's concurrent connections against the plan cap. **Overall "done":** every budget is green in CI, a 6-player game night (Manual QA step 7) no longer pins CPU at the plan limit, battle-list calls no longer take seconds, and PERF-08's plan decision rests on measured p95s.

## Open questions

| # | Question | Decides |
| --- | --- | --- |
| 1 | Render service type (Docker or native) and exact start command (read via the Render MCP connector, `srv-d648pl4hg0os73d0otpg`) | PERF-01 is P0 (Docker means `runserver`) or P2; whether `wait_for_db.py` can hang boot |
| 2 | Render env vars: `DJANGO_DEBUG=0`? A long `DJANGO_SECRET_KEY`? `RATE_LIMIT_NUM_PROXIES`? `WEB_CONCURRENCY`? | PERF-02's safety companions; worker sizing |
| 3 | Is `DATABASE_URL` the Neon `-pooler` host or the direct host? Neon plan, compute size and autosuspend delay? | PERF-02 settings (`DISABLE_SERVER_SIDE_CURSORS`), PERF-07 |
| 4 | Measured connect ms and per-query ms from a Render shell to Neon | PERF-06 (move if ≥ 8 ms); turns every projection into a real number |
| 5 | Is Vercel's `VITE_API_BASE_URL` the Render origin? | PERF-05 (preflights are real only if so) |
| 6 | Does Render's edge already compress JSON (`content-encoding`)? | PERF-04 |
| 7 | Pusher plan and concurrent-connection cap; do local dev and production share one Pusher app? | PERF-18 urgency; test isolation |
| 8 | How many people are on at once when it gets slow (2-3 for a battle? 6 on a campaign night?) | Load-test client counts; PERF-08 |
| 9 | Render health-check path, and does UptimeRobot ping `/api/keep-awake/` with GET (405 today) or HEAD? | PERF-07 |
| 10 | Is a shared cache (Render Key Value) worth its cost, or is LocMem per worker enough? | PERF-13 cache backend; also the LocMem throttle issue (AUTH-SEC-03) |

[01]: features/01-auth-core.md
[02]: features/02-campaigns.md
[03]: features/03-warband-roster.md
[04]: features/04-warband-economy-trades.md
[05]: features/05-battles.md
[06]: features/06-catalogue.md
[07]: features/07-frontend-platform.md
[08]: features/08-infrastructure-performance.md
