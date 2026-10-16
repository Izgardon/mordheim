# Warband economy and trades: stash, buy/sell/move, resources, treasury ledger, logs, player-to-player trades

> Scope: backend `apps/warbands/views/warbands.py` (items, item-transfers, item-sales, logs, resources, trades endpoints), `apps/warbands/serializers/warbands.py`, `apps/warbands/models/warband.py` (`WarbandItem`, `WarbandResource`, `WarbandTrade`, `WarbandLog`), `apps/warbands/utils/trades.py` (`TradeHelper`), `apps/warbands/views/mixins.py` + `permissions.py`, `apps/logs/utils.py` (`log_warband_event`), `apps/trades/` (model, views, urls), the trade parts of `apps/realtime/services.py` and `channel_auth.py`, `apps/notifications/utils.py`; frontend `features/items/hooks/useAcquireItemDialogShared.tsx`, `features/items/components/AcquireItemDialog/*`, `features/items/components/AddItemForm.tsx`, `features/warbands/components/{warband/stash, warband/resources, tabs/TradesTab, tabs/LogsTab, trade/*, shared/dialogs/Item*Dialog, shared/UnitItemDialogs}`, `features/warbands/hooks/{warband/useStashActions, warband/useWarbandWarchest, warband/useWarbandResources, warband/useTradesTab, warband/useWarbandTradeSession, warband/useWarbandUpdateListener, useUnitItemMenu}`, `features/warbands/utils/{pending-purchases, unit-item-actions, warband-utils (gold helpers)}`, `features/warbands/api/warbands-{items,logs,resources,trades,events}.ts`, trade calls in `features/campaigns/api/campaigns-api.ts`, `lib/realtime.ts` (trade socket), trade session state in `stores/app-store.tsx`.

## Summary

| Dimension | Verdict |
| --- | --- |
| Performance | **Poor under concurrency.** Economy actions are chatty, client-orchestrated waterfalls: one purchase is ~8 HTTP requests and ~140 queries, one item move is 60 to 100 queries, and every trade click costs ~30 to 45 queries plus a blocking Pusher call. Almost every mutation ends in a full `/summary/` refetch that loads the whole ledger into Python. |
| Bugs | **Several confirmed correctness defects.** Trades with a trader selected can never complete. Moving an item to a missing target destroys the item. Purchases are not atomic and can leave unpaid or duplicated items. Trade lock/offer writes race and lose updates. Four different "gold" calculations disagree. |
| Code quality | **Rules are split between browser and server.** Gold is derived from action-name string lists copied in 4 places with 2 sign conventions. Stash mutation helpers exist 4 times with inconsistent locking. `trades/views.py` (730 lines) and the acquire hook (964 lines) are oversized. |
| UI / UX | **Works, but opaque.** No trade countdown (hard 5-minute expiry counted from the request). The treasury has no balance and no way to correct entries. Group purchases display as income. Same-name stash items can't be told apart. Several failures are silent. |
| Security | Minor: item ids are not scoped to the campaign, and trade actions don't re-check campaign membership. |
| Tests | **Effectively untested.** No tests cover the trade lifecycle, item-sales, item-transfers, resources, logs or gold derivation. 6 backend tests cover item cost defaults only. |

**Top 5 findings**

1. **ECON-BUG-01** (P1): Trades where either side picked a trader can never complete. The trader is consumed at lock, then rejected as "unavailable" when the transfer runs, leaving the trade stuck at "both accepted".
2. **ECON-BUG-02** (P1): `item-transfers` returns a 404 from inside `transaction.atomic()` after the source items were removed. Django commits that removal, so the items are destroyed.
3. **ECON-BUG-03** (P1): Purchases are orchestrated in the browser. If writing the ledger row fails, the failure is swallowed and the item is kept without payment. Unit purchases resend the unit's full item list, which loses or duplicates items when two tabs edit at once. The server never checks gold.
4. **ECON-PERF-02** (P1): Trade sessions amplify requests. Every offer edit or lock is a POST plus a synchronous Pusher call plus 2 to 3 full `/summary/` refetches (the sender gets its own event back). The trade WebSocket is torn down and re-authenticated on every tab switch.
5. **ECON-PERF-01** (P1): The purchase waterfall costs ~8 requests and ~140 queries per item bought, including a delete-and-recreate of every item row on the unit.

