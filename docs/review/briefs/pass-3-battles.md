# Pass 3 brief: Battles

Step 1 of the pass loop in [PLAN.md](../PLAN.md). Full detail (repro, fix) is in [features/05-battles.md](../features/05-battles.md); IDs are from [BUGS.md](../BUGS.md), [PERFORMANCE.md](../PERFORMANCE.md), [IMPROVEMENTS.md](../IMPROVEMENTS.md) and [TEST_PLAN.md](../TEST_PLAN.md). The review predates passes 1 and 2, so every finding below was re-checked against today's code: the main checkout `pass2/economy-frontend-changes` @ `910bf6e` (line numbers are from here) and the ledger work on `pass2/economy-backend` @ `aa96cb9`, which shortens `views/shared.py` by 29 lines after `:1431`. Both are still moving.

**Already done (not proposed again):**
- Phase 0: realtime sends run after commit in the background with `robust=True` (`core/dispatch.py:29-42`), so a Pusher hiccup no longer turns a kill into a 500 and a retried duplicate (BUG-01, the main half of BATL-BUG-05).
- Phase 0: the open-battle lookup is one prefetched query (`?open=1`, `lifecycle.py:72-82`, budgets 2 and 3, `test_battle_list.py`) shared by the layout and the overview through `useOpenCampaignBattles` (BATL-PERF-01, PERF-10). `state/` no longer re-reads the battle and writes presence at most once a minute (`shared.py:177-183, 492-509`, budget 6; part of PERF-35). One dice engine for the app (`DiceProvider.tsx`; PERF-39, the dice half of BATL-PERF-08). One realtime client that catches up campaign queries after a reconnect (BATL-PERF-10, the platform half of BUG-19). Realtime navigation is offered by toast (BUG-26). Duplicate battle test files are gone (BATL-CQ-07).
- Pass 1: postbattle XP goes through `apply_xp_gain` with the campaign's tables, half-rate and the XP high-water mark (`shared.py:1757, 1778, 1820`; BUG-03 = BATL-BUG-01, with BATL-TEST-01/02 in `test_postbattle_xp.py`); hired swords use the hero table; rosters, postbattle and upkeep only see `on_roster` / `not_dismissed` units; override armour saves use the shared parser at finalise (`:883-893`); leader sync takes the warband lock (`warbands/utils/leaders.py`); kill history lives in `units/services/kill_history.py` on a partial index (PERF-29).
- Pass 2 (main checkout): `X-Pusher-Socket-Id` and `sender_socket_id` exist (`realtime/services.py:71-76`, `campaigns-api.ts:227-228`), but battles neither send nor use them.

**Inherited from pass 2's backend branches** (not merged yet; PR A starts on top of both). The ledger branch changes battles only in `shared.py`: upkeep and battle rewards are signed rows written by `ledger.record` (Upkeep negative, Reward positive), which also moves the stored `Warband.gold`; finds join the stash through `services/stash.add_costs`, each copy at its own cost (BUG-117), replacing the battle's own read-modify-write stash helper (the fourth copy in ECON-CQ-04); `TradeHelper` is gone. The ledger's balance UPDATE locks the warband row, which finalise already holds before it writes any unit (`shared.py:1686`), so the lock order doesn't change. From the trades branch: timers follow `expire_trades` (a cron; reads never write; a write to an overdue row closes it first under its lock), and a spent hero warns instead of being refused (pass 2 decision 9).

**Data is disposable** (`CLAUDE.md`): nothing below needs a backfill, a drift report or a production check.

