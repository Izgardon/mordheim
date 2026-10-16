# Campaigns

> Scope: `backend/apps/campaigns/` (models, views, serializers, permissions, pivotal_moments, management commands), house-rule repricing in `backend/apps/items/services.py`, chat/ping services in `backend/apps/realtime/` (campaign channels), campaign side of `backend/apps/notifications/`; frontend `frontend/src/features/campaigns/` (list, card, `CampaignLayout`, overview, settings, Locations, Encampments), `frontend/src/features/rules/` (house rules), `frontend/src/features/realtime/components/CampaignChatMenu.tsx`, the campaign-socket parts of `frontend/src/lib/realtime.ts`.

## Summary

| Dimension | Verdict |
| --- | --- |
| Performance | **Poor.** Opening a campaign costs **17 requests, about 231 queries and about 600 KB of JSON**, spread over 3 sequential waves. Two thirds of the queries come from fetching the full battle history twice, and that fetch runs again (up to 4 times) every time the tab regains focus. Most campaign endpoints have constant query counts. The roster endpoint is the exception (N+1 on warband rating). |
| Bugs | **Several user-visible defects.** "Kick" always returns 403. Admins see a "Start campaign" button the backend rejects. Starting a campaign doesn't stick in the UI. Permission codes have drifted, so some permissions can never be granted. Joining has a race. Removing a member leaves orphaned battles, trades and notifications behind. |
| Code quality | **Fair, but bloated.** `views.py` is 1277 lines with 31 copies of the membership check. `CampaignLayout.tsx` is 724 lines doing 7 jobs. The role and permission seeds are copied in 3 places and have drifted. `CampaignSettings.tsx` breaks the Rules of Hooks. |
| UI/UX | **Functional, with gaps.** Stale-battle tooling is buried. Ownership can't be transferred and players can't leave. Locations and Encampments are missing delete, `explorable` and the action log. Some confirmation text is misleading. |
| Security | One P3 issue: email addresses are shown to every campaign member when a user has no display name. |
| Tests | 36 backend API tests and 5 small component test files. Nothing covers member removal, roles, joining twice, chat, the house-rule PATCH path, campaign deletion or query counts. |

**Top 5**
1. **CAMP-PERF-01 (P0):** the campaign shell and the overview each fetch `/campaigns/:id/battles/` (2 + 2B queries: every battle the user was ever in) on mount and on every focus or visibility change. That measured 156 to 312 queries per tab switch.
2. **CAMP-PERF-02 (P1):** `CampaignLayout` holds the whole campaign behind loading 5 full catalogues (about 370 KB) and refetches them on every mount, which forces a 3-wave waterfall.
3. **CAMP-PERF-03 (P1):** `/players/` costs 4 + 3W queries (3 rating queries per warband). It loads on the overview, Encampments, the trade invite dialog and the roster dialog.
4. **CAMP-BUG-04 (P1):** permission codes have drifted. The backend checks `manage_spells` and `manage_features`, which don't exist, and the UI can't grant `manage_encampments` or `manage_bestiary`.
5. **CAMP-BUG-01 (P1):** the owner's "Kick" button deletes the player's warband through an endpoint that only the warband's owner may call, so it always returns 403.

## How it works

**Models** (`backend/apps/campaigns/models.py`)
- `Campaign` (name, unique 6-character `join_code`, `in_progress`) has a one-to-one `CampaignSettings` (limits, starting gold, level thresholds, hero death roll, `enable_locations`, `enable_encampments`, the legacy `locations` flag, and an M2M `item_settings` to `Restriction`).
- `CampaignMembership` (unique campaign + user) links to `CampaignRole` (`owner`, `admin` or `player`). Grants live in `CampaignMembershipPermission` → `CampaignPermission(code)`.
- Content models: `CampaignMessage` (chat), `CampaignBulletinEntry`, `CampaignHouseRule` (with an optional `effect_key`), `CampaignEncampment`, `CampaignLocation` and `PivotalMoment`.
- `PivotalMoment` rows are generated once per battle by `pivotal_moments.generate_pivotal_moments_for_battle`, called from `battles/views/shared.py:_finalize_battle` (line 677).

**Permission model** (`permissions.py`)
- `get_membership` costs 1 query.
- Owners and admins implicitly have every permission code. Players need explicit grants; joining grants `add_custom`.
- Owner only: PATCH and DELETE on the campaign, role changes, removing members, and the active-battle list and cancel.
- Owner or admin: the members list and permission grants.
- Feature endpoints (locations, encampments) also require the settings flag to be on.

**Endpoints** (all under `/api/campaigns/`)

| Endpoint | Who | Queries (measured, user 1 / campaign 1; add 1 per request for JWT in prod) |
| --- | --- | --- |
| `GET /` list, `POST /` create | any user | 2 (constant in number of campaigns) |
| `POST join/` | any user | n/a (write) |
| `GET/PATCH/DELETE :id/` | member / owner / owner | GET 3 |
| `GET :id/players/` | member | **4 + 3W** (13 at W=3) |
| `GET :id/battle-history/` | member | 3 (payload O(ended battles × participants)) |
| `GET :id/pivotal-moments/`, `top-killers/`, `bulletin/` | member | 2 each |
| `GET :id/active-battles/`, `POST …/:battle/cancel/` | owner | 3 |
| `GET :id/members/` | owner/admin | 4 (+8 on the first call per process for `_ensure_permissions`) |
| `PUT members/:user/permissions/`, `PATCH members/:user/role/`, `DELETE members/:user/` | owner+admin / owner / owner | n/a |
| `GET :id/permissions/` (no FE caller), `GET :id/permissions/me/` | member | 2 / 1–2 |
| `GET/POST :id/rules/`, `PATCH/DELETE rules/:id/` | member / `manage_rules` | GET 2; effect writes about 40–70 or more (see PERF-08) |
| `GET/POST :id/locations/`, `encampments/` (+ `PATCH :id/`) | member + flag / `manage_*` | 3 |
| `GET :id/warbands/` (no FE caller) | member | 4 |
| `POST :id/pings/` (no FE caller) | member, throttled 30/min | n/a |
| `GET/POST :id/messages/` | member; POST throttled 12/min | GET 2 (50 per page, `?before=<id>`) |

**House-rule effects**
- `half_price_armour` and `improved_shields` call `items/services.py`.
- `sync_*` clones every base armour or shield `Item` into a campaign-scoped `Item` (`generated_effect_key`, `source_item`) with its own availabilities, then remaps every owned row (`HeroItem`, `HenchmenGroupItem`, `HiredSwordItem`, `WarbandItem`) in the campaign onto the clones.
- Deleting the last rule with that key calls `revert_*`, which maps the rows back and deletes the clones.
- `ItemListView` shadows base items by **name** with the campaign items (`items/views.py:84-90`).

**Chat and pings**
- `POST messages/` inserts a row, then calls Pusher synchronously on `private-campaign-{id}-chat`.
- `CampaignChatMenu` opens its own Pusher connection while mounted, loads the newest 50 messages when opened, and pages back on scroll-to-top.
- Pings (`private-campaign-{id}-pings`) are fully implemented on both sides, but nothing in the UI calls them.

**Frontend flow**

`/campaigns` (`Campaigns.tsx`) shows the list (`CampaignListSection` → `CampaignCard`, roster dialog on demand) with the Create and Join dialogs. `/campaigns/:id` mounts `CampaignLayout`:
1. `getCampaign`.
2. Then the 5 catalogue lookups (items, skills, spells, specials, races) plus own warband → summary, plus `listCampaignBattles` for the "Rejoin" button.
3. Only after the lookups settle does it render the sidebar and top bar (dice, chat, notifications) and the `<Outlet>`.

The index route `CampaignOverview` uses `useCampaignOverview`:
- 6 parallel fetches: players, completed trades, battle history, pivotal moments, plus top killers and bulletin for the hidden tab.
- `BattleActionPanel` (its own `listCampaignBattles` plus focus listeners) opens `StartBattleDialog`.
- Roster rows lazily load heroes, henchmen and hired swords for the stat preview.

Settings (`CampaignSettings` + `use-campaign-settings`):
- "Personal" tab for everyone.
- "Campaign" tab for owner and admin: `MembersCard`, `ActiveBattlesTable` (owner), `CampaignControlCard` and `CampaignLevelUpSettingsCard` (owner), `DeleteCampaignCard`.

House rules live at `features/rules/routes/HouseRules.tsx` (+ `CommonRulesSheet`, `EditHouseRuleDialog`). Locations and Encampments are list + inline form pages gated by the settings flags.

**What opening the overview costs** (measured with `CaptureQueriesContext`, user 1, campaign 1 with 38 battles, local Postgres)

