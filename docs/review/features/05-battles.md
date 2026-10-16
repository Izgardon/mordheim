# Battles

> Scope: `backend/apps/battles/` (models, `views/lifecycle.py`, `views/combat.py`, `views/shared.py`, `urls.py`, `tests/test_battles_api.py`), battle hooks in `backend/apps/campaigns/pivotal_moments.py`, `backend/apps/campaigns/views.py` (owner active-battle admin, busy flags), `backend/apps/realtime/` (battle channel auth, `send_battle_event`), battle notifications in `backend/apps/notifications/`, `backend/apps/warbands/views/kill_history.py` (consumer of kill events); `frontend/src/features/battles/**` (routes, hooks, components, utils, tests), `frontend/src/features/campaigns/components/overview/{BattleActionPanel,StartBattleDialog}.tsx`, battle refresh logic in `frontend/src/features/campaigns/routes/CampaignLayout.tsx`, battle handling in `frontend/src/features/realtime/hooks/useNotifications.ts`, `frontend/src/lib/realtime.ts` (battle socket).

## Summary

| Dimension | Verdict |
| --- | --- |
| Performance | **Poor under multiple users.** The live battle loop is O(1) queries per request but every action fans out to N-1 full refetches that each include a write; finalisation holds the battle row lock for ~60-70 sequential queries; and the campaign battle list (78 queries / 102 KB for 38 battles) is fetched 2-4 times on every tab focus. |
| Bugs | **Several confirmed data-integrity bugs.** Custom XP thresholds ignored; cancelling after "End battle" leaves wins/losses applied (visible in local data); postbattle kill edits are silently dropped; stale battles block players indefinitely; Pusher hiccups turn committed writes into HTTP 500. |
| Code quality | **Hard to change safely.** `shared.py` is 1968 lines of mixed concerns, three route files are 1173-1799 lines with heavy copy-paste, business rules exist in both frontend and backend, and there is dead code on both sides. |
| UI / UX | **Works on desktop, risky on phones.** The postbattle back arrow skips postbattle permanently, nobody can see who is holding up a battle, kills and item uses cannot be undone, and invitees cannot decline. |
| Security | Honour-system by design: all rewards are client-trusted and stat overrides become permanent without an audit entry; event payloads are unvalidated. |
| Tests | 57 backend API tests and ~41 unique frontend cases (7 files duplicated). No coverage for thresholds, cancel-after-finish, query budgets, concurrency, realtime failure or reconnect. |

**Top 5 findings**

1. **BATL-PERF-01** (P1): campaign battle list endpoint is 2 queries per battle in history and is called 2-4 times per tab focus by two components.
2. **BATL-BUG-02** (P1): cancelling a battle in postbattle keeps wins/losses already applied by "End battle" (warband 1 has 2 phantom losses locally from battles 36 and 39).
3. **BATL-BUG-01** (P1): postbattle level-ups use hard-coded default thresholds instead of the campaign's custom ones (and hired swords use henchmen defaults).
4. **BATL-PERF-02 + BATL-PERF-03** (P1): each action triggers N-1 full state refetches, and every GET writes to the database.
5. **BATL-BUG-03** (P1): no expiry, leave or decline path; battle #40 has blocked both its players since 2026-04-22.

Also P1: **BATL-BUG-04** (postbattle kill edits discarded) and **BATL-PERF-04** (finalisation lock duration).

## How it works

### Models (`backend/apps/battles/models/`)

- **`Battle`**: `campaign`, `created_by_user`, `flow_type` (`normal` | `reported_result`), `status`, `scenario`, `scenario_link`, `winner_warband_ids_json`, timestamps. Indexes `(campaign, status)`, `(status, created_at)`.
- **`BattleParticipant`**: one row per user/warband in a battle. Phase status, timeline timestamps, and four JSON blobs that carry all battle-scoped state: `selected_unit_keys_json` (unit keys like `hero:12`, `henchman:88`, `custom:<uuid>`), `unit_information_json` (per-unit `stats_override`, `notes`, `current_wounds`, `out_of_action`, `kill_count`), `custom_units_json` (temporary units), `postbattle_json` (draft results). `connection_state`, `last_seen_at`, `last_event_id` are written on every request but never read by the client.
- **`BattleEvent`**: append-only timeline (`unit_ooa_set/unset`, `unit_kill_recorded`, `item_used`, lifecycle events). Index `(battle, id)`, `(battle, type)`.

### State machine (normal flow)

```
inviting --(all accept: POST join)--> prebattle --(all ready + creator POST start)--> active
active --(creator POST finish, picks winners; wins/losses applied NOW)--> postbattle
postbattle --(each participant POST finalize-postbattle or confirm[=skip]; last one triggers _finalize_battle)--> ended
inviting|prebattle|active|postbattle --(creator POST cancel-battle | owner POST active-battles/:id/cancel)--> canceled
inviting|prebattle --(every participant POST cancel)--> canceled   (no UI calls this endpoint)
```

Participant statuses: `invited → accepted → joined_prebattle ⇄ ready → in_battle → finished_battle → confirmed_postbattle`, plus `canceled_prebattle`.

`_finalize_battle` (`shared.py:657-679`) runs inside the **last** finaliser's transaction: it sets `ended`, appends `battle_ended`, resets trading actions, and calls `generate_pivotal_moments_for_battle` (`campaigns/pivotal_moments.py:291-314`; 4 queries, idempotent via an `exists()` check, normal flow only). Event-driven moments read `unit_kill_recorded` payloads; warband moments read each participant's `postbattle_json.unit_results`.

Reported-result flow: `POST report-result/` creates a battle in `reported_result_pending`; the submitter is auto-approved, every other participant gets a `battle_result_request` notification; all approvals → wins/losses + `battle:complete` logs + `ended`; any decline → `canceled`.

### Endpoints (`/api/campaigns/:cid/battles/...`)

| Endpoint | View | Notes |
| --- | --- | --- |
| `GET /` | `CampaignBattleListCreateView.get` (`lifecycle.py:65`) | Full snapshot of every battle the user was ever in (used to find the one resumable battle) |
| `POST /`, `POST report-result/` | create views (`lifecycle.py:81`, `:340`) | Busy check, participants, notifications |
| `GET :id/state/?sinceEventId&view` | `CampaignBattleStateView` (`lifecycle.py:502`) | Battle + all participants + events after `sinceEventId`; writes `_touch_participant` |
| `GET :id/rosters/` | `CampaignBattleRosterView` (`lifecycle.py:527`) | Live warband units of every participant (28 queries); also writes |
| `POST join/ config/ ready/ cancel/ cancel-battle/ start/` | lifecycle views | `select_for_update` on battle + participant |
| `POST events/ unit-ooa/ unit-kill/ finish/ postbattle/ finalize-postbattle/ confirm/` | combat views | same locking; `winner/` is a stub that always returns 400 |
| `POST approve-result/ decline-result/` | reported result | |

Campaign app: `GET/POST /campaigns/:cid/active-battles/[:id/cancel/]` (owner admin, `campaigns/views.py:681-757`), `GET players/` (busy flags), `GET battle-history/`.

### Realtime

- Every `_append_battle_event` (`shared.py:377`) schedules `send_battle_event` on commit → Pusher `private-battle-{id}` event `battle.event` with the serialized event. Config/ready/join changes send `battle_state_updated` (`shared.py:424`). User notifications (`battle_invite`, `battle_prebattle_opened`, `battle_result_request`, `battle_result_updated`) go to `private-user-{id}-notifications`.
- Pusher calls are synchronous HTTPS requests made in the request thread after commit, and they re-raise on failure.
- Client: `useBattleState` (`hooks/useBattleState.ts`) loads `state?sinceEventId=0`, opens its own Pusher connection (`lib/realtime.ts:224`), and on every non-self event calls `GET state?sinceEventId=<last>` and replaces `participants` wholesale (`utils/battle-state.ts:19`). There is **no polling** anywhere in the battle pages (no `setInterval`; the only timers are a 150 ms item-search debounce and a 1 s notes autosave debounce). Outside battle pages, `CampaignLayout` and `BattleActionPanel` refetch the battle list on `focus`, `visibilitychange`, `online` and battle notification events.

### Frontend

- `routes/BattleLayout.tsx` (228): mobile top/bottom bar shell; each phase page owns its own data.
- `routes/BattlePrebattle.tsx` (1173): invite gate, unit selection, temp stat edits, custom units, ready/start/cancel.
- `routes/BattleActive.tsx` (1182): unit cards (wounds, OOA, kills, items), melee/ranged/critical helpers, creator End/Cancel.
- `routes/BattlePostbattle.tsx` (1799): exploration (local-only dice), unit results (XP, kills, dead, serious-injury rolls), finds, upkeep, finalise/leave.
- `components/postbattle/postbattle-utils.ts` (852): draft building, XP defaults, exploration table, injury tables.
- Overview: `BattleActionPanel.tsx` (Start / Rejoin / See Status), `StartBattleDialog.tsx` (start and report-result modes).

### Measured cost (local Docker, read-only, inside rolled-back transactions; `force_authenticate`, so add 1 query for JWT user lookup in production)

| Request | Queries | Writes | Payload |
| --- | --- | --- | --- |
| `GET state` battle 40 (active, 2 events), any view | 7 | 1 | 1.9-2.6 KB |
| `GET state` battle 38 (ended, 10 events) full / active | 7 | 1 | 8.6 / 4.0 KB |
| `GET rosters` (any battle, 2 warbands, 8 + 4 units) | 28 | 1 | 7.1 KB |
| `GET /campaigns/1/battles/` (user 1, 38 battles) | **78** (= 2 + 2 × 38) | 0 | **102 KB** |
| `GET /items/?campaign_id=1` (postbattle finds dropdown, empty search) | 14 | 0 | **170 KB** |