**Your part:** answer the [open question](#open-question) (decision 4). The other decisions are answered below, and their additions are rows in [Planned changes](#planned-changes).

## What it is today

- **Flow.** `inviting` (everyone accepts through `join/`) → `prebattle` (everyone ready; the creator starts) → `active` (the creator ends it and picks at least one winner; wins and losses are added now, `combat.py:354-359`) → `postbattle` (each player finalises, or skips with `confirm/`; the last one runs `_finalize_battle`, `shared.py:660-682`: `ended`, trading actions reset, pivotal moments) → `ended`. The creator (`lifecycle.py:961-988`) or the owner (`campaigns/views.py:737-768`) can cancel in any phase but `ended`. Reported results: `report-result/` → every other player approves (wins, losses, logs) or one declines (cancelled).
- **State.** Everything battle-scoped sits in four JSON blobs on `BattleParticipant` (selected unit keys; `unit_information_json` with overrides, wounds, OOA and a live `kill_count`; custom units; the `postbattle_json` draft) plus an append-only `BattleEvent` timeline. `Battle` has no activity timestamp.
- **Reads.** `state/?sinceEventId&view` (budget 6); `rosters/`, built from the live warband tables (28 queries) and fetched by each phase page; `battles/?open=1` for the Rejoin button and the overview panel.
- **Realtime.** Each write sends `battle.event` (the event) or a bare `battle_state_updated`; every other client then GETs `state/` (`useBattleState.ts:116-121`), skipping events whose actor is the same user (`battle-state.ts:39-48`). Battle state lives in `useState` on each phase page, not in TanStack.
- **Postbattle.** The draft (`postbattle/`) holds XP, kills, deaths, injury rolls, finds and upkeep; exploration dice live in React state only. Finalise (`combat.py:439-487` → `_apply_participant_postbattle_results`, `shared.py:1680-1970`) makes stat overrides permanent, adds the live kill counter, XP, deaths, exploration shards, upkeep and reward, found items, consumes used single-use items and writes the logs.
- **Permissions.** Creator-only start, end and cancel; owner-only Settings → Active Battles (list and cancel, `campaigns/views.py:702, 745`); the battle channel checks only that a participant row exists.
- **Main files.** Backend `apps/battles/views/`: `shared.py` 1,970, `lifecycle.py` 1,037, `combat.py` 540; 67 backend tests (57 + 6 + 4). Frontend `features/battles/`: `BattlePostbattle.tsx` 1,909, `BattleActive.tsx` 1,196, `BattlePrebattle.tsx` 1,173 (27, 23 and 25 `useState`), `postbattle-utils.ts` 843; 14 test files, 42 cases. Also `StartBattleDialog.tsx` 458 and `BattleActionPanel.tsx` 324.

## What's wrong

### Results and records
- **BUG-09** (P1): wins and losses are added at End battle (`combat.py:354-359`). Both cancels still accept `postbattle` (`lifecycle.py:975-978`, `campaigns/views.py:753-756`), and `_cancel_battle_for_all_participants` rewrites `confirmed_postbattle` rows to `canceled_prebattle` (`shared.py:430-445`) while their XP, gold and items stay applied.
- **BUG-11** (P1): finalise adds the live `unit_information.kill_count` (`shared.py:1744, 1754-1756, 1775-1777, 1804-1805`) and ignores the postbattle stepper, which the frontend floors at the live count (`postbattle-utils.ts:447-454`). Pivotal moments use the stepper's value (`pivotal_moments.py:207, 218`); kill history lists kills from cancelled battles (`units/services/kill_history.py:61-76`, no status filter); `/config/` accepts `kill_count` up to 9999 (`shared.py:846-851`); the event aggregator is dead (`:612-657`). A mis-tapped kill or item use can't be undone (BATL-UX-03).
- **BUG-47**: each draft save with a new injury roll writes a permanent `serious_injury` log (`combat.py:429-433` → `shared.py:1521-1551`), even if the player then skips. Results are never applied: the frontend sends `special_ids: []` (`postbattle-utils.ts:203, 421`), so the backend special path (`shared.py:1481-1490, 1764-1766`) is unreachable.
- **BUG-71**: every draft save clears exploration on both sides (`combat.py:419-423`, `BattlePostbattle.tsx:519-522`), so a reload loses the roll and allows a free re-roll; dice limits are client-only; `amount_override` has no ceiling (`shared.py:1187-1190`); the log records only the dice (`:1953-1960`).
- **SEC-10**: prebattle and in-battle stat overrides become permanent at finalise with no log (`shared.py:1753, 1774, 1795-1803`); 9999 XP per unit and 999,999 gc of finds are accepted silently (`:1208, 1387-1390`).
- **Dead units' items** (pass 2 decision 7): untouched. A dead hero or hired sword keeps his item rows, a dead henchman's group keeps every copy (`shared.py:1759-1761, 1806-1808`), and postbattle doesn't say anything.

### Stuck battles and ways out
- **BUG-10** (P1): `create` refuses anyone in an open battle (`lifecycle.py:132-154`; the Start dialog disables them, `StartBattleDialog.tsx:123, 349, 379`); nothing records activity (`models/battle.py:54-58`) or expires a battle; only the creator can start or end (`lifecycle.py:1001-1002`, `combat.py:330-331`). One abandoned battle locks its players out until the owner finds Settings → Active Battles, and cancelling there in postbattle triggers BUG-09.
- **BUG-45**: invitees can only accept (`PrebattleInviteGate.tsx:28-34`); dismissing the invite just resolves the notification (`notifications/views.py:65`); the participant `cancel/` endpoint has no caller (`battles-api.ts:96`) and would block start for ever, since `_all_participants_ready` counts the cancelled row (`shared.py:530-532`).
- **BUG-46** (reworded): the pending-results view is unrouted and N+1 (`lifecycle.py:300-339`), the overview shows no pending result, and a future `battle_date` is accepted (`:393-402`). Clearing doesn't strand the request as the review said: Clear and Clear all **decline** it and cancel the result for every player, without saying so (`notifications/views.py:60-65, 96-137`).
- **New BUG-121** (P3, Likely; race not reproduced): that clear path reads and writes the battle and participant without a lock. If the same player's Approve (another tab, or a tap just before Clear all) commits in between, the result is applied (wins and losses added) and the battle is then marked cancelled. Same shape as BUG-119 in trades.

### Live state and correctness
- **BUG-44**: `/config/` replaces the whole `unit_information_json` (`lifecycle.py:564-568, 597`), so a wound or notes save built before a kill or OOA undoes it; postbattle `persistDraft` has no queue (`BattlePostbattle.tsx:511-536`), unlike active config (`BattleActive.tsx:123-280`); `mergeBattleState` always takes the incoming participants (`battle-state.ts:19-29`), so a slow GET reverts newer state.
- **BUG-19** (battle part): the reconnect catch-up invalidates campaign queries (`RealtimeProvider.tsx:30-35`), but battle state isn't a query, so a phone that slept through End battle stays on Active and every action fails with "Battle is not active".
- **BUG-75**: events are skipped per user, not per tab (`battle-state.ts:39-48`), so a second device never updates; `send_battle_event` takes no `socket_id` (`realtime/services.py:110-111`).
- **BUG-72**: `item_used` is stored without checking that the unit and item are the player's (`combat.py:72-93`); a skipped postbattle keeps every used item (`:490-540`; items are consumed only at finalise, `shared.py:1945`).
- **BUG-73**: rosters are read live (`shared.py:323-382`); a unit dismissed or killed on the sheet mid-battle makes finalise fail (`:1469-1472, 1751-1752, 1771-1772, 1789-1793`), leaving skip as the only exit.
- **BUG-74**: the prebattle unready-on-exit cleanup runs whenever the battle or participant status changes (`BattlePrebattle.tsx:499-512`), sending duplicate unready POSTs; prebattle has no `postbattle` redirect (`:966-967`).
- **SEC-08** (battle half): channel auth checks only that a participant row exists (`realtime/channel_auth.py:77-82`). **SEC-09**: `item_used` payloads are stored and replayed as sent, any shape and size (`combat.py:39-46, 88-93`).
- **New BUG-122** (P3, Confirmed from code): trading actions reset twice, at End battle (`combat.py:373`) and again when the last player finalises (`shared.py:679`), so a hero who searched or traded while others were still in postbattle gets his action back.
- **New BUG-123** (P3, Confirmed from code): an in-battle armour-save override is stored as any text up to 20 characters (`shared.py:809-816`) but parsed only at finalise (`:883-893`), so a typo such as "7+" makes finalise answer 400 and leaves skip as the only exit (noted in pass 1, never filed).
- **BUG-106** (reworded): not reproducible from today's code. Finalise locks the warband (`shared.py:1686`, and implicitly through the participant query's join at `:523-525`) before any hero (`:1705`), the same order as the roster paths (`lock_warband`). It becomes load-bearing once PERF-37 drops the implicit lock, so PR B keeps the order explicit and pins it.