| Wave | Request | Queries | Bytes |
| --- | --- | --- | --- |
| 1 | `GET /campaigns/1/` | 3 | 0.8 KB |
| 2 | `GET /items/?campaign_id=1` | 14 | 170 KB |
| 2 | `GET /skills/?campaign_id=1` | 4 | 103 KB |
| 2 | `GET /spells/?campaign_id=1` | 4 | 41 KB |
| 2 | `GET /special/?campaign_id=1` | 4 | 61 KB |
| 2 | `GET /races/?campaign_id=1` | 4 | 5 KB |
| 2 | `GET /warbands/?campaign_id=1` → then `GET /warbands/2/summary/` | 4 + 12 | 1.3 KB |
| 2 | `GET /campaigns/1/battles/` (layout "Rejoin") | **78** | **102 KB** |
| 3 | `GET /campaigns/1/players/` | 13 | 0.5 KB |
| 3 | `GET /campaigns/1/trade-requests/?status=completed` | 3 | ~0 |
| 3 | `GET /campaigns/1/battle-history/` | 3 | 6 KB |
| 3 | `GET /campaigns/1/pivotal-moments/` | 2 | 5 KB |
| 3 | `GET /campaigns/1/top-killers/` (hidden tab) | 2 | 0.6 KB |
| 3 | `GET /campaigns/1/bulletin/` (hidden tab) | 2 | 0.1 KB |
| 3 | `GET /campaigns/1/battles/` (BattleActionPanel, duplicate) | **78** | **102 KB** |
| 3 | `POST /realtime/pusher/auth/` (chat channel) | 1 | small |
| | **Total** | **≈231 (+17 JWT ≈ 248)** | **≈600 KB** |

At a conservative 10 ms per query round trip to Neon, that is about 2.5 s of database time per user per campaign open, before counting the 3 dependent network waves.

## Performance

### CAMP-PERF-01 · P0 · Campaign shell and overview fetch the full battle history twice, and again on every focus or visibility change
- **Where:** `frontend/src/features/campaigns/routes/CampaignLayout.tsx:508-577`; `frontend/src/features/campaigns/components/overview/BattleActionPanel.tsx:58-102`; backend `backend/apps/battles/views/lifecycle.py:65-79` (`CampaignBattleListCreateView.get`) and `backend/apps/battles/views/shared.py:154-162` (`_battle_snapshot`)
- **What:**
  - Both components call `listCampaignBattles(campaignId)` on mount.
  - Both also register listeners for `focus`, `visibilitychange`, `online`, `battle:invite`, `battle:prebattle-opened` and `battle:status-updated`, and refetch on each.
  - The endpoint returns a full snapshot (battle + all participants with `unit_information_json`, `postbattle_json` and so on) for **every battle the user has ever been in**, including ended and canceled ones. It runs `_battle_snapshot` per battle: **2 + 2B queries**.
  - The frontend then throws away everything except the one resumable battle: `getResumableBattleForUser` drops `ended` and `canceled` (`features/battles/utils/battle-session.ts:19-41`).
  - Measured for user 1 (B=38): **78 queries and 102 KB per call**. Opening the overview makes 2 calls (156 queries, 68% of all queries for the screen).
  - Returning to the tab usually fires both `visibilitychange` and `focus`, so that is 2 events × 2 listeners = **4 calls = 312 queries and about 400 KB**.
  - The layout listener is active on every campaign page except battle pages (warband, items, settings and so on), not just the overview.
- **Impact:**
  - This is the single biggest per-user load in this area, and it grows with campaign age (every finished or canceled battle adds 2 queries to every call).
  - Players in a tabletop session constantly switch apps on their phones. With 5 players, each switch generates hundreds of Neon round trips on a single Render process, which matches the "slows down massively with multiple users" symptom.
- **Fix:**
  1. Backend: add a cheap "current battle" read: `GET /campaigns/:id/battles/?status=open`, or a dedicated `battles/current/` that filters `status__in=(inviting, prebattle, active, postbattle)` and the participant status. Prefetch participants in one query instead of calling `_battle_snapshot` in a loop. That is 2–3 queries no matter how much history there is. Fix the loop in `lifecycle.py` as well (see BATL).
  2. Frontend: own this state in one place. Lift it into `CampaignLayout` (or a `useCurrentBattle` hook/store) and pass `battleStates` and `refresh` to `BattleActionPanel` through the outlet context, so there is one fetch per trigger.
  3. Merge `focus` and `visibilitychange` into one throttled handler (for example, skip if the last refresh was under 30 s ago), and lean on the existing Pusher `battle:*` events for real-time changes.
- **Effort:** S (frontend dedupe + throttle) / M (backend endpoint) · **Confidence:** Confirmed (measured)

### CAMP-PERF-02 · P1 · The campaign UI waits on 5 full catalogues, refetched on every mount (3-wave waterfall)
- **Where:** `frontend/src/features/campaigns/routes/CampaignLayout.tsx:314-405` (prefetch effect), `579-581` (loading gate); `frontend/src/features/warbands/hooks/campaign/useCampaignItems.ts` (and the skills, spells, specials and races siblings)
- **What:**
  - `CampaignLayout` waits for `getCampaign`.
  - Then it calls `loadItems()`, `loadSkills()`, `loadSpells()`, `loadSpecials()` and `loadRaces()`, and shows "Preparing the campaign..." until **all five settle**.
  - Only then does it render the `<Outlet>`, so the overview's own 6–7 fetches can't start until the slowest catalogue (items: 14 queries, 170 KB) returns.
  - The direct `loadX()` calls ignore `cacheEntry.loaded`, so leaving for `/campaigns` and coming back refetches all five (about 30 queries, about 370 KB) even though the store already holds them.
  - The overview itself uses none of these catalogues.
- **Impact:**
  - Time to first meaningful paint on the most-used screen is roughly 3 × (network RTT + slowest request in the wave).
  - On a cold Render instance talking to remote Neon, this is the "it hangs on Preparing the campaign" experience.
  - Repeated re-entry multiplies the catalogue load per user.
- **Fix:**
  - Render the shell and `<Outlet>` as soon as `campaign` is loaded.
  - Let pages that need catalogues use the hooks with `auto: true` (they already skip when `cacheEntry.loaded`).
  - If prefetching is still wanted, do it in the background without gating and only when `!cacheEntry.loaded`.
  - Longer term, move these to TanStack Query (`staleTime` of minutes; the catalogues change rarely) and add `Cache-Control`/ETag on the catalogue endpoints (see CAT).
  - Optionally let the overview start its fetches in parallel with `getCampaign`; it only needs `campaignId`.
- **Effort:** M · **Confidence:** Confirmed (code + measured sizes)

### CAMP-PERF-03 · P1 · `/players/` has an N+1 on warband rating (4 + 3W queries) and is reused as a generic member list
- **Where:** `backend/apps/campaigns/views.py:583-597` → `backend/apps/warbands/serializers/warbands.py:95-119` (`WarbandSummarySerializer.get_rating`); callers: `useCampaignOverview.ts:104`, `routes/Encampments.tsx:90`, `features/warbands/components/trade/TradeInviteDialog.tsx:31`, `components/dialogs/CampaignPlayersDialog.tsx:47`
- **What:**
  - For each warband in the campaign, `get_rating` runs 3 queries (heroes, henchmen groups with a Count, hired swords). Measured: **13 queries at W=3**, so 28 at W=8 and 52 at W=16.
  - The "busy" lookup also loads full `BattleParticipant` rows (all JSON columns) plus the battle, just to read `user_id` and `battle.status`.
  - The rating is only needed by `StartBattleDialog`. Encampments and TradeInviteDialog fetch this endpoint just to get names for a dropdown.
- **Impact:** Linear growth on a screen every player opens. Each extra player adds 3 Neon round trips to every overview load, Encampments visit and trade invite.
- **Fix:**
  - Compute ratings for all warbands of the campaign in 3 grouped queries:

    ```python
    hero_rows = Hero.objects.filter(warband__campaign_id=cid, dead=False).values("warband_id", "xp", "large")
    # same for HenchmenGroup (annotate live henchmen count) and HiredSword, then aggregate in Python by warband_id
    ```

    Or move the rating calculation into a shared `warbands/services/rating.py` that accepts many warbands, and reuse it in `WarbandSummarySerializer`.
  - Change the busy query to `.values_list("user_id", "battle__status")`.
  - Give Encampments and TradeInviteDialog a lightweight `?fields=basic` variant (memberships + warband names, 2 queries).
- **Effort:** S–M · **Confidence:** Confirmed (measured SQL)

### CAMP-PERF-04 · P2 · Expanding a roster row costs 3 requests and about 38 queries just to show stat lines
- **Where:** `frontend/src/features/campaigns/hooks/useCampaignOverview.ts:249-253`
- **What:**
  - Expanding a player in the overview roster calls `listWarbandHeroes`, `listWarbandHenchmenGroups` and `listWarbandHiredSwords`, which are full detail endpoints with items, skills and specials.
  - Measured for warband 2: **14 + 11 + 13 = 38 queries** (and they grow per unit, see ROST).
  - The preview only renders name, type and the 10 stat fields (`RosterUnit`).