Next in line: **ECON-PERF-03** (item move/sale responses re-serialize whole units inside the transaction, 60 to 100 queries) and **ECON-BUG-04** (lost-update races on trade lock/offer that can permanently burn a hero's trading action).

## How it works

**How gold is stored.** `Warband` has **no gold column** (`models/warband.py:13-49`). Gold is derived on every read from the `WarbandTrade` ledger:

- `WarbandSummarySerializer.get_gold` (`serializers/warbands.py:78-87`) iterates every ledger row. It subtracts `abs(price)` when `action.lower()` is in `_EXPENSE_ACTIONS` (`buy, bought, recruit(ed), hire(d), upkeep, trade sent`) and adds `abs(price)` for anything else.
- `TradeHelper.normalize_price` (`utils/trades.py:17-23`) stores a negative price only for `{Buy, Upkeep, Recruit, Recruited, Hire, Hired}`. The frontend posts `"Bought"` and the trades app writes `"Trade sent"`, both with **positive** prices. The stored sign is therefore inconsistent, and the gold total depends on string matching.
- Header gold on the Warband page is local state (`tradeTotal`, `routes/Warband.tsx:107, 537-542`), refreshed from `/summary/`.

**Other models.** `WarbandItem` is the stash: unique `(warband, item)`, with `quantity` and the persisted base `cost`. Unit inventories are `HeroItem`, `HiredSwordItem` and `HenchmenGroupItem`, one row per copy, each with its own `cost`. `WarbandResource` holds named counters (default "Treasure"). `WarbandLog` stores feature, type, JSON payload and parent; it is written by `log_warband_event` on the server or by the browser through `POST /logs/`. `TradeRequest` has a UUID; from/to user and warband; status `pending → accepted → completed | declined | expired`; `from_offer`/`to_offer` JSON (`{trader_id, trader_name, gold, items[]}`); `from_accepted`/`to_accepted`; and `expires_at = created_at + 5 min`, which is never extended.

**Endpoints**

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/warbands/{id}/items/`, `DELETE …/items/{item_id}/` | Stash list / add (no gold movement) / discard |
| `POST /api/warbands/{id}/item-transfers/` | Move N copies between stash, hero, hired sword and henchmen group. Returns refreshed source and target units plus the summary. |
| `POST /api/warbands/{id}/item-sales/` | Remove N copies and write a "Sold" ledger row with a client-provided price |
| `GET/POST /api/warbands/{id}/trades/` | Treasury ledger (top-level rows with nested `children`) and free-form entries |
| `GET/POST /api/warbands/{id}/logs/` | Full log list (optional `?feature=`) and client-written log entries |
| `GET/POST …/resources/`, `PATCH/DELETE …/resources/{rid}/` | Resource counters (absolute `amount`) |
| `GET /api/warbands/{id}/summary/` | Gold, rating, resources and unit names. Called after almost every mutation. |
| `/api/campaigns/{cid}/trade-requests/` (+ `{uuid}/`, `accept/`, `offer/`, `lock/`, `unlock/`, `decline/`, `close/`), `/api/trade-requests/pending/` | Trade state machine. Each write triggers Pusher on `private-trade-{uuid}` and/or `private-user-{id}-notifications`. |

**Frontend flows**

- Most mutations call `emitWarbandUpdate(warbandId, detail?)`, which dispatches a window event. `useWarbandUpdateListener` merges any detail it carries, and **if the event has no summary it GETs `/summary/`** (`useWarbandUpdateListener.ts:90-99`).
- **Stash:** the header "Stash" button opens `StashItemList` with Sell, Move and Buy again. These go through `useStashActions` to item-sales or item-transfers. Unit item menus use `useUnitItemMenu` and `UnitItemDialogs`.
- **Buying** (`AcquireItemDialog` → `useAcquireItemDialogShared.handleAcquire`):
  - For the stash, it POSTs `/items/`.
  - For a unit, it fetches the unit detail if needed, then PATCHes the unit with its full item list.
  - It then POSTs `/trades/` ("Bought") and `/logs/` in parallel using `allSettled`, emits an update (a summary GET follows), and calls `onAcquire`, which GETs the hero detail.
  - In roster edit mode, purchases are deferred as `PendingPurchase` and committed after the unit save by `commitPendingPurchases`, which POSTs them one by one.
- **Treasury tab:** `TradesTab` with `useTradesTab`.
- **Resources:** `WarbandResourceBar` with `useWarbandResources`. Changes are debounced for 1 s and sent as an absolute PATCH. "Sell" is a PATCH followed by a POST to `/trades/`.
- **Logs tab:** GETs all logs and paginates on the client (12 per page).
- **Trades:**
  1. `TradeInviteDialog` POSTs a trade request, which creates a notification and sends a Pusher user event.
  2. The recipient accepts from `NotificationsMenu` (`useNotifications`). Both players then land on `/warband?trade=<uuid>`.
  3. `useWarbandTradeSession` opens a dedicated Pusher client on `private-trade-<uuid>`.
  4. `TradeSessionDialog` autosaves the offer (300 ms debounce).
  5. Each side clicks "Accept" (lock), which consumes the chosen trader's trading action.
  6. When both sides have locked, the server moves stash items and writes "Trade sent"/"Trade received" ledger rows, then sends `trade.completed`.

**Measured query counts** (local Docker, `CaptureQueriesContext` with `force_authenticate` as user 1 against warband 2 "Monks". Add 1 query in production for the JWT user lookup.)

| Request / building block | Queries | Response size |
| --- | --- | --- |
| `GET /warbands/2/summary/` | 12 | 597 B |
| `GET /warbands/2/items/` | 6 | 95 B |
| `GET /warbands/2/trades/` (38 rows) | 7 | 8.4 KB |
| `GET /warbands/2/logs/` (128 rows, "Page 1 of 11") | 6 | 26.1 KB |
| `GET /warbands/2/resources/` | 6 | 112 B |
| `GET /warbands/2/heroes/` | 14 | 1.6 KB |
| `GET /warbands/2/henchmen-groups/` | 11 | 1.6 KB |
| `GET /campaigns/1/trade-requests/` | 3 | 3.9 KB |
| `WarbandObjectMixin.get_warband` (runs on every endpoint above) | 4 | n/a |
| Re-fetch and serialize hero #2 (4 items), as item-transfer/item-sale responses do | 30 | n/a |
| Re-fetch and serialize hired sword #41 (5 items) | 22 | n/a |
| Re-fetch and serialize henchmen group #2 | 15 | n/a |
| `WarbandSummarySerializer` alone | 7 | n/a |

## Performance

### ECON-PERF-01 · P1 · A single purchase is a ~8-request, ~140-query browser-orchestrated waterfall
- **Where:** `frontend/src/features/items/hooks/useAcquireItemDialogShared.tsx:225-258, 515-547, 762-828, 842-890`; `features/warbands/components/heroes/blocks/HeroListBlocks.tsx:254-257`; `backend/apps/warbands/serializers/heroes.py:491-493`
- **What:** The cost builds up in four stages:
  1. **Opening the dialog** fires `GET /heroes/` (15 queries in production), `GET /henchmen-groups/` (12) and `GET /trades/` (8). The Warband page already holds all three in memory: hero and henchmen state, plus `tradeTotal`.
  2. **Buying for a unit** builds `items: [...existingItems, ...addedItems]` and PATCHes the unit. The server deletes every item row on that unit and bulk-recreates them (`hero.hero_items.all().delete()` + `bulk_create`), then serializes the full hero: about 30 queries for 4 items, plus 3 to 5 per distinct item from the availability/restriction N+1.
  3. **Recording the purchase** sends `POST /trades/` (~7 queries) and `POST /logs/` (~7), then `emitWarbandUpdate` without a summary, which triggers `GET /summary/` (13).
  4. **Refreshing the unit:** `onAcquire` GETs the hero detail again (~36).
- **Impact:** About 140 to 150 queries over 8 requests. That is ~1.5 s of database time per purchase at 10 ms per Neon round trip, before the per-request connection cost (INFRA). Buying a henchmen group's kit repeats this per item. It is the most common economy action, and the cost multiplies directly with the number of active users.
- **Fix:** Add one server endpoint, `POST /api/warbands/{id}/purchases/` with `{item_id, availability_id, quantity, unit_type, unit_id|null, unit_price, is_buying, reason, rarity_roll?}`. In one transaction it should:
  - check that the item is base or belongs to this campaign;
  - debit gold with a conditional update (ECON-CQ-01);
  - insert only the new item rows;
  - insert the ledger row and the log;
  - return `{gold, unit_items | stash_item}`.

  That is ~10 to 12 queries in one round trip. In the dialog, read gold from `tradeTotal` and units from page state instead of the three opening GETs.
- **Effort:** L · **Confidence:** Confirmed (code; building blocks measured; the PATCH share is estimated)

### ECON-PERF-02 · P1 · Trade sessions amplify every click into 3–4 requests, ~30–45 queries and a blocking Pusher call
- **Where:** `frontend/src/features/warbands/hooks/warband/useWarbandTradeSession.ts:127-231` (deps 223-231), `162-171`, `233-262`; `features/warbands/components/trade/TradeSessionDialog.tsx:102-130, 207-226`; `lib/realtime.ts:182-221`; `backend/apps/trades/views.py:449, 567, 595`; `backend/apps/realtime/services.py:123-131`
- **What:**
  - **Self-echo plus summary refetch.** `client.trigger()` is called without `socket_id`, so the sender receives its own event. On every `trade.offer_updated` and `trade.locked`, **both** browsers call `emitWarbandUpdate`, which triggers `GET /summary/` (13 queries), even though changing an offer doesn't touch warband state. `handleAccept` also emits.
    - One offer edit costs a POST (4 to 8 queries, including loading the whole ledger in `_calculate_trade_total`) plus one synchronous Pusher HTTPS call plus 2 summary GETs: about 32 queries.
    - One lock costs a POST plus 3 summary GETs: about 44 queries.
  - **Socket churn.** The socket effect depends on `searchParams` and on the `tradeSession` object. Every tab switch (`?tab=` lives in the URL, `Warband.tsx:126-136`) and every `setTradeSession` closes the Pusher client and opens a **new WebSocket**. That adds a `POST /realtime/pusher/auth/` (2 queries), and the "sync" effect (also keyed on `searchParams`) re-GETs the trade request. Events sent during the reconnect are lost.
  - **Autosave against the throttle.** The offer autosaves after every change (300 ms debounce) against `trade_write_user` 20/min and `trade_write_ip` 60/min. Players sitting at one table share an IP.
- **Impact:** A six-edit trade costs about 250 or more queries, most of them redundant summary refetches. Pusher and WebSocket churn adds connection load (Pusher plans cap concurrent connections). During a busy campaign night these requests compete with everything else on the single backend.
- **Fix:**
  - Stop emitting warband updates on `offer_updated` and `locked`. Refresh only on `completed`/`closed`, using the summary embedded in the event payload.
  - Send `X-Pusher-Socket-Id` from the client and pass `socket_id=` to `trigger` to suppress the echo.
  - Key the socket effect on `tradeSession?.requestId` only, and read `searchParams`/`setSearchParams` through refs.
  - Reuse one Pusher client app-wide (FE cross-ref).
  - Raise the autosave debounce to about 600 ms.
- **Effort:** M · **Confidence:** Confirmed

### ECON-PERF-03 · P1 · Item transfer and sale rebuild whole units twice, inside the transaction (60–100 queries per move)
- **Where:** `backend/apps/warbands/views/warbands.py:92-102, 416-459, 489-523, 172-186`
- **What:**
  - **Existence checks fetch everything.** `_get_unit_instance` prefetches skills, specials, spells and item properties (11 queries) only to confirm the source or target exists before deleting or inserting rows.
  - **Units are rebuilt twice.** After the write, it re-fetches and serializes both units with the Detail serializers (30 queries for a 4-item hero; 3 to 5 more per distinct item via the availability/restriction N+1), then adds `WarbandSummarySerializer` (7).
  - **Estimated totals from the measured blocks:**

    | Operation | Queries |
    | --- | --- |
    | Stash → hero | ~58 |
    | Hero → hero | ~60 + 4.75 × (items on both units), ~98 at 4 items each |
    | Sale from a hero | ~58 |
    | Sale from the stash | ~18 |

  - **The transaction stays open.** The response is built inside `with transaction.atomic()` (lines 451-459). The transaction and its row locks stay open while all of this runs: about 1 s on Neon.
- **Impact:** Every Sell/Move click is a heavy request that holds a database connection and transaction. Concurrent users of the same warband serialize on those locks.
- **Fix:**
  - Check existence with `Model.objects.filter(id=…, warband=…, dead=False).only("id").first()`.
  - Do only the row writes inside the transaction, and serialize after it closes.
  - Return a lightweight payload: the touched units' `items` lists (`[{id,name,cost}]`) plus `gold`, instead of full unit detail.
  - Fix the serializer N+1 by prefetching `item__availabilities__restriction_links__restriction` (cross-ref ROST/CAT).
- **Effort:** M · **Confidence:** Confirmed (measured building blocks)

### ECON-PERF-04 · P2 · Every economy endpoint pays 6 fixed queries, half of them wasted
- **Where:** `backend/apps/warbands/views/mixins.py:17-38`; `backend/apps/warbands/permissions.py:11-46`; `backend/apps/campaigns/permissions.py:4-24`
- **What:** `get_warband` always does `select_related(campaign, campaign__settings)` and prefetches `resources`, `restrictions` and `campaign__settings__item_settings` (4 queries). `CanViewWarband` then makes a separate membership query (1), and JWT auth adds 1, so 6 queries run before any work. `/items/`, `/logs/`, `/trades/` and `/resources/` use none of the three prefetches: 3 of the 6 queries are wasted. For non-owner editors (`manage_warbands`), `CanEditWarband` repeats the membership query and runs a permission `exists()`, adding 2 more.
- **Impact:** At least 50% overhead on the lightest endpoints. Each wasted query is a round trip to Neon.
- **Fix:** Add a lean `get_warband(warband_id, prefetch=())` that uses `select_related("campaign")` only, with callers opting into what they need (summary: `resources`). Resolve membership once per request and reuse it for both permission checks, with `select_related("role")` and the permission codes prefetched.
- **Effort:** S · **Confidence:** Confirmed (measured)

### ECON-PERF-05 · P2 · Gold is computed by loading every ledger row into Python; summary queries units twice
- **Where:** `backend/apps/warbands/serializers/warbands.py:78-87, 95-133`; `backend/apps/trades/views.py:35-44`
- **What:** `get_gold` iterates `obj.trades.all()`, fetching every column of every ledger row (`notes` holds up to 2,000 chars) on every `/summary/` call, and summary is the most frequently called endpoint (ECON-PERF-02, ECON-PERF-08). `_calculate_trade_total` repeats this once per offer edit and twice at trade completion. The summary also queries heroes, hired swords and henchmen twice each (once for rating, once for the name lists): 7 queries where 3 would do.
- **Impact:** Payload and CPU grow linearly with campaign length, on the hottest read path.
- **Fix:** The short-term fix is one aggregate: `Sum(Case(When(action_lower__in=EXPENSE, then=-Abs("price")), default=Abs("price")))`. The proper fix is the denormalized `Warband.gold` in ECON-CQ-01, which reduces this to zero queries. For units, run one `.values("id","name","unit_type","xp","large")` query per type and compute both rating and lists from it. That brings the summary from 12 queries to about 6.
- **Effort:** S · **Confidence:** Confirmed

### ECON-PERF-06 · P2 · Logs endpoint is unpaginated; the client paginates 12 per page
- **Where:** `backend/apps/warbands/views/warbands.py:531-545`; `frontend/src/features/warbands/components/tabs/LogsTab.tsx:23-55, 74-78`; `features/warbands/api/warbands-logs.ts:5-15`
- **What:** `GET /logs/` returns every row. The page showing "Page 1 of 11" downloads 128 entries (26 KB, and there is no `GZipMiddleware`). Size grows by about 200 B per entry, and a long campaign reaches hundreds of entries per warband. The tab refetches on every open because the component remounts. The server already supports `?feature=`, but the UI filters on the client instead. The only index is on `warband_id`, so `ORDER BY created_at` sorts every time.
- **Impact:** Unbounded payload on a frequently opened tab, mostly wasted (12 rows displayed).
- **Fix:** Add DRF `LimitOffsetPagination` (page size 25) or cursor pagination on `(created_at, id)`. Pass the feature filter to the server and return the distinct features alongside the first page. Keep the loaded pages while the warband page stays mounted. Optionally add an index on `(warband_id, created_at DESC)`.
- **Effort:** S · **Confidence:** Confirmed (measured)

### ECON-PERF-07 · P2 · Synchronous Pusher calls in the trade request path; a failure returns 500 after the database committed
- **Where:** `backend/apps/trades/views.py:401, 449, 519-520, 567, 595, 640, 681, 728`; `backend/apps/realtime/services.py:103-131`
- **What:** Every trade write makes 1 to 2 blocking HTTPS calls to Pusher (accept makes two in sequence), with the client's default 5 s timeout. `send_user_notification` logs and **re-raises**. `send_trade_event` has no try at all. There is no `ATOMIC_REQUESTS`, so the database writes are already committed when Pusher fails, and the client gets a 500 for an action that succeeded. Consequences:
  - On create, the user retries and creates duplicate trade requests.
  - On lock, the "trade.locked" trigger at line 567 runs **before** the completion block, so a Pusher error after the second lock leaves both flags `True` and the trade never completes.
- **Impact:** Adds 50 to 300 ms of latency per trade action, ties up a worker while Pusher is slow, and causes spurious 500s and stuck states.
- **Fix:** Wrap every trigger in try/except with logging and never fail the request on it. Send via `transaction.on_commit` from a background thread or queue. Use `trigger_batch` for accept's two events. Set `timeout=2`.
- **Effort:** S · **Confidence:** Confirmed (code)

### ECON-PERF-08 · P2 · Redundant refetches after mutations
- **Where:** `frontend/src/features/warbands/hooks/warband/useStashActions.ts:80-85, 118, 142`; `features/warbands/hooks/useUnitItemMenu.ts:97-103`; `features/warbands/hooks/warband/useTradesTab.ts:101-103` with `routes/Warband.tsx:1049`; `features/warbands/hooks/warband/useWarbandResources.ts:286-290`; `features/warbands/hooks/warband/useWarbandTradeSession.ts:119-124`
- **What:**
  - **Stash sell/move** calls `onItemsChanged()`, which refetches the whole stash. The response already contains `stash_item`, `removed_stash_item_id` and `summary`, and these are merged anyway.
  - **"Move"** fetches `/henchmen-groups/` (12 queries) just to list group names that are already in `summary.henchmen_groups` / the store warband.
  - **Treasury "Add entry"** emits an update, which triggers a summary GET, and also increments `tradeTotal` locally.
  - **Resource Sell** emits as well, triggering another summary GET.
  - **The campaign layout and the Warband loader** both GET `/summary/` when the user opens their warband (cross-ref ROST/FE).
  - **Treasury and Logs tabs** refetch on every tab switch.
- **Impact:** Each Sell/Move is 2 requests instead of 1. Each manual ledger entry is 2 instead of 1. Repeated summary loads add up across users.
- **Fix:** Apply mutation responses directly. Pass `emitUpdate: false` wherever local state is already updated. Take henchmen names from the summary. Cache tab data for the lifetime of the page.
- **Effort:** S · **Confidence:** Confirmed

### ECON-PERF-09 · P3 · Deferred purchases are committed as 2N+1 sequential requests after a roster save
- **Where:** `frontend/src/features/warbands/utils/pending-purchases.ts:114-187`; `features/warbands/hooks/warband/useWarbandSave.ts:194-211` (same in the henchmen and hired-sword save hooks)
- **What:** After the unit save, `commitPendingPurchases` awaits one "Group" header POST, then one trade POST and one log POST per purchase, each in sequence (about 7 queries each). Equipping 8 items means 17 back-to-back round trips.
- **Impact:** Saving a re-equipped roster takes seconds on Render plus Neon, and partial failures are likely (ECON-BUG-03).
- **Fix:** Send purchases inside the unit save request and let the server write ledger and log rows in the same transaction, or add one bulk endpoint.
- **Effort:** M · **Confidence:** Confirmed

### ECON-PERF-10 · P3 · Economy hooks subscribe to the monolithic app store; the notification socket re-subscribes on every trade state change
- **Where:** `frontend/src/stores/app-store.tsx:422-525`; `features/warbands/hooks/useUnitItemMenu.ts:62`; `features/warbands/hooks/warband/useStashActions.ts:59`; `features/items/hooks/useAcquireItemDialogShared.tsx:204`; `features/realtime/hooks/useNotifications.ts:170-337` (deps 335-336); `features/warbands/routes/Warband.tsx:554-596`
- **What:**
  - Each unit block's `useUnitItemMenu` reads `warband` from the single memoized context. Any change to the trade session, notifications or catalogue caches, and every store-warband sync (the Warband page rewrites it whenever heroes or gold change), re-renders every unit block.
  - The user-notification effect depends on `tradeSession?.requestId/status`, so every trade transition (pending → active → closed) tears down the notifications Pusher client and refetches `GET /notifications/`.
- **Impact:** Unnecessary renders on mobile, and extra requests and WebSocket reconnects around every trade.
- **Fix:** Split the store or use selectors (FE cross-ref). Pass `warband` down as a prop. Read `tradeSession` through a ref inside the notification socket handler.
- **Effort:** M · **Confidence:** Confirmed (code); cross-ref FE

## Bugs

### ECON-BUG-01 · P1 · Trades with a trader selected can never complete
- **Where:** `backend/apps/trades/views.py:168-180` (`_consume_offer_trader`), `553-562` (lock), `587` → `233-235` (`_apply_trade_transfer`) → `107-112` (`_build_offer_payload` trader check)
- **What:** Locking sets the selected trader's `trading_action=False`. Once both sides are locked, `_apply_trade_transfer` re-validates both offers through `_build_offer_payload`. That function raises `ValueError("Selected trader is unavailable.")` whenever `hero.trading_action` is false, which is now always true for the trader that was just consumed. The atomic block rolls back the transfer, but both accepted flags and the trader consumption were saved earlier, outside the block (line 562). Every retry hits the same error. The only way out is Unaccept, remove the trader, then Accept again. (Local DB: 7 trade requests, 0 completed.)
- **Impact:** Any trade where either player picks a trader, which the UI offers as standard, fails with a confusing error while both sides show "Accepted".
- **Fix:** At completion, validate only that the trader still exists and belongs to the warband (e.g., `_build_offer_payload(..., trader_already_consumed=True)`), or don't re-validate the trader at completion at all, since the lock already did. Add test ECON-TEST-01. See also ECON-BUG-11.
- **Effort:** S · **Confidence:** Confirmed (code path unambiguous; not executed because DB writes were out of scope)

### ECON-BUG-02 · P1 · Moving an item to a missing or dead unit destroys it
- **Where:** `backend/apps/warbands/views/warbands.py:416-437`
- **What:** Inside `with transaction.atomic():` the source rows are removed first (line 423 or 430). Only afterwards is the target resolved. If the target unit doesn't exist, is dead, or belongs to another warband, the view **returns** a 404 from inside the block. A normal return exits `atomic()` successfully, so Django commits the removal. The items vanish: they are not on the source, not on the target, and no ledger or log row records them.
- **Impact:** Silent, permanent item loss whenever the Move dialog targets a unit that died or was dismissed since the page loaded (postbattle death rolls in another tab, an admin edit), or on any malformed request. Rated P1 rather than P0 only because it needs a stale or invalid target.
- **Fix:** Resolve and validate both source and target **before** mutating. Inside the block, raise (`raise NotFound(...)` handled by DRF) or call `transaction.set_rollback(True)` before returning. Add ECON-TEST-02.
- **Effort:** S · **Confidence:** Confirmed

### ECON-BUG-03 · P1 · Purchases are not atomic: unpaid items, lost or duplicated items, no server-side gold check
- **Where:** `frontend/src/features/items/hooks/useAcquireItemDialogShared.tsx:459-465, 762-828, 842-886`; `features/warbands/utils/pending-purchases.ts:114-187`; `features/warbands/hooks/warband/useWarbandSave.ts:194-211`; `backend/apps/warbands/serializers/heroes.py:491-493`; `backend/apps/warbands/views/warbands.py:669-695`
- **What:**
  1. **Payment failures are swallowed.** The item is committed first. The "Bought" ledger row and the log are posted afterwards with `Promise.allSettled`, failures are only `console.error`'d (881-886), and the dialog closes as a success. The item is acquired and no gold is deducted.
  2. **Client read-modify-write of whole item lists.** For heroes, hired swords and henchmen, the client sends `[...existingItems, ...addedItems]` built from page state or a freshly fetched detail, and the server replaces the unit's entire list. If another tab or user changed that unit in between, the PATCH resurrects or drops items. Example: Tab B moves the Sword from Hero X to the stash. Tab A, still holding the old list, buys an Axe for Hero X. The Sword now exists both in the stash and on Hero X.
  3. **Gold is only checked in the browser** (`isGoldBlocked`). The server accepts any "Bought"/"Buy" ledger row, so two tabs buying at once, or a stale client, can drive gold negative.
  4. **Retrying a failed roster save double-charges.** In edit mode the unit is saved before the pending purchases are posted one by one. If one fails midway, the pending list is kept, so retrying Save re-posts the purchases that already succeeded.
- **Impact:** The core invariant, that every bought item is paid exactly once, is not enforced. Gold and inventory drift silently.
- **Fix:** Use the server purchase endpoint from ECON-PERF-01, wrapped in `transaction.atomic()`, with the gold check done as a conditional debit (`Warband.objects.filter(id=w, gold__gte=total).update(gold=F("gold") - total)` == 1) or under `select_for_update()` on the warband. Add append-style unit item endpoints (`POST /heroes/{id}/items/`) instead of full-list replacement for single acquisitions. Until then: treat a failed ledger POST as an error, remove the item again, and show it; drop each pending purchase from state as soon as it commits.
- **Effort:** L · **Confidence:** Confirmed for 1–3 (code); Likely for 4

### ECON-BUG-04 · P1 · Lost updates in trade lock and offer writes; trading actions can be burned permanently
- **Where:** `backend/apps/trades/views.py:411-446` (offer), `530-562` (lock), `606-637` (unlock), `168-180`, `183-187`
- **What:** Every trade write loads the `TradeRequest` without `select_for_update`, changes one side, and saves `update_fields` covering **both** sides (`from_accepted`+`to_accepted`, `from_offer`+`to_offer`). When both players click Accept at nearly the same moment:
  1. A's request saves `from=T, to=F`.
  2. B's request, holding the stale row, saves `from=F, to=T`, which erases A's lock. A's trader has already been consumed.
  3. When A clicks Accept again, the `if not from_accepted` guard re-runs `_consume_offer_trader`, which raises "Selected trader is unavailable". **A can never lock again.**
  4. On expiry or close, `_restore_accepted_traders` only restores sides whose flag is `True`, so A's hero keeps its spent trading action until the next battle reset.

  Concurrent offer edits drop one side's offer in the same way. `_consume_offer_trader` is itself read-modify-write, so two trades can consume the same trader.
- **Impact:** Deadlocked trades and lost trading actions, at exactly the moment both players click together ("ready? go").
- **Fix:**
  - In every trade write, wrap the work in `transaction.atomic()` and load with `TradeRequest.objects.select_for_update().get(...)`.
  - Save only the field that changed.
  - Consume the trader with `Hero.objects.filter(id=t, warband_id=w, trading_action=True).update(trading_action=False) == 1`.
  - Store `from_trader_consumed`/`to_trader_consumed` explicitly instead of inferring them from the accepted flags.
- **Effort:** M · **Confidence:** Confirmed (code); race not reproduced

### ECON-BUG-05 · P2 · "Accept" isn't tied to the offer the user saw (accept a changed offer)
- **Where:** `frontend/src/features/campaigns/api/campaigns-api.ts:253-260`; `features/warbands/components/trade/TradeSessionDialog.tsx:207-226, 447-453`; `backend/apps/trades/views.py:525-598`
- **What:** The lock request carries no offer identity. If the partner changes their offer and your lock lands before the Pusher update reaches your screen (~100–500 ms plus request time), you are locked to an offer you never saw. The partner then locks and the trade completes. The flag reset on offer update (lines 444-445) only protects locks that happen strictly after the change.
- **Impact:** A player can be talked into, or accidentally accept, a worse trade. Trust issues in a social game.
- **Fix:** Add `offer_version` to `TradeRequest`, incremented on every offer change and included in the payload. The lock request sends the version it rendered, and the server returns 409 on mismatch. Disable Accept for about 1 s after the partner's offer changes and highlight what changed.
- **Effort:** S · **Confidence:** Confirmed (code)

### ECON-BUG-06 · P2 · Concurrent sells or moves can double-credit gold or duplicate items
- **Where:** `backend/apps/warbands/views/warbands.py:105-116, 136-148, 151-169, 341-348, 369-384`
- **What:**
  - **Stash removal is unlocked.** `_remove_stash_items` reads the quantity, checks it, then saves the new quantity or deletes, with no lock.
  - **Unit removal doesn't check what it deleted.** `_remove_unit_items` selects row ids and deletes them without checking the deleted count.
  - **Double sale of the last copy.** Two concurrent sales both pass the check, the second delete removes 0 rows, and **both insert "Sold" rows**, so gold is credited twice. With quantity 2 and each request selling 1, both write quantity 1: one item gone, two credited.
  - **Duplicate moves.** Two concurrent moves of the same unit item both add copies to their targets.
  - **Stash add loses increments and can crash.** `WarbandItemListView.post` increments with read-modify-write (lost increments), and two concurrent first inserts hit `unique_warband_item` and return a 500.
  - **Locking is inconsistent.** The battle copy of `_add_stash_items` (`battles/views/shared.py:1427`) uses `select_for_update`; the warbands copy does not.
- **Impact:** Gold and items duplicated whenever two tabs, devices or users (owner plus admin) act on the same stash at once.
- **Fix:**
  - Stash removal: `n = WarbandItem.objects.filter(warband=w, item_id=i, quantity__gte=q).update(quantity=F("quantity") - q)`. If `n == 0`, raise `ValueError`. Then delete rows where `quantity=0`.
  - Unit removal: `deleted, _ = qs.filter(id__in=ids).delete()`. If `deleted != q`, raise.
  - Stash add: `F("quantity") + q`, falling back to create on `IntegrityError`.
  - Centralize all of this (ECON-CQ-04).
- **Effort:** S · **Confidence:** Likely (window confirmed in code; needs two concurrent requests)

### ECON-BUG-07 · P2 · Four disagreeing gold calculations and a mixed sign convention in storage
- **Where:** `backend/apps/warbands/serializers/warbands.py:19-28, 78-87`; `backend/apps/trades/views.py:23-44, 245-271`; `backend/apps/warbands/utils/trades.py:7-23`; `frontend/src/features/warbands/utils/warband-utils.ts:417-436`; `features/items/hooks/useAcquireItemDialogShared.tsx:442-454, 525-536`; `features/warbands/hooks/warband/useWarbandResources.ts:43-46`
- **What:** The four calculations:
  1. **Summary gold:** ±abs(price) by action name.
  2. **Trade cap** (`_calculate_trade_total`): the same, clamped to ≥ 0.
  3. **Acquire dialog:** sums `getSignedTradePrice` over the **top-level** rows of `GET /trades/` only. "Group" headers have price 0, and their children are ignored. Children come from multi-henchman recruits (`henchmen.py:93-125, 236-266`) and multi-item roster saves (`pending-purchases.ts:127-160`). The dialog therefore **overstates spendable gold** by the cost of every grouped purchase.
  4. **"Gold Crowns" resource:** if a resource with that name exists, the dialog uses its amount instead. The resource bar hides that name, so a user who creates it sees purchases blocked by an invisible 0.

  In storage, Buy/Upkeep/Recruit/Hire rows are negative, but "Bought" (from the frontend) and "Trade sent" (`trades/views.py:245-271`) are positive. So `SUM(price)` does not equal gold: warband 2 has a raw sum of 1,287 against 801 derived (`select … from warband_trades`). Any action not in the list counts as income, and `POST /trades/` accepts free text.
- **Impact:** Buy checks can pass for gold the warband doesn't have, the treasury can't be reconciled with the header, and any future report or SQL that sums `price` is wrong.
- **Fix:** Long term, ECON-CQ-01. Short term: make the acquire dialog read gold from `tradeTotal` / `summary.gold` (or receive it as a prop) and delete the "gold crowns" path.
- **Effort:** S (short term) / M (proper) · **Confidence:** Confirmed (code and SQL)

### ECON-BUG-08 · P2 · Treasury shows grouped purchases as income
- **Where:** `frontend/src/features/warbands/components/tabs/TradesTab.tsx:62-67, 223-231, 272`
- **What:** For a group header the code sums the children's signed prices (e.g., −120), then formats that total using the header's action, `"Group"`. "Group" is not an expense, so `getSignedTradePrice` returns `+abs()`, displayed as "+120 gc" with a green badge.
- **Impact:** Recruiting a henchmen batch or equipping several items looks like gold gained, which misleads players reconciling their treasury.
- **Fix:** Format the summed total by its own sign, and colour the header by that sign.
- **Effort:** S · **Confidence:** Confirmed

### ECON-BUG-09 · P2 · Moving an item to a different unit type corrupts the client-side roster
- **Where:** `frontend/src/features/warbands/components/heroes/blocks/HeroListBlocks.tsx:71-83`; `hiredswords/blocks/HiredSwordListBlocks.tsx:71-81`; `henchmen/blocks/HenchmenListBlocks.tsx:60-68`; `features/warbands/hooks/warband/useWarbandUpdateListener.ts:24-39`
- **What:** `onMutationComplete` merges `[unit, result.source, result.target]` into the **source unit's own list** whatever the target's type. Moving an item from a hero to a hired sword or henchmen group injects that unit into the heroes list via `mergeById`. Ids are per table, so on collision a real hero is overwritten: locally, hero #2 "Woman" and henchmen group #2 "Typhus" share id 2. Meanwhile the real target's list is never updated; the hero block only updates the target when it is a hero.
- **Impact:** Phantom or overwritten unit cards until reload. If the user then edits and saves the overwritten hero, the wrong item list may be persisted (speculative).
- **Fix:** Route `result.target` to the list named by `targetUnitType` and `result.source` to the source list, in one shared helper (ECON-CQ-06). Add ECON-TEST-23.
- **Effort:** S · **Confidence:** Confirmed (code)

### ECON-BUG-10 · P2 · Trade offers value items at 0, and traded items lose their cost
- **Where:** `backend/apps/trades/views.py:77, 89, 226-230`; `frontend/src/features/warbands/components/trade/TradeSessionDialog.tsx:38-46`; `features/campaigns/components/overview/TradeOverviewTable.tsx:28-37`
- **What:** `_normalize_offer_items` reads `entry.item.cost`, but `Item` has no `cost` field (prices live in `ItemAvailability`), so every offer item gets `cost: 0`. "Total value" in the trade dialog and on the campaign overview therefore counts gold only. When the trade completes, the receiver's `WarbandItem` is created **without** a cost, so the sell dialog later suggests 0 gc. Also noted from the catalogue side as CAT-BUG-10.
- **Impact:** Players can't judge offers, and traded items have the wrong resale value.
- **Fix:** Value offers from `entry.cost` (the stash row). Copy `cost=source_item.cost` onto the target row (and merge the cost when the row already exists).
- **Effort:** S · **Confidence:** Confirmed

### ECON-BUG-11 · P2 · Any failure during trade completion leaves the trade stuck at "both accepted"
- **Where:** `backend/apps/trades/views.py:553-567, 569-592`
- **What:** The accepted flags and the trader consumption are saved before, and outside, the atomic completion block. Completion can fail with a `ValueError` (an offered item was sold or moved, gold was spent, or ECON-BUG-01), or the `trade.locked` Pusher trigger at 567 can raise. Either way the trade stays `accepted` with both flags `True`. The clicker gets a 400 or 500. The partner sees "Accepted" with no error. Nothing resets.
- **Impact:** Trades dead-end with no explanation and need manual Unaccept/Cancel.
- **Fix:** Do lock and completion in one `select_for_update` transaction. On a validation failure, reset both flags, restore the traders, and broadcast `trade.offer_updated` with an `error` field so both UIs explain what happened.
- **Effort:** S/M · **Confidence:** Confirmed

### ECON-BUG-12 · P2 · The trade dialog reverts the user's own in-flight edits
- **Where:** `frontend/src/features/warbands/components/trade/TradeSessionDialog.tsx:96-100, 102-130`
- **What:** `setDraftOffer(myOffer)` runs whenever `myOffer` changes. That happens on every Pusher payload (each event creates a new object) and on every response to your own save. Edits made during the 300 ms debounce, or while a save is in flight, are replaced by the server's older copy of your offer. When both players edit at once, clicks disappear.
- **Impact:** The UI feels unreliable ("I added it twice and it shows once").
- **Fix:** Track a dirty flag. Reset the draft only when the server copy differs from `lastSentRef` and there are no unsaved local changes, or reconcile by offer version (ECON-BUG-05).
- **Effort:** S · **Confidence:** Confirmed (code)

### ECON-BUG-13 · P2 · The trade dialog opens on another player's warband page with that warband's data
- **Where:** `frontend/src/features/warbands/routes/Warband.tsx:928-939`; `features/warbands/components/trade/TradeSessionDialog.tsx:73`
- **What:** `TradeSessionDialog` renders on every Warband route using the global `tradeSession`, and opens whenever `session.status === "active"`. While viewing someone else's warband (`/warbands/:id`) during an active trade, the dialog lists **that** warband's heroes as traders, its stash as offerable items, and its gold as the cap. The server validates against your own warband and answers "One or more items are not in the warchest." `useWarbandTradeSession` also emits updates for the viewed warband.
- **Fix:** Render the dialog only when `!isViewingOtherWarband`, or hoist it to the campaign layout using the user's own warband.
- **Effort:** S · **Confidence:** Likely

### ECON-BUG-14 · P2 · Campaign item overrides are bypassed by owned items (explains "Axe 25 gc" vs "Axe (5 gc)")
- **Where:** `backend/apps/items/views.py:84-88`; `backend/apps/warbands/views/warbands.py:333-339`; `frontend/src/features/warbands/hooks/warband/useStashActions.ts:94-103`; `backend/apps/warbands/views/henchmen.py` (`_calculate_henchman_hire_cost`)
- **What:** **Investigation of the live observation.**
  - **The data.** Campaign 1 has a custom item "Axe" (id 231, 25 gc) that hides the base "Axe" (id 1, 5 gc) by name in the campaign catalogue (owned by CAT as CAT-BUG-03).
  - **Where "Axe (5 gc)" comes from.** It is the ledger note on row 7 (2026-02-26, "Recruited Alfred into hj", −25 = 20 base + Axe 5), written when only the base Axe existed. It is not a display bug.
  - **The economy consequences that remain:**
    - Already-owned copies keep item id 1 and cost 5 (henchmen group: 2 rows; hired swords: 2; warband 2 stash: 1).
    - Recruiting into that group still charges 5 gc for the Axe.
    - "Buy again" from the stash or a unit fetches item 1 and buys at 5 gc, bypassing the house rule.
    - Warband 2's stash shows two indistinguishable "Axe" rows: id 1 with cost NULL, which sells for 0, and id 231, which sells for 13.
- **Fix:** Product decision with CAT: either make overrides explicit (`source_item_id` set, and a resolver that maps base to override for buy, buy-again and recruit pricing), or label override items ("house rule", campaign badge). Resolve "Buy again" through the campaign catalogue. Disambiguate same-name stash rows (show cost or a badge).
- **Effort:** M · **Confidence:** Confirmed (data and code)

### ECON-BUG-15 · P3 · Resource updates send absolute values; resource sale is two non-atomic requests
- **Where:** `frontend/src/features/warbands/hooks/warband/useWarbandResources.ts:140-182, 258-301`; `backend/apps/warbands/views/warbands.py:613-630`; `backend/apps/warbands/serializers/warbands.py:220-223`
- **What:** Clicks on +/- are coalesced into an absolute `amount` computed from the client's copy, so two users or tabs adjusting the same counter overwrite each other. The API accepts negative amounts (only the UI clamps). Sell is a PATCH of the amount followed by `POST /trades/`; if the second call fails, the resource is gone and no gold is credited (the error is shown).
- **Fix:** Accept `delta` and apply `F("amount") + delta` with an `amount__gte` guard. Add a resource-sale endpoint that does both writes in one transaction. Validate `amount >= 0`.
- **Effort:** S · **Confidence:** Confirmed (code); race Likely

### ECON-BUG-16 · P3 · Trade expiry and notification hygiene
- **Where:** `backend/apps/trades/views.py:286-291, 319-332, 384, 503-507, 665-669, 707-716`; `backend/apps/notifications/utils.py:27-33`; `frontend/src/features/warbands/hooks/warband/useWarbandTradeSession.ts:72-86`
- **What:**
  - **Expiry is lazy; no job runs it.** An expired pending request stays `pending` until someone hits the detail or pending endpoint, and the frontend never calls the pending endpoint (`listPendingTradeRequests` is unused).
  - **Stale notifications.** The recipient's notification is not resolved on expiry, or when the initiator closes a pending request (Close only sends a trade-channel event, which the recipient isn't subscribed to yet). Accepting from that stale notification returns a 400.
  - **Traders stay spent.** Traders consumed in an abandoned accepted trade are restored only when someone loads the campaign trade list, a GET with side effects.
  - **Close errors are swallowed.** `handleTradeSessionClose` ignores close errors and drops the session locally.
- **Fix:** Resolve notifications on every terminal transition. Send a `trade_closed` user event. Add a periodic cleanup (management command or cron) that expires and restores. Remove the unused endpoint or use it.
- **Effort:** S · **Confidence:** Confirmed

### ECON-BUG-17 · P3 · The hero "Trade" badge is clickable for non-owners and fails silently
- **Where:** `frontend/src/features/warbands/components/heroes/blocks/HeroCardHeader.tsx:29-46, 84-95`
- **What:** There is no `canEdit` check, as the NOTES live run observed. `handleConfirmTrade` uses try/finally with no catch, so a 403 becomes an unhandled rejection and the confirm dialog stays open with no message. ROST owns the card; listed here because it spends the trading action used by trades.
- **Fix:** Pass `canEdit` and render the static span when it is false. Catch the error and display it.
- **Effort:** S · **Confidence:** Confirmed

### ECON-BUG-18 · P3 · Buying a rare item can record the wrong quantity in the ledger and log
- **Where:** `frontend/src/features/items/hooks/useAcquireItemDialogShared.tsx:421, 745, 850, 873`; `features/items/components/AcquireItemDialog/PriceSection.tsx:168-188, 203, 217-224`
- **What:** The `quantity` state survives switching to a rare availability, where the selector is hidden. `count` is forced to 1 and the charge is `finalPrice`, but the description and log use `quantity`, so the ledger reads "Item x 3" for one item. The price section shows "Unit price" and "Total: finalPrice×3".
- **Fix:** Use `count` everywhere, and reset `quantity` to 1 whenever the rarity isn't common.
- **Effort:** S · **Confidence:** Confirmed (code)

## Code quality

### ECON-CQ-01 · P1 · The ledger has no single source of truth for gold
- **Where:** `backend/apps/warbands/models/warband.py:13-49, 95-110`; `backend/apps/warbands/utils/trades.py:7-23`; `backend/apps/warbands/serializers/warbands.py:19-28, 78-87, 296-320`; `backend/apps/trades/views.py:23-44, 245-271`; `frontend/src/features/warbands/utils/warband-utils.ts:417-436`
- **What:** Gold isn't stored. It is derived by matching free-text `action` strings against lists copied in four places:
  - `_EXPENSE_ACTIONS` in the serializer;
  - `EXPENSE_ACTIONS` in the trades app;
  - the frontend `EXPENSE_ACTIONS`;
  - `NEGATIVE_TRADE_ACTIONS` in `TradeHelper`, which differs (it lacks "bought" and "trade sent").

  The stored sign depends on which code path wrote the row, and the trades app bypasses `TradeHelper` entirely. With no row to lock, the server can't enforce rules such as "no overspend" or "no negative gold".
- **Fix:**
  1. Make `action` a `TextChoices` enum with an `is_expense` map, and validate it in `WarbandTradeCreateSerializer`.
  2. Always store signed prices through one helper, with a data migration that flips the "Bought" and "Trade sent" rows.
  3. Add `Warband.gold = IntegerField()`, maintained with `F()` in the same transaction as every ledger insert. Add a `CheckConstraint(gold__gte=0)` if the campaign rules require it, and a `recompute_gold` management command for audits.
  4. Make every reader (summary, trades, frontend) use `warband.gold`. The browser stops recomputing.
- **Effort:** M · **Confidence:** Confirmed

### ECON-CQ-02 · P2 · The audit trail is inconsistent: who writes logs depends on the flow
- **Where:** `backend/apps/warbands/views/warbands.py:389-461` (move: no log), `464-525` (sale: ledger only), `359-386` (discard: nothing), `547-573` (`POST /logs/` accepts any feature, type and payload); `backend/apps/trades/views.py:233-271` (gold rows only; traded items unrecorded); `frontend/src/features/items/hooks/useAcquireItemDialogShared.tsx:690-706, 858-879` (buy and rarity logs written by the browser)
- **What:** The server logs recruits and battles. The browser logs buys, rarity rolls and dice. Nobody logs sales, moves, discards or traded items. A completed items-only trade leaves no trace in either warband's ledger or logs.
- **Fix:** Have the server write a `WarbandLog`, and a ledger row where gold moves, in the same transaction as each economy mutation. Restrict `POST /logs/` to a whitelist of client-only features (dice rolls) and cap the payload size.
- **Effort:** M · **Confidence:** Confirmed

### ECON-CQ-03 · P2 · `trades/views.py` (730 lines): repeated preamble, inconsistent expiry handling
- **Where:** `backend/apps/trades/views.py`. The same load + 404 + participant + expiry block is repeated at 411-432, 457-477, 487-510, 530-551, 606-627, 649-672 and 691-716. Expiry is handled three ways: 503-507 and 665-669 set the status directly, the others call `_expire_trade_request`, and the list GET expires only `accepted` rows (319-332).
- **Fix:** Split it up:
  - `trades/selectors.py`: `get_trade_for_participant(request, campaign_id, request_id, *, lock=False)`, which raises 404/403 and handles expiry.
  - `trades/services.py`: offer validation, gold check, trader consume/restore, transfer, and a `transition(trade, to_status)` state-machine helper using `select_for_update`.
  - `trades/serializers.py`: move `serialize_trade_request` out of `realtime/services.py` and add `TradeOfferSerializer` (ECON-CQ-09).

  That leaves views of about 150 lines.
- **Effort:** M · **Confidence:** Confirmed

### ECON-CQ-04 · P2 · Stash mutation helpers are duplicated 4 times with inconsistent locking
- **Where:** `backend/apps/warbands/views/warbands.py:136-169` and `341-348`; `backend/apps/battles/views/shared.py:1427-1450`; `backend/apps/trades/views.py:200-230`
- **What:** There are four implementations of "add or remove N of item X in a stash". Only the battle copy locks. `refresh_from_db()` after `save()` (lines 147 and 164) costs an extra query each time.
- **Fix:** Create `apps/warbands/services/stash.py` with `add_to_stash(warband_id, item_id, qty, cost)` and `remove_from_stash(warband_id, item_id, qty)`, using conditional `F()` updates (ECON-BUG-06), and reuse it from warbands, battles and trades.
- **Effort:** S · **Confidence:** Confirmed

### ECON-CQ-05 · P2 · `useAcquireItemDialogShared.tsx` is a 964-line god hook
- **Where:** `frontend/src/features/items/hooks/useAcquireItemDialogShared.tsx`
- **What:** About 27 `useState` and 11 `useEffect` calls, and a 50-field return object (907-963). The three unit-purchase branches (768-828) are near-identical. There are `as any` casts at 677, 787, 807 and 827. The effects keyed on the `warband` object identity (225-258, 515-547) refetch whenever the store warband changes. One hook mixes form state, gold fetching, rarity-roll persistence, purchase orchestration and logging.
- **Fix:** Split into:
  - `useAcquireTargets`: units from props or page state;
  - `useSpendableGold`: reads `tradeTotal`;
  - `useRarityRoll`: roll, trading-action spend and log;
  - `useAcquireForm`: availability, price and quantity;
  - a single `purchaseItem()` call to the server endpoint (ECON-PERF-01), which deletes about 200 lines of orchestration.

  The near-duplicate catalogue editor `AddItemForm.tsx` vs `ItemFormDialog.tsx` is tracked as CAT-CQ-02.
- **Effort:** M · **Confidence:** Confirmed

### ECON-CQ-06 · P3 · Frontend duplication across stash, unit menus, trade and resources
- **Where:**
  - `getFloatingMenuPosition`: `components/warband/stash/StashItemList.tsx:33-60` vs `components/shared/UnitItemDialogs.tsx:12-31`.
  - `useStashActions.ts` vs `useUnitItemMenu.ts`: the same Sell/Move/Buy-again state machine and the same henchmen fetch.
  - Mutation-result merging, 3 copies, one of them buggy (ECON-BUG-09): `HeroListBlocks.tsx:71-83`, `HiredSwordListBlocks.tsx:71-81`, `HenchmenListBlocks.tsx:60-68`.
  - `calculateOfferValue`: `TradeSessionDialog.tsx:38-46` vs `TradeOverviewTable.tsx:28-37`.
  - `WarbandResourceBar.tsx`: its two variants duplicate the add/adjust/sell/delete controls (44-196 vs 200-350).
- **Fix:** Shared `floating-menu.ts`, a `useItemActionMenu(source)` hook, an `applyItemMutationResult(result, sourceType, targetType)` helper, `offerValue()` in the trade utils, and a `ResourceRow` component.
- **Effort:** S · **Confidence:** Confirmed

### ECON-CQ-07 · P3 · Dead or misleading code
- **Where:**
  - `frontend/src/features/warbands/utils/unit-item-actions.ts:16-36`: `heroPayload`, `hiredSwordPayload`, `henchmenGroupPayload` are never used.
  - `features/campaigns/api/campaigns-api.ts:218-222`: `listPendingTradeRequests` is unused, and `backend/apps/trades/views.py:274-295` is reachable only from it.
  - `trades/views.py:77`: the `costs` map reads a nonexistent `Item.cost`.
  - `backend/apps/warbands/utils/trades.py:59-75`: `upsert_starting_gold_trade` rewrites the **oldest ledger row of any type**. It is safe only because it runs at creation.
  - `warbands.py:147, 164`: `refresh_from_db` immediately after `save`.
- **Fix:** Delete these. Rename the helper to `create_starting_gold_trade` and remove the upsert branch.
- **Effort:** S · **Confidence:** Confirmed

### ECON-CQ-08 · P3 · Duplicate frontend test files in this area
- **Where:** `features/items/hooks/useAcquireItemDialogShared.test.tsx` vs `features/items/hooks/__tests__/useAcquireItemDialogShared.test.tsx`; `features/items/utils/acquire-item-costs.test.ts` vs `__tests__/…`; `features/items/components/AcquireItemDialog/RaritySection.test.tsx` vs `__tests__/…` (12 pairs repo-wide)
- **What:** Each pair is identical apart from the import path and CRLF vs LF line endings. Every test runs twice and the copies will drift. Cross-ref FE.
- **Fix:** Delete the copies outside `__tests__`.
- **Effort:** S · **Confidence:** Confirmed

### ECON-CQ-09 · P3 · Trade offers are untyped JSON parsed by hand with silent coercion
- **Where:** `backend/apps/trades/models.py:53-54`; `backend/apps/trades/views.py:47-133`
- **What:** Invalid gold becomes 0, invalid items are skipped, and an invalid `trader_id` becomes `None`. Client bugs turn into silent no-ops instead of 400s.
- **Fix:** Add a `TradeOfferSerializer` (`trader_id: int|null`, `gold: int>=0`, `items: [{id:int, quantity:int>=1}]`, max length) and return 400 with field errors.
- **Effort:** S · **Confidence:** Confirmed

## UI / UX

### ECON-UX-01 · P2 · Trade timing is invisible and unforgiving
- **Where:** `backend/apps/trades/views.py:384`; `frontend/src/features/warbands/hooks/warband/useWarbandTradeSession.ts:205-214`; `features/warbands/components/trade/TradeSessionDialog.tsx` (never shows `expiresAt`)
- **What:** The 5-minute window starts when the request is **created**, so it includes the time the recipient takes to notice. It is never extended. The dialog shows no remaining time. At expiry the hook silently closes the socket but the dialog stays open, and the next action fails with "Trade request expired". Leaving the warband page kills the session socket, and nothing elsewhere shows that a trade is in progress.
- **Fix:** Show a countdown. Reset `expires_at` to now + 10 min on accept, and slide it on each offer change up to a hard cap. On expiry, close the dialog with a toast. Show a trade-in-progress badge in the campaign layout.
- **Effort:** S · **Confidence:** Confirmed

### ECON-UX-02 · P2 · The treasury can't be reconciled or corrected
- **Where:** `frontend/src/features/warbands/components/tabs/TradesTab.tsx:28-36, 214-320`; `backend/apps/warbands/views/warbands.py:650-695` (no PATCH or DELETE)
- **What:**
  - **No balance.** There is no running balance or total, so nothing explains the header gold.
  - **No corrections.** Entries can't be edited or deleted, and there is no "Adjustment" action. Warband 2 has a "Reward: we" for 1,000 gc that can only be offset by a fake "Buy".
  - **Inconsistent wording.** The manual actions (Buy/Sell/Recruit/Hire) differ from the auto-generated ones (Bought/Sold/Recruited/Hired/Trade sent).
- **Fix:** Show current gold and a per-row running balance. Allow owner/admin edit and delete with a log entry, or add an "Adjustment ±" action. Unify the vocabulary with the enum (ECON-CQ-01).
- **Effort:** M · **Confidence:** Confirmed

### ECON-UX-03 · P3 · Resource controls: no delete confirmation, +/- hidden on touch
- **Where:** `frontend/src/features/warbands/components/warband/resources/WarbandResourceBar.tsx:165, 317` (Delete), `268-285` (+/- set to `opacity-0 pointer-events-none` until hover or focus-within)
- **Fix:** Add a `ConfirmDialog` before deleting, since the amount is lost. Make +/- visible under `@media (hover: none)`.
- **Effort:** S · **Confidence:** Confirmed

### ECON-UX-04 · P3 · Stash and logs: clarity and accessibility gaps
- **Where:** `frontend/src/features/warbands/components/warband/stash/StashItemList.tsx:216-224` (icon-only kebab button with no `aria-label`); `features/warbands/components/shared/dialogs/ItemSellDialog.tsx:100` (shows "0 gc" when the cost is unknown); `features/warbands/hooks/warband/useStashActions.ts:94-103` (Buy again failure only logged to the console); `features/warbands/components/tabs/LogsTab.tsx:131-142` (filter `<select>` without a label), `155-181` (batch child logs shown flat, not grouped under their `parent_id` the way the treasury groups rows)
- **Fix:** Add `aria-label="Actions for {item}"`, show "cost unknown", show a toast on failure, label the filter, and group child logs.
- **Effort:** S · **Confidence:** Confirmed

### ECON-UX-05 · P3 · Silent failures across economy flows
- **Where:**
  - `useAcquireItemDialogShared.tsx:881-886`: ledger and log failures go to the console only.
  - `useWarbandTradeSession.ts:75`: close errors are swallowed.
  - `useStashActions.ts:82-84` and `useUnitItemMenu.ts:100-102`: the henchmen fetch on Move uses `.catch(() => {})`, which leaves an empty target list with no message.
  - `HeroCardHeader.tsx:31-46`: no catch.
- **Fix:** Show one standard toast for failed mutations and never close a dialog as successful when part of the write failed.
- **Effort:** S · **Confidence:** Confirmed

## Security

### ECON-SEC-01 · P3 · Item ids aren't scoped to the warband's campaign
- **Where:** `backend/apps/warbands/views/warbands.py:333, 406, 482`; `backend/apps/warbands/serializers/heroes.py:268` (`_build_item_join_rows`, cross-ref ROST)
- **What:** `Item.objects.filter(id=item_id)` accepts any item, including another campaign's custom items. Those items can be added to a stash or unit, and their name and cost appear in responses. Battle finds already scope correctly: `Q(campaign_id__isnull=True) | Q(campaign_id=battle.campaign_id)` in `battles/views/shared.py:~1907-1912`.
- **Fix:** Apply the same filter in every economy write.
- **Effort:** S · **Confidence:** Confirmed

### ECON-SEC-02 · P3 · Trade actions don't re-check campaign membership
- **Where:** `backend/apps/trades/views.py:424, 470, 500, 543, 619, 662, 704`; `backend/apps/realtime/channel_auth.py:54-68`
- **What:** Participation is checked by user id only. A player removed from the campaign mid-trade can still edit, lock and complete the trade, keep receiving events, and move items into or out of a campaign they no longer belong to.
- **Fix:** Require a membership check for both participants in the shared selector (ECON-CQ-03) and in channel auth.
- **Effort:** S · **Confidence:** Confirmed

## Test plan

### Existing coverage

**Backend**
- `apps/warbands/tests/test_warbands_api.py`: 18 tests, of which 6 touch the economy, and only the item `cost` defaulting on `POST /items/` and unit PATCH (lines 70-168).
- `apps/core/tests/test_rate_limiting.py:404-440`: throttling of `POST /campaigns/{id}/trade-requests/`.
- `apps/battles/tests/test_battles_api.py`: postbattle finds create a "Reward" ledger row and stash items, plus an upkeep row (around 1043-1101, 1191-1220, 1327-1460). Owned by BATL.
- **Nothing for:** item-sales, item-transfers, `DELETE /items/`, resources, logs list/create, treasury list/create, gold derivation, any trade view (create/accept/offer/lock/unlock/decline/close/expiry/transfer), trade channel auth, notifications for trades.

**Frontend**
- `features/items/hooks/__tests__/useAcquireItemDialogShared.test.tsx`: 1 test (buy without a rarity roll; state preserved after a failed roll). Duplicated outside `__tests__`.
- `features/items/utils/__tests__/acquire-item-costs.test.ts`: 5 tests of the persisted-cost rules. Duplicated.
- `features/items/components/AcquireItemDialog/__tests__/RaritySection.test.tsx`: 3 tests. Duplicated.
- The henchmen and hired-sword save hook tests only mock `createWarbandTrade`; they focus on level-ups.
- **Nothing for:** `TradeSessionDialog`, `useWarbandTradeSession`, `TradesTab`/`useTradesTab`, `LogsTab`, `StashItemList`/`useStashActions`, `useUnitItemMenu`, `useWarbandResources`, `pending-purchases`, `getSignedTradePrice`, `useWarbandUpdateListener`.

### Gaps and proposed tests

| ID | Level | Scenario | Expected result | Priority |
| --- | --- | --- | --- | --- |
| ECON-TEST-01 | API | Trade where side A selects a trader and both lock | 200, status `completed`, items and gold moved, trader stays `trading_action=False` (regression for ECON-BUG-01) | P1 |
| ECON-TEST-02 | API | `item-transfers` stash → hero where the hero is dead or doesn't exist | 404, stash quantity unchanged (ECON-BUG-02) | P1 |
| ECON-TEST-03 | API | Transfer hero → hero and hero → stash, quantity 2 | Rows moved, `cost` preserved, response shape valid | P1 |
| ECON-TEST-04 | API | Sale from the stash and from a unit | Quantity decremented or row removed, one "Sold" row, summary gold increases by exactly `price` | P1 |
| ECON-TEST-05 | API (`TransactionTestCase`, 2 threads) | Two concurrent sales of the last stash copy | Exactly one succeeds, one "Sold" row (ECON-BUG-06) | P2 |
| ECON-TEST-06 | API (threads or stale-object simulation) | Both participants lock at the same time | Both flags true, trade completes, no trader lost (ECON-BUG-04) | P1 |
| ECON-TEST-07 | API | Lock with a stale `offer_version` | 409, not locked (after ECON-BUG-05) | P2 |
| ECON-TEST-08 | API | An offered item is sold between offer and completion | 400 with a reason, both flags reset, traders restored (ECON-BUG-11) | P2 |
| ECON-TEST-09 | API | Offer validation: gold above balance, item not in stash, quantity above stock, non-participant, expired | 400/400/400/403/400; expired request becomes `expired` with traders restored | P1 |
| ECON-TEST-10 | API | Accept or decline a pending request after `expires_at` | 400, status `expired`, recipient notification resolved | P2 |
| ECON-TEST-11 | Unit | Gold calculation per action type, Group children, unknown action | Matches the enum mapping; children counted once | P1 |
| ECON-TEST-12 | API | Mixed ledger (buy, sell, trade sent/received, upkeep, reward, group) | `summary.gold == Warband.gold == recompute_gold()` | P1 |
| ECON-TEST-13 | API | New purchase endpoint: insufficient gold; success; two concurrent purchases over budget | No item and no ledger row; item + ledger + log; only one succeeds, gold never negative | P1 |
| ECON-TEST-14 | API | Query budgets with `assertNumQueries` | summary ≤ 6, items ≤ 4, logs page ≤ 4, transfer ≤ 15, sale ≤ 12, offer update ≤ 6 (fails today; tracks the PERF fixes) | P1 |
| ECON-TEST-15 | API | Logs pagination and feature filter | Page size honoured, newest first, `next` link, filter applied on the server | P2 |
| ECON-TEST-16 | API | Resource delta update and resource sale endpoint | `F()` delta applied, negative totals rejected, sale atomic | P3 |
| ECON-TEST-17 | API | Item from another campaign posted to `/items/`, `item-transfers`, unit PATCH | 400/404 (ECON-SEC-01) | P3 |
| ECON-TEST-18 | API | `pusher.trigger` mocked to raise on offer, lock, create | Request still 2xx, state consistent, no duplicate rows (ECON-PERF-07) | P2 |
| ECON-TEST-19 | Component | `TradeSessionDialog`: partner payload arrives during a pending local edit; Accept right after the partner changes | Draft not reverted; Accept briefly disabled; countdown visible | P2 |
| ECON-TEST-20 | Hook | `useWarbandTradeSession`: change `?tab=`; receive `offer_updated` | Socket not recreated; `getWarbandSummary` not called | P2 |
| ECON-TEST-21 | Component | `TradesTab` with a group header whose children cost 120 | Shows "−120 gc" in expense style; adding an entry updates the total once | P2 |
| ECON-TEST-22 | Hook | `useAcquireItemDialogShared`: `createWarbandTrade` rejects; rare item after quantity 3 was chosen | Error shown and dialog stays open; ledger says quantity 1 | P1 |
| ECON-TEST-23 | Unit | `applyItemMutationResult` for hero → hired sword and hero → henchmen moves | Target merged into the correct list; heroes list unchanged apart from the source (ECON-BUG-09) | P2 |
| ECON-TEST-24 | Component | Warband route viewing another warband during an active trade | Trade dialog not rendered (ECON-BUG-13) | P2 |
| ECON-TEST-25 | E2E (Playwright, 2 contexts) | Full trade: request → accept → offers both ways with a trader → lock both → completed; plus decline, cancel and expiry paths | Both stashes and gold updated, ledger rows on both sides, notifications cleared | P1 |
| ECON-TEST-26 | E2E (2 tabs) | Tab B moves an item off Hero X, then Tab A buys for Hero X | No duplicated item (ECON-BUG-03) | P2 |
| ECON-TEST-27 | Component | `LogsTab` with server pagination and batch children | Fetches by page; child logs grouped under the header | P3 |
| ECON-TEST-28 | Manual | Campaign override item: Buy again on an owned base Axe | Price follows the agreed override rule (ECON-BUG-14) | P3 |

### Manual QA script

**Setup**
- Browser A: user 1, owner of "Monks" (warband 2) in the "Shards" campaign.
- Browser B: user 2, owner of "Warband 2" (warband 1).
- Optional browser C: a campaign admin with `manage_warbands`.
- Open the DevTools Network tab in A and B. Pusher must be configured.

**Steps**
1. **Gold reconciliation.** A: open the Warband page and note the header gold. Open Treasury and add up the entries by hand. Expect them to match. Expect group rows to show negative totals (ECON-BUG-08).
2. **Logs fetching.** A: open Logs and note "Page 1 of N". Switch Warband → Logs → Treasury → Logs. In Network, expect paged log requests with no full re-download (ECON-PERF-06 and ECON-PERF-08 after the fix).
3. **Stash sale.** A: open Stash, open the kebab on an item with quantity ≥ 2, Sell 1 at the default price. Expect the stash quantity to drop by 1, gold to rise by the price, a "Sold" ledger row, and exactly one request (no extra `GET /items/`).
4. **Cross-type move.** A: move an item from the stash to a hero, then from that hero to a henchmen group. Expect the henchmen group never to appear among the heroes, the group to show the item, and the hero's name to be unchanged (ECON-BUG-09).
5. **Data-loss check.** A: open Move on a stash item targeting Hero X, but don't confirm. In a second tab of A, delete Hero X or mark them dead. Back in the first tab, confirm. Expect an error and the stash item still present (ECON-BUG-02).
6. **Purchase request count.** A: buy a common item ×2 for a hero. Count the requests in Network: today about 8, target 1. Expect the ledger to read "Bought <item> x 2" with the total price and gold to fall by that total.
7. **Purchase failure.** A: in DevTools, block the URL pattern `*/api/warbands/*/trades/`, then buy an item. Expect a visible error and no item added. Today the item is added silently with no charge (ECON-BUG-03).
8. **Overspend.** A: open the acquire dialog in two tabs for items that each cost more than half of the current gold, then confirm both. Expect the second purchase to be rejected and gold never to go negative (after the fix).
9. **Resources.** A: click + three times on "Treasure" and wait 1 s. Expect one PATCH. At the same time, C (admin) changes the same resource. Expect the final value to reflect both changes (after the delta fix). Delete a resource: expect a confirmation dialog.
10. **Trade start.** A: Trade → pick B. B: expect a notification; accept it. Expect both to land on their warband page with the trade dialog open and a countdown visible (ECON-UX-01).
11. **Offers sync.** A adds 2 items and 10 gc; B adds 1 item. Expect each side's view to update within about 1 s, and no `GET /summary/` per edit in Network (ECON-PERF-02).
12. **Rapid edits.** A clicks one item 5 times quickly while B changes their gold. Expect A's offer to end at ×5 (ECON-BUG-12).
13. **Changed offer.** B changes their offer and A clicks Accept within half a second. Expect A's lock to be rejected or the UI to refresh, never a lock on an offer A didn't see (ECON-BUG-05).
14. **Simultaneous lock.** Count down "3-2-1" and have both click Accept together. Expect the trade to complete. Repeat 5 times (ECON-BUG-04).
15. **Trader trade.** Run a new trade where A selects a trader hero, then both accept. Expect completion, the hero marked as spent, and the overview Trades table listing the trade with item values (ECON-BUG-01, ECON-BUG-10).
16. **Completion failure.** In a new trade A offers a stash item. Before both lock, A sells that item in another tab. Then both lock. Expect a clear error on both screens and both "Accepted" flags reset (ECON-BUG-11).
17. **Expiry.** Start a trade and wait more than 5 minutes (or shorten the window locally). Expect the dialog to close with a message, the trader to be restored, and B's notification to be gone (ECON-BUG-16).
18. **Cancel before accept.** A starts a trade and cancels before B accepts. Expect B's notification to disappear or show "cancelled".
19. **Other warband's page.** During an active trade, A opens B's warband page. Expect no trade dialog showing B's stash (ECON-BUG-13).
20. **Tab switching.** During an active trade, switch the Warband/Treasury/Logs tabs. Expect no new `POST /realtime/pusher/auth/` and no new WebSocket in Network (ECON-PERF-02).
21. **Permissions.** As B, view A's warband. Expect no stash kebabs, no resource controls, no "Add Trade Entry", and a non-clickable hero "Trade" badge (ECON-BUG-17). Then run `curl -X POST /api/warbands/2/item-sales/` with B's token: expect 403.
22. **Override item pricing.** In Shards, Wargear shows Axe at 25 gc. Warband 2's stash shows two "Axe" rows. "Buy again" on the base Axe currently charges 5 gc. Confirm the intended behaviour with the owner (ECON-BUG-14).
23. **Pusher outage.** Set a wrong `PUSHER_SECRET` locally and edit an offer. Expect the request to succeed and the state to stay consistent, not a 500 (ECON-PERF-07).