### Performance left after Phase 0
- **PERF-34** (P1): events carry no state (`shared.py:385-416`); each other client GETs `state/` per event with no coalescing (`useBattleState.ts:116-121`); notes autosaves broadcast too.
- **PERF-35** (rest): every write view still calls `_touch_participant` (15 calls in `combat.py` and `lifecycle.py`), an extra UPDATE; `connection_state` and `last_event_id` are never read.
- **PERF-36** (P1): finalise validates twice (`combat.py:459`, `shared.py:1683`), saves units one by one including every henchman (`:1808`), runs an `exists()` per special (`:1764-1766`) and a query per group (`:1822`), and writes logs singly, all under the battle lock. No budget yet.
- **PERF-37**: `select_for_update()` with `select_related("user", "warband")` locks the user and warband rows on every battle write (`shared.py:523-525`; also `:1719-1720`).
- **PERF-38**: `rosters/` (28 queries) is fetched by each phase page through an ad hoc `useEffect` (`useBattleRosters.ts:35-112`).
- **PERF-40**: the finds picker requests `GET /items/` (170 KB) on open and after every keystroke (`BattlePostbattle.tsx:542-584`), though the catalogue is cached since 0-D.

### Code quality
- **BATL-CQ-01** (IMP-50): `shared.py` mixes serialisers, rosters, realtime, lifecycle, normalisers and postbattle; `_apply_participant_postbattle_results` is 290 lines and `_normalize_postbattle_json` 253; `campaigns/views.py:14-19` imports four private helpers.
- **BATL-CQ-02** (IMP-51): the duplication the review lists is still there; each route owns its own state, rosters and redirects; battle code has 22 copies of the `instanceof Error` message block.
- **BATL-CQ-03** (IMP-52): rules on both sides: exploration table (`postbattle-utils.ts:370-395` / `shared.py:1405-1421`), suggested XP (frontend only, `postbattle-utils.ts:150-205`), busy statuses (`lifecycle.py:47-60` / `campaigns/views.py:613-634`), kill floor, dice limits, stat clamps.
- **BATL-CQ-04 to -06, -08** (IMP-53 to -56): dead code (`shared.py:564-576, 589-601`; the `winner/` stub, `combat.py:386-391`; legacy `kill_recorded` handling, `:48-66`; `usePrebattleRosters.ts`; `cancelBattlePrebattle`; test-only roll helpers, `postbattle-utils.ts:297, 305, 822, 826`); about 20 views repeating the load, lock and 404 preamble; one participant type for four `?view=` shapes; a stale `BATTLEMODE_README.md`.