- **Impact:** Each expand costs about 40 Neon round trips. Players browsing the roster during a session add load out of proportion to what they see.
- **Fix:**
  - Add one `GET /warbands/:id/roster-stats/` (or `?view=stats` on the list endpoints) that uses `.only()` on stat columns across the 3 models: 3–4 queries, a few KB.
  - Optionally include it in `/players/` behind `?include=stats`.
- **Effort:** S · **Confidence:** Confirmed (measured)

### CAMP-PERF-05 · P2 · The overview always fetches data for the hidden bulletin tab
- **Where:** `frontend/src/features/campaigns/hooks/useCampaignOverview.ts:182-224`; `routes/CampaignOverview.tsx:32-37`
- **What:**
  - `overviewTabs` only contains "overview", so the Bulletin tab has no entry point; it can only be reached through `?tab=bulletin`.
  - The hook still fetches `top-killers` and `bulletin` on every overview mount.
- **Impact:** 2 wasted requests (4 queries + 2 JWT lookups) per overview visit for every user.
- **Fix:** Fetch them only when `activeTab === "bulletin"` (move both effects into `BulletinBoardTab` or gate on the tab), or remove the feature until it ships (see CAMP-UX-05).
- **Effort:** S · **Confidence:** Confirmed

### CAMP-PERF-06 · P2 · Repeated per-request membership and permission lookups; `/permissions/me` fetched separately by every page
- **Where:**
  - `backend/apps/campaigns/views.py:144-157` (`_get_campaign_for_user`: `get_membership`, then a second query that already joins the membership)
  - `views.py:168-170` (`_campaign_feature_enabled`: an extra settings query)
  - `permissions.py:16-24` (`has_campaign_permission`: an extra query for players)
  - Frontend `listMyCampaignPermissions` is called from `Encampments.tsx:69-77`, `Locations.tsx:68-76`, `HouseRules.tsx:98-106`, plus Items, Skills, Spells, Bestiary, HiredSwords and Warband (through `useCampaignMemberPermissions`)
- **What:** A typical player write to a feature endpoint costs, before doing any work:
  - JWT user (1)
  - `get_membership` (1)
  - feature flag (1)
  - permission check (1)

  Each page also makes its own `/permissions/me` round trip on mount, even though the role is already in the campaign payload.
- **Impact:** A constant 2–4 extra round trips per request, and one extra request per page navigation for every player.
- **Fix:**
  - Load the membership once with `select_related("role", "campaign__settings")` and `prefetch_related("permissions__permission")`, cache it on `request` (a small `CampaignMemberMixin.get_membership()`), and have `has_campaign_permission` read the prefetched codes.
  - Add `permissions: string[]` to `CampaignSerializer` for the detail view, expose it through the layout context, and delete the 9 per-page fetches.
  - Drop the redundant first query in `_get_campaign_for_user`.
- **Effort:** M · **Confidence:** Confirmed

### CAMP-PERF-07 · P2 · Chat runs a synchronous, unguarded Pusher HTTP call inside the request
- **Where:** `backend/apps/campaigns/views.py:1269-1276`; `backend/apps/realtime/services.py:154-179` (`send_campaign_chat_message`, `send_campaign_ping`)
- **What:**
  - After inserting the message (autocommit), the view calls `client.trigger(...)` synchronously, with no `try` and no `on_commit`.
  - A Pusher call from Render typically takes 50–300 ms and ties up the worker for that long.
  - If Pusher errors or times out, the view returns **500 even though the message was saved**. The client drops the user's input (CAMP-BUG-08); the message reappears on the next open.
  - The ping endpoint has the same pattern.
- **Impact:** Every chat message blocks a worker on an external network call. Under the dev-server or small-gunicorn setup in NOTES.md, a Pusher slowdown spreads to all users. Errors are reported for messages that actually went through.
- **Fix:**
  - Wrap the call in `transaction.on_commit(lambda: _safe_trigger(...))`, where `_safe_trigger` logs and swallows errors, and return 201 regardless.
  - Better, push it onto a background thread pool or queue shared with the other `send_*` helpers (see FE/INFRA for the cross-cutting Pusher handling).
- **Effort:** S · **Confidence:** Confirmed (code)

### CAMP-PERF-08 · P2 · House-rule effect sync rewrites every clone and remaps owned rows on every create, edit or delete, including text-only edits
- **Where:** `backend/apps/campaigns/views.py:1189-1195` (PATCH always re-syncs); `frontend/src/features/rules/components/EditHouseRuleDialog.tsx:86-90` (always resends `effect_key`); `backend/apps/items/services.py:85-128`, `131-187`, `218-264`
- **What:**
  - For `half_price_armour` with A base armour items (A=8 today), `_sync_generated_items_for_campaign` does, per item:
    - `clone.save()`
    - delete and bulk-create property links
    - delete availabilities (collector select + cascade delete)
    - create each availability
    - bulk-create restriction links
  - That is about **8 queries per item, so about 70 queries**, plus `_remap_campaign_owned_rows` with 4 SELECTs and **one UPDATE per owned row** (plus one extra SELECT per stash row).
  - Shields: about 38 queries plus remaps.
  - All of this runs in one `transaction.atomic()`, holding row locks on every remapped `HeroItem` and `WarbandItem` in the campaign.
  - Fixing a typo in the rule title re-runs the whole thing, and recreates availability rows with new IDs.
- **Impact:** A text edit costs about 1 s or more against Neon and briefly blocks concurrent item purchases in the same campaign. It is rare, but it is also pure waste.
- **Fix:**
  - In PATCH, skip both revert and sync when `previous_effect_key == rule.effect_key`.
  - In the services, diff availabilities instead of delete-and-recreate.
  - Use `bulk_update(rows, ["item", "cost"])` for remaps (3–4 statements total), and `bulk_create` for availabilities.
- **Effort:** S (skip-on-unchanged) / M (bulk rewrite) · **Confidence:** Likely (estimated from code; writes were not executed per review rules)

### CAMP-PERF-09 · P2 · `CampaignLayout` re-renders the active page on every store change and churns the chat socket
- **Where:** `frontend/src/features/campaigns/routes/CampaignLayout.tsx:109-118` (`useAppStore()` whole-store), `280-312` (`defaultTopBar` + `setMobileTopBar` effect), `595-603` (new outlet context object every render); `features/warbands/hooks/warband/useWarbandMobileTopBar.tsx:296-347` (replaces `rightSlot`)
- **What:**
  - `useAppStore` is a React Context holding the whole app state (`stores/app-store.tsx:81`). `CampaignLayout` reads it without selectors and builds a fresh `context={{...}}` object on every render.
  - So every store write re-renders the layout and the entire routed page: 5 cache writes during load, warband loading flags, notifications, battle session.
  - Notification changes also rebuild `defaultTopBar`, which calls `setMobileTopBar` and triggers another render.
  - On mobile, when the warband page enters edit mode it replaces `rightSlot`. That unmounts `CampaignChatMenu`, which closes its Pusher connection, then reopens it with a new auth POST when edit mode ends. The unread count resets each time.
- **Impact:** Wasted render work on low-end phones (the Warband page is a heavy tree), extra Pusher connections and auth requests, and an unreliable unread badge.
- **Fix:**
  - `useMemo` the outlet context.
  - Read only the slices needed (split the store or move to zustand with selectors; see FE).
  - Render the chat and notifications menus outside the swappable `rightSlot`: always mounted, with only their placement changing.
- **Effort:** M · **Confidence:** Likely (code reading; not profiled)

### CAMP-PERF-10 · P3 · Unbounded list endpoints that grow with campaign age
- **Where:** `backend/apps/campaigns/views.py:647-659` (battle history: all ended battles, full participant rows), `764-768` (pivotal moments), `802` (bulletin); completed trades on the overview
- **What:**
  - Query counts are constant (2–3), but payloads and DB transfer grow linearly.
  - The battle-history participant prefetch selects every column, including `unit_information_json`, `custom_units_json`, `selected_unit_keys_json` and the full `postbattle_json`, even though only `unit_results` and `exploration` are read.
  - Today this is 41 participant rows, about 32 KB on the DB side and 6 KB of JSON.
- **Impact:** Low today. A 30-game, 8-player campaign will grow these responses into hundreds of KB on every overview load.
- **Fix:**
  - Add `.defer("unit_information_json", "custom_units_json", "selected_unit_keys_json")` to the participant prefetch.
  - Paginate battle history and pivotal moments (newest 20 + "Load more", using `?before=`), and cap the bulletin at 50.
- **Effort:** S · **Confidence:** Confirmed (code), low current impact

### CAMP-PERF-11 · P3 · No composite index for chat and bulletin pagination
- **Where:** `backend/apps/campaigns/models.py:202-219` (`CampaignMessage`, ordering `-created_at`); `views.py:1245-1252`; DB indexes: only `campaign_message(campaign_id)` and `campaign_bulletin(campaign_id)`
- **What:** `GET messages/?before=<id>` filters on campaign and `id < before` but orders by `-created_at`. Postgres has to sort every matching message for the campaign on each page.
- **Impact:** Negligible now (2 messages). It degrades for chatty campaigns.
- **Fix:** Order by `-id` (which matches the `before=id` cursor) and add `models.Index(fields=["campaign", "-id"])` to both models.
- **Effort:** S · **Confidence:** Confirmed (indexes inspected)