State-endpoint query count is constant in the number of participants and events, so the battle loop's cost is dominated by **how many requests** it triggers, not by per-request N+1s.

## Performance

### BATL-PERF-01 · P1 · Battle list endpoint is 2 queries per historical battle and is refetched 2-4 times per tab focus
- **Where:** `backend/apps/battles/views/lifecycle.py:65-79`, `backend/apps/battles/views/shared.py:154-162`; callers `frontend/src/features/campaigns/routes/CampaignLayout.tsx:508-577`, `frontend/src/features/campaigns/components/overview/BattleActionPanel.tsx:58-102`
- **What:** `GET /campaigns/:id/battles/` loops over every battle the user has ever joined and calls `_battle_snapshot(battle.id)` for each, which re-fetches the battle row and its participants (2 queries per battle) and serialises full participant blobs (unit info, custom units, postbattle drafts). Measured 78 queries and 102 KB for 38 battles; it grows without bound. The frontend only uses it to find **one** resumable battle (`getResumableBattleForUser`). It is called by `CampaignLayout` when the campaign layout mounts and whenever the user leaves a battle route, again when `currentBattleSession.campaignId` changes (the callback depends on it, so the mount effect re-runs: likely double fetch on entry), and on `focus` **and** `visibilitychange` (both fire when a phone user switches back to the browser), `online`, and three battle window events. `BattleActionPanel` registers the same five listeners and fetches the same endpoint. Returning to the overview tab therefore costs about 4 × 78 = 312 queries and 400 KB; when prebattle opens, every participant's client also refetches it twice before navigating.
- **Impact:** The single largest battle-related load on Neon. Example: 5 players on a campaign page switching apps 20 times an hour generates ~15,000 queries an hour from this alone, at 10-100 ms per round trip. It slows every campaign page for everyone because Render runs few workers.
- **Fix:**
  1. Add `GET /campaigns/:id/battles/current/` that returns only the caller's open normal battle (status in inviting/prebattle/active/postbattle and participant not confirmed/canceled) plus pending reported results awaiting their approval: one query with `select_related`/`Prefetch` (2-3 queries total, < 3 KB).
  2. If a full list is still needed, prefetch participants (`Prefetch("participants", queryset=BattleParticipant.objects.select_related("user","warband"))`, 3 queries total like `CampaignBattleHistoryView`), support `?status=open`, and paginate.
  3. Frontend: fetch it in one place (app store or a TanStack Query key `["battle-current", campaignId]`) shared by `CampaignLayout` and `BattleActionPanel`; listen to `visibilitychange` only (drop `focus`), throttle to once per 30 s, and remove `currentBattleSession?.campaignId` from the `useCallback` deps.
- **Effort:** M · **Confidence:** Confirmed (measured; double-fetch on entry Likely)