### UX
- **BUG-48** (BATL-UX-01): the mobile back chevron opens "Leave Battle", which skips postbattle for good (`BattlePostbattle.tsx:1051, 1871-1903` → `confirm/` at `:847`).
- **BATL-UX-02**: nobody can see who is holding a battle up; after finalising you are sent away (`BattlePostbattle.tsx:824`). **BATL-UX-04**: the finalise summary lists exploration, finds, deaths, XP and upkeep only (`:1765-1860`).
- **BATL-UX-05**: 32 px wound and OOA buttons (`ActiveUnitCard.tsx:28, 121, 135`), labels without the unit's name (`:126-166`), End battle red and Cancel calm on the creator's mobile bar (`BattleActive.tsx:515-533`).
- **BATL-UX-06**: End battle needs a winner (`BattleActive.tsx:548, 1132`; `combat.py:304-305`), doesn't say when wins count, and suggested XP has no Winning Leader +1.
- The mid-battle stat editor has been unmounted since a restyle, while `onSaveOverride` is still threaded through (`ActiveUnitCard.tsx:40-43`, `ActiveHenchmenGroupCard.tsx:38-41`, `BattleActive.tsx:983`).

## What I propose for this pass

Order: characterisation tests → PR A → PR B → PR C (decisions and Planned changes).

### PR A: fixes

Decision-independent, backend
- BUG-44: `/config/` takes `unit_information_patch: {unit_key: {current_wounds?, notes?, stats_override?}}`, merged under the participant lock; `kill_count` and `out_of_action` change only through their own endpoints, also when an old client sends the whole blob.
- BUG-72, SEC-09: `item_used` needs a selected unit of the player's that holds the item, whitelisted keys and at most 2 KB; a skipped postbattle consumes used single-use items too.
- BUG-73, PERF-38 (server half): `start/` stores each participant's roster (`roster_json`), and `rosters/` serves it from then on; finalise leaves out a unit that has left the warband, with a warning, instead of answering 400.
- BUG-122: trading actions reset once, at End battle. BUG-123: override armour saves are parsed when entered (`parse_armour_save`), as every unit write already does.
- BUG-46, BUG-121: `GET campaigns/:id/battles/pending-results/` (constant queries, BATL-TEST-15); `POST withdraw-result/` for the submitter; `battle_date` not in the future; clearing a result request only resolves the notification, so the unlocked decline goes.
- SEC-08 (battle half): channel auth needs current membership and a participant who hasn't declined or been cancelled.
- PERF-37: `select_for_update(of=("self",))` wherever a locked query joins (BATL-TEST-19). PERF-35: writes stop calling `_touch_participant`.
- PERF-34 (server half, additive): `Battle.state_version`, raised by every battle write; `battle.event` and `battle_state_updated` carry it and the changed participant's snapshot (under Pusher's 10 KB); `X-Pusher-Socket-Id` skips the sender's own socket (BUG-75 server half); notes saves stop broadcasting. The frontend adopts it in PR B.

Decision-independent, frontend
- BUG-44: postbattle drafts go through the same serialised queue as active config; config saves send only the changed unit's patch.
- BUG-48 (IMP-57): the back chevron only navigates (the draft is saved and the overview resumes it); "Skip postbattle" moves to the overflow menu, styled destructive, with a confirm listing what won't be applied.
- BUG-74: unready on unmount only; prebattle redirects to postbattle. BUG-75: battle writes send `X-Pusher-Socket-Id`, and only own-socket events are skipped.
- BUG-46: a "Results awaiting your approval" card on the overview with Approve, Decline and, for the submitter, Withdraw.
- PERF-40: finds filtered from the cached campaign items; no request per keystroke. BATL-UX-05: 44 px targets, unit names in labels, End battle as the default button and Cancel in the overflow.

