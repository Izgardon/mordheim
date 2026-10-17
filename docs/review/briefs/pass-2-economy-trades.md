# Pass 2 brief: Economy and trades

Step 1 of the pass loop in [PLAN.md](../PLAN.md). Full detail (repro, fix) is in [features/04-warband-economy-trades.md](../features/04-warband-economy-trades.md); IDs are from [BUGS.md](../BUGS.md), [PERFORMANCE.md](../PERFORMANCE.md), [IMPROVEMENTS.md](../IMPROVEMENTS.md) and [TEST_PLAN.md](../TEST_PLAN.md). The review predates pass 1, so every finding below was re-checked against today's code: backend `pass1/roster-changes-backend` @ `9953789`, frontend `pass1/roster-changes-frontend` @ `0baa011` (still moving, so frontend line numbers may drift).

**Already done (not proposed again):** Pusher sends after commit in the background, so it can no longer turn a trade write into a 500 or strand a lock (0-A, ECON-PERF-07). Gold is one aggregate shared by the summary and the trade cap (`services/summary.py:109-121`; summary 12 → 7, ECON-PERF-05 short term). One realtime client keeps one subscription per trade, so tab switches don't rebuild the socket (0-E). Duplicate test files are gone (ECON-CQ-08). Pass 1: every endpoint under `warbands/<id>/` runs on `WarbandScopedView` (items, logs and resources 3 queries, treasury 4; ECON-PERF-04); cross-kind item moves merge into the right lists (BUG-39/BUG-86, `UnitListBlocks.tsx:81-95`); the hero Trade badge follows `capabilities` and shows errors (ECON-BUG-17, inside BUG-31); writes patch the TanStack sheet instead of the `warband:updated` bus; transfers and sales have 13 characterisation tests.