### BATL-PERF-02 · P1 · Every battle action fans out to N-1 full state refetches with no coalescing
- **Where:** `frontend/src/features/battles/hooks/useBattleState.ts:63-77,116-129`; `backend/apps/battles/views/shared.py:377-437`; `backend/apps/battles/views/lifecycle.py:502-524`
- **What:** The Pusher payload carries the event (or a bare `battle_state_updated` notice) but clients ignore it and call `GET state`. That re-reads the battle, **all** participants (with their JSON blobs) and the event delta. There is no in-flight guard or debounce, so bursts produce parallel GETs. Per action, round trips ≈ actor POST (~10: auth, membership, battle FOR UPDATE, participant FOR UPDATE, 2-3 writes, touch, commit, 2 snapshot reads) **+ 8 × (N-1)** for the other clients (auth + 7 measured, including a write). N=2: 18; N=4: 34. Config saves (wound +/-, notes autosave every 1 s pause) broadcast too. Battle 5 in local data had 20 OOA toggles in one session.
- **Impact:** For 4 players, ~0.35 s of DB time per tap with Neon in-region (10 ms RTT), ~2.7 s if Render and Neon are cross-region (~80 ms). Multiplies with players and with tapping frequency.
- **Fix:**
  1. Include the **changed participant snapshot** (1-3 KB, under Pusher's 10 KB limit) and a monotonically increasing `state_version` in both `battle.event` and `battle_state_updated`; clients patch locally and only call `GET state` when they detect a version gap.
  2. Until then, coalesce: keep one in-flight refresh and a "dirty" flag, debounce 250 ms, and drop responses older than the current `state_version`.
  3. Stop broadcasting notes autosaves (notes are low value to opponents; send them only on dialog close).
- **Effort:** M · **Confidence:** Confirmed (code; arithmetic from measured counts)

### BATL-PERF-03 · P1 · Every GET to state and rosters performs a database write
- **Where:** `backend/apps/battles/views/lifecycle.py:523,535`; `backend/apps/battles/views/shared.py:499-506`
- **What:** `_touch_participant` updates `connection_state`, `last_seen_at` and `last_event_id` on every read (measured `writes=1` for every GET). None of the three fields is read by the frontend (`grep` finds them only in `battle-types.ts`), and `connection_state` never becomes `offline` anywhere (both battle 40 rows still say `online` six months later). Each refetch in PERF-02 is therefore a write transaction (WAL flush on Neon), and it blocks on the participant row whenever a finalise or start holds that row lock.
- **Impact:** One extra round trip and a write per read; reads queue behind locks during finalisation; misleading "online" data.
- **Fix:** Remove `_touch_participant` from both GET views. If presence is wanted, use a Pusher presence channel (`presence-battle-{id}`) instead of DB writes; if `last_seen_at` is kept, write it at most once per 60 s with a conditional `UPDATE ... WHERE last_seen_at < now() - interval '60 seconds'`. Drop `connection_state` and `last_event_id`.
- **Effort:** S · **Confidence:** Confirmed (measured)

### BATL-PERF-04 · P1 · Finalisation holds the battle row lock for ~60-70 sequential queries
- **Where:** `backend/apps/battles/views/combat.py:443-493`; `backend/apps/battles/views/shared.py:509-524,1455-1521,1683-1968,657-679`
- **What:** `finalize-postbattle` locks the battle row (and, via BATL-PERF-06, the user and warband rows), then: validates the payload twice (`combat.py:463` and again inside `_apply_participant_postbattle_results` at `shared.py:1684`), saves each hero / hired sword / henchman individually (`henchman.save` runs unconditionally for every henchman, `shared.py:1806`), runs an `exists()` per granted special and per henchmen group, does select + save + `refresh_from_db` per found item type (`shared.py:1432-1447`), writes logs one by one, re-queries all participants for the `battle:complete` payload, and, for the last finaliser, runs trading resets and pivotal moments. From the code: round trips ≈ 38 + H + S + M + 2G + 3F (+8 for the last finaliser). A typical warband (5 heroes, 2 hired swords, 8 henchmen in 3 groups, 1 found item) is ~62-70 round trips inside the lock. Pusher calls run after commit, so they are not inside the lock.
- **Impact:** The lock is held ~0.6-0.7 s with in-region Neon and ~5 s cross-region. When players finalise together (the normal case at the end of a game), they serialise; any kill/OOA/config write for that battle also waits.
- **Fix:**
  1. Validate once and pass the normalised payload through.
  2. Collect changes and use `bulk_update` for heroes, hired swords, henchmen and groups (3-4 queries); `HeroSpecial.objects.bulk_create(..., ignore_conflicts=True)` with a unique constraint; compute group death from the in-memory henchmen; `WarbandLog.objects.bulk_create`; and `F()` updates for stash quantities instead of select/save/refresh.
  3. Narrow the lock: lock only the caller's participant (`select_for_update(of=("self",))`), use an atomic status transition (`UPDATE ... SET status='confirmed_postbattle' WHERE id=%s AND status='finished_battle'`) as the idempotency guard, apply the warband changes, then take the battle row lock only for the short "all confirmed → `_finalize_battle`" step.
  4. Add an `assertNumQueries` budget (see BATL-TEST-07).
- **Effort:** M · **Confidence:** Likely (estimated from code; POSTs were not executed per review rules)

### BATL-PERF-05 · P2 · Pusher calls are synchronous, sequential and unbatched in the request thread
- **Where:** `backend/apps/battles/views/shared.py:390-436`; `backend/apps/realtime/services.py:103-118,134-149`
- **What:** Each `on_commit` callback makes a blocking HTTPS call to Pusher (python-pusher default `timeout=5`). Create sends N-1 user notifications sequentially; the last accept sends N `battle_prebattle_opened` notifications plus a state update; the last finalise sends 2 battle events. The response waits for all of them.
- **Impact:** Typically adds 50-150 ms per event to response time (up to 5 s each on a Pusher slowdown) and ties up one of Render's few workers or threads.
- **Fix:** Use `pusher_client.trigger_batch` (up to 10 events per HTTP call) and send from a small module-level `ThreadPoolExecutor` (or a queue) after commit; set `timeout=2`. Coordinate with INFRA's "Pusher off the request path".
- **Effort:** S · **Confidence:** Confirmed

### BATL-PERF-06 · P2 · `select_for_update()` with `select_related` locks unrelated user and warband rows
- **Where:** `backend/apps/battles/views/shared.py:520-523` (every battle write), `shared.py:1714` (henchmen → groups)
- **What:** Django emits `... FROM battle_participant INNER JOIN auth_user ... INNER JOIN warband ... FOR UPDATE` without `OF` (verified by printing the SQL). Postgres locks the joined `auth_user` and `warband` rows for the whole transaction.
- **Impact:** Any concurrent warband write by the same user (stash, trades, gold, hero edits in another tab) waits behind battle writes, and during finalisation (PERF-04) that is seconds. It also widens the deadlock surface with trade and warband code that locks the warband first.
- **Fix:** `select_for_update(of=("self",))` everywhere a locked query uses `select_related`.
- **Effort:** S · **Confidence:** Confirmed

### BATL-PERF-07 · P2 · Rosters cost 28 queries and are refetched by every phase page
- **Where:** `backend/apps/battles/views/shared.py:309-374`; `frontend/src/features/battles/hooks/useBattleRosters.ts:57-112` (used in all three phase routes)
- **What:** The roster payload is rebuilt from live warband tables with 4-5 prefetches per unit kind (constant 28 queries). Prebattle, active and postbattle each mount their own `useBattleRosters`, so a normal game fetches it at least 3 times per player, plus once per reload. Helper functions also compute item entries twice per unit (`shared.py:237,240` and `:261,264`).
- **Impact:** 28 round trips (0.3-0.6 s in-region) per page entry per player, and the roster can drift mid-battle (see BATL-BUG-13).
- **Fix:** Snapshot the roster into the participant at `start` (one write) and serve it from there; or keep one `useBattleState`/`useBattleRosters` at `BattleLayout` level so phase changes don't refetch. Reduce queries by collecting item/skill/special/spell link rows per kind and resolving catalogue rows with one query per catalogue table.
- **Effort:** M · **Confidence:** Confirmed (measured)

### BATL-PERF-08 · P2 · Postbattle page downloads the whole item catalogue and boots two 3D dice engines
- **Where:** `frontend/src/features/battles/routes/BattlePostbattle.tsx:516-558` (finds search), `:1196-1217` (two `DiceRoller` instances), `frontend/src/components/dice/DiceRoller.tsx:190-262`
- **What:** Opening the finds dropdown with an empty search calls `GET /items/?campaign_id=` (170 KB, 14 queries), repeated after every keystroke with a 150 ms debounce. The page also mounts two `DiceRoller`s (roll-all and reroll), each eagerly constructing a `DiceBox` (WebGL scene, physics worker, assets) on mount; cleanup only calls `clear()`.
- **Impact:** Slow postbattle on phones (memory, battery, GPU) and wasted bandwidth and queries for every player at the end of every game.
- **Fix:** Require 2+ characters, debounce 300 ms, and reuse the campaign lookups/catalogue cache. Use one lazily initialised `DiceRoller` whose notation changes per roll, and destroy the DiceBox on unmount.
- **Effort:** S · **Confidence:** Confirmed (measured)

### BATL-PERF-09 · P3 · Redundant reads in every state request and mutation response
- **Where:** `backend/apps/battles/views/shared.py:154-169,509-524,744-747`
- **What:** `GET state` runs membership, battle, participant (+user, warband), then `_battle_snapshot` re-reads the battle and all participants: 3 redundant queries. Every mutation also re-reads battle + participants for the response.
- **Impact:** About 40% of the state endpoint's round trips are avoidable.
- **Fix:** One query `BattleParticipant.objects.select_related("battle").filter(battle_id=..., battle__campaign_id=..., user=...)` with an `Exists(CampaignMembership...)` annotation, reuse the loaded battle, query participants once. Target 4 queries for `GET state` including auth, down from 8.
- **Effort:** S · **Confidence:** Confirmed

### BATL-PERF-10 · P3 · Each battle page opens its own Pusher connection and battle entry re-creates the notification socket
- **Where:** `frontend/src/lib/realtime.ts:224-264` (also `:104,155,197,278`), `frontend/src/features/battles/hooks/useBattleState.ts:116-129`, `frontend/src/features/realtime/hooks/useNotifications.ts:181,328`
- **What:** `createBattleSessionSocket` constructs a new `Pusher` client (new WebSocket plus auth POST) per page; the effect also re-runs when `currentUserId` goes from undefined to a value. `useNotifications` depends on `currentBattleSession?.battleId`, so entering a battle tears down and recreates the user notification socket and refetches `listNotifications()`. The battle socket captures the JWT at creation, so after a token refresh, reconnect auth uses a stale token.
- **Impact:** Extra connections against Pusher plan limits, extra auth/notification requests per phase change, and silently lost realtime on long sessions.
- **Fix:** One shared Pusher client per tab with a token-supplying `channelAuthorization.customHandler`; stable effect deps. Cross-ref FE findings on the realtime layer.
- **Effort:** S-M · **Confidence:** Confirmed

## Bugs

### BATL-BUG-01 · P1 · Postbattle level-ups ignore the campaign's custom XP thresholds
- **Where:** `backend/apps/battles/views/shared.py:1751,1776,1822`
- **What:** Verified end to end. `count_new_level_ups(previous_xp, next_xp)` and `count_new_henchmen_level_ups(previous_xp, next_xp)` are called without `thresholds`, so they fall back to `HERO_LEVEL_THRESHOLDS` / `HENCHMEN_LEVEL_THRESHOLDS` (`warbands/utils/hero_level.py:3`, `henchmen_level.py:1`). Hired swords use the **henchmen** defaults instead of `hired_sword_level_thresholds`. The warband serializers pass the campaign thresholds (`warbands/serializers/heroes.py:485-487`, `henchmen.py:320-322`, `hired_swords.py:363-365`), and owners can edit them in `CampaignLevelUpSettingsCard.tsx`. Not observable locally only because both local campaigns use default thresholds.
- **Impact:** In any campaign with custom thresholds, every battle awards the wrong number of pending level-ups (too many or too few), and the warband sheet, which uses the custom thresholds for its XP display, disagrees with the `level_up` counter.
- **Fix:** Load settings once per finalise (this also replaces the separate `hero_death_roll` query in validation) and pass them through:
  ```python
  settings = CampaignSettings.objects.filter(campaign_id=battle.campaign_id).only(
      "hero_level_thresholds", "henchmen_level_thresholds", "hired_sword_level_thresholds", "hero_death_roll"
  ).first()
  hero_t = settings.hero_level_thresholds if settings else None
  # hero
  hero.level_up += count_new_level_ups(previous_xp, next_xp, hero_t)
  # hired sword
  hired_sword.level_up += count_new_henchmen_level_ups(previous_xp, next_xp, settings and settings.hired_sword_level_thresholds)
  # henchmen group
  group.level_up += count_new_henchmen_level_ups(previous_xp, next_xp, settings and settings.henchmen_level_thresholds)
  ```
  Better: a single `apply_xp(unit, delta, kind, settings)` in `warbands/utils` used by the three serializers and battles (the four copies are how this drifted). Add BATL-TEST-01/02.
- **Effort:** S · **Confidence:** Confirmed (code; not reproduced, since local data uses defaults)

### BATL-BUG-02 · P1 · Cancelling after "End battle" leaves wins/losses applied and overwrites participant history
- **Where:** `backend/apps/battles/views/combat.py:354-363` (wins/losses applied at finish), `backend/apps/battles/views/lifecycle.py:957-984` (creator cancel allowed in any status except ended), `backend/apps/campaigns/views.py:725-757` (owner cancel, same), `backend/apps/battles/views/shared.py:439-496` (`_cancel_battle_for_all_participants`, statuses overwritten at `:452-465`)
- **What:** Wins/losses are incremented when the creator ends the active battle, not when the battle ends. Both cancel paths still accept `postbattle`, and `_cancel_battle_for_all_participants` neither reverses the counters nor protects participants who already finalised: their `confirmed_postbattle` status is overwritten with `canceled_prebattle`, while their XP, gold, items and logs stay applied. **Seen in local data:** battles 36 and 39 were cancelled by the campaign owner (`mode: campaign_owner`) after `battle_entered_postbattle` with winner `[2]`. Warband 1 ("Warband 2") shows 16 losses but only 14 lost ended battles; warband 2 shows 17 wins vs 16.
- **Impact:** Win/loss records diverge from battle history; partial results survive a "cancelled" battle; the audit trail is destroyed.
- **Fix:**
  1. Move the wins/losses increment from `CampaignBattleFinishView` into `_finalize_battle`, so it happens exactly once when the battle ends.
  2. Reject cancel when `status == postbattle` in both views, and offer **Close postbattle** instead (creator or owner): mark remaining `finished_battle` participants as confirmed with `skipped_postbattle: true` and call `_finalize_battle`.
  3. Never overwrite `confirmed_postbattle` in `_cancel_battle_for_all_participants`.
  4. Ship a one-off `manage.py report_win_loss_drift` that compares counters with ended battles for owner review (do not auto-fix; owners may have edited counters by hand).
- **Effort:** M · **Confidence:** Confirmed (code and data)

### BATL-BUG-03 · P1 · No expiry, leave or abandon handling: stale battles block players indefinitely
- **Where:** `backend/apps/battles/views/lifecycle.py:45-58,129-156` (busy rule), `:997-998` and `combat.py:330-331` (creator-only start/finish), `shared.py:527-529` (start requires every row ready, including cancelled ones), `combat.py:485-486` (battle ends only when all confirm); model `Battle` has no activity timestamp
- **What:** Confirmed. Battle #40 has been `active` since 2026-04-22 with only 2 events; both participants are `in_battle`, so both users are "busy" and can neither start nor be invited to another normal battle in campaign 1. The only escapes are the creator pressing End/Cancel on the active page, or the owner cancelling in settings (which in postbattle triggers BUG-02). Stuck states are reachable in every phase:
  - **inviting:** an invitee who ignores or dismisses the invite (there is no decline, BUG-08).
  - **prebattle:** the creator disappears (only they can start).
  - **active:** the creator disappears (only they can end).
  - **postbattle:** one player never finalises; the battle never reaches `ended`, pivotal moments are never generated, and every participant stays busy (`finished_battle` is a busy status).
- **Impact:** Players are locked out of battles until someone with the right role notices; overview shows a misleading "Rejoin Battle".
- **Fix (design):**
  1. **Track activity:** add `Battle.last_activity_at` (index `(status, last_activity_at)`), bumped in `_append_battle_event` and the config/postbattle saves.
  2. **Expiry policy (constants or campaign settings):** inviting 72 h → cancel; prebattle idle 24 h → cancel; active idle 48 h → flag `stale: true` in the state payload, auto-cancel after 7 days (no wins/losses); postbattle idle 72 h → auto-skip unconfirmed participants (`skipped_postbattle: true`) and `_finalize_battle`.
  3. **Sweeper:** run it lazily from the new `battles/current/` endpoint (BATL-PERF-01) and from the busy check (one indexed query), plus `manage.py expire_stale_battles` for a Render cron job.
  4. **Participant exits:** `POST decline/` (inviting: participant removed and the creator notified; fewer than 2 left → cancel); `POST leave/` (prebattle: remove the row so it no longer blocks `_all_participants_ready`); `POST forfeit/` (active: participant marked done and counted as a loss at the end).
  5. **Creator handover:** `POST claim-lead/` lets any participant take over start/end when the creator has been inactive 15+ minutes (presence channel or last write time).
  6. **Owner tools:** in `ActiveBattlesTable`, add "End battle (pick winners)" and "Close postbattle"; hide "Cancel" for postbattle.
  7. **UI:** show "Idle for 2 days" with those actions on the overview CTA and phase pages.
- **Effort:** L · **Confidence:** Confirmed

### BATL-BUG-04 · P1 · Postbattle kill edits are silently discarded; kill counts have three disagreeing sources
- **Where:** UI `frontend/src/features/battles/routes/BattlePostbattle.tsx:652-677,1296-1303,1394-1401`, `postbattle-utils.ts:443-457`; backend `backend/apps/battles/views/shared.py:1734,1744-1746,1769-1771,1802-1803`; `backend/apps/campaigns/pivotal_moments.py:203-217`; `backend/apps/warbands/views/kill_history.py:84-91,112-119,146-153`; dead `shared.py:609-654`
- **What:** The postbattle roster has a Kills stepper (minimum = live kill count). It saves `unit_results[key].kill_count`, but finalisation adds `unit_information[key].kill_count` (the live counter) to `hero.kills`; the edited value is ignored. Pivotal moments ("Carried the Fight", "Bloody Martyr") **do** use the edited `unit_results` value. Kill history lists `unit_kill_recorded` events with no battle-status filter, so kills from **cancelled** battles appear (battles 5-8 in local data have kill events) while the total shown is `hero.kills`. The event-based aggregator `_apply_kill_aggregation` (the README's rule 14) is never called. Kill counts are also writable through `/config/` (`unit_information_json.kill_count`, up to 9999) in any phase.
- **Impact:** The UI lies about what will be saved; pivotal moments, kill totals and kill history disagree.
- **Fix:** Pick one source of truth. Recommended: events are authoritative. Postbattle "kill adjustments" become `unit_kill_recorded` events with `source: "postbattle"` (or a voided flag, see BATL-UX-03); finalisation aggregates events (revive `_apply_kill_aggregation`, which also becomes the only writer of `kills`); `kill_count` in `unit_information`/`unit_results` becomes display-only and is not accepted from `/config/`; kill history filters `battle__status=ended`. Minimal fix: apply `max(unit_info.kill_count, result.kill_count)` at `shared.py:1734`.
- **Effort:** M · **Confidence:** Confirmed

### BATL-BUG-05 · P2 · A Pusher failure turns a committed write into HTTP 500 (and invites duplicate kills)
- **Where:** `backend/apps/battles/views/shared.py:406-421,434-436`; `backend/apps/realtime/services.py:111-118,142-149`
- **What:** `send_battle_event` / `send_user_notification` log and **re-raise**, and the `_send_*_after_commit` wrappers re-raise again. Django 5.0 runs `on_commit` callbacks non-robustly by default, so the exception propagates out of `transaction.atomic()` **after** the commit: the client gets a 500 for a write that succeeded, and later callbacks (other notifications) are skipped.
- **Impact:** On a Pusher hiccup, users see "Unable to record kill" for a recorded kill, retry, and the kill is counted twice (`unit-kill` is not idempotent; nor is `item_used`). Create-battle retries fail with "already in another battle".
- **Fix:** Never re-raise from realtime sends; use `transaction.on_commit(fn, robust=True)` as a backstop; accept an `Idempotency-Key` header (or client `event_uuid` stored on `BattleEvent` with a unique constraint) for `unit-kill` and `events`.
- **Effort:** S · **Confidence:** Confirmed (code and Django semantics)

### BATL-BUG-06 · P2 · Lost updates: config autosaves overwrite kills/OOA, and stale refetches overwrite fresh state
- **Where:** `backend/apps/battles/views/lifecycle.py:557-610`; `frontend/src/features/battles/routes/BattleActive.tsx:185-279,598-607,700-718`; `BattlePostbattle.tsx:492-514`; `frontend/src/features/battles/utils/battle-state.ts:19-32`; `useBattleState.ts:63-77`
- **What:**
  1. `/config/` replaces the **whole** `unit_information_json` with the client's copy. A wound or notes save built before a kill or OOA lands, but processed after it, resets `kill_count` / `out_of_action` (the kill and OOA endpoints are separate requests, not part of the config queue).
  2. Postbattle `persistDraft` has no queue, so two quick edits can be applied server-side out of order, and the older response then rebuilds the draft.
  3. `mergeBattleState` always takes `next.participants`, so a socket-triggered GET that started before your own mutation can land after it and revert your UI until the next event.
- **Impact:** Kills and OOA flags occasionally vanish or flicker back; final results can be wrong.
- **Fix:** Server-side merge-patch: `unit_information_patch: {unit_key: {current_wounds?, notes?, stats_override?}}` applied under the participant lock, never accepting `kill_count`/`out_of_action` from `/config/`. Add `participant.version` (incremented on each write; return it in every snapshot) and drop older snapshots client-side. Serialise draft saves with the same queue used on the active page.
- **Effort:** M · **Confidence:** Likely

### BATL-BUG-07 · P2 · No reconnect catch-up on battle pages
- **Where:** `frontend/src/features/battles/hooks/useBattleState.ts:116-129`; `frontend/src/lib/realtime.ts:224-264`
- **What:** If the socket misses events (phone screen off, Wi-Fi blip, Pusher reconnect), nothing refetches: there is no `visibilitychange`, `online` or Pusher `connected` handler on battle pages. When the creator ends the battle while your phone sleeps, you wake on the Active page and every action fails with "Battle is not active" until you reload. The same applies to start, cancel and other participants' readiness.
- **Impact:** Confusing errors exactly at phase transitions, the most common time for phones to be idle at the table.
- **Fix:** In `useBattleState`, call `refreshBattleState()` on `visibilitychange` → visible, `online`, `pusher.connection.bind("connected")` after a prior `unavailable`/`disconnected`, and when a mutation fails with a status-mismatch 400 (return a machine-readable `code: "battle_status_changed"`).
- **Effort:** S · **Confidence:** Confirmed

### BATL-BUG-08 · P2 · Invitees cannot decline and participants cannot leave; a cancelled participant blocks start
- **Where:** `frontend/src/features/battles/components/prebattle/PrebattleInviteGate.tsx:14-41`; `frontend/src/features/campaigns/components/overview/BattleActionPanel.tsx:292-370`; `frontend/src/features/realtime/hooks/useNotifications.ts:382-390`; `frontend/src/features/battles/api/battles-api.ts:91-95` (unused); `backend/apps/battles/views/shared.py:527-529`; `lifecycle.py:903-954`
- **What:** The invite gate and status dialog offer only "Accept"; dismissing the invite notification just resolves it. The battle stays `inviting` and the invitee stays "busy". The backend `cancel` endpoint (README rule 6: "cancel participation and later rejoin") has no caller. If someone did cancel, `_all_participants_ready` counts their `canceled_prebattle` row as not ready, so the battle can never start (only the creator's hard cancel helps).
- **Impact:** One unresponsive or unwilling invitee locks the creator and the invitee out of battles (feeds BUG-03).
- **Fix:** Add "Decline" to the invite gate, status dialog and notification (new `decline/` endpoint per the BUG-03 design); exclude cancelled/declined participants from `_all_participants_accepted/ready`; remove the unused API or wire it up as "Leave prebattle".
- **Effort:** M · **Confidence:** Confirmed

### BATL-BUG-09 · P2 · Reported-result approval is only reachable from the notification; clearing it strands the request
- **Where:** `frontend/src/features/realtime/hooks/useNotifications.ts:392-421`; `backend/apps/notifications/views.py:29-60`; unrouted `backend/apps/battles/views/lifecycle.py:300-337`
- **What:** Approve and decline exist only in `NotificationsMenu`. "Clear all" or dismiss marks the `battle_result_request` notification resolved, after which no UI shows the pending result: the overview does not list pending reported results (contrary to BATTLEMODE_README), and `PendingReportedBattleResultRequestsView` exists but is not in any `urls.py`. The submitter has no withdraw button either.
- **Impact:** Reported results stay pending until the owner cancels them in settings.
- **Fix:** Route a pending-results endpoint (rewrite with `Prefetch`; the current version is N+1), show a "Results awaiting your approval" card on the overview with Approve / Decline (and Withdraw for the submitter), and exclude action-required notifications from "Clear all". Also validate `battle_date <= today` in `lifecycle.py:391-400`.
- **Effort:** S-M · **Confidence:** Confirmed

### BATL-BUG-10 · P2 · Serious injuries are logged on draft save, never reverted, and never applied
- **Where:** `backend/apps/battles/views/combat.py:433-437`; `backend/apps/battles/views/shared.py:1524-1554`; `frontend/src/features/battles/components/postbattle/postbattle-utils.ts:405-424` (line 419); `BattlePostbattle.tsx:565-585`
- **What:** `_log_new_serious_injury_rolls` writes a `personnel/serious_injury` warband log whenever a draft save has more rolls than the previous one. The UI only appends rolls, so each re-roll adds another permanent log entry. Leaving without saving, or the battle being cancelled, leaves the logs in place even though nothing was applied. The injury result itself is never applied: `getExistingUnitResult` forces `special_ids: []`, so the backend's special-granting path (`shared.py:1327-1336,1482-1495,1758-1760`) is unreachable from the UI. Only the "Dead" checkbox has an effect.
- **Impact:** The warband log claims injuries (even deaths) that did not happen; real injuries must be applied by hand with no reminder.
- **Fix:** Log injuries at finalise only (one entry per unit, the final roll); either map injury results to `special_ids` (the guide tables already exist) or remove the dead backend code; list injuries in the finalise summary (BATL-UX-04).
- **Effort:** S-M · **Confidence:** Confirmed

### BATL-BUG-11 · P3 · Exploration is client-only, lost on reload, and weakly validated
- **Where:** `frontend/src/features/battles/routes/BattlePostbattle.tsx:466-490,755-765,1157-1171`; `postbattle-utils.ts:213-224,252,277`; `backend/apps/battles/views/combat.py:423-431`; `backend/apps/battles/views/shared.py:1178-1196,1831-1844,1951-1958`
- **What:**
  1. Dice and roll state live only in React state, and every draft save clears `exploration` server-side, so a reload or a phone killing the tab loses the roll (and allows a free re-roll).
  2. Limits differ by side: the frontend allows a count of 0-10 dice and selection of at most 6; the backend checks only ≤ 10 values in 1-6, and `amount_override` has no upper bound.
  3. The exploration log stores the dice only, not the resource, amount or override actually applied.
- **Impact:** Data loss and an audit gap; the "one roll-all" rule is unenforceable.
- **Fix:** Persist exploration in the draft (keep `has_rolled_all`); validate server-side selected ≤ 6 and count ≤ eligible heroes + 1 (or log an explicit override); cap `amount_override` (e.g. 0-12) and log `{dice, resource_id, amount, override}`.
- **Effort:** S · **Confidence:** Confirmed

### BATL-BUG-12 · P3 · Single-use item edge cases
- **Where:** `backend/apps/battles/views/combat.py:72-93`; `backend/apps/battles/views/shared.py:1591-1680`; `combat.py:496-548` (confirm/skip)
- **What:** `item_used` payloads are stored without checking that the unit belongs to the participant or owns the item. Items are consumed only on finalise, so "Leave without saving" keeps every used potion. Henchmen item use in prebattle is attributed to `group.members[0]` (works, but an arbitrary attribution).
- **Impact:** Minor exploit and inconsistency.
- **Fix:** Validate `unit_key` ∈ selected keys and item ownership at event time; consume used single-use items in the skip path too.
- **Effort:** S · **Confidence:** Confirmed

### BATL-BUG-13 · P3 · Live rosters drift mid-battle and can make finalisation impossible
- **Where:** `backend/apps/battles/views/shared.py:309-374,1468-1471,1741-1742`; no battle lock in `backend/apps/warbands`
- **What:** Rosters are read from the live warband tables (`dead=False`). Deleting or killing a unit on the warband sheet during a battle removes it from the roster, the postbattle draft omits it, and validation fails with "postbattle unit_results are missing selected units" (or "A selected hero is no longer available"), leaving "Leave without saving" as the only exit.
- **Impact:** Rare but a dead end; results are lost.
- **Fix:** Snapshot the roster at start (also BATL-PERF-07), or block destructive warband edits while the warband is busy; drop missing units from `required_unit_keys` with a warning instead of failing.
- **Effort:** M · **Confidence:** Likely

### BATL-BUG-14 · P3 · Prebattle "unready on exit" fires on dependency changes, not just unmount
- **Where:** `frontend/src/features/battles/routes/BattlePrebattle.tsx:498-516,963-969`
- **What:** The cleanup runs whenever `battle.status` or the participant status changes, before the effect at `:128-132` sets the suppress flag. When the battle starts, a `ready=false` POST fires and gets a 400 (swallowed); unreadying sends a duplicate unready. Prebattle also does not redirect when the status is `postbattle`.
- **Impact:** Noise requests and throttle budget; a confusing state if a battle jumps phases.
- **Fix:** Track the latest values in refs and run the reset in an unmount-only effect; add the `postbattle` redirect (or centralise redirects, BATL-CQ-02).
- **Effort:** S · **Confidence:** Likely

### BATL-BUG-15 · P3 · Self-events are ignored per user, so a user's second device never updates
- **Where:** `frontend/src/features/battles/utils/battle-state.ts:42-50`
- **What:** Socket events whose `actor_user_id` equals the current user are skipped. A player with the battle open on a phone and a laptop never sees their own actions on the other device.
- **Impact:** Stale second screen (a common setup: phone at the table, laptop for rules).
- **Fix:** Send a per-tab `X-Client-Id` header, echo it in the Pusher payload, and ignore only same-tab events.
- **Effort:** S · **Confidence:** Confirmed

## Code quality

### BATL-CQ-01 · P2 · `views/shared.py` is a 1968-line grab bag
- **Where:** `backend/apps/battles/views/shared.py` (serialisers 66-169, rosters 172-374, realtime 377-437, lifecycle helpers 439-747, JSON normalisers 750-1398, postbattle application 1401-1968)
- **What:** Seven concerns in one module, imported piecemeal by three view modules and by `campaigns/views.py` (which imports private `_cancel_battle_for_all_participants`, `_serialize_*`). The largest function, `_apply_participant_postbattle_results`, is 286 lines.
- **Impact:** Every change touches the hottest, least-tested file; private helpers leak across apps.
- **Fix:** Split into a package:
  - `battles/serializers.py`: battle/participant/event/snapshot serialisation (66-169).
  - `battles/services/rosters.py`: roster payload, later roster snapshot (172-374).
  - `battles/services/realtime.py`: event append, notifications, batched Pusher (377-437).
  - `battles/services/lifecycle.py`: cancel, close postbattle, finalise, reported-result commit, trading reset, expiry (439-742).
  - `battles/validation/{unit_information,custom_units,postbattle}.py`: replace hand-rolled normalisers (750-1398) with DRF serializers.
  - `battles/services/postbattle.py`: split `_apply_participant_postbattle_results` into `apply_unit_results`, `apply_exploration`, `apply_upkeep`, `apply_finds`, `consume_single_use_items`, `write_battle_logs`.
  - `battles/permissions.py`: `get_battle_for_user(..., lock=...)`.
- **Effort:** L · **Confidence:** Confirmed

### BATL-CQ-02 · P2 · The three phase routes are 1173-1799 lines with heavy duplication; proposed decomposition
- **Where:** `frontend/src/features/battles/routes/BattlePrebattle.tsx` (1173), `BattleActive.tsx` (1182), `BattlePostbattle.tsx` (1799)
- **What:** Duplicated blocks between Prebattle and Active:
  - used single-use item counting: `BattlePrebattle.tsx:398-429` / `BattleActive.tsx:331-361`
  - participant selection effect and memo: `:262-292` / `:281-311`
  - `statusParticipants`: `:337-348` / `:363-374`
  - mobile top-bar extra actions: `:469-496` / `:466-493`
  - `updateCustomDraftStat` + `makeCustomUnitKey` + custom unit construction: `:836-898` / `:784-851`
  - item-use handler: `:765-794` / `:719-751`
  - creator cancel handler: `:728-744` / `:580-596`
  - roster loading gate: `:971-980` / `:896-905`
  - phase redirects: `:963-969` / `:884-894` / `BattlePostbattle.tsx:1012-1014`

  Within postbattle: the hero/hired-sword and henchmen rows duplicate kills, dead and injury-chip markup (`:1291-1325` / `:1375-1425`); the desktop floating bar is copied in Active (`:1017-1042`) and Postbattle (`:1624-1646`). The `errorResponse instanceof Error ? ... : ...` pattern appears about 25 times.
- **Impact:** Bugs get fixed in one copy only (BUG-14 exists in Prebattle only); 50+ `useState` per page makes behaviour hard to reason about.
- **Fix:**
  - **Data at layout level:** `routes/BattleLayout.tsx` owns `useBattleState` + `useBattleRosters` and a phase guard, exposed through `BattleContext` (`hooks/useBattleContext.ts`). Phase changes no longer refetch or resubscribe, and redirects live in one place.
  - **State machine:** `state/battle-machine.ts` exports `deriveBattleView(battle, participant)` → `{ route, canEdit, canReady, canStart, canEnd, canCancel, canFinalize, canLeave }`, used by the layout, phase pages and overview CTA (replaces `getBattleRouteForStatus` and the ad hoc booleans at `BattlePrebattle.tsx:431-462`).
  - **Shared hooks:** `hooks/useParticipantSelection.ts`, `hooks/useUsedSingleUseItems.ts`, `hooks/useCustomUnitDraft.ts`, `hooks/useCreatorCancel.ts`, `hooks/useSerializedSave.ts` (generalises the active config queue at `BattleActive.tsx:128-279`; reused by postbattle drafts), `lib/get-error-message.ts`.
  - **Prebattle:** `hooks/usePrebattleConfig.ts` (selection, overrides, notes, custom units, hash/persist: `:89-260,542-622,796-944`), `hooks/usePrebattleActions.ts` (accept, ready, start: `:642-763`), unmount-only `hooks/useUnreadyOnExit.ts`.
  - **Active:** `hooks/useActiveBattleActions.ts` (OOA, wounds, overrides, notes, kill, item: `:598-751`), `hooks/useBattleHelperOptions.ts` (melee/ranged options `:376-458`), `components/active/FinishBattleDialog.tsx` (`:1069-1121`), `components/shared/CancelBattleDialog.tsx` (`:1123-1163`, replacing the copy in `PrebattleDialogs`), `components/shared/BattleFloatingActionBar.tsx`.
  - **Postbattle:** `hooks/usePostbattleDraft.ts` (`:461-464,492-514,560-739`), `hooks/useExploration.ts` (`:466-490,593-638`, persisted), `hooks/useFindItemSearch.ts` (`:516-558`), `hooks/useSectionScrollSpy.ts` (`:895-957`); components `postbattle/ExplorationSection.tsx` (`:1037-1218`), `RosterResultsSection.tsx` with `UnitResultRow.tsx` (shared by heroes, hired swords and henchmen), `FindsSection.tsx` (`:1433-1550`), `UpkeepSection.tsx` (`:1552-1622`), `FinalizeSummaryDialog.tsx` (`:1658-1761`), `LeaveBattleDialog.tsx`, `SeriousInjuryRollDialog.tsx` (`:158-214`), `PostbattleStepperInput.tsx` (`:216-277`); `utils/dice-results.ts` (`:101-156`).
  - **Target:** each route file under 250 lines. Pairs naturally with the TanStack Query decision in PLAN 0.5 (battle state as a query key, patched from socket payloads).
- **Effort:** L · **Confidence:** Confirmed

### BATL-CQ-03 · P2 · Business rules implemented twice (frontend and backend)
- **Where (pairs):**
  - Exploration shard table: `postbattle-utils.ts:365-389` + `BattlePostbattle.tsx:91-99` / `shared.py:1401-1417` (three copies).
  - Find item base cost: `BattlePostbattle.tsx:356-368` / `shared.py:1420-1424`.
  - Upkeep total excluding dead: `postbattle-utils.ts:763-779` / `shared.py:1846-1892`.
  - Dice limits: `postbattle-utils.ts:223,252,277` / `shared.py:1178-1179` (the 6-selected rule exists only in the frontend).
  - Hero death roll type: `BattlePostbattle.tsx:140-151` + `postbattle-utils.ts:793-829` / `shared.py:1462-1480`.
  - Stat clamps 0-10: `prebattle-utils.ts:13-36` / `shared.py:816-820,963-969`.
  - Used single-use counting: `BattleActive.tsx:331-361` / `shared.py:1591-1619`.
  - Kill-count floor: `postbattle-utils.ts:443-457` / `shared.py:1734` (disagree: BUG-04).
  - XP defaults (survive +1, kills with `earned_xp`): `postbattle-utils.ts:142-179,510-564`, frontend only.
  - Busy statuses: `lifecycle.py:45-58` / `campaigns/views.py:600-617`.
- **What:** The server is authoritative for some rules and absent for others; the copies have already drifted (kills, dice selection).
- **Impact:** Silent divergence (BUG-04, BUG-11); every rule change needs two PRs.
- **Fix:** The backend computes and returns `suggested_postbattle` (default XP, dice count, upkeep, exploration amount) and a `rules` block (`exploration_table`, `max_dice`, `max_selected_dice`, `hero_death_roll`) in the postbattle state; the frontend renders and edits but does not re-derive. Busy statuses become a `BattleParticipant.objects.busy()` manager method.
- **Effort:** M · **Confidence:** Confirmed

### BATL-CQ-04 · P3 · Dead code on both sides
- **Where:**
  - **Backend:** `shared.py:561-573` (`_all_started_participants_finished`), `:586-598` (`_latest_finished_participant`), `:609-654` (`_apply_kill_aggregation`); `lifecycle.py:300-337` (`PendingReportedBattleResultRequestsView`, not routed); `combat.py:390-395` + `urls.py:117-121` (`winner/` stub that always returns 400); legacy `kill_recorded`/`death_recorded` handling in `combat.py:48-66` (the frontend sends only `item_used`); `BattleParticipant.connection_state` / `last_event_id`.
  - **Frontend:** `components/prebattle/usePrebattleRosters.ts` (126 lines, unused); `battles-api.ts:91-95` `cancelBattlePrebattle`; `postbattle-utils.ts:288-313,831-845` (`rollAllLocalExplorationDice`, `rerollLocalExplorationDie`, `rollD6SeriousInjury`, `rollHeroSeriousInjury`, test-only); `appendBattleEvent` type union still lists `kill_recorded`/`death_recorded`.
- **What:** Superseded implementations kept alongside current ones (special-id plumbing, BUG-10).
- **Impact:** Readers assume dead paths matter (e.g. that kills are event-aggregated).
- **Fix:** Delete, or revive deliberately per BUG-04/BUG-09.
- **Effort:** S · **Confidence:** Confirmed

### BATL-CQ-05 · P3 · Repetitive view boilerplate and near-duplicate views and helpers
- **Where:**
  - 20 APIViews repeat the throttle, permission, `with transaction.atomic(): battle, participant = _get_user_battle_participant(...); if not battle or not participant: 404` sequence plus status guards.
  - `combat.py:443-493` vs `:496-548`: finalize vs confirm (copied guards, and "confirm" is described as a "legacy alias to finalize" in the README while it actually **skips** postbattle).
  - `shared.py:527-583`: five `_all_participants_*` helpers, two queries each.
  - `lifecycle.py:827-839` re-implements `_coerce_bool`.
  - Participant/warband validation duplicated: `lifecycle.py:95-127` vs `:349-380`.
  - Winner parsing: `combat.py:303-315` vs `lifecycle.py:402-416`.
  - Notification loops: `lifecycle.py:244-287` vs `:468-497`.
  - The default `postbattle_json` dict appears three times: `shared.py:1149-1154`, `combat.py:423-431`, `:512-526`.
- **Impact:** Guards drift (the cancel-after-finish hole in BUG-02 is one).
- **Fix:** A `BattleActionView` base with declarative `allowed_battle_statuses`, `allowed_participant_statuses`, `creator_only`, `lock=True`; one `participants_all_in(battle_id, statuses, exclude=())` using a single `aggregate(total=Count("id"), ok=Count("id", filter=Q(status__in=...)))`; rename `confirm/` to `skip-postbattle/` (keep the alias).
- **Effort:** M · **Confidence:** Confirmed

### BATL-CQ-06 · P3 · Typing and contract gaps
- **Where:** `frontend/src/features/battles/types/battle-types.ts:152-180` (participant type), `:189` (`payload_json: Record<string, unknown>`); `backend/apps/battles/views/shared.py:92-140` (view-shaped serialisation with no schema)
- **What:** One `BattleParticipant` type serves all four `?view=` shapes by making the view-specific fields optional (`postbattle_json?`, `declared_rating?`, timeline fields), so code cannot tell which fields a given page is guaranteed to receive. Event payloads are untyped, which forces the casts in `BattleActive.tsx:341-342`, `BattlePrebattle.tsx:408-409` and `postbattle-utils.ts:151-167`. The backend has no serializer or schema for these shapes, so nothing checks the contract.
- **Impact:** Casts hide contract drift (for example, the kill payload shape is parsed in three places: `postbattle-utils.ts`, `pivotal_moments.py`, `kill_history.py`).
- **Fix:** Per-view participant types (`ActiveParticipant`, `PrebattleParticipant`, `PostbattleParticipant`) and a typed `BattleEvent` union keyed on `type`; DRF serializers per view once CQ-01 lands, then generated TS types (drf-spectacular).
- **Effort:** M · **Confidence:** Confirmed

### BATL-CQ-07 · P3 · Seven frontend battle test files exist twice
- **Where:** `components/active/{ActiveParticipantRoster,ActiveHenchmenGroupCard,ActiveUnitCard}.test.tsx`, `components/shared/{BattleUnitStatsAndItems,BattleDesktopSubnav}.test.tsx`, `utils/battle-session.test.ts`, `components/postbattle/postbattle-utils.test.ts`, each also under the sibling `__tests__/` folder
- **What:** The copies differ only in import paths (verified with `diff --strip-trailing-cr -w`: 2-6 lines each), so Vitest runs 23 cases twice.
- **Impact:** Slower runs; fixes land in one copy and the other goes stale.
- **Fix:** Delete the co-located copies, keep `__tests__/` (the convention used by the route tests).
- **Effort:** S · **Confidence:** Confirmed

### BATL-CQ-08 · P3 · `BATTLEMODE_README.md` has drifted from the code
- **Where:** `BATTLEMODE_README.md` (rules 6, 10, 11, 14; "Report battle result dialog" section; API list; runbook)
- **What:**
  - Rule 6 (cancel and rejoin) has no UI.
  - Rule 11 ("each user finishes independently") was replaced by creator-only End.
  - Rule 14 (kills aggregated from events at finalise) is dead code.
  - `ReportBattleResultDialog.tsx` does not exist (merged into `StartBattleDialog.tsx`).
  - "Pending reported results show on campaign overview" is not true.
  - `confirm/` is called an alias of finalise, but it skips postbattle.
  - The runbook uses `npm` and `.venv` paths; the "Known issue" about `spell.roll` is stale.
- **Impact:** Misleads the next contributor (including AI agents told to "read this first").
- **Fix:** Rewrite as a short architecture note generated from the state machine in CQ-02, and delete the historical plan sections.
- **Effort:** S · **Confidence:** Confirmed

## UI / UX

### BATL-UX-01 · P2 · On mobile, the postbattle back arrow skips postbattle permanently
- **Where:** `frontend/src/features/battles/routes/BattlePostbattle.tsx:968,982-987,1762-1790`
- **What:** The mobile top-bar back chevron opens "Leave Battle", whose confirm calls `confirm/`: postbattle is skipped and no XP, kills, injuries, finds or item consumption are applied, permanently. On prebattle and active pages the same chevron is a harmless "leave the session, come back later". The mobile bottom bar labels this "Leave" with the secondary style; desktop says "Leave Without Saving" in destructive red.
- **Impact:** A natural "go back" gesture can wipe a player's whole postbattle.
- **Fix:** The back chevron navigates away (the draft is persisted; the overview CTA resumes it). Move "Skip postbattle" into an overflow menu with a destructive style and a confirmation listing what will be lost.
- **Effort:** S · **Confidence:** Confirmed

### BATL-UX-02 · P2 · No one can see who is holding up the battle; transitions are silent
- **Where:** `BattlePostbattle.tsx:1022-1035` (subnav shows only yourself), `:741-753` (navigate away after finalise); redirects `BattleActive.tsx:884-894`, `BattlePrebattle.tsx:963-969`
- **What:** Postbattle shows only the current participant; after finalising you are sent to the warband page, and the battle stays `postbattle` until the last player finishes, with no "waiting for Alice" indicator anywhere. Cancel and end redirect to the overview with no message.
- **Impact:** Players don't know whom to chase (feeds BUG-03); a sudden redirect feels like a crash.
- **Fix:** A participant status strip on every phase page (Ready, In battle, Finalised, Skipped, Idle 2 h) with a "Nudge" action (send a campaign ping); a toast on redirect ("Battle cancelled by Alice", "Battle ended, Monks won"); after finalising, show a "Waiting for others" panel instead of navigating away.
- **Effort:** S-M · **Confidence:** Confirmed

### BATL-UX-03 · P2 · Kills and single-use items cannot be undone
- **Where:** `frontend/src/features/battles/components/active/ActiveUnitCard.tsx:153-163,216-226`; `components/shared/BattleUnitStatsAndItems.tsx:251-282`; backend `combat.py:166-295`
- **What:** OOA has an undo (tap the skull again), but a mis-recorded kill or a fat-fingered "Use" on a potion is permanent: there is no endpoint to void it, the postbattle kill stepper cannot go below the live count, and item uses are consumed on finalise. There is no confirmation step either.
- **Impact:** Wrong kills, XP and pivotal moments, and lost items from one mis-tap on a phone.
- **Fix:** A 5-second "Undo" snackbar after kill/item actions, backed by `POST events/:id/void/` that appends a `*_voided` event and decrements `kill_count`; aggregation ignores voided events.
- **Effort:** M · **Confidence:** Confirmed

### BATL-UX-04 · P2 · The finalise summary omits several permanent changes
- **Where:** `frontend/src/features/battles/routes/BattlePostbattle.tsx:835-852,1658-1761`; backend applies `shared.py:1743,1768,1793-1801` (stat overrides), `:1744-1746` (kills), `:1751` (level-ups), `:1943` (item consumption)
- **What:** The confirmation lists exploration, finds, deaths, XP and upkeep. It does not mention that **temporary stat overrides become permanent** (by design, per `test_finalize_postbattle_applies_unit_stat_overrides`), kills added, level-ups earned, single-use items consumed, or that injury results are not applied (BUG-10).
- **Impact:** Players unknowingly bake a prebattle potion buff into their hero's profile.
- **Fix:** Add "Stat changes", "Kills", "Level-ups (per campaign thresholds)", "Items consumed" and "Injuries to apply manually" sections; consider making permanence of each override an explicit per-unit choice.
- **Effort:** S · **Confidence:** Confirmed

### BATL-UX-05 · P3 · Phone ergonomics and accessibility on active cards
- **Where:** `frontend/src/features/battles/components/active/ActiveUnitCard.tsx:118-136,147-222`; `BattleUnitStatsAndItems.tsx:213`; `BattleActive.tsx:510-529`
- **What:**
  - Wound +/- and OOA buttons are 32 px (`h-8 w-8`) and the "Apply stat changes" tick is 28 px (`BattleUnitStatsAndItems.tsx:213`), below the 44 px touch guideline for a phone held at a table.
  - `aria-label`s like "Record kill" and "Set unit out of action" do not name the unit (the henchmen card does).
  - On the creator's mobile bar, "End Battle" (the normal path) is red/destructive while "Cancel battle" (destroys the session) is the calm secondary button on the left.
- **Impact:** Mis-taps and poor screen-reader output.
- **Fix:** 44 px targets on mobile, unit names in labels, "End battle" as default variant and Cancel moved into an overflow menu.
- **Effort:** S · **Confidence:** Confirmed

### BATL-UX-06 · P3 · Rules support gaps at End Battle and XP defaults
- **Where:** `BattleActive.tsx:1069-1121`; `backend/apps/battles/views/combat.py:303-305`; `postbattle-utils.ts:173-179,510-564`
- **What:**
  - End battle requires at least one winner (no draw or "no result").
  - The dialog doesn't warn that wins/losses are recorded now (BUG-02).
  - Default XP covers survive +1 and XP-granting kills but not the Winning Leader +1 or scenario bonuses.
  - The exploration default count (heroes not OOA + 1 for winners) is shown without explanation.
- **Impact:** Manual corrections every game; surprises.
- **Fix:** Allow "No winner"; add a consequence line in the dialog; add leader-winner XP to the server-side suggestions (CQ-03) with a visible "why" tooltip per default.
- **Effort:** S · **Confidence:** Confirmed

## Security

### BATL-SEC-01 · P3 · Postbattle rewards are fully client-trusted, and permanent stat changes are unaudited
- **Where:** `backend/apps/battles/views/lifecycle.py:539-617` (config accepts `stats_override`, `kill_count` in active and postbattle), `backend/apps/battles/views/shared.py:1386-1387` (XP and kills ≤ 9999), `:1204-1209` (gold ≤ 999,999), `:1187-1190` (unbounded exploration override), `:1743` (stat overrides saved permanently without a log)
- **What:** Any participant can, via the API, grant their own warband up to 9999 XP per unit, 999,999 gc, any catalogue item with a cost, any shard amount, and arbitrary permanent stat lines (0-10). The stat changes leave no warband log at all.
- **Impact:** Acceptable for a friends' honour-system campaign, but owners have no way to spot abuse or mistakes.
- **Fix:** Sensible server caps (XP ≤ 20 per battle per unit, shards ≤ 12, gold ≤ a campaign setting), log every applied stat override (`personnel/stat_change` with before/after), and optionally an owner "review postbattle" setting.
- **Effort:** M · **Confidence:** Confirmed

### BATL-SEC-02 · P3 · Unvalidated event payloads and loose channel authorisation
- **Where:** `backend/apps/battles/views/combat.py:39-46,88-93`; `backend/apps/realtime/channel_auth.py:71-76`
- **What:** `item_used` (and the legacy types) store `payload_json` as sent: any shape, up to Django's 2.5 MB request limit. It is then replayed in every state payload to all participants and pushed to Pusher, which rejects messages over 10 KB and so triggers BUG-05's 500 after commit. Battle channel auth checks participation only, not current campaign membership or participant status.
- **Impact:** One client can bloat every participant's state payload; removed members keep receiving battle events.
- **Fix:** Whitelist keys per event type and cap the size (e.g. 2 KB); require `get_membership` and a non-declined status in `_authorize_battle_channel`.
- **Effort:** S · **Confidence:** Confirmed

## Test plan

### Existing coverage

**Backend:** `backend/apps/battles/tests/test_battles_api.py`, 3979 lines, 1 class, 57 tests:
- Create, busy and reported-result flows: initial state, scenario/date validation, busy rejection, approve commits wins/losses and logs, decline commits nothing, pending reported results don't block, confirmed participants can start anew.
- Start requires all ready; creator-only start, finish and cancel; non-creator 403s.
- Finish commits wins/losses once.
- Postbattle save and finalise: finds (reward trade, stash, lowest availability cost, rejection without cost), upkeep trade with and without gold, skip when unchecked, more than 10 exploration dice rejected, stat overrides applied, no-level-up units skip XP, leader reassignment on death, single-use item removal, confirm skips results, serious injury logged once per new roll.
- Kill endpoints and snapshots; kill history (hero, hired sword, henchmen; membership).
- Pivotal moments written only at end, giant slayer.
- Cancel: all-cancel, creator while inviting, creator while active, owner views and cancels active and reported results.
- State delta and view shapes, invalid view, rosters payload, config persistence (selection, overrides, notes in every phase, `current_wounds`, live-state preservation), item use in prebattle, OOA/kill endpoints, custom victim names.

Not covered: custom XP thresholds, cancel in postbattle, query counts, concurrency, realtime failure, decline/leave/expiry, kill-count edits, injury log lifecycle, `campaigns` busy-flag duplication beyond `test_players_marks_battle_busy_members`.

**Frontend:** 14 unique files, ~41 unique cases (plus 7 duplicated files, BATL-CQ-07):
- `postbattle-utils` (9): defaults, kill floor, ordering, no-level-ups, exploration, upkeep, dice payload, injury guides.
- `battle-session` (4), `battle-state` (2: merge, self-ignore), `active-utils` (2).
- Unit card and roster components (7), subnav (3), notes dialog (3).
- Route tests: BattlePrebattle 1, BattleActive 3 (notes, wound queueing, henchman wounds), BattlePostbattle 6 (shell, notes, mobile sections, dialogs, XP visibility, finds search), BattleLayout 1.

Not covered: `useBattleState` socket and refresh behaviour, finalise and leave flows, start/finish/cancel dialogs, `BattleActionPanel`, `StartBattleDialog`, `CampaignLayout` battle refresh, notification approve/decline. No e2e tests.

### Gaps and proposed tests

| ID | Level | Scenario | Expected result | Priority |
| --- | --- | --- | --- | --- |
| BATL-TEST-01 | API | Campaign hero thresholds `[1, 3, 10]`; finalise a hero from 0 → 3 XP | `hero.level_up += 2` (default table would give 1) | P1 |
| BATL-TEST-02 | API | Custom `hired_sword_level_thresholds` and `henchmen_level_thresholds` differ from each other; finalise both kinds | Each uses its own table | P1 |
| BATL-TEST-03 | API | Creator calls `cancel-battle/` in postbattle after one participant finalised | 400 (or "close postbattle" path); wins/losses and the confirmed participant's status unchanged | P1 |
| BATL-TEST-04 | API | Owner calls `active-battles/:id/cancel/` in postbattle | Same as TEST-03 | P1 |
| BATL-TEST-05 | API | `GET state` for a 3-participant battle with 50 events | No UPDATE/INSERT issued; `assertNumQueries(<=4)`; count independent of participants and events | P1 |
| BATL-TEST-06 | API | Current/list battle endpoint with 1 vs 30 historical battles | Identical query count; payload contains only open battles | P1 |
| BATL-TEST-07 | API | Finalise a fixture warband (5 heroes, 2 hired swords, 8 henchmen, 1 find) | `assertNumQueries` ≤ 30 (budget after the PERF-04 fix; record the current baseline first) | P2 |
| BATL-TEST-08 | API | `send_battle_event` mocked to raise during `unit-kill` | 201 returned, kill stored once, error logged | P1 |
| BATL-TEST-09 | API | Same kill submitted twice with one `Idempotency-Key` | One event, `kill_count` +1 | P2 |
| BATL-TEST-10 | API | Postbattle draft raises a unit's kills from 1 to 3, then finalise | Agreed semantics (BUG-04): permanent kills equal the value shown; pivotal moments use the same number | P1 |
| BATL-TEST-11 | API | Record kill, then POST `/config/` with a stale `unit_information_json` (`kill_count: 0`) | `kill_count` and `out_of_action` preserved (merge-patch) | P2 |
| BATL-TEST-12 | API | Invitee declines during inviting | Battle cancelled (or participant removed); invitee no longer busy; creator notified | P2 |
| BATL-TEST-13 | API | Freeze time past each TTL (inviting, prebattle, active, postbattle) and call the sweeper | Expected transitions; postbattle auto-skips and ends once; pivotal moments generated once | P1 |
| BATL-TEST-14 | API | Serious-injury roll in draft, then "leave without saving" | No `serious_injury` log; with finalise, exactly one log per unit | P2 |
| BATL-TEST-15 | API | Pending reported results endpoint with 5 pending | Constant query count; resolves after approve/decline; "clear all" doesn't hide action-required items | P2 |
| BATL-TEST-16 | API (TransactionTestCase, 2 threads) | Two participants finalise concurrently | Both confirmed; exactly one `battle_ended` event; pivotal moments and trading reset once; no deadlock | P2 |
| BATL-TEST-17 | API | `item_used` with a unit not owned, an item not owned, or a 50 KB payload | 400 each | P3 |
| BATL-TEST-18 | API | Reported result with `battle_date` tomorrow | 400 | P3 |
| BATL-TEST-19 | API | Locked participant query SQL | Contains `FOR UPDATE OF "battle_participant"` (no user/warband lock) | P3 |
| BATL-TEST-20 | Component | BattlePostbattle on mobile: tap the back chevron | Navigates away; `confirmBattlePostbattle` not called | P2 |
| BATL-TEST-21 | Unit (hook) | `useBattleState` receives 5 socket events in 100 ms | One GET; a response older than the current `state_version` is discarded | P2 |
| BATL-TEST-22 | Unit (hook) | `useBattleState` on `visibilitychange` to visible, and on Pusher `connected` after `unavailable` | Refetches once | P2 |
| BATL-TEST-23 | Component | `CampaignLayout` + `BattleActionPanel` mounted; fire `focus` and `visibilitychange` | At most one current-battle request | P1 |
| BATL-TEST-24 | Unit | Exploration table parity: frontend vs a backend-exported JSON fixture (until CQ-03 removes the copy) | Same amounts for totals 0-40 | P3 |
| BATL-TEST-25 | e2e (Playwright, 2 contexts) | Invite → accept → ready ×2 → start → OOA/kill/wounds on A → end → both finalise | B's UI reflects A's actions within 2 s without reload; battle ends; wins/losses, XP, level-ups and logs correct | P1 |
| BATL-TEST-26 | e2e | B goes offline during "End battle", comes back online | B lands on postbattle without a manual reload | P2 |
| BATL-TEST-27 | Component | Postbattle kill stepper and finalise summary | Summary lists stat changes, kills, level-ups and consumed items | P3 |

### Manual QA script

Setup: three accounts in one campaign, each with a warband that has heroes, a henchmen group and a hired sword: **A** (owner, Chrome), **B** (Chrome incognito or Firefox), **C** (a phone, or DevTools device mode at 390 × 844). Optionally set custom level-up thresholds in Campaign Settings first, e.g. hero `[1, 3, 5]`. Keep DevTools Network open on A filtered by `battles`, and note request counts.

1. **Overview load cost.** A opens the campaign overview. Count `GET .../battles/` requests (today: 2-3). Switch to another tab and back: count again (today: +4). Record the response size.
2. **Create.** A clicks Start battle, selects B and C, enters a scenario and ratings, submits. B and C receive an invite notification in under 3 s. A sees "See Status".
3. **Decline (expected gap).** As C, look for a way to decline in the notification, the status dialog and the prebattle gate. Expected today: none; dismissing the notification leaves the battle inviting and C still "busy" in A's Start dialog. Record the result.
4. **Accept.** B and C accept (one via notification, one via overview). When the last accepts, all three are navigated to prebattle automatically.
5. **Prebattle config.** Each player deselects one unit, adds a temporary stat edit with a note, and adds a custom unit. Switch to another player's tab and confirm the changes appear without reload.
6. **Ready.** B readies, then unreadies, then readies. A's Start button stays disabled until all three are ready. A navigates back to the overview and returns: confirm A was auto-unreadied.
7. **Start.** A starts the battle. All clients move to Active.
8. **Live actions.** On C (phone), toggle OOA on a hero, adjust wounds with +/- quickly, record a kill against one of B's units, and use a single-use item. On A and B, confirm each change appears within ~2 s. Check the touch targets and that the item use cannot be undone.
9. **Reconnect.** On C, enable airplane mode (or DevTools Offline). A records a kill. Disable airplane mode. Expected (desired): C refreshes on reconnect. Today, C shows stale data until reload; record it.
10. **End battle.** A ends the battle and selects the winner(s). A and B move to postbattle. Lock C's screen during this step, then unlock: expected today, C stays on Active and actions error (BUG-07).
11. **Postbattle edits.** On B: roll exploration, reroll one die, reload the page (expected today: exploration lost); raise a hero's kills by 1 (note the value); mark a henchman dead; roll a serious injury twice; add a found item and gold; untick upkeep. Open the warband log in another tab: expected today, two serious-injury entries already written before finalising.
12. **Finalise together.** A and B press Finalise within a second of each other. Both succeed; neither sees an error. The battle remains postbattle until C acts.
13. **Destructive back.** On C (mobile), tap the top-left back chevron in postbattle. Observe that it offers "Leave Battle" (skip). Cancel. Then finalise C normally.
14. **Results check.**
    - The battle appears in Battle History with the right winners.
    - Wins/losses on each warband incremented exactly once.
    - Hero XP and pending level-ups match the **campaign** thresholds (expected today: they match the default table, BUG-01).
    - Kills on the warband sheet: compare with the value set in step 11 (expected today: the postbattle edit is ignored, BUG-04).
    - The used item is gone, the found item is in the stash, gold and the upkeep trade are in the ledger.
    - Pivotal moments appear on the overview.
15. **Cancel after end (regression for BUG-02).** Start a new A+B battle, end it (pick A), and before finalising, have the owner cancel it from Campaign Settings → Active Battles. Today the cancel succeeds and A keeps the extra win and B the extra loss; record the counters before and after.
16. **Stale battle.** Start an A+B battle and have A (creator) close the browser mid-active. As B, try to end, leave or start another battle: no path exists. As owner, find it under Settings → Active Battles.
17. **Reported result.** A reports a result with B and C as participants and A as winner. B approves from the notification. C clicks "Clear all" in notifications, then looks for the pending result on the overview: expected today, nowhere to approve (BUG-09). Owner cancels it from settings. Repeat, with C declining: the result is cancelled for everyone and no wins/losses change.
18. **Performance spot check (optional, staging with Neon).** With 3 players on the active page, have one player record 10 actions in 30 s; in Render logs or a query-count middleware, confirm per-action counts match about `10 + 8 × (N-1)` today, and re-measure after the PERF-02/03 fixes.