Decision-driven, backend
- BUG-09 (decision 3): wins and losses move from `combat.py:354-359` into `_finalize_battle`, applied once; both cancels refuse `postbattle` (`code: "use_close_postbattle"`); `POST close-postbattle/` (the creator, or anyone with the new `manage_battles` permission from BATL-NEW-04) marks unfinished players skipped (`skipped_postbattle: true`, used items consumed) and ends the battle; cancel never rewrites a `confirmed_postbattle` row.
- Decision 8: `finish/` accepts an empty winner list: no wins or losses. Reported results accept it too, for consistency (`lifecycle.py:415-416`).
- BUG-10 (decisions 1 and 2): `Battle.last_activity_at` (indexed with status), bumped by every battle write; `create` warns instead of refusing busy players (`warnings` in the answer); the `/players/` busy entry carries the battle's id, status and `last_activity_at`; `Battle.closes_at` is set at create (72 h to answer) and at End (72 h of postbattle); `manage.py expire_battles [--dry-run]`, run by a Render cron job like `expire_trades`, declines overdue invitees (with fewer than two players left the battle is cancelled) and closes overdue postbattles as Close postbattle does.
- BUG-45 (decline is in every option of decision 4): `POST decline/` while inviting sets `declined`, resolves the invite and notifies the creator; one `participants_all_in()` aggregate ignores declined and cancelled rows.
- BUG-11 (decision 5): `POST events/:id/void/` (your own kill or item use, until you finalise) marks the event voided and appends a `*_voided` event; postbattle can add a kill event (`source: "postbattle"`); finalise counts each unit's live kill events through the revived `_apply_kill_aggregation`, the only writer of `kills`; `kill_count` becomes derived in payloads and is ignored on input; pivotal moments and kill history read the same events, and kill history lists ended battles only.
- BUG-47 (decision 7): draft saves log nothing; a server injury table gives each result's effect (`dead`, a characteristic −1, a special, or `manual`); finalise applies the ticked effects and writes one log per unit with the final roll and what was applied.
- BUG-71, SEC-10 (decisions 6 and 9): the draft keeps exploration (dice, re-rolls, resource, override) and the server computes the amount; stat overrides apply only with `keep_stats` and are logged with before and after; re-rolls and unusual values come back as `warnings` and are logged, never refused.
- Pass 2 decision 7: each dead henchman takes one copy of each of his group's items; dead heroes and hired swords keep theirs on the record, out of reach; the battle log lists what was lost.

Decision-driven, frontend (the minimum to stay honest; the rest is PR C): Cancel in postbattle becomes Close postbattle; End battle offers "No winner" and says wins and losses count once everyone has finished; Decline in the invite gate, status dialog and notification; the Dead tick says "all carried items are lost".

### PR B: refactor (no behaviour change, except BUG-19 in its own commit)