**Your part:** answer the [decisions](#decisions-i-need-from-you), pick any [ideas](#ideas-you-might-want), and add rows to [Planned changes](#planned-changes).

## What it is today

- **Gold.** `Warband` has no gold column. `warband_gold()` sums the ledger in one query, ± `abs(price)` by matching `action` against `EXPENSE_ACTIONS` (`services/summary.py:20-29`). `TradeHelper` stores a negative price only for Buy, Upkeep, Recruit(ed), Hire(d) (`utils/trades.py:12-28`); "Bought" (sent by the browser), "Sold", and "Trade sent"/"Trade received" (written directly by the trades app, `trades/views.py:225-253`) are stored positive. The browser keeps a third copy of the rule (`warband-utils.ts:142-160`) and holds the header gold in local state (`Warband.tsx:36, 70-74, 195`).
- **Buying.** `useAcquireItemDialogShared` (973 lines). Opening it GETs heroes, henchmen groups and the whole ledger. A stash buy POSTs `items/`; a unit buy PATCHes the unit's whole item list; then the "Bought" row and the log are POSTed with `allSettled`. In roster edit mode purchases queue: Save sends the section's batch (bought copies already inside the unit lists), then `commitPendingPurchases` posts a "Group" header, a trade and a log per purchase, one at a time (`write-section.ts:70-86`).
- **Stash, moves, sales.** `services/item_moves.py` moves or sells copies between the stash and any unit through the `KINDS` registry, seeing only `on_roster` units. A sale writes "Sold" at the client's price (the dialog suggests half the cost rounded up, `ItemSellDialog.tsx:27-28`). Discard is `DELETE items/:id`, with no log.
- **Treasury, logs, resources.** Treasury: top-level rows with nested children, free-text manual entries, no edit or delete (`views/ledger.py:82-108`). Logs: the whole list, paged 12 at a time in the browser; `POST logs/` takes any feature. Resources: named counters with an absolute PATCH after a 1 s debounce; "Sell" is a PATCH plus a POST to `trades/`.
- **Trades.** `trades/views.py` (712 lines, no lifecycle tests): request (expires 5 minutes after creation) → accept → both sides edit offers (300 ms autosave) → each side locks (spending the chosen trader's trading action) → on the second lock, stash items and gold move in one transaction. A Pusher event per change; the dialog opens from `?trade=<uuid>`; the session lives in the app store.
- **Permissions.** Warband economy endpoints use the `edit` rule (owner or `manage_warbands`) and the sheet's `capabilities.manage_items`. Trades check participants by user id; there is no `trade` capability.
- **Built on pass 1.** Soft delete: `on_roster()` hides dead and dismissed units from transfers and sales, so their items are out of reach, and a dismissed unit's items are lost (decision 3). `POST <kind>/batch/` is the roster Save, designed so purchases can join it (`units/services/batch.py`; contract §9). `KINDS` gives each kind's item join model (`kind.items`, `parent_field`). `units/catalogue_scope.py` scopes unit catalogue ids (SEC-07 unit half). `hire_cost` prices a recruit's share of group items from stored row costs. BUG-06 is pinned at `test_roster_characterisation_items.py:149`.
- **Main files.** Backend: `trades/views.py` 712, `serializers/warbands.py` 354, `services/item_moves.py` 185, `realtime/services.py` 147, `services/summary.py` 121, `views/ledger.py` 108, `views/items.py` 92, `utils/trades.py` 80. Frontend: `useAcquireItemDialogShared` 973, `TradeSessionDialog` 480, `log-formatters` 426, `AcquireItemDialogContent` 405, `useWarbandResources` 360, `WarbandResourceBar` 351, `TradesTab` 297, `StashItemList` 285, `useWarbandTradeSession` 262.

## What's wrong

### Gold and purchases
- **BUG-07** (P1): purchases still aren't atomic. A unit buy PATCHes the whole item list from page state (`useAcquireItemDialogShared.tsx:768-842`; the server replaces it, `units/services/loadout.py:68-80`), so a second tab resurrects or drops items. The "Bought" row and log follow with `allSettled`, failures reach only the console (859-895), and the item is free. Gold is checked only in the browser. In edit mode the batch saves the bought copies, then the ledger rows go one by one (`write-section.ts:70-80`): a failure leaves items unpaid, and because the forms are kept (`useUnitSave.ts:98-128`), Retry re-sends the whole batch, creating and charging the queued recruits a second time and re-posting the purchases that went through.
- **BUG-37**: four gold rules disagree. Server `EXPENSE_ACTIONS`; `TradeHelper.NEGATIVE_TRADE_ACTIONS` (no "bought" or "trade sent"); the browser copy; and the acquire dialog, which sums top-level ledger rows only (group children ignored, so it overstates gold) or uses a hidden "Gold Crowns" resource instead (`useAcquireItemDialogShared.tsx:454-466, 538-560`). Stored signs are mixed, so `SUM(price)` isn't gold. Manual entries accept any action text (`serializers/warbands.py:293-297`), and unknown text counts as income.
- **BUG-70**: a rare item bought after choosing quantity 3 is charged once, but the ledger and log say "x 3" (`count` at :751, `quantity` at :865 and :884).
- **BUG-18 (pass 2 part)**: "Buy again" loads the owned item by id (`useStashActions.ts:92-101`, `useUnitItemMenu.ts:103-112`), so a base Axe is rebought at 5 gc under a 25 gc house rule; same-name stash rows look identical.
- **ECON-PERF-01, -09**: one purchase is still about 8 requests (3 GETs on open at `:227-264, :546`, then a unit detail GET, the PATCH, trade, log and a summary GET). A Save with K queued purchases adds 2K+1 sequential requests.

### Stash, moves and sales
- **BUG-06** (P1): a move to a dead, dismissed or missing target still answers 404 from inside `atomic()` after the source rows are gone, so the item is destroyed (`services/item_moves.py:144-149`). Soft delete widens it: a unit dismissed in another tab is now a missing target.
- **BUG-36**: stash removal is read-modify-write (`item_moves.py:65-77`), unit removal ignores the deleted count (`:41-49`), stash adds lose increments and a concurrent first insert hits `unique_warband_item` (`:80-114`), and `DELETE items/:id` is read-modify-write too (`views/items.py:52-65`). Two sales of the last copy both credit gold.
- **New BUG-107** (P2, Likely): Move targets come from the app store's warband, which is *your own* warband, not the one on screen (`StashItemList.tsx:258-260`, `UnitItemDialogs.tsx:81-92`, `useUnitItemMenu.ts:57`), and the acquire dialog stocks and charges the store's warband (`useAcquireItemDialogShared.tsx:206, 768-772, 861-868`). A campaign admin managing another player's warband sees their own units as targets (the move 404s and BUG-06 destroys the item), and "Buy again" in that warband's stash buys into the admin's own stash with the admin's gold.
- **New BUG-108** (P3): an item taken "from stash" for a new henchman leaves the stash through a separate `DELETE items/` after the batch (`henchmen-editor.ts:88-94`); a failure leaves the copy in both places.
- **SEC-07 (stash half)**: `POST items/` and transfers accept any campaign's item (`views/items.py:44, 70`).
- **ECON-PERF-03**: transfers and sales load full unit detail just to check a unit exists (`item_moves.py:24-31`), then serialise both units and the summary inside the transaction (`:117-124, 152-157, 176`). No budget yet.

### Trades
- **BUG-05** (P1): a trade with a trader never completes. Lock spends the trader (`trades/views.py:150-162, 536-544`); completion re-validates the offer and rejects him as "unavailable" (`:215-217` → `:89-94`).
- **BUG-08** (P1): offer, lock and unlock load the request unlocked and save both sides' fields (`:424-428, 544, 619`). Two Accepts at once erase one lock and burn that trader; two trades can spend the same trader.
- **BUG-41**: flags and trader spend are committed before the completion transaction (`:544` vs `:552-574`); any completion error answers 400 and leaves both sides "Accepted". Completion also checks gold against an unlocked ledger.
- **BUG-35**: lock carries no offer identity (`TradeSessionDialog.tsx:217`), so you can lock an offer you never saw.
- **BUG-40**: offer items are valued at `Item.cost`, which doesn't exist (`trades/views.py:59`), so totals count gold only; traded stash rows lose their cost (`:207-212`) and sell for 0.
- **BUG-42**: the dialog resets your draft on every server copy (`TradeSessionDialog.tsx:103-107`), reverting clicks made during the debounce.
- **BUG-43**: the trade dialog and hook run on any warband page, so viewing another warband mid-trade offers *its* heroes, stash and gold (`Warband.tsx:63-68, 153-164`).
- **BUG-69**: only the unused pending endpoint expires pending requests (`trades/views.py:256-277`); the campaign list GET expires accepted ones and restores traders as a side effect (`:301-314`); accept and decline after expiry skip the clean-up (`:485-489, 647-651`); closing a pending request leaves the recipient's notification (`:700-710`). The client swallows close errors and, at expiry, stops listening while the dialog stays open (`useWarbandTradeSession.ts:86-87, 147-161`).
- **SEC-08**: participants are checked by user id only (`trades/views.py:406, 452, 482, 525, 601, 644, 686`; `realtime/channel_auth.py:54-70`).
- **New BUG-109** (P3): the server accepts a dead hero as trader (`trades/views.py:90, 155` filter `not_dismissed`, not `on_roster`). The UI doesn't offer one.
- **ECON-PERF-02 (rest)**: every `offer_updated`/`locked` event, and your own lock or unlock, re-reads `summary/` in both browsers although gold hasn't moved (`useWarbandTradeSession.ts:184-193`, `TradeSessionDialog.tsx:219, 240`); the sender gets its own event back (no `socket_id`); the sync effect re-GETs the request on every `?tab=` change (`useWarbandTradeSession.ts:226-254`).

### Treasury, logs and resources
- **BUG-38**: a group header formats its children's total with the action "Group", so −120 shows as "+120 gc" in green (`TradesTab.tsx:202-204, 236, 243`).
- **BUG-68**: resource +/- sends an absolute `amount` from the client's copy (`useWarbandResources.ts:154-164`), the API accepts negatives (`serializers/warbands.py:210-213`), and Sell is a PATCH then a POST (`:262-284`).
- **ECON-CQ-02**: sales write only a ledger row, moves and discards write nothing, completed trades record gold but not items; buys and rarity rolls are logged by the browser; `POST logs/` takes any feature and payload (`views/ledger.py:33-44`).
- **ECON-UX-02**: no balance or running total, no corrections, and manual and automatic rows use different words (Buy/Bought, Recruit/Recruited).
- **ECON-PERF-06, -08**: logs are unpaginated (`views/ledger.py:25-31`, `LogsTab.tsx:10, 32-38`); Treasury and Logs refetch on every tab switch; stash Sell/Move refetch the stash although the response has it (`useStashActions.ts:116, 144`) and Move GETs henchmen groups for their names (`:79-83`, `useUnitItemMenu.ts:94-98`); a treasury entry re-reads the summary and adds to a local total (`useTradesTab.ts:103-104`, `Warband.tsx:195`).

### Code quality
- **ECON-CQ-01 (IMP-38)**: no stored balance and no single writer: `TradeHelper`, direct row creation in trades, and starting gold rewriting the oldest row (`utils/trades.py:63-80`; BUG-78 is pass 4).
- **ECON-CQ-03, -09 (IMP-40)**: `trades/views.py` repeats the load/participant/expiry preamble in 7 views, handles expiry three ways, and parses offers as untyped JSON with silent coercion (`:29-115`).
- **ECON-CQ-04 (IMP-41)**: four stash helpers (`item_moves.py`, `views/items.py`, `trades/views.py:182-212`, `battles/views/shared.py:1431-1448`); two of them lock.
- **ECON-CQ-05 to -07 (IMP-42 to -44)**: the 973-line acquire hook with three near-identical unit branches; duplicated floating menu, stash vs unit item menus and offer value; dead `heroPayload`/`hiredSwordPayload`/`henchmenGroupPayload` (`unit-item-actions.ts:16-35`).

### UX and accessibility
- **ECON-UX-01**: no countdown; the clock starts at the request (`trades/views.py:366`) and never extends.
- **ECON-UX-03, -04**: resource Delete has no confirm (`WarbandResourceBar.tsx:163-175`) and +/- appear only on hover (`:260-282`); the stash kebab has no accessible name (`StashItemList.tsx:218-228`); unknown cost shows "0 gc"; the log filter is unlabelled; child logs aren't grouped.
- **ECON-UX-05**: Buy-again and Move-target load failures are silent (`useStashActions.ts:79-83, 92-101`).

## What I propose for this pass

Order: characterisation tests → PR A → PR B → PR C (your Planned changes).

### PR A: fixes

Backend
- BUG-06: resolve and validate source and target before any write; raise inside the block. Flips the pinned test.
- BUG-36: new `services/stash.py` (`add_to_stash`, `remove_from_stash`) with `F()` and `quantity__gte` guards and an `IntegrityError` fallback on the first insert; unit removals check the deleted count. Used by transfers, sales and `items/`.
- BUG-05, BUG-08, BUG-41, BUG-109: every trade write runs in `atomic()` with `select_for_update()` on the request (completion also locks both warbands, lowest id first); a write saves only its own side; the trader's spend is one guarded UPDATE recorded on the request (`from_trader_spent`, `to_trader_spent`), so Unaccept and expiry restore only what this trade spent; completion checks only that the trader is still on the roster (whether an already-spent hero is refused or warned is decision 9). Lock and completion share one transaction; a failed completion resets both flags, restores traders, answers 409 with the reason and broadcasts it.
- BUG-35: `offer_version` on the request; lock sends the version it showed; mismatch is a 409.
- BUG-40: offers valued from the stash row's `cost`; a completed trade copies `cost` to the receiver.
- BUG-69: decision 8's timers; notifications resolved on every terminal transition; a `trade_closed` user event; `manage.py expire_trades` (Render cron, `--dry-run`) expires and restores traders, so GETs stop writing.
- SEC-08: both participants must still be campaign members, in the views and in channel auth. SEC-07 (stash half): the `units/catalogue_scope.py` rule on `items/` and transfers.
- BUG-68: resources take a `delta` applied with `F()` (never below 0); `POST resources/:id/sell/` writes the change and its ledger row together.
- BUG-07 (server half, additive): `POST warbands/:id/purchases/` in one transaction: item scope, rows appended through `kind.items` or the stash service (no list replacement), ledger row and log, rarity roll and trading action (decision 9), decision 2's gold rule; it answers the touched unit's items or stash row plus the summary. The batch body gains `purchases` and `stash_takes` (decision 1, BUG-108), and `update` entries may carry `updated_at` (409 for a unit changed in another tab). The frontend adopts it in PR B.
- ECON-CQ-02 (IMP-39): the server logs sales, moves, discards and traded items in the same transaction; `POST logs/` keeps only client-only features (dice) with a size cap.
- ECON-PERF-03: existence checks with `.only("id")`, writes in the transaction, serialisation after, a slim answer (touched units' `items`, the stash row, the summary). ECON-PERF-06: cursor pagination and a server feature filter for logs and the treasury, with `(warband, -created_at)` indexes. ECON-PERF-02: `socket_id` from `X-Pusher-Socket-Id`; `trade.completed` carries both summaries.

Frontend
- BUG-37: the acquire and trade dialogs read gold from the sheet summary; the "Gold Crowns" path and `Warband.tsx`'s local `tradeTotal` go.
- BUG-38: group headers formatted and coloured by their own sign. BUG-70: `count` everywhere.
- BUG-42: a dirty flag; the server copy replaces the draft only when nothing local is unsent. BUG-43: the trade dialog and hook only on your own warband.
- BUG-107: Move targets, Buy again and the acquire dialog use the warband on screen.
- BUG-69, ECON-UX-05: close and load errors shown; at expiry the dialog closes with a toast.
- ECON-PERF-02, -08: no summary GET on offer and lock events; send `X-Pusher-Socket-Id`; sync keyed on the request id; 600 ms debounce. Stash Sell/Move apply the response; Move targets come from the sheet; ledger entries and resource sales use the returned summary.

### PR B: refactor (no behaviour change)

Backend
- `services/ledger.py`: one `record(warband, action, amount, ...)` that writes the signed row and `Warband.gold = F("gold") + amount` in the caller's transaction; `action` becomes `TextChoices` with `is_expense`. Every writer moves onto it (recruits, sales, purchases, trades, battle upkeep and rewards, starting gold, manual entries); until BUG-78 (pass 4), the starting-gold rewrite adjusts the balance by the difference. Migration: add `Warband.gold`, backfill it from today's rule, store signed prices (flipping the positive "Bought" and "Trade sent" rows); `manage.py check_gold` compares column and ledger. Proven neutral by the mixed-ledger test; the treasury `price` becomes signed, which the frontend already handles. Summary 7 → 6.
- `trades/`: `selectors.py` (`get_trade_for_participant(..., lock=True)`: 404/403, membership, expiry), `services.py` (`TradeOfferSerializer` validation, trader spend and restore, `transition()`, completion), `serializers.py` (`serialize_trade_request` out of `realtime/services.py`). Views about 150 lines, nothing over 400.
- `services/stash.py` also serves trades and battle finds. Delete `NEGATIVE_TRADE_ACTIONS`, the `Item.cost` read, `refresh_from_db` after save, and the pending endpoint if decision 8 doesn't need it.

Frontend
- `api/economy-queries.ts`: keys under the warband (`[..., 'warband', id, 'treasury' | 'logs' | 'stash']`, logs as an infinite query) and `['campaign', id, 'trade', uuid]`; mutations (`usePurchase`, `useItemMove`, `useItemSale`, `useLedgerEntry`, `useResourceChange`, trade offer/lock/unlock) patch the cache from the response. Realtime trade events patch the trade query from their payload.
- One purchase path: the acquire dialog split into `useAcquireForm`, `useRarityRoll` and `usePurchaseTarget` (the page's warband and units, passed in) around `purchase()`; the roster Save sends `purchases` in its batch; `commitPendingPurchases` and the whole-list PATCH go. `getSignedTradePrice` and `EXPENSE_ACTIONS` go once prices are signed.
- `TradeSessionDialog` → `TradeOfferEditor`, `TradeOfferSummary`, `TradeActions`; trade session state leaves the app store (the `?trade=` param says which trade is open).
- `TradesTab` → `TreasuryTab` + `TreasuryRow`; `LogsTab` on the infinite query; `log-formatters.tsx` split by feature; one `ResourceRow` for both `WarbandResourceBar` variants; `useItemActionMenu(source)` replaces `useStashActions` and `useUnitItemMenu`; shared `floating-menu.ts` and `offerValue()`; dead payload helpers deleted. Every touched component and hook ≤ 250 lines.

After PR B, the treasury changes from decisions 4 and 5, the countdown (ECON-UX-01) and ECON-UX-03/-04 are one change each, so I'll add them to Planned changes (PR C) once you've answered.

### Characterisation tests to write first

Backend (factories; Pusher mocked; known bugs pinned with their ID so they flip in PR A)
- Gold (ECON-TEST-11/12): a mixed ledger (Buy, Bought, Sold, Recruited, Hired, Upkeep, Reward, Trade sent/received, a Group with children, free text) gives today's `summary.gold`; pin that `SUM(price)` differs (BUG-37). This is the safety net for the ledger migration.
- Treasury, logs, resources and stash: list and create shapes, manual entry sign per action, `?feature=`, `items/` cost defaults and increments, `DELETE items/`; pinned: negative resource accepted (BUG-68), another campaign's item accepted (SEC-07).
- Transfers and sales: extend the 13 tests with cost kept over quantity 2 (ECON-TEST-03) and gold up by exactly `price` (ECON-TEST-04).
- Trades (none today): create (notification, user event), accept, offer validation (ECON-TEST-09), lock and unlock, completion without a trader (items, gold, "Trade sent"/"Trade received"), decline, close, expiry and trader restore, non-participant 403; pinned: a trader blocks completion (BUG-05), items valued at 0 and traded rows without cost (BUG-40), removed member still acts (SEC-08).
- Concurrency (`TransactionTestCase` with two threads, or the interleaving patch used for BUG-62): two sales of the last copy (ECON-TEST-05), two locks at once (ECON-TEST-06), two offers at once; expected failures today. Two purchases over budget (ECON-TEST-13) arrive with the endpoint.
- Budgets at today's counts for transfer, sale, offer, lock and the campaign trade list (ECON-TEST-14).

Frontend (MSW harness)
- `useAcquireItemDialogShared`: request sequences for stash and each kind; gold from top-level rows (BUG-37); a rejected trade POST still closes the dialog (BUG-07); rare item after quantity 3 (BUG-70). Asserted as requests and visible text, so PR B's split keeps them.
- `writeSection` and `commitPendingPurchases`: order and a failure midway (extend the 8 tests in `pending-purchases.test.ts`).
- Stash and unit item menus: Sell and Move requests and cache merges; Move targets for an admin on another warband (BUG-107).
- `TradesTab` group header (BUG-38); `LogsTab` paging and filter; `useWarbandResources` debounce and absolute PATCH.
- `TradeSessionDialog` and `useWarbandTradeSession`: draft reset (BUG-42), summary GET per event (ECON-PERF-02), dialog on another warband (BUG-43).
- E2E-03 (two-player trade) and E2E-10 (two-tab purchase) wait for Playwright (0.14c); until then they are manual QA steps.

## Decisions I need from you

1. **Purchase model.** (A) In roster edit mode, purchases ride the section's batch Save with the roster changes (one request; Cancel discards); outside edit mode (stash, item menus, Items page) a purchase is one immediate request. (B) Every purchase is immediate, also in edit mode. **Default: A** (matches pass 1 decision 1).
2. **Spending more than you have.** (A) Warn and allow: the dialog says "leaves the warband at −15 gc" and asks to confirm; the header shows negative gold in red. (B) The server refuses. (C) Refuse players, allow campaign owners and admins. **Default: A.** Trade offers stay capped at current gold, since another warband receives it.
3. **Selling.** (A) The server suggests half the stored cost rounded up (today's browser rule), the player can change it, and any price is accepted. (B) As A, rounded down. (C) Fixed at half. Unknown cost: suggest half the campaign's current price and say "cost unknown". **Default: A.**
4. **Ledger and wording.** (A) A stored balance (`Warband.gold`) updated with every ledger row; signed prices (spending negative); one vocabulary for manual and automatic rows (Buy, Sell, Recruit, Hire, Upkeep, Reward, Exploration, Trade, Adjustment, Starting gold), old rows renamed. (B) As A without the stored balance. **Default: A.**
5. **Corrections and history.** (A) Append-only: an "Adjustment ±" row with a reason, optionally pointing at the row it corrects; a manual row's description and notes stay editable. (B) Owners and admins may also edit or (soft) delete manual rows, logged; automatic rows only via adjustments. (C) Anything editable. Changing the campaign's starting gold would add an adjustment instead of rewriting the oldest row (BUG-78, pass 4). **Default: A.**
6. **Who may write gold directly** (manual rows and adjustments). (A) Anyone who can edit the warband (owner, campaign owner and admins, `manage_warbands`), as today. (B) The warband owner and campaign owner/admins only. (C) The owner only. **Default: A**, with who made it shown on each manual row.
7. **Items of units that die** (postbattle, built in pass 3). Today a dead hero's or hired sword's items stay on the record, out of reach, and a dead henchman's copies stay with his group. (A) Lost, as with dismissal, and postbattle says so; the group loses one copy of each of its items per dead henchman. (B) Moved to the stash. (C) Postbattle asks per unit. **Default: A**; I believe the rulebook says a dead warrior's weapons and armour are lost. Confirm.
8. **Trade timing.** (A) A request waits 10 minutes for an answer; an accepted session stays open while either player acts (each change extends it to 10 minutes, at most 60 in total), with a countdown; a scheduled cleanup closes the rest and restores traders. (B) No timer once accepted: open until both lock or one cancels; a daily cleanup closes sessions idle for a day. **Default: A.**
9. **Trading actions.** Today a trade's trader is optional and locking spends his action; a spent hero is refused. Rarity rolls in the buy dialog spend the searcher's action from the browser, and a failed or missing roll doesn't stop the purchase. (A) Warn and allow: a spent hero can still be picked ("already used his trading action this round"); the server records the spend, and rolls are saved with the purchase; a failed roll warns. (B) Keep refusing spent heroes; rolls as A. (C) Drop the trader from player trades. **Default: A.**
10. **Who may trade for a warband.** (A) Its owner only, as today; the sheet gains `capabilities.trade`. (B) Also campaign owners and admins, for absent players. **Default: A.**
11. **House-rule prices (BUG-18 part).** (A) Buy again and a recruit's share of group items use the campaign's current price (the override's). (B) Both use the price the warband paid. (C) A for Buy again, B for recruits (decision 7 of pass 1 unchanged). Same-name stash rows show their cost either way. **Default: C.**

## Ideas you might want

Options from the review that are your call; copy any you want into Planned changes.
- **Treasury balance**: current gold at the top and a running balance per row, so the header can be checked against the entries (IMP-46).
- **Trade in progress badge** in the campaign layout, with the trade dialog reachable from any page (pairs with decision 8).
- **Offer unit items in a trade**, not only stash items.
- **Undo instead of confirm** for Sell, Move and Discard: a 5-second "Undo" toast.
- **Shard sale helper**: suggest the rulebook price for selling N wyrdstone shards by warband size, editable.
- **Ledger export** (CSV) per warband.
- **Price paid** shown for every owned item, with a "set cost" action for copies whose cost is unknown.

## Production data checks

Before PR A ships, run [BUGS.md production checks §4](../BUGS.md#4-economy-and-trades): trade outcomes and stuck requests, spent trading actions, the sign convention per action, stash rows without a cost (back-filling them needs your OK), negative resources. Run `expire_trades --dry-run` against the stuck trades before letting it close them. Also (read-only):

```sql
-- Ledger actions outside the planned vocabulary (decision 4 must map each; today they count as income)
SELECT action, COUNT(*) AS n, SUM(price) AS total FROM warband_trades
WHERE lower(trim(action)) NOT IN ('buy','bought','recruit','recruited','hire','hired','upkeep','trade sent',
  'sell','sold','trade received','reward','exploration','starting gold','group')
GROUP BY action ORDER BY n DESC;

-- Warbands already below 0 gc under today's rule (decision 2)
WITH g AS (SELECT warband_id, SUM(CASE WHEN lower(trim(action)) IN ('buy','bought','recruit','recruited',
  'hire','hired','upkeep','trade sent') THEN -abs(price) ELSE abs(price) END) AS gold
  FROM warband_trades GROUP BY warband_id)
SELECT * FROM g WHERE gold < 0;

-- Items still carried by dead heroes and hired swords (decision 7)
SELECT 'hero' AS kind, u.warband_id, u.id, u.name, COUNT(*) AS items
FROM hero u JOIN hero_item i ON i.hero_id = u.id WHERE u.dead GROUP BY 1, 2, 3, 4
UNION ALL
SELECT 'hired_sword', u.warband_id, u.id, u.name, COUNT(*)
FROM hired_sword u JOIN hired_sword_item i ON i.hired_sword_id = u.id WHERE u.dead GROUP BY 1, 2, 3, 4;

-- Stash rows holding another campaign's item (SEC-07)
SELECT wi.warband_id, i.id, i.name, i.campaign_id FROM warband_items wi
JOIN warband w ON w.id = wi.warband_id JOIN item i ON i.id = wi.item_id
WHERE i.campaign_id IS NOT NULL AND i.campaign_id <> w.campaign_id;
```

## Planned changes

Types: **New**, **Tweak**, **Remove**. IDs: `ECON-NEW-NN`, `ECON-TWEAK-NN`, `ECON-REMOVE-NN`. Status: Proposed → Agreed → Done.

| ID | Type | Change | Notes / acceptance | Status |
| --- | --- | --- | --- | --- |

## Progress

| Step | State |
| --- | --- |
| Characterisation tests | **Done** on `pass2/economy-trades`. Backend: 90 tests (suite 407 → 497), including a new `apps/trades/tests/` package for the whole trade lifecycle; four real two-thread races are expected failures until PR A (two sales of the last copy, two first stash additions, two locks, two offers); coverage of the 12 economy and trade files 55% → 97% (`trades/views.py` 23% → 98%); query budgets recorded for moves, sales, offers, locks and the trade list. Frontend: suite 654 → 743 through a fake API server (`src/test/fake-api.ts`) that asserts method, path, body and order; 41 tests pin current bugs and name the PR that flips them. Found BUG-110 to BUG-117 (all P3) and widened BUG-107. |
| Your decisions | Waiting (11 questions above). |
| PR A / PR B / PR C | Not started. |

Manual QA until Playwright exists: a two-player trade (E2E-03) and a two-tab purchase (E2E-10); step-by-step scripts are in the frontend characterisation report.