## Bugs

### CAMP-BUG-01 · P1 · Owner's "Kick" always fails with 403
- **Where:** `frontend/src/features/campaigns/components/settings/MembersCard.tsx:198-207`, `279-288`; `hooks/use-campaign-settings.ts:256-281` (`deleteWarband(kickTarget.warband_id)`); `backend/apps/warbands/views/warbands.py:266-268`
- **What:**
  - "Kick" only appears for the owner (`canKickPlayers={isOwner}`) and only on player rows.
  - It calls `DELETE /warbands/:id/`, but the backend only lets the warband's own user delete it (`if warband.user_id != request.user.id: return 403`).
  - The owner is never the user behind a player row, so the action can never succeed. It shows "Forbidden" in the dialog.
- **Impact:** A visible, broken moderation action, and owners have no way to remove an abandoned warband.
- **Fix:**
  - Decide what "kick" means (see CAMP-UX-02).
  - If it means "delete their warband", let the campaign owner (or `manage_warbands`) delete in `WarbandDetailView.delete`. Spell out the cascade, because `BattleParticipant.warband` is `CASCADE`, so the warband also disappears from battle history (see ROST/BATL).
  - Otherwise remove the button.
  - Add an API test.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-BUG-02 · P1 · Admins are offered "Start campaign" but the backend only allows the owner
- **Where:** `frontend/src/features/campaigns/hooks/useCampaignOverview.ts:226` (`canStartCampaign = owner || admin`); `backend/apps/campaigns/views.py:454-459` (PATCH requires `is_owner`)
- **What:** An admin sees the button, confirms, and gets "Forbidden" in the dialog.
- **Impact:** A confusing dead end for admins, who are often the person running the session.
- **Fix:** Either allow owner and admin to set `in_progress` (split the PATCH permission per field), or gate the button to `role === "owner"`. Pick one and add a test for it.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-BUG-03 · P1 · Starting the campaign doesn't stick; the button comes back after navigating away
- **Where:** `frontend/src/features/campaigns/hooks/useCampaignOverview.ts:84-92`, `322-344`; `routes/CampaignLayout.tsx:105`, `330-334`
- **What:**
  - `handleStartCampaign` sets local `isUnderway` and the store's `campaignStarted`, but never calls `setCampaign` with the PATCH response.
  - The layout's `campaign.in_progress` stays `false`.
  - After navigating to any other page and back, `useCampaignOverview` re-initialises `isUnderway` from `campaign.in_progress` (false). "Start campaign" reappears and the "Start battle" panel disappears until a full reload.
  - Other members never learn about the change until they reload (CAMP-UX-04).
  - The flag lives in two places (store `campaignStarted` and `campaign.in_progress`) and they drift apart.
- **Impact:** The owner thinks the start failed, and players can't start battles.
- **Fix:**
  - Pass `setCampaign` from the outlet context into the hook and call `setCampaign(updated)` with the response.
  - Derive `campaignStarted` from `campaign.in_progress` instead of storing it separately (`ExperienceBar` reads the store copy).
- **Effort:** S · **Confidence:** Confirmed

### CAMP-BUG-04 · P1 · Permission codes have drifted between backend checks, the seed list, the seed command and the UI
- **Where:**
  - Backend checks: `backend/apps/spells/views.py:83,104` (`manage_spells`), `backend/apps/special/views.py:83,104` (`manage_features`)
  - Seed: `backend/apps/campaigns/views.py:84-93` (`PERMISSION_SEED`, which has neither)
  - `MembershipPermissionsUpdateSerializer` + `views.py:1082-1083` silently drop unknown codes
  - UI list `frontend/src/features/campaigns/constants/campaign-settings.ts:3-34` is missing `manage_encampments` and `manage_bestiary`
  - Seed command `backend/apps/campaigns/management/commands/seed_campaign_users.py:23-31` is missing `manage_encampments`
- **What:**
  - `manage_spells` and `manage_features` exist neither in the DB (checked: 8 codes) nor in the seed, so no player can ever be granted spell or special edit/delete rights. The grant API drops the code even if sent.
  - The backend does enforce `manage_encampments` and `manage_bestiary`, and the Encampments, Bestiary and Hired Swords pages check them on the client. But `MembersCard` builds its checkbox list from the hard-coded `permissionOptions`, so owners can't grant them through the UI.
  - `GET /permissions/` already returns the real list, but nothing uses it.
- **Impact:** Delegation is broken for 4 of the 10 permission concepts, and owners and admins have to do all of that work themselves.
- **Fix:**
  - One source of truth: move `PERMISSION_SEED` to `apps/campaigns/constants.py` and add `manage_spells` and `manage_features` (or change those views to `manage_skills` or `manage_items`, whichever is intended).
  - Seed via a data migration.
  - Drive `MembersCard` from `listCampaignPermissions` (add a `description` field to the model or constant).
  - Add a test that asserts every code passed to `has_campaign_permission` anywhere exists in the constant (a grep-based unit test is enough).
- **Effort:** S–M · **Confidence:** Confirmed (DB + code)

### CAMP-BUG-05 · P2 · Join race: the seat limit can be exceeded, and joining twice concurrently returns 500
- **Where:** `backend/apps/campaigns/views.py:519-556`
- **What:**
  - The view checks `exists()`, then `count()`, then `create()`, with no transaction and no lock.
  - Two users joining at the same time for the last seat both pass the count check, and the campaign ends up over `max_players`.
  - The same user joining from two tabs or devices at once: both pass `exists()`, the second `create` hits `unique_campaign_membership` and raises `IntegrityError`, which returns 500.
  - Membership and its default permission are written without a transaction.
- **Impact:** Rare, but it corrupts the seat invariant and shows an error page. Likely when a join code is shared in a group chat and everyone joins at once.
- **Fix:**

  ```python
  with transaction.atomic():
      campaign = Campaign.objects.select_for_update().select_related("settings").filter(join_code=code).first()
      ...count + create...
  ```

  Catch `IntegrityError` and return 400 "Already a member".
- **Effort:** S · **Confidence:** Confirmed (code reading; not reproduced concurrently)

### CAMP-BUG-06 · P2 · Removing a member leaves orphaned battles, trades, notifications and ownership behind
- **Where:** `backend/apps/campaigns/views.py:1126-1145`; `backend/apps/notifications/models.py:22` (`campaign_id` is a plain int); `frontend/src/features/campaigns/components/settings/RemoveMemberDialog.tsx:22-30`
- **What:** `CampaignMemberRemoveView` only deletes the membership row. Afterwards:
  - **Warband:** stays in the campaign. It still appears in `/warbands/`, top killers and battle history, but disappears from the roster and members list.
  - **Battles:** any open battle they are in is stuck. They can no longer call battle endpoints (`get_membership` returns 404), and the other participants can't finish, so the owner has to find and cancel it (CAMP-UX-01).
  - **Trades and notifications:** pending trade requests and unresolved battle-invite or trade notifications remain. Acting on them returns 404.
  - **Encampments:** encampments they own keep `owner_id` pointing at a non-member.
  - **Chat:** their existing Pusher chat subscription keeps receiving messages until they reconnect.
  - **Dialog text:** the confirmation says "This action cannot be undone", but rejoining with the code silently restores the membership and reattaches the old warband (unique campaign + user).
  - Deleting a whole campaign also leaves `Notification` rows with that `campaign_id` behind.
- **Impact:** Stuck battles (the exact "stale active battle" symptom in NOTES.md), ghost warbands, and dead notifications for other users.
- **Fix:** Turn removal into a service that runs in one transaction:
  - cancel their open battles (`_cancel_battle_for_all_participants`, mode `member_removed`)
  - decline open trades
  - `resolve_notifications_for_reference` for invites involving them, and delete their own unresolved notifications for the campaign
  - null `CampaignEncampment.owner`
  - archive or keep the warband by explicit choice, with a checkbox in the dialog: "Also delete their warband"

  Also update the dialog text, and add `Notification.objects.filter(campaign_id=...).delete()` to campaign deletion.
- **Effort:** M · **Confidence:** Confirmed (code)