Backend
- Split `views/shared.py` (IMP-50): `serializers.py`; `services/rosters.py`; `services/realtime.py`; `services/lifecycle.py` (cancel, close postbattle, finalise, reported results, trading reset, expiry, `participants_all_in`); `validation/` (DRF serializers for unit information, custom units and the draft, replacing about 650 lines of normalisers); `services/postbattle/` (`apply_unit_results`, `apply_exploration`, `apply_upkeep_and_rewards`, `apply_finds`, `consume_single_use_items`, `write_battle_logs`). Public names for what `campaigns` and the warband tests import. Nothing over 400 lines or 60 per function.
- `BattleScopedView` (IMP-53; the permissions design's name): loads battle and participant once, locked with `of=("self",)`; declarative allowed statuses, creator and `manage_battles` rules; views ≤ 40 lines per method. The state payload gains `capabilities` (`start`, `end`, `cancel`, `close_postbattle`, `edit_record`).
- PERF-36 with the split: validate once, read campaign settings once, `bulk_update` units, henchmen and groups, `bulk_create` specials and logs, upkeep and reward in one `ledger.record_entries`, group deaths from memory; the battle row locked only for the final "everyone has finished" step, with the participant's status change as the idempotency guard. Budget ≤ 30 (BATL-TEST-07).
- BUG-106: the lock order lives in one place: battle, participant, warband, units, then stash and resource rows (the ledger's balance UPDATE reuses the warband lock), pinned by an SQL-order test like BUG-105's.
- IMP-52: `suggested_postbattle` (XP per unit by today's frontend rule, exploration dice, upkeep) and a `rules` block (exploration table, injury tables, hero death roll) in the postbattle state, with today's values.
- Deleted: `_touch_participant`, `connection_state`, `last_event_id`, the unused helpers, `winner/`, legacy event types and the unrouted view. `confirm/` becomes `skip-postbattle/`, keeping the old path as an alias.

Frontend
- `api/battle-queries.ts`: `['campaign', cid, 'battle', bid, 'state' | 'rosters']`. `BattleLayout` owns both queries and the phase redirects (`deriveBattleView` in `state/battle-machine.ts`) and shares them through `BattleContext`, so a phase change refetches nothing. Mutations apply their answer with `setQueryData`; socket events patch the cache from their payload, refetch only on a `state_version` gap, keep one request in flight and drop answers older than the cache (PERF-34, BUG-44).
- BUG-19: `useRealtimeReconnect` and `visibilitychange` invalidate the battle state; a 400 with `code: "battle_status_changed"` refetches it.
- Routes ≤ 250 lines (IMP-51): shared `useParticipantSelection`, `useUsedSingleUseItems`, `useCustomUnitDraft`, `useSerializedSave`; prebattle, active and postbattle split as the review lists; `getErrorMessage` everywhere; per-view participant types and a typed event union (IMP-54); postbattle renders `suggested_postbattle` and `rules` instead of its own copies; dead code deleted; `BATTLEMODE_README.md` rewritten as a short note (IMP-56).

### PR C: your decisions and Planned changes

Every row below is Agreed and lands on PR B's data layer, in this order: records (BATL-TWEAK-02, -06, BATL-NEW-04), ways out (BATL-TWEAK-01, BATL-NEW-01 to -03, -05), postbattle (BATL-TWEAK-03 to -05, -07, -08, BATL-NEW-06, -07, -09, -10), then the status strip (BATL-NEW-08). Decision 4's rows join once you've answered it.

### Query and request targets

| Request | Today | After pass 3 | Test |
| --- | --- | --- | --- |
| `GET state/` | 6 (the first read in a minute writes presence) | ≤ 4, constant in players and events | BATL-TEST-05 |
| `GET rosters/` | 28, once per phase page per player | from the snapshot, once per battle per player | PERF-38 |
| Each tap, per other player | 1 `state/` GET (5 or 6 queries) | 0 (patched from the event); 1 GET on a version gap | BATL-TEST-21 |
| `POST finalize-postbattle/` (fixture) | about 62-70 under the battle lock (estimated) | ≤ 30; battle row locked only for the last step | BATL-TEST-07 |
| Finds picker | one `items/` request (170 KB) per keystroke | 0 | PERF-40 |
| Pending reported results | unrouted, N+1 | constant | BATL-TEST-15 |

### Calls I made in this brief (change any of them)
- Both timers are 72 hours, counted from the invite and from End battle, not from the last activity, so the deadline shown never moves.
- `manage_battles` also gates the owner tools (BATL-NEW-03) and Close postbattle, so owners and admins get them by default; pass 4 decision 7 still decides the overview banner.
- Clearing a reported-result notification stops declining it (BUG-46); the player answers on the overview card instead. This also removes BUG-121.
- "No winner" applies to reported results as well as End battle.
- The idempotency key for kills (BATL-TEST-09) and the win/loss drift report are dropped: the false 500 is gone, decision 5 makes duplicates undoable, and data is disposable.
- The unusual-value thresholds in BATL-TWEAK-07 are placeholders to tune in PR C.

### Characterisation tests to write first

Backend (factories; Pusher mocked; known bugs pinned with their ID so they flip in PR A)
- Lifecycle: create (busy refusal, pinned for decision 1), accept → prebattle, ready and unready, creator-only start and end, creator and owner cancel in each phase; pinned: wins and losses at End and a postbattle cancel rewriting confirmed rows (BUG-09, BATL-TEST-03/04), a cancelled participant blocking start (BUG-45), a skip keeping used items (BUG-72), two trading resets (BUG-122).
- Config and combat: config replaces the blob and undoes a kill (BUG-44, BATL-TEST-11) and accepts `kill_count`; an armour-save typo accepted, then finalise 400 (BUG-123); kill, OOA and item-use shapes; pinned: another player's unit or item and a 50 KB payload accepted (BUG-72, SEC-09, BATL-TEST-17).
- Postbattle, on a fixture warband (5 heroes, 2 hired swords, 8 henchmen in 3 groups, a find): overrides permanent and unlogged (SEC-10), live kills applied over the stepper (BUG-11, BATL-TEST-10), a log per draft re-roll (BUG-47, BATL-TEST-14), exploration cleared by a draft save (BUG-71), dead units keeping their items (decision 7), signed upkeep and reward rows, finds at their own cost, the crown moving on a death; kill history listing a cancelled battle (BUG-11).
- Notifications and channels: Clear all declining a pending result (BUG-46); a removed member still authorised on the battle channel (SEC-08).
- Budgets at today's counts: `state/` (6), `rosters/` (28), config, kill, OOA, finish and the finalise fixture (BATL-TEST-05/07); the SQL of a locked battle write (BATL-TEST-19).
- Concurrency (`TransactionTestCase` with two threads, as in pass 2): two players finalising together (BATL-TEST-16: both confirmed, one `battle_ended`, pivotal moments and trading reset once); finalise against a leader PATCH on the same warband (BUG-106, expected to pass); a config save racing a kill (BUG-44) and Clear racing Approve (BUG-121), both expected failures until PR A.

Frontend (the fake API server, `src/test/fake-api.ts`)
- `useBattleState`: one GET per socket event, no coalescing (PERF-34, BATL-TEST-21 baseline); own-user events skipped (BUG-75); nothing refetched on reconnect or `visibilitychange` (BUG-19, BATL-TEST-22); a slow GET reverting newer participants (BUG-44).
- Request counts from prebattle through active to postbattle: `rosters/` three times (PERF-38).
- Prebattle: a duplicate unready POST on a status change (BUG-74). Active: End needs a winner (decision 8); kill, OOA and wound requests through the config queue. Postbattle: the back chevron calls `confirm/` (BUG-48, BATL-TEST-20); unqueued drafts sent without exploration (BUG-44, BUG-71); the kill floor; the finalise summary's sections (BATL-TEST-27 baseline); a request per keystroke in the finds picker (PERF-40).
- `StartBattleDialog` disables busy players (decision 1); Approve and Decline only in the notification (BUG-46).
- E2E-02, E2E-05 and E2E-06 wait for Playwright (0.14c); until then they are manual QA steps (`features/05-battles.md`, manual QA 1-18).

## Decisions (answered by William, 2026-10-18)

| # | Decision | Answer |
| --- | --- | --- |
| 1 | Busy players | **B, warn and allow**: busy players greyed out but clickable ("in battle #40, idle 6 days"). **Plus:** a player with an unfinished battle is told so, with a way to go straight to it and finish it (BATL-TWEAK-01, BATL-NEW-01). |
| 2 | Abandoned battles | **C**: no automatic action except timers for unanswered invites and unfinished postbattle; "idle N days" shown elsewhere; tools for the owner (BATL-NEW-02, -03). |
| 3 | When wins and losses count | **A**: only when the battle finishes; in postbattle, Cancel becomes "Close postbattle" (BATL-TWEAK-02). **Plus:** an admin can edit past battles, behind a new campaign permission: the start form (scenario name and link, participants) and the winners and losers. These edits change only that battle record; nothing else is recalculated (no warband win/loss counters, XP, gold or kills) (BATL-NEW-04). |
| 4 | Leaving and handing over | **No leaving halfway.** Invitees can decline before the battle starts. In an active battle, a player who is out (lost first, routed) taps "Finish my battle" and goes straight to their own postbattle while the others play on; on finishing they declare "I won", "I lost" or "decide when the battle ends". **The battle ends automatically when the last player finishes**: that player gets a "Confirm results" modal and drags each participant into Winners or Losers, with anyone who already declared starting on their chosen side (decision 8's "No winner" still allowed). **Start: any participant, after a confirm** ("Alice created this battle. Start it anyway?"). There is no End button and no forfeit. |
| 5 | Kill mistakes | **A**: undo any time before finalising; the postbattle number is what's saved (BATL-TWEAK-03). **Plus:** postbattle lists each unit's kills by who was taken out, so a specific kill can be removed or added, not just a number changed (BATL-NEW-06). |
| 6 | Temporary stat changes | **A**: temporary unless "keep" is ticked in postbattle, and logged (BATL-TWEAK-04). **Restore the hidden mid-battle stat editor** (BATL-NEW-07). |
| 7 | Serious injuries | **A**: logged once at finalise; simple results applied but can be unticked; complex ones flagged "apply by hand" (BATL-TWEAK-05). |
| 8 | No winner | **A**: "No winner" records no wins or losses (BATL-TWEAK-06). |
| 9 | Exploration and unusual numbers | **A**: the roll is saved; re-rolls and unusual values warn, go ahead and are logged (BATL-TWEAK-07). |
| a to c | Optional features | **All wanted**: who's holding up the battle, with Nudge, and a "Waiting for others" panel (BATL-NEW-08); Winning Leader +1 XP with a "why" tooltip on each suggestion (BATL-NEW-09); a finalise summary of every permanent change (BATL-NEW-10). |
| Pass 2, 7 | Items of units that die | **Lost**, and postbattle says so (BATL-TWEAK-08). |

## Open question

None. Decision 4 was answered on 2026-10-18 (see the table): per-player "Finish my battle" with a self-declared result, an automatic end when the last player finishes with a drag-to-sides "Confirm results" modal, and Start by any participant after a confirm. This replaces BATL-NEW-05's leave/forfeit ideas; decline stays. In PR C: `finish/` per participant (moves that player to postbattle, stores the declared result), the end transition fires from the last `finish/`, and the results modal writes winners and losers in one request; start becomes a participant rule in `BattleScopedView`.

## Planned changes

Types: **New**, **Tweak**, **Remove**. IDs: `BATL-NEW-NN`, `BATL-TWEAK-NN`, `BATL-REMOVE-NN`. Status: Proposed → Agreed → Done.

| ID | Type | Change | Notes / acceptance | Status |
| --- | --- | --- | --- | --- |
| BATL-TWEAK-01 | Tweak | Busy players greyed out but selectable, with a warning | Decision 1. In the Start battle dialog a player in an open battle is greyed out ("in battle #40, idle 6 days") but can be ticked; ticking shows the warning, and the server creates the battle and returns the warning instead of refusing. The overview panel and the Rejoin button list every open battle (today `getResumableBattleForUser` picks one). | Agreed |
| BATL-NEW-01 | New | Warning about your unfinished battle, with a way back | Decision 1. A player with an unfinished battle sees "You have an unfinished battle: #40, postbattle, idle 6 days. Go to it" when starting a battle, on an invite (gate and notification) and on the overview; the link opens the phase page where it can be finished. | Agreed |
| BATL-NEW-02 | New | Idle time and two timers | Decision 2. `last_activity_at` shows as "idle N days" on the overview, the phase pages, the Start dialog and Settings → Active Battles. An invite unanswered for 72 h counts as declined (with fewer than two players left the battle is cancelled); a postbattle still open 72 h after End skips whoever hasn't finished and ends the battle. Pages show the deadline ("postbattle closes in 2 days"). No other automatic action; reads never write. | Agreed |
| BATL-NEW-03 | New | Owner tools for stuck battles | Decision 2. Settings → Active Battles shows idle time and offers End battle (winners or No winner), Close postbattle and Cancel (not in postbattle), behind `manage_battles` (owners and admins have it). | Agreed |
| BATL-TWEAK-02 | Tweak | Wins and losses count when the battle ends; Close postbattle | Decision 3. Applied once, when the last player finalises or postbattle is closed. In postbattle, Cancel is replaced by Close postbattle (the creator, or `manage_battles`): whoever hasn't finished is skipped, their results aren't applied, and the dialog says so. End battle says "Wins and losses are recorded when everyone has finished postbattle." | Agreed |
| BATL-NEW-04 | New | Edit a past battle's record | Decision 3. New campaign permission `manage_battles` (owners and admins have it; it can be granted to others; added to `PERMISSION_SEED`, `campaigns/views.py:85-94`). On an ended battle (Battle History → Edit, `PATCH battles/:id/record/`): scenario name and link, date, participants (a removed one is kept, marked removed), declared ratings, winners and losers. Only the battle record changes: warband win/loss totals, XP, gold, kills and pivotal moments are not recalculated, and the dialog says so. Each edit is a battle event with before, after and the editor. | Agreed |
| BATL-NEW-05 | New | Decline an invite | In every option of decision 4. Decline in the invite gate, the status dialog and the notification; the creator is told; with fewer than two players left the battle is cancelled. | Agreed |
| BATL-TWEAK-03 | Tweak | Undo kills and item uses until you finalise | Decision 5. Undo from the unit card or the battle log until that player finalises; an undone event stays in the timeline marked "undone". | Agreed |
| BATL-NEW-06 | New | Named kills in postbattle | Decision 5. Postbattle lists each unit's kills by victim ("took out Bob's Youngblood"); a kill can be removed, or added with a victim from the other rosters or a typed name. The list is what's saved: kills, kill history, pivotal moments and suggested XP all use it. | Agreed |
| BATL-TWEAK-04 | Tweak | Stat changes are temporary unless kept | Decision 6. Postbattle lists every unit with a stat change and a "Keep" tick (off by default, one per henchmen group); kept changes are applied at finalise and logged with before and after. | Agreed |
| BATL-NEW-07 | New | Mid-battle stat editor restored | Decision 6. `ActiveUnitStatEditor` back on hero, hired-sword and henchmen-group cards (the `onSaveOverride` chain is still wired), saving through the merge-patch config. | Agreed |
| BATL-TWEAK-05 | Tweak | Serious injuries applied at finalise | Decision 7. Draft re-rolls write nothing; finalise writes one log per unit. Simple results (dead, a characteristic −1, a named special such as Old Battle Wound) are applied, shown ticked and can be unticked; complex ones (Robbed, Captured, Sold to the Pits, Multiple Injuries) are flagged "apply by hand" in the summary and the log. | Agreed |
| BATL-TWEAK-06 | Tweak | "No winner" | Decision 8. End battle offers No winner; no wins or losses are recorded. | Agreed |
| BATL-TWEAK-07 | Tweak | Exploration saved; unusual values warn | Decision 9. The roll is saved with the draft and survives a reload; a re-roll asks to confirm, goes ahead and is logged. Unusual values (proposed: over 10 XP for one unit, more dice than heroes + 1 or more than 6 chosen, an amount above the table, finds over 100 gc) warn, are allowed and are logged; only malformed data is refused. | Agreed |
| BATL-TWEAK-08 | Tweak | A dead unit's items are lost | Pass 2 decision 7. A dead hero's or hired sword's items stay on his record, out of reach; each dead henchman takes one copy of each of his group's items. The Dead tick says "all carried items are lost; move them to the stash first to keep them", and the summary lists them. | Agreed |
| BATL-NEW-08 | New | Who's holding up the battle | Optional a. A strip on every phase page (Ready, In battle, Finished, Skipped, idle time) with Nudge (a notification to that player, at most one per 10 minutes); after finalising, a "Waiting for others" panel instead of leaving the page; a toast when the battle is cancelled or ends. | Agreed |
| BATL-NEW-09 | New | Winning Leader XP and "why" tooltips | Optional b. Suggested XP comes from the server (`suggested_postbattle`) and adds Winning Leader +1 for each winning warband's leader; every suggestion has a tooltip ("survived +1, 2 kills +2, winning leader +1") and stays editable. | Agreed |
| BATL-NEW-10 | New | Finalise summary of every permanent change | Optional c. Adds kept stat changes, kills, level-ups (campaign thresholds), items used, injuries applied and to apply by hand, items lost with dead units, and gold after upkeep and rewards (red when negative, pass 2 decision 2). | Agreed |

## Production data checks

None: data is disposable (both databases can be wiped and only the catalogue is reseeded), so this pass has no backfills, drift reports or read-only SQL to run first.