### CAMP-BUG-07 · P2 · House-rule clones are editable and deletable as custom items; stale-clone cleanup cascades owned items; purchase costs get overwritten
- **Where:** `frontend/src/features/items/routes/Items.tsx:776` (Edit shown for any `item.campaign_id`); `backend/apps/items/views.py:140-195` (PATCH/DELETE only check `campaign_id` + `manage_items`); `backend/apps/items/services.py:257-262` (stale clone delete), `131-187` (remap writes `cost`), `200-212`
- **What:**
  1. Generated clones look like ordinary campaign items, so a `manage_items` user can edit them (overwritten silently on the next sync) or delete them. `Item` deletion **cascades** to `HeroItem`, `HenchmenGroupItem`, `HiredSwordItem` and `WarbandItem`, so every warband loses that armour.
  2. `_sync_generated_items_for_campaign` deletes clones whose source is no longer in the base armour or shield set (for example, a catalogue item re-subtyped) **before** remapping owned rows back. That also cascades and deletes owned items.
  3. The remap overwrites each owned row's stored purchase `cost` with the current price. It is halved on enable and reset to the base price on revert, and becomes `None` for any source with 0 or 2+ availabilities (`_single_availability_cost`). Historical purchase prices used by sell and value displays are lost.
  4. Base catalogue changes (a price fix, a new armour) never reach existing clones until someone edits the rule.
  5. There is no unique constraint on `(campaign, generated_effect_key, source_item)`.
- **Impact:** Potential silent item loss across a whole campaign from one click, and incorrect ledger and sale values.
- **Fix:**
  - Return 403 on PATCH/DELETE when `generated_effect_key` is set, and hide Edit in the UI (expose `generated_effect_key` in `ItemSerializer`).
  - In stale cleanup, remap owned rows to `source_item` first.
  - Stop rewriting `cost` on remap (keep the purchase price), or store an explicit `purchase_cost`.
  - Add the unique constraint.
  - Re-sync clones when base items change (signal or seeder hook).
- **Effort:** M · **Confidence:** Confirmed (code)

### CAMP-BUG-08 · P2 · A failed chat send silently loses the typed message
- **Where:** `frontend/src/features/realtime/components/CampaignChatMenu.tsx:122-141`
- **What:** `handleSend` clears the draft before the request and has `try/finally` with no `catch`. Any of these make the message vanish with an unhandled promise rejection and no feedback:
  - a 429 from the 12/min throttle
  - a network error
  - the Pusher 500 (CAMP-PERF-07)
- **Impact:** Lost messages during busy sessions, and users can't tell whether a message went through.
- **Fix:** Keep the draft until success, or restore it in `catch`, and show an inline error ("Slow down, try again in a few seconds" for 429).
- **Effort:** S · **Confidence:** Confirmed

### CAMP-BUG-09 · P2 · "Common Rules" partial failures cause duplicates; concurrent adds can create duplicate clone sets
- **Where:** `frontend/src/features/rules/components/CommonRulesSheet.tsx:121-145`; `backend/apps/campaigns/views.py:1160-1172`
- **What:**
  - Selected rules are posted in parallel with `Promise.all`. If one fails, the error is shown, but rules that **were** created are not added to the list (`onApplied` never runs).
  - The user retries and gets duplicate rules, because de-duplication is client-side by title only.
  - Two managers adding "Half Price Armour" at the same moment both see no existing clones and both create a clone per armour item. No constraint stops this, and `existing_clones` then keys on only one of them.
- **Impact:** Duplicate rules and duplicate item clones (two "Heavy Armour" entries in the shop).
- **Fix:**
  - Use `Promise.allSettled` and merge the fulfilled results.
  - Make the backend idempotent per `(campaign, effect_key)` (return the existing rule, or a partial unique index where `effect_key IS NOT NULL`).
  - Add the clone uniqueness constraint (CAMP-BUG-07).
- **Effort:** S · **Confidence:** Confirmed (partial failure) / Likely (race)

### CAMP-BUG-10 · P3 · Multi-step writes aren't atomic, and create-time numbers aren't validated
- **Where:** `backend/apps/campaigns/views.py:384-426` (create: Campaign → Settings → item settings → membership), `serializers.py:120-133`, `views.py:1085-1091` (permissions PUT: delete then bulk_create), `views.py:509-511` (starting-gold loop over warbands)
- **What:**
  - `CampaignCreateSerializer` validates only `max_players`. Sending `max_heroes: -1` or `40000` gets past DRF, then the `CampaignSettings` insert fails the positive or smallint check and returns **500 after the `Campaign` row is committed**. That leaves an orphan campaign with no settings and no owner.
  - Permission replacement and the starting-gold rewrite can also half-apply on error.
  - `ATOMIC_REQUESTS` is not enabled.
- **Impact:** Orphan rows and inconsistent permission sets. This is reachable through the API, not the UI.
- **Fix:** Wrap these views in `transaction.atomic()`, and add `min_value`/`max_value` to the create serializer matching the model fields (also `max_players` 2–16).
- **Effort:** S · **Confidence:** Confirmed (code)

### CAMP-BUG-11 · P3 · `in_progress` is enforced only by the UI, and the start-confirmation text overstates it
- **Where:** `backend/apps/campaigns/views.py:472-473` (the only server use); `frontend/src/features/campaigns/routes/CampaignOverview.tsx:200-203`; `features/warbands/components/shared/unit_details/ExperienceBar.tsx:38`
- **What:**
  - No backend endpoint checks `in_progress`. Battles can be created and XP adjusted through the API before the start.
  - The dialog says starting will "lock in the roster", but joining and warband edits stay open.
- **Impact:** The UI makes promises the system doesn't keep. Minor, since players are friends.
- **Fix:** Either enforce the flag (battle create, report result, XP endpoints) or change the text to "This enables battles and experience tracking".
- **Effort:** S · **Confidence:** Confirmed

### CAMP-BUG-12 · P3 · Changing starting gold rewrites "the oldest trade" in every warband, with no log or refresh
- **Where:** `backend/apps/campaigns/views.py:509-511` → `backend/apps/warbands/utils/trades.py:59-75`; `frontend/src/features/campaigns/components/settings/CampaignLevelUpSettingsCard.tsx:159-181`
- **What:**
  - `upsert_starting_gold_trade` picks `WarbandTrade.objects.filter(warband=…).order_by("created_at").first()` without filtering on `action="Starting Gold"`, and overwrites its action, description and price.
  - It is called for every warband whenever the owner saves starting gold, including mid-campaign, with no confirmation and no `WarbandLog` entry.
  - The current user's warband in the store isn't refreshed, so their treasury shows the old gold until reload.
- **Impact:**
  - Retroactive, silent treasury changes for every player.
  - If the first ledger row ever isn't the starting-gold row (for example, a future delete-trade feature), an unrelated purchase gets rewritten.
- **Fix:**
  - Filter on `action="Starting Gold"` (or add an explicit flag).
  - Log a warband event.
  - Confirm in the UI when `campaign.in_progress` is true ("This changes every warband's treasury").
  - Reload the warband summary after saving.
- **Effort:** S · **Confidence:** Confirmed (code)

## Code quality

### CAMP-CQ-01 · P2 · `views.py` is 1277 lines with 31 copies of the membership boilerplate
- **Where:** `backend/apps/campaigns/views.py` (27 view classes and 12 helpers); `membership = get_membership(request.user, campaign_id)` appears 31 times and `return Response({"detail": "Not found"}, status=404)` 50 times
- **What:**
  - Payload builders (`_battle_history_participant_payload`, `_campaign_top_killers_payload`), house-rule orchestration, role seeding and join-code generation all live next to the HTTP views.
  - Each method repeats the membership → 404, role → 403, feature → 404 checks inline.
- **Fix:** Split as follows (target under 300 lines each):
  - `views/campaigns.py` (list, create, detail, join)
  - `views/overview.py` (players, battle history, pivotal, top killers) with the payload builders moved into `selectors.py`
  - `views/members.py` (members, permissions, role, remove, active battles)
  - `views/content.py` (house rules, bulletin, locations, encampments)
  - `views/realtime.py` (messages, pings)
  - `services/membership.py` (roles, permissions, join code, the removal service from CAMP-BUG-06)

  Add a `CampaignMemberView(APIView)` base with `get_membership()` (cached on the request; see PERF-06) and declarative `required_role` / `required_permission` / `feature_flag` attributes checked in `initial()`.
- **Effort:** M · **Confidence:** Confirmed

### CAMP-CQ-02 · P2 · `CampaignLayout.tsx` is 724 lines doing 7 jobs, with duplicated blocks
- **Where:** `frontend/src/features/campaigns/routes/CampaignLayout.tsx`
- **What:** It handles:
  - campaign loading (316-343)
  - catalogue orchestration (345-454, about 110 lines of pass-through)
  - own warband loading (456-489)
  - battle-session tracking (491-577)
  - mobile top bar config (147-312)
  - mobile and desktop shells (607-723)
  - nav item config (672-684)

  Duplication:
  - `settingsButton` (178-192) is unused.
  - The `NotificationsMenu` props are duplicated (208-235 vs 705-716).
  - The "Rejoin" button styles are copied from `BattleActionPanel.tsx:199-215` (layout 250-279).
  - Battle-session refresh and listener logic is duplicated between the layout (508-577) and `BattleActionPanel.tsx:58-102` (the root of PERF-01).
  - `defaultMobileTitle` lists `campaign?.name` as a dependency it doesn't use (177).
- **Fix:** Extract:
  - `useCampaign(id)`
  - `useCampaignLookups(campaignId)` (or delete it after PERF-02)
  - `useOwnWarband(campaignId)`
  - `useCurrentBattle(campaignId)`, shared with `BattleActionPanel`
  - `useCampaignMobileTopBar()`
  - `<CampaignMobileShell>` and `<CampaignDesktopShell>`
  - a `<CampaignNotificationsMenu>` wrapper and a `RejoinBattleButton` component
  - `getCampaignNavItems(campaign)` next to `getCampaignSectionTabs`
- **Effort:** M · **Confidence:** Confirmed

### CAMP-CQ-03 · P2 · Roles and permissions are defined in 3 places, seeded lazily on the request path
- **Where:** `backend/apps/campaigns/views.py:78-132` and `management/commands/seed_campaign_users.py:17-61` (the same `ROLE_SEED`, `PERMISSION_SEED`, `_ensure_roles`, `_ensure_permissions`, `_generate_join_code` and `_unique_join_code`, already drifted: the command lacks `manage_encampments`); `frontend/src/features/campaigns/constants/campaign-settings.ts` (third copy, drifted); `views.py:986` (`_ensure_permissions()` called with its result discarded); `views.py:1025-1029` (re-queries what `_ensure_permissions` just returned)
- **What:**
  - Roles and permissions are created with `get_or_create` inside `lru_cache` functions on first use per process, which adds 8–11 queries on the first request after each deploy or restart.
  - Two processes starting at once can race into an `IntegrityError` on the unique code.
  - Tests need `cache_clear()` calls (`test_campaigns_api.py:48-49`, `spells/tests/test_spells_api.py:16`).
- **Fix:**
  - Put the constants in `apps/campaigns/constants.py` and create a data migration that upserts the roles and permissions.
  - Keep a cheap `get_role(slug)` cache.
  - Make the seed command import from the shared module.
  - Have the frontend read `/permissions/` (CAMP-BUG-04).
- **Effort:** S · **Confidence:** Confirmed

### CAMP-CQ-04 · P2 · `CampaignSettings.tsx` breaks the Rules of Hooks
- **Where:** `frontend/src/features/campaigns/routes/CampaignSettings.tsx:43-60` (`useState`, `useMemo`, `useEffect` after the `if (!campaign) return` and NaN early returns), `154-160` (`canManageSettings ? useCampaignSettings(...) : emptySettings`), `70-111` (a 40-line stub copying the hook's return shape)
- **What:**
  - Hooks are called conditionally. Today the branch is stable (`campaign` is always set under the layout, and the role doesn't change), but any future refresh that changes `campaign.role` (for example a demotion with CAMP-UX-04) would throw "Rendered more/fewer hooks".
  - `react-hooks/rules-of-hooks` should flag this.
- **Fix:**
  - Always call `useCampaignSettings({ campaignId, campaignRole, enabled: canManageSettings, … })` and let the hook no-op when disabled.
  - Move the early returns below all hooks.
  - Delete `emptySettings`.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-CQ-05 · P2 · Hand-rolled fetch state duplicated across the overview, Locations, Encampments and House Rules
- **Where:**
  - `frontend/src/features/campaigns/hooks/useCampaignOverview.ts:94-224`: 6 near-identical 20-line effects (set loading, clear error, call, set data, map `Error` to message, finally stop loading), plus 18 `useState` hooks
  - `routes/Locations.tsx` (339 lines) and `routes/Encampments.tsx` (314 lines) share the same scaffolding: permissions effect, flag-gated load, form open/close/scroll, submit, disabled card
  - The permissions fetch is duplicated in `Encampments.tsx:69-77`, `Locations.tsx:68-76` and `HouseRules.tsx:98-106`, even though `useCampaignMemberPermissions` exists
  - The error-message pattern `errorResponse instanceof Error ? … : "Unable to …"` appears more than 20 times in this area
- **What:** Lots of boilerplate, inconsistent behaviour (some places guard against unmount, most don't), and no caching or dedupe, which is the root enabler of PERF-01 and PERF-02.
- **Fix:**
  - Adopt TanStack Query (`useQuery(["campaign", id, "players"], …)`). That gives caching, dedupe, focus refetch with `staleTime`, and invalidation after mutations. Or add a small `useAsyncResource(fetcher, deps)` plus a `getErrorMessage(err, fallback)` helper.
  - Extract a `CampaignRecordsPage` scaffold (header, disabled state, list, inline form) used by Locations and Encampments.
  - Use `useCampaignMemberPermissions` everywhere, or the campaign payload permissions (PERF-06).
- **Effort:** M · **Confidence:** Confirmed

### CAMP-CQ-06 · P3 · Duplicated blocks in repricing services and top-killers
- **Where:**
  - `backend/apps/items/services.py:14-29` vs `32-47` (armour vs shield prefetch: identical except `subtype`)
  - `services.py:85-106` vs `108-128` (discounted vs matching availabilities: identical except the cost expression)
  - `services.py:134-165` (three identical remap loops for hero, henchmen and hired-sword items)
  - `backend/apps/campaigns/views.py:250-326` (three 25-line annotate/values blocks for heroes, hired swords and henchmen)
- **Fix:**
  - `_prefetched_base_items(subtype)`
  - `_sync_availabilities(source, clone, cost_fn)`
  - loop over `[(HeroItem, "hero__warband__campaign_id"), …]` with `bulk_update`
  - `_killer_rows(model, kind, name_prefix, unit_type_field, warband_path)` for top killers
- **Effort:** S · **Confidence:** Confirmed

### CAMP-CQ-07 · P3 · Dead code and dead API surface
- **Where:**
  - `CampaignSettings.locations` (`models.py:114`, `serializers.py:43,74,101`; never written, never read by the frontend, superseded by `enable_locations` in migration 0011)
  - `Campaign` settings proxy properties (`models.py:37-101`): only the `max_players` getter is used (`views.py:535`); the setters perform hidden `get_or_create` + save
  - `max_games` (stored, never used or shown)
  - `CampaignMembershipSerializer` and `CampaignSettingsSerializer` (unused)
  - `CampaignPingView` (`views.py:1216-1232`) + `createCampaignPingSocket` (`frontend/src/lib/realtime.ts:81-138`): no callers, and the endpoint relays an unvalidated, unbounded `payload` to every member
  - `CampaignWarbandsView` (`views.py:958-973`, which also prefetches `restrictions` that `WarbandSerializer.get_restrictions` never reads) and `CampaignPermissionsView`: no frontend callers
  - `settingsButton` in `CampaignLayout.tsx:178-192`
  - the empty `onOpenChange` branch in `CampaignOverview.tsx:192-197`
  - the `warbands` placeholder route (`app/routes/routes.tsx:76`)
- **Fix:**
  - Remove them, or wire them up deliberately.
  - Drop `locations` with a migration.
  - If pings are kept for a future feature, validate the payload size and shape.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-CQ-08 · P3 · Campaign views import private helpers from the battles app
- **Where:** `backend/apps/campaigns/views.py:32-37` (`_cancel_battle_for_all_participants`, `_response_with_snapshot`, `_serialize_battle`, `_serialize_participant` from `apps.battles.views.shared`)
- **What:** There is cross-app coupling to underscore-private view helpers, and `battles/views/shared.py` imports `campaigns.pivotal_moments` inside a function to dodge a cycle.
- **Fix:** Move these into `apps/battles/services.py` and `serializers.py` as public functions, and have both apps import from there.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-CQ-09 · P3 · House-rule effect keys are untyped free text, with the catalogue only in the frontend
- **Where:** `backend/apps/campaigns/serializers.py:259-262` (`effect_key` accepts any string up to 80 characters); `frontend/src/features/rules/routes/HouseRules.tsx:59` and `components/CommonRulesSheet.tsx:33-88` (keys and rule texts hard-coded); DB contains a legacy `ranged_limit` key with no effect
- **Fix:**
  - Add an `EFFECT_KEYS` registry on the backend (choices + metadata such as `affects_items`).
  - Validate it in the serializer.
  - Expose the common rules through an endpoint so the frontend stops duplicating them.
  - Write a migration that nulls unknown keys.
- **Effort:** S · **Confidence:** Confirmed

## UI / UX

### CAMP-UX-01 · P2 · Stale active battles are hard to find and judge
- **Where:** `frontend/src/features/campaigns/routes/CampaignSettings.tsx:255-262`; `components/settings/ActiveBattlesTable.tsx:251,289`
- **What:**
  - The only tool is an owner-only table under Settings → "Campaign" tab.
  - It shows `created_at` but no last-activity time, so a battle abandoned 6 months ago looks the same as one started an hour ago.
  - Admins can't see it.
  - The warband's "In Active Battle" badge (and the busy flags in Start Battle) offers no path to it.
  - Live-run observation: battle #40 had been active since 2026-04-22.
- **Fix:**
  - Show "last activity" (`max(participant.last_seen_at, battle.updated_at)`) and highlight battles idle for more than 24 h.
  - Add an owner/admin banner on the overview ("1 battle idle for 5 days: Review").
  - Let admins cancel.
  - Link from the "In Active Battle" badge.
  - Pair with server-side auto-expiry (BATL).
- **Effort:** M · **Confidence:** Confirmed

### CAMP-UX-02 · P2 · Membership lifecycle gaps: no ownership transfer, no leaving, confusing remove and kick
- **Where:** `backend/apps/campaigns/serializers.py:247-248` (role choices are `admin`/`player` only), `views.py:1112-1113`, `1141-1142`; `frontend/src/features/campaigns/components/settings/MembersCard.tsx:188-209`, `RemoveMemberDialog.tsx`, `CampaignSettings.tsx:327-350`
- **What:**
  - Ownership can never be transferred, so the campaign is orphaned if the owner drops out.
  - Players have no "Leave campaign".
  - Admins can't be removed until demoted, and nothing says so.
  - "Remove" (deletes the membership, keeps the warband) and "Kick" (deletes the warband, keeps the membership) read as backwards, and their dialogs don't explain the consequences.
- **Fix:**
  - Add `POST members/:user/transfer-ownership/` (swap owner ↔ admin in one transaction).
  - Add `DELETE members/me/` for leaving (reusing the CAMP-BUG-06 service).
  - Rename the actions to "Remove from campaign" and "Delete warband", with consequence text and an optional "also delete warband" checkbox.
  - Show a hint on admin rows.
- **Effort:** M · **Confidence:** Confirmed

### CAMP-UX-03 · P2 · Locations and Encampments are incomplete compared with `LOCATIONS_AND_ENCAMPMENTS_PLAN.md`
- **Where:** `backend/apps/campaigns/models.py:272-308`; `views.py:844-955`; `frontend/src/features/campaigns/routes/Locations.tsx`, `Encampments.tsx`; `components/settings/CampaignControlCard.tsx:162`
- **What:**
  - Missing against the plan:
    - delete endpoints and buttons for both (a typo'd record can't be removed)
    - the encampment `explorable` state ("Encampments can be marked explorable" is an acceptance criterion)
    - action-log entries
    - created/updated timestamps
  - The "Enable locations" toggle text promises "trading in the Marketplace, Infamous Haunts and Cursed Marshes", but nothing implements it.
  - The plan's open decisions (what disabling does to existing data, whether to split permissions) are undocumented. In practice, disabling hides everything and returns 404 on reads.
- **Fix:**
  - Add a `DELETE` detail endpoint (same permission) with a confirm dialog.
  - Add `explorable` (bool + `explored_at`) with a separate "Mark explorable" action that writes a `WarbandLog` or campaign log entry.
  - Add timestamps.
  - Rewrite the toggle text to match what is implemented.
  - Record the decisions in the plan doc.
- **Effort:** M · **Confidence:** Confirmed

### CAMP-UX-04 · P3 · Campaign-level changes don't reach other members until they reload
- **Where:** `frontend/src/features/campaigns/routes/CampaignLayout.tsx:316-343` (fetch once per mount)
- **What:** When the owner starts the campaign, toggles features, changes item settings, or promotes or demotes someone, other members keep the old `campaign` until a hard reload. They keep missing the Start Battle button, show stale nav items, or offer stale role-based actions.
- **Fix:** Refetch `GET /campaigns/:id/` (2 queries) on focus with a 60 s throttle, or broadcast `campaign.updated` on the existing campaign Pusher channel and refetch on receipt.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-UX-05 · P3 · The bulletin tab is half shipped
- **Where:** `frontend/src/features/campaigns/routes/CampaignOverview.tsx:32-37`, `260`
- **What:**
  - The bulletin board, "wanted poster" and "most dangerous" table exist and are tested, but the tab isn't in `overviewTabs`.
  - Through `?tab=bulletin` it renders while the header shows "Overview" as active.
  - Notes can only be deleted by their author (see UX-08).
- **Fix:** Decide: add the tab (and lazy-load its data, PERF-05) or remove the code.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-UX-06 · P3 · Campaign deletion is labelled inconsistently and understates what it destroys
- **Where:** `frontend/src/features/campaigns/components/settings/DeleteCampaignCard.tsx:36,47,52`; `backend/apps/campaigns/views.py:440-452`
- **What:**
  - The heading says "Delete campaign", the button says "Close campaign", and the dialog says "CONFIRM CLOSURE".
  - "Close" suggests archiving, but the action hard-deletes every warband, battle, trade, log and item clone (cascade).
- **Fix:**
  - Use "Delete campaign" consistently and list what will be deleted.
  - Consider a soft "Archive" (an `archived_at` flag) as the default, with hard delete as a separate step.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-UX-07 · P3 · Accessibility issues in campaign components
- **Where:**
  - `components/campaigns/CampaignCard.tsx:74` (`role="link"` div containing buttons)
  - `components/overview/RosterTable.tsx:181` (`role="button"` row containing a `<Link>`)
  - `components/layout/CampaignSidebar.tsx:47-60` (`<NavLink>` wrapping `<Button>`)
  - `components/settings/MembersCard.tsx:303-341` (permission dropdown portal: no Escape key, no focus move or return, appended at the end of `body`)
  - `features/realtime/components/CampaignChatMenu.tsx:207-220` (chat input has only a placeholder, no label)
- **Fix:**
  - Stop nesting interactive elements: use a real `<a>`/`Link` on the card title and a dedicated expand button in the row, and style the `NavLink` itself.
  - Use the existing Radix `Popover` or `DropdownMenu` for permissions.
  - Add `aria-label="Message"` to the chat input.
- **Effort:** S · **Confidence:** Confirmed

### CAMP-UX-08 · P3 · No moderation for shared content
- **Where:** `backend/apps/campaigns/views.py:837-838` (bulletin delete is author-only); chat has no delete at all
- **What:** The owner and admins can't remove offensive or mistaken bulletin notes or chat messages in their own campaign.
- **Fix:** Allow owner and admin to delete bulletin entries, and add `DELETE messages/:id/` (author, owner or admin) plus a Pusher `chat.deleted` event.
- **Effort:** S · **Confidence:** Confirmed

## Security

### CAMP-SEC-01 · P3 · Email addresses are shown to every campaign member when a user has no display name
- **Where:** `backend/apps/campaigns/views.py:628` (players: `first_name or email`), `815` and `1268` (bulletin and chat `username = first_name or get_username()`, and `username == email` per `users/serializers.py:31`), `serializers.py:277` (encampment `owner_name`), `backend/apps/realtime/services.py:58` (ping label always `get_username()`)
- **What:**
  - Registration makes the name optional (`users/serializers.py:8`).
  - For such users, every campaign member sees their email in the roster, battle history, chat, bulletin, encampments and the start-battle picker. The chat and bulletin copies are stored permanently in `username` columns.
  - Admins legitimately see emails in the members list. Players shouldn't.
- **Fix:**
  - Fall back to something like the email's local part or "Player #id" in one `display_name(user)` helper (the battles app already has `_display_name`).
  - Require a name at signup, or prompt on first campaign join.
- **Effort:** S · **Confidence:** Confirmed (all current users have names, so nothing is exposed in this DB today)

## Test plan

### Existing coverage

**Backend**
- `backend/apps/campaigns/tests/test_campaigns_api.py` (36 tests):
  - Create: owner membership, feature defaults, Marienburg flags, item settings
  - PATCH: features and item settings
  - House-rule effects (8): create, idempotent, remap, delete restore, stash merge, shields create/remap/delete
  - List scoping
  - Join: max players
  - Players: membership, busy flags
  - Warband restriction behaviour (4)
  - Battle-history aggregates
  - Pivotal moments: only persisted rows
  - Top killers (3)
  - Bulletin flow, validation, ownership (3)
  - Encampments and locations: flows plus feature/permission gating (4)
  - Member permissions: admin or owner required (1)
- `backend/apps/battles/tests/test_battles_api.py:1900, 2027` (pivotal generation), `:2671-2740` (active-battles list and owner cancel)
- `backend/apps/core/tests/test_rate_limiting.py:311-353` (chat and ping throttles)

**Frontend**
- `features/campaigns/components/overview/RosterTable.test.tsx` (3), `UnitsTable.test.tsx` (1), `BulletinBoardTab.test.tsx` (4)
- `components/settings/FeedbackReportCard.test.tsx` (5), `WarbandSettingsCard.test.tsx` (2)
- `features/warbands/hooks/campaign/__tests__/useCampaignCatalogs.test.tsx`

**Not covered at all**
- Backend: role change, member removal, campaign delete, joining twice or concurrently, the house-rule PATCH path, chat GET pagination and POST, `/permissions/` and `/permissions/me`, starting-gold rewrite, owner-only PATCH enforcement.
- Frontend: `CampaignLayout`, `useCampaignOverview`, `CampaignSettings`/`useCampaignSettings`, `MembersCard`, `HouseRules`/`CommonRulesSheet`/`EditHouseRuleDialog`, `CampaignChatMenu`, Locations, Encampments, `StartBattleDialog`, `BattleActionPanel`.
- **No query-count assertions anywhere in the backend.**

### Gaps and proposed tests

| ID | Level | Scenario | Expected result | Priority |
| --- | --- | --- | --- | --- |
| CAMP-TEST-01 | API | `assertNumQueries` on `GET /campaigns/:id/players/` with 2 vs 8 warbands | Same query count (no N+1) after the PERF-03 fix; ≤ 6 | P0 |
| CAMP-TEST-02 | API | `assertNumQueries` on the current-battle endpoint (or `/battles/?status=open`) with 0 vs 30 ended battles | Constant ≤ 4 queries; ended and canceled battles excluded | P0 |
| CAMP-TEST-03 | API | Query budget tests for `/campaigns/`, `/campaigns/:id/`, `battle-history/`, `pivotal-moments/`, `top-killers/`, `members/`, `messages/` | Each ≤ its documented constant, independent of row counts | P1 |
| CAMP-TEST-04 | component | `CampaignLayout` + overview mount with mocked API | `listCampaignBattles` called once; overview fetches start without waiting for catalogue lookups; a `focus` + `visibilitychange` pair triggers at most 1 refetch | P0 |
| CAMP-TEST-05 | API | Owner deletes a player's warband (kick), player deletes own, admin/other player tries | Matches the chosen policy (owner 204, other player 403); battle history behaviour asserted | P1 |
| CAMP-TEST-06 | API | Admin PATCHes `in_progress=true` | Matches the policy chosen in CAMP-BUG-02 (and the UI gate matches) | P1 |
| CAMP-TEST-07 | component | Start campaign then remount overview (simulate navigation) | Start button stays hidden; layout `campaign.in_progress` is true | P1 |
| CAMP-TEST-08 | unit | Every code passed to `has_campaign_permission` (grep the source) exists in `PERMISSION_SEED`; `MembersCard` renders every code from `GET /permissions/` | Passes; catches drift such as `manage_spells` | P1 |
| CAMP-TEST-09 | API | Join same code twice sequentially; join when full; join with a lowercase code | 400 "Already a member"; 400 "Campaign is full"; 201 | P1 |
| CAMP-TEST-10 | API (TransactionTestCase) | Two threads join the last seat concurrently; one user joins twice concurrently | Exactly one succeeds; no 500 | P2 |
| CAMP-TEST-11 | API | Remove a player who is in an inviting/active battle, has a pending trade and an invite notification, and owns an encampment | Battle canceled, trade declined, notifications resolved, encampment unassigned, warband per policy | P1 |
| CAMP-TEST-12 | API | Owner cannot be removed or demoted; admin cannot remove; admin cannot change roles; owner promotes and demotes | 400/403/200 as specified | P1 |
| CAMP-TEST-13 | API | Ownership transfer (after UX-02) | Old owner becomes admin, new owner is owner, atomic | P2 |
| CAMP-TEST-14 | API | PATCH house rule title only (effect unchanged) | No clone or availability rows rewritten (assert availability IDs unchanged, query count small) | P2 |
| CAMP-TEST-15 | API | PATCH/DELETE a generated clone item via `/items/:id/` | 403; owned `HeroItem` rows intact | P1 |
| CAMP-TEST-16 | API | Toggle half-price armour on and off for a hero who bought armour at 50 gc | Stored purchase cost preserved (or the documented behaviour); multi-availability items don't become `None` | P2 |
| CAMP-TEST-17 | API | Base armour item re-subtyped, then the rule is edited | Owned rows remapped to source, not deleted | P2 |
| CAMP-TEST-18 | API | POST the same effect rule twice / concurrently | One rule (or idempotent), one clone per source item | P2 |
| CAMP-TEST-19 | component | `CommonRulesSheet` with one POST failing | Successful rules are added to the list; error shown; retry doesn't duplicate | P2 |
| CAMP-TEST-20 | API | Chat: GET pagination with `before`, 51+ messages; POST blank / over 2000 / non-member; Pusher client raising | 50 per page, ordered; 400/400/404; POST returns 201 even when Pusher fails | P1 |
| CAMP-TEST-21 | component | `CampaignChatMenu` send failure (429) | Draft restored and inline error shown; no unhandled rejection | P2 |
| CAMP-TEST-22 | API | Campaign create with negative or huge `max_heroes`, `starting_gold` | 400, no orphan `Campaign` row | P2 |
| CAMP-TEST-23 | API | Change starting gold when the oldest trade is not "Starting Gold" | Only the starting-gold trade is changed; log written | P3 |
| CAMP-TEST-24 | component | `CampaignSettings` as owner → admin → player (re-render with a changed role) | No hook-order error; correct tabs and cards per role | P2 |
| CAMP-TEST-25 | component | `MembersCard` permission toggle success and failure, role toggle, remove dialog | Optimistic update then reconcile; rollback and error on failure | P2 |
| CAMP-TEST-26 | API + component | Locations and Encampments delete and `explorable` (after UX-03) | Permission-gated; log entry on explorable | P3 |
| CAMP-TEST-27 | API | Players endpoint never returns email for users without a name (after SEC-01) | Display name fallback used | P3 |
| CAMP-TEST-28 | API | Campaign delete removes notifications for that `campaign_id` | No orphan notifications | P3 |

### Manual QA script

Accounts: **A** (owner), **B** (will become admin), **C** (player), **D** (latecomer). Use 3–4 browsers or profiles. Keep DevTools → Network open on A to count requests.

1. A creates a "Standard" campaign with 3 seats and copies the join code from the card. Check that it appears with role "Owner" and "1 / 3".
2. B and C join with the code (lowercase input should work). D tries to join and gets "Campaign is full". C tries again and gets "Already a member".
3. **Race:** raise seats to 4 in the DB or recreate the campaign. D joins from two browsers at the same moment. Expect exactly one membership and no error page.
4. A opens the campaign with the network log cleared. Record the request count and timeline:
   - Does the overview render before items, skills, spells, special and races finish?
   - How many `/battles/` calls are made?
   - Then switch to another tab and back: how many `/battles/` calls fire?
5. A → Settings → Campaign: promote B to Admin. On B, reload. B sees the Campaign tab but no Campaign Systems or Delete cards.
6. As B (admin), on the overview, check whether "Start campaign" is shown. If it is, click it and confirm that it either works or isn't offered (CAMP-BUG-02).
7. As A, click "Start campaign". Navigate to Warband, then back to the overview. "Start campaign" must stay hidden and "Start battle" must show (CAMP-BUG-03). On C without reloading, check whether C sees "Start battle" (CAMP-UX-04).
8. As A, open the permissions dropdown for C. Check that "Manage encampments" and "Manage bestiary" are listed, and that there is a way to grant spell or special editing. Grant "Manage house rules" to C. On C, reload House Rules and confirm "Add rule" appears.
9. As C, add "Half Price Armour" and "Improved Shields" via Common Rules. In Wargear, check that each armour appears once at half price and shields show "(n+ CC)". As A, check that the Edit button is not offered on these generated items.
10. As C, buy Heavy Armour for a hero, then edit only the title of the "Half Price Armour" rule. The hero's item must keep its price and the server response should be quick. Delete the rule: the item reverts to the base item and stays on the hero.
11. As C, create a battle with A. As A, open Settings → Campaign → Active battles. Check that the battle is listed with useful age or activity information, then cancel it. On C, the warband no longer shows "In Active Battle".
12. As C, create another battle with B and leave it in prebattle. As A, remove C from the campaign. Then check that:
    - B can start a new battle (no stuck battle)
    - C's pending invite or trade notifications disappear
    - C's warband no longer appears in `/warbands/` listings
    - the dialog text matched what happened
13. As A, click "Kick" on a player who still has a warband. It must succeed (or not be offered). Check that the battle history still makes sense.
14. **Chat:**
    - A and B both open chat; messages appear live on the other side.
    - Send 13 messages in a minute from B: the 13th must show an error and keep the text.
    - Scroll to the top with more than 50 messages to load older ones.
    - Close chat on A: B's messages increment A's unread badge.
    - On mobile, enter warband edit mode and exit: the badge and connection should survive.
15. **Marienburg flow:** A creates a Marienburg campaign. Locations and Encampments appear in the nav and mobile tabs. Create, edit (and delete, once implemented) a location and an encampment. Assign an encampment owner. Toggle encampments off in Settings: the page shows the disabled card and other members' nav updates.
16. As A, change starting gold mid-campaign. Expect a confirmation warning, and the warband treasury updates without a reload.
17. As A, delete the campaign by typing "delete". It disappears for everyone, and B and C have no leftover notifications for it.
18. Repeat steps 4 and 14 on a phone-width viewport. Check the roster expand, the members card dropdown (keyboard and Escape), and that tap targets don't trigger the wrong nested action (card vs roster button).
