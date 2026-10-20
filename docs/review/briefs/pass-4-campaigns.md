# Pass 4 brief: Campaigns

Step 1 of the pass loop in [PLAN.md](../PLAN.md). Full detail (repro, fix) is in [features/02-campaigns.md](../features/02-campaigns.md); IDs are from [BUGS.md](../BUGS.md), [PERFORMANCE.md](../PERFORMANCE.md), [IMPROVEMENTS.md](../IMPROVEMENTS.md) and [TEST_PLAN.md](../TEST_PLAN.md); the permission pattern is [design 0.29](../designs/permissions-and-capabilities.md). The review predates passes 1 to 3, so every finding below was re-checked against today's code: the main checkout `pass3/frontend-fixes` @ `6077f59` (line numbers are from here; its backend is `main` plus pass 3's characterisation tests). Pass 3's backend branch `pass3/battles` @ `59777d7` doesn't touch `campaigns`, `notifications` or `realtime`. Both are still moving.

**Already done (not proposed again):**
- Phase 0: chat sends after commit in the background (`realtime/services.py:78-85`), so Pusher can't turn a saved message into a 500 (CAMP-PERF-07, BUG-01). The chat subscription lives in `RealtimeProvider` and survives top-bar swaps (`useCampaignChat.ts:18-35`, CAMP-PERF-09's socket half); the draft stays until the server has it and a failed history load offers Retry (`useChatWindow.ts:71-74, 123-138`): BUG-20's chat half, with CAMP-TEST-21 in `CampaignChatMenu.test.tsx:55, 68`.
- Phase 0: one `battles/?open=1` query (budget 2) shared by the layout and the battle panel, with no focus double-fetch (CAMP-PERF-01; `CampaignLayout.test.tsx:164, 176`); the shell renders without waiting for catalogues (CAMP-PERF-02, `:129`); `/players/` is constant at 7 with a batched rating and a `values_list` busy lookup (`views.py:597-635`, most of PERF-41); bulletin data loads only while its tab is open (PERF-43, `useCampaignOverview.ts:189-237`); the outlet context is memoised (`CampaignLayout.tsx:317-322`); `CampaignSettings` calls its hooks unconditionally (CAMP-CQ-04, CAMP-TEST-24 in `CampaignSettings.test.tsx:91, 105`); location content is sanitised (SEC-03, `serializers.py:346`); the ping socket is gone from the frontend; `CampaignLayout.tsx` went from 724 to 402 lines.
- Phase 0 (0.21): the campaign payload carries the caller's `permissions` (`views.py:430-451`) and the nine `/permissions/me/` fetches are gone. **Not changed:** roles and permission codes are still created with `get_or_create` inside `lru_cache` helpers on the request path (`views.py:97-120`, plus a drifted copy in `seed_campaign_users.py:17-45`). No migration seeds them (design 0.29 Q4 wasn't taken in pass 1), so a fresh database has no codes until the first campaign is created or joined.
- Pass 1: the pattern to copy. `WarbandScopedView` (`warbands/views/base.py:17-49`) enforces `WARBAND_RULES` and the sheet reports `capabilities` (`warbands/access.py:31-66`, `services/sheet.py:61-76`). The campaign payload has `permissions` but no `capabilities`, and campaign views still hand-roll every check.
- Pass 2: the ledger (`warbands/services/ledger.py`: `record_entries` writes many rows in one INSERT and one balance UPDATE; `LedgerAction.ADJUSTMENT` exists). Starting gold moved into `ledger.rewrite_starting_gold` (`:108-122`), which keeps rows and balance in step but still rewrites the oldest row, as its docstring says (BUG-78). Also `capabilities.trade` (the warband's owner only), trade `close()` (`trades/services/lifecycle.py:57-61`) and the trade channel requiring both players to be members (`channel_auth.py:72`, SEC-08's trade half).
- Pass 3 (in flight, not merged): `manage_battles` (BATL-NEW-04, added to `PERMISSION_SEED`; no branch has it yet), `Battle.last_activity_at` with "idle N days" and the owner tools in Settings → Active Battles behind that permission (BATL-NEW-02, -03), decline, Close postbattle, `BattleScopedView` with battle `capabilities`, public names for the four battle helpers campaigns imports (`views.py:14-19`, CAMP-CQ-08), and clearing a result request only resolving it (BUG-46, BUG-121).

**Data is disposable** (`CLAUDE.md`): no backfills or drift reports; every migration below must still run on an empty database.

**Your part:** every decision is answered (see [Decisions](#decisions-answered-by-william-2026-10-18)). The [Calls I made](#calls-i-made) were confirmed on 2026-10-18.

## What it is today

- **Model.** `Campaign` (name, unique 6-character `join_code`, `in_progress`) with a one-to-one `CampaignSettings` (limits, starting gold, level thresholds, `enable_locations` / `enable_encampments`, a dead `locations` flag); `CampaignMembership` (unique campaign + user) with a role (owner, admin, player) and grants. Content: chat, bulletin notes, house rules (two with item effects), encampments (name, owner, description), locations, pivotal moments. Nothing is soft-deleted or archived.
- **Rules.** Owners and admins hold every code (`permissions.py:16-24`); joining grants `add_custom` (`views.py:557-570`). Owner only: PATCH, DELETE, roles, removing players, Active Battles. Owner or admin: members and grants. Encampments and locations need their flag plus `manage_*`; bulletin delete is author-only.
- **Reads.** Campaign detail (3 queries, cached 5 min) and open battles (2), then the overview's players (7), completed trades (2), battle history (3) and pivotal moments (2), fetched by `useEffect`s on every overview mount (`useCampaignOverview.ts`, 435 lines, 29 `useState`). A roster expand adds 3 requests (13 queries).
- **Realtime.** Chat on `private-campaign-{id}-chat`; a routed pings channel with no caller; no event for campaign changes, so others see a start, a role change or a feature toggle only once their 5-minute cache goes stale.
- **Main files.** Backend `campaigns/views.py` 1,289 (26 views), `serializers.py` 416; 43 tests (36 + 3 + 4). Frontend `CampaignLayout` 402, `useCampaignOverview` 435, `use-campaign-settings` 359, `BattleHistoryTable` 367, `ActiveBattlesTable` 362, `MembersCard` 360, `Locations` 355, `CampaignLevelUpSettingsCard` 346, `CampaignSettings` 324, `Encampments` 323, `RosterTable` 316; 20 test files across campaigns and realtime.

## What's wrong

### Members, roles and permissions
- **BUG-12** (P1): Kick still calls `DELETE /warbands/:id/` (`use-campaign-settings.ts:254-278`; offered to the owner at `CampaignSettings.tsx:213`, dialog `:280-324`), which only the warband's owner may call (`warbands/views/warbands.py:62`, `access.py:35`): always 403. Were it allowed, it would hard-delete the warband and, through `BattleParticipant.warband` `CASCADE`, its battle history.
- **BUG-50**: removal deletes only the membership (`views.py:1138-1157`). Open battles keep a player who can't reach them; pending trades stay; notifications stay listed, because the list doesn't check membership (`notifications/views.py:31-37`); encampments keep a non-member owner. The dialog says "This action cannot be undone" (`RemoveMemberDialog.tsx:26-27`), yet rejoining reattaches the warband (unique campaign + user, `warbands/models/warband.py:50`). Deleting a campaign leaves its notifications (`views.py:461-466`; `campaign_id` is a plain integer, `notifications/models.py:22`).
- **CAMP-UX-02**: no ownership transfer (roles `admin` / `player` only, `serializers.py:249`), no leaving, and admins can't be removed (`views.py:1153-1154`) without anything saying so.
- **BUG-15** (P1, campaign half), unchanged: `manage_spells` and `manage_features` are checked (`spells/views.py:83, 104`; `special/views.py:83, 104`) but seeded nowhere (`views.py:85-94`; the seed command, `seed_campaign_users.py:23-31`, also lacks `manage_encampments`); the grant PUT drops unknown codes silently (`views.py:1094-1095`); the grant menu offers 6 of the 10 codes (`campaign-settings.ts:3-34`); `GET /permissions/` has no caller (`campaigns-api.ts:166`).
- **SEC-13** (wider than filed): `first_name or email` in `/players/` (`views.py:642`), the stored chat and bulletin usernames (`:827, 1280`), encampment owners (`serializers.py:278`) and ping labels (`realtime/services.py:92`). Battle participant labels (`battles/views/shared.py:65-69`) and trade names (`trades/serializers.py:12-14`) fall back to the email too.

### Starting the campaign and its settings
- **BUG-13** (P1): `canStartCampaign` is owner or admin (`useCampaignOverview.ts:239`); the PATCH is owner only (`views.py:472`).
- **BUG-14** (P1): `handleStartCampaign` drops the PATCH answer (`useCampaignOverview.ts:335-357`) and `isUnderway` re-reads the cached campaign on remount (`:91-99`; cached 5 min, `useCampaignQuery.ts:15`), so Start campaign comes back and Start battle goes. The store copy `campaignStarted` (synced at `CampaignLayout.tsx:241-246`) gates the XP bar (`useExperienceBar.ts:35`) and drifts.
- **BUG-77**: nothing on the server reads `in_progress` except the PATCH; the dialog says "This will lock in the roster" (`CampaignOverview.tsx:192`); before the start the whole battle panel is hidden (`:209-217`) and XP +/- is disabled (`ExperienceBar.tsx:49`).
- **BUG-78** (reworded): the balance now moves with the row, but `rewrite_starting_gold` still rewrites the oldest row of any action (`ledger.py:115-122`), called from a loop with one transaction per warband (`views.py:523-525`); the save asks nothing (`CampaignLevelUpSettingsCard.tsx:129-153`) and the player's sheet keeps the old gold until it refetches.
- **BUG-76** (wider): create writes campaign, settings and membership outside a transaction (`views.py:394-416`) and validates only `max_players` (`serializers.py:121-134`); the PATCH's `max_heroes` / `max_hired_swords` have no ceiling for their smallint columns (`:139-140`), so 40000 is a 500; the grant PUT deletes, then inserts (`views.py:1097-1103`); the PATCH commits campaign, settings and warbands separately.
- **BUG-49**: join checks, then creates, with no transaction or lock (`views.py:545-570`): an over-full campaign, or an `IntegrityError` 500 for a double join.

### Battles seen from the campaign
- **CAMP-UX-01**: Active Battles is owner-only on both sides (`views.py:702, 745`; `use-campaign-settings.ts:57`; `CampaignSettings.tsx:217`) and shows only `created_at` (`ActiveBattlesTable.tsx:258, 296`); no banner. The warband page no longer has an "In Active Battle" badge: the only busy label is the Start battle dialog's (`StartBattleDialog.tsx:137-150`). Pass 3 brings idle time, the tools and `manage_battles`; this pass adds the banner and the link (decision 7).

### Chat, bulletin and notifications
- **CAMP-UX-08**: chat has no delete; bulletin delete is author-only and hard (`views.py:849-852`).
- **CAMP-UX-05**: the bulletin tab isn't in `overviewTabs` (`CampaignOverview.tsx:32`); `?tab=bulletin` renders it while the header shows Overview (`:248`).
- **IMP-78** (FE-UX-07): unread counts every message that arrives while the window is closed, your own from another device included, and lives in memory only (`useCampaignChat.ts:24-35`). Clear resolves everything at once with no confirm (`NotificationsMenu.tsx:112-115`, `useNotifications.ts:117-125`) and declines pending trade requests and reported results as a side effect (`notifications/views.py:58-147`; pass 3 changes the result half).
- **CAMP-UX-07**, unchanged: a `role="link"` card around buttons (`CampaignCard.tsx:74`), a `role="button"` roster row around a link (`RosterTable.tsx:195`), `NavLink` around `Button` (`CampaignSidebar.tsx:47-59`), a hand-placed portal for grants (`MembersCard.tsx:320-356`), a chat input with only a placeholder (`CampaignChatMenu.tsx:110-123`).
- `CampaignPingView` is still routed and relays any payload to every member (`views.py:1228-1244`).

### Encampments, locations and house rules
- **CAMP-UX-03**: the Locations toggle promises "trading in the Marketplace, Infamous Haunts and Cursed Marshes" (`CampaignControlCard.tsx:173-174`); none of it exists. Encampments need `manage_encampments` to add or edit (`views.py:876, 898`), can't be deleted, and a new one defaults to Unassigned (`Encampments.tsx:55`).
- **BUG-51**, unchanged: house-rule clones can be edited and deleted as custom items (`items/views.py:140-195`), and deleting cascades to owned copies; stale cleanup deletes clones before remapping (`items/services.py:240-245`); remaps overwrite each owned row's stored cost (`:142, 153, 164, 177-179`); nothing makes `(campaign, generated_effect_key, source_item)` unique.
- **BUG-52**: Common Rules posts with `Promise.all` (`CommonRulesSheet.tsx:129-137`), so one failure hides the rules that were created, and the server has no per-effect idempotency. **PERF-44**: every rule PATCH reverts and re-syncs (`views.py:1201-1207`), title edits included.

### Performance left after Phase 0
- **PERF-41** (rest): `/players/` is 7 (target ≤ 6), and Encampments and the trade invite fetch it just for names (`Encampments.tsx:78`). **PERF-42**: a roster expand is 3 list requests and 13 queries (`useCampaignOverview.ts:262-266`).
- **PERF-45**: chat pages by `id` but orders by `-created_at` with only a `campaign_id` index (`views.py:1258-1264`); battle history prefetches every participant JSON column (`:666-670`).
- **CAMP-PERF-06** (rest): the detail reads the membership twice (`views.py:145-158`); a player's feature write costs 3 queries before work (membership, flag, grant: `:871-876`).
- The overview, settings, Encampments and House Rules fetch in `useEffect`s and refetch on every visit; nothing patches them from events.

### Code quality
- **CAMP-CQ-01** (IMP-63): `views.py` is 1,289 lines with 32 `get_membership(` calls and 50 bare `"Not found"`; payload builders, house-rule orchestration and seeding sit beside the views.
- **CAMP-CQ-02** (IMP-13): `CampaignLayout.tsx` (402) reads the whole store (`:64-70`), tracks the battle session (`:241-315`), holds the title switch (`:100-130`) and copies the Rejoin styles of `BattleActionPanel.tsx:150-153` (`:187-216`).
- **CAMP-CQ-03, -05** (IMP-64, -66): codes in three drifted places, seeded lazily (above); 29 `useState` in `useCampaignOverview` and 21 in `use-campaign-settings`; 46 `instanceof Error` blocks in campaigns and rules; Locations and Encampments duplicate their scaffolding.
- **CAMP-CQ-06, -07, -09** (IMP-67, -68, -69): duplicated repricing and top-killer blocks; dead `CampaignSettings.locations` (`models.py:113`), settings proxy properties with hidden writes (`models.py:35-101`), unused serializers (`serializers.py:29, 191`), `CampaignWarbandsView` (`views.py:970-985`) and `listCampaignWarbands`; free-text effect keys, with the common rules only in the frontend.

## What I propose for this pass

Order: characterisation tests → PR A → PR B → PR C (Planned changes).

### PR A: fixes

Decision-independent, backend
- BUG-15, IMP-64: `apps/campaigns/constants.py` (roles; every code with a label and a description, `manage_battles` included if pass 3 hasn't added it) and a data migration that upserts them from a frozen copy; `manage_features` becomes `manage_specials` (design Q1) and `special/views.py` checks it; `_ensure_roles` / `_ensure_permissions` leave the request path and the seed command imports the constants; the grant PUT answers 400 `unknown_permission`; `GET /permissions/` returns code, label and description; a test that every code checked anywhere exists (CAMP-TEST-08).
- BUG-49: join runs in `transaction.atomic()` with the campaign row locked; an `IntegrityError` becomes 400 "Already a member" (CAMP-TEST-10). BUG-76: create, PATCH and the grant PUT are atomic; create and PATCH limits match their columns (`max_players` 2-16, smallints ≤ 32767, gold within the ledger's 32-bit ceiling).
- SEC-13: one `display_name(user)` (first name, else "Player {id}") in `apps/users/`, used by players, chat, bulletin, encampments, battles and trades; chat and bulletin store it. Admins still see emails in the members list.
- BUG-51 (pass 4 half): items PATCH and DELETE answer 403 `house_rule_item` for a generated clone, and `ItemSerializer` exposes `generated_effect_key`; stale cleanup remaps owned rows to the source first; remaps keep each row's stored cost; a unique constraint on `(campaign, generated_effect_key, source_item)` (CAMP-TEST-15 to -17). BUG-52, PERF-44: rule create is idempotent per `(campaign, effect_key)` (a partial unique index), and a PATCH that keeps the key skips revert and sync (CAMP-TEST-14, -18).
- PERF-45: chat ordered by `-id` with `Index(campaign, -id)` on messages and bulletin; history defers the JSON it doesn't read. PERF-41: the full read ≤ 6 and `players/?fields=basic` (≤ 2) for name pickers. PERF-42: `GET warbands/:id/roster-stats/` (stat columns of on-roster units, ≤ 4 queries).

Decision-independent, frontend
- BUG-14: Start writes the PATCH answer into the campaign query and the overview reads `in_progress` from it (no local `isUnderway`). BUG-15: `MembersCard` builds its menu from `GET /permissions/` (CAMP-TEST-25).
- BUG-52: `Promise.allSettled`; created rules join the list and only failures are reported (CAMP-TEST-19). BUG-51: Items hides Edit on generated clones.
- CAMP-UX-07: real links and buttons in `CampaignCard`, `RosterTable` and `CampaignSidebar`; the grant menu on Radix `DropdownMenu`; a labelled chat input.

Decision-driven, backend
- BUG-12, BUG-50 (decision 1): `services/membership.remove_member`, in one transaction under the membership lock: closes the player's open battles (see [Calls I made](#calls-i-made)) and pending or accepted trades (`lifecycle.close`), resolves their notifications for the campaign and the invites of what it closed, then deletes the membership; warband, battles, ledger and encampments stay. `GET members/:user/removal/` previews what will close; `membership_removed` goes to the player's channel on commit. Warband DELETE stays its owner's (CAMP-TEST-05, -11).
- BUG-13 (decision 2): the PATCH accepts `in_progress` on its own from the owner or an admin; every other field stays owner-only (CAMP-TEST-06).
- BUG-77 (decision 3): before the start, battle create and report-result succeed with `warnings: [{code: "campaign_not_started"}]`; nothing refuses.
- BUG-78 (decision 6): a PATCH that changes `starting_gold` on a campaign with warbands needs `adjust_existing_warbands`; when true, one `ledger.record_entries` writes an Adjustment of new minus old per warband ("Starting gold changed from 500 to 600 gc"); `rewrite_starting_gold` is deleted (CAMP-TEST-23 rewritten). New warbands get the new value, as today (`warbands/views/warbands.py:55-56`).

Decision-driven, frontend (the minimum to stay honest; the rest is PR C): Kick and its dialog go, and Remove shows the preview ("Alice's warband is kept and comes back if she rejoins. Battle #40 will be cancelled and 1 trade closed. Regenerate the join code to keep her out."); Start campaign for admins, saying it enables battles and experience; the battle panel renders before the start with Start battle greyed out but clickable and a warning; the starting-gold save asks with the tick and refreshes the player's sheet and treasury.

### PR B: refactor (no behaviour change)

Backend
- Design 0.29 for campaigns: `apps/campaigns/access.py` (`CAMPAIGN_RULES` as PR A leaves them, `campaign_capabilities`) and `views/base.py` (`CampaignScopedView`: one request-cached query for membership, role, settings and codes via `ArrayAgg`; declarative `rules` and `feature_flag`; deny by default; `check_rule(name, obj)` for bulletin authors and encampment owners). `has_campaign_permission` reads the loaded codes, so `WarbandScopedView` and the catalogue views lose their extra EXISTS. The detail payload gains `capabilities` (0 extra queries); the matrix and capability-truth tests from design §6 cover every campaign route.
- Split `views.py` (IMP-63) into `views/{campaigns,overview,members,content,chat}.py`, `selectors.py` (history payload, top killers through one `_killer_rows`, IMP-67) and `services/{membership,settings,house_rules}.py`; `serializers.py` likewise. Nothing over 400 lines or 60 per function; views ≤ 40 lines a method.
- IMP-67, -69: one repricing path (`_prefetched_base_items(subtype)`, `_sync_availabilities`, one `bulk_update` remap loop: PERF-44's bulk half) and an `EFFECT_KEYS` registry that validates `effect_key` and serves the common rules (`GET rules/common/`).
- IMP-68: delete `CampaignPingView`, `send_campaign_ping`, `build_ping_payload`, its channel rule and throttle, the legacy `locations` flag (migration), the settings proxy properties, the two unused serializers, `CampaignWarbandsView` and `listCampaignWarbands`.

Frontend
- `api/campaign-queries.ts`: keys under `['campaign', id, ...]` for players, battle history, pivotal moments, completed trades, bulletin, top killers, members, active battles, encampments, house rules, the permission catalogue and chat (infinite). The overview, settings, Encampments and House Rules read them (IMP-66); mutations write their answers with `setQueryData`; `useCampaignOverview` and `use-campaign-settings` become per-section hooks; `getErrorMessage` replaces the 46 `instanceof Error` blocks.
- `capabilities.ts` and `useCampaignCapabilities` (design §4): every campaign page gates on flags, not on `campaign.role` or codes (Locations only swaps its gate); the lint rule becomes `error`. `campaignStarted` comes from the campaign query; the store copy goes.
- `CampaignLayout` ≤ 250 (IMP-13): `useBattleSession` (`:241-315`), `<CampaignTopBarActions>` (dice, chat and notifications built once), a shared `RejoinBattleButton`, `campaignSectionTitle(path)` beside `campaign-nav.ts`, store selectors instead of the whole store.
- Under 250 lines each: `CampaignOverview`, `CampaignSettings` (one card per capability), `MembersCard`, `ActiveBattlesTable`, `CampaignLevelUpSettingsCard`, `CampaignControlCard`, `WarbandSettingsCard`, `RosterTable`, `BattleHistoryTable`, and `Encampments` on a `CampaignRecordsPage` scaffold. Pass 3 owns `StartBattleDialog` and `BattleActionPanel`; `BulletinBoardTab`, `Locations` and `LocationsTable` wait for the design conversation.

### PR C: your decisions and Planned changes

Every row below is Agreed and lands on PR B's data layer and capabilities, in this order: membership (CAMP-NEW-01 to -03), archive (CAMP-NEW-04, CAMP-TWEAK-04), stuck battles (CAMP-NEW-05, once pass 3's BATL-NEW-02/03 are in), content (CAMP-NEW-06, CAMP-TWEAK-06 to -08), then live updates and polish (CAMP-NEW-07, -08, CAMP-TWEAK-09, -10). New columns: `Campaign.archived_at` / `archived_by`; `removed_at` / `removed_by` on messages, bulletin notes and encampments; `CampaignMembership.chat_last_read_id`. One migration each, all fine on an empty database.

### Query and request targets

| Request | Today | After pass 4 | Test |
| --- | --- | --- | --- |
| `GET campaigns/:id/` | 3, plus 1 for a player's codes | ≤ 3 for every role, with `capabilities` and unread chat | CAMP-TEST-03 |
| Preamble of a player's feature write | 3 (membership, flag, grant) | 1 (cached access) | design §6 |
| `GET players/` | 7 | ≤ 6; `?fields=basic` ≤ 2 | CAMP-TEST-01 |
| Overview revisit within the stale time | 4 requests, 14 queries | 0 (cached; battle and campaign events invalidate what they change) | CAMP-TEST-04 |
| Roster expand | 3 requests, 13 queries | 1 request, ≤ 4 | PERF-42 |
| House-rule PATCH, title only | about 70 + 1 per owned row (estimated) | ≤ 4 | CAMP-TEST-14 |
| Starting-gold change, W warbands | about 3W, one transaction each | 1 INSERT + 1 UPDATE in one transaction | CAMP-TEST-23 |
| `GET members/` | 4 (+8 on the first call per process) | ≤ 4 | CAMP-TEST-03 |

## Characterisation tests to write first

Backend (factories; Pusher mocked; known bugs pinned with their ID so they flip in PR A)
- Members and roles: owner-only removal of players, an admin target refused, owner-only role changes, an undemotable owner (CAMP-TEST-12); pinned: removal leaving an open battle, a pending trade, the player's notifications and a non-member encampment owner, and rejoining reattaching the warband (BUG-50, CAMP-TEST-11); Kick's warband DELETE answering 403 to the owner (BUG-12, CAMP-TEST-05); campaign delete leaving notifications (CAMP-TEST-28).
- Permissions: a fresh migrate holding no codes; the grant PUT dropping `manage_spells` silently; the code registry test as an expected failure (BUG-15, CAMP-TEST-08).
- Start and settings: an admin's `in_progress` PATCH answering 403 (BUG-13, CAMP-TEST-06); a starting-gold change rewriting the oldest row whatever its action (BUG-78, CAMP-TEST-23); create with `max_heroes: -1` leaving a campaign without settings and PATCH `max_heroes: 40000` answering 500 (BUG-76, CAMP-TEST-22, expected failures); a battle created before the start with no warning (decision 3).
- Join: twice, full and lowercase (CAMP-TEST-09); two threads for the last seat and one user joining twice (BUG-49, CAMP-TEST-10, `TransactionTestCase`, expected failures).
- Content: chat pages of 50 with `before` over 51+ messages, blank, 2,001 characters and non-member posts (CAMP-TEST-20); bulletin delete author-only and hard; encampment create needing `manage_encampments` and no DELETE route (decisions 8 and 9).
- House rules: a title-only PATCH re-syncing clones with new availability ids (PERF-44, CAMP-TEST-14); a clone edited and deleted through `/items/:id/`, cascading owned copies (BUG-51, CAMP-TEST-15); toggling half-price armour rewriting stored costs (CAMP-TEST-16); stale cleanup deleting owned copies (CAMP-TEST-17, expected failure); two concurrent effect rules making two clone sets (BUG-52, CAMP-TEST-18).
- SEC-13: players, chat, bulletin, encampments, battle participants and trades showing the email of a user with no first name (CAMP-TEST-27).
- Budgets at today's counts (CAMP-TEST-03): detail 3, players 7, history 3, pivotal moments 2, top killers 2, members 4, permissions 2, messages 2, bulletin 2, encampments 3, locations 3, house rules 2, active battles 3, plus an encampment POST's preamble (3).

Frontend (the fake API server, `src/test/fake-api.ts`)
- Overview: Start campaign offered to admins (BUG-13); start, leave and come back: the button returns (BUG-14, CAMP-TEST-07 baseline); no battle panel before the start (decision 3); the four list requests on every overview mount (the TanStack baseline); a roster expand making 3 requests (PERF-42).
- Settings: Kick calling warband DELETE (BUG-12); the remove dialog's "cannot be undone"; a six-code grant menu (BUG-15) with toggle success and rollback (CAMP-TEST-25); Active Battles owner-only; a starting-gold save with no confirm and no sheet refetch (BUG-78); the delete card's three different labels (CAMP-UX-06).
- Chat and notifications: unread counting your own message from another device and resetting on reload; Clear removing invites and requests with no confirm (IMP-78).
- `CommonRulesSheet` with one POST failing and dropping the created rules (BUG-52, CAMP-TEST-19); Encampments defaulting the owner to Unassigned and hiding Add without `manage_encampments` (decision 9).
- Manual QA: `features/02-campaigns.md` steps 1-18 (12, 13 and 16 change with decisions 1 and 6). E2E waits for Playwright (0.14c).

## Decisions (answered by William, 2026-10-18)

| # | Decision | Answer |
| --- | --- | --- |
| 1 | Removing a player (BUG-12, BUG-50) | **One "Remove from campaign" action**; Kick is merged into it. No option to retire the warband: it is always kept and comes back if the player rejoins. Their open battles and trades close on removal. **Plus:** owners and admins can regenerate the join code (the old code stops working), which is how a removed player is kept out (CAMP-TWEAK-01, CAMP-NEW-01). |
| 1b | Join code visibility (BUG-143, 2026-10-20) | **Every member can see the join code**, in Settings and on the campaigns list alike; only owners and admins regenerate it (regenerating is how a removed player is kept out). |
| 2 | Who can start the campaign (BUG-13) | **Owner and admins** (CAMP-TWEAK-02). |
| 3 | What "started" means (BUG-77) | **Starting only enables battles and XP.** Before the start, Start battle is greyed out but clickable, with a warning (CAMP-TWEAK-03). |
| 4 | Ownership and leaving | The owner can **hand ownership to an admin**; players can **leave**, with the same clean-up as removal; the owner must hand over first (CAMP-NEW-02, -03). |
| 5 | Deleting a campaign | **Archive by default** (read-only, restorable); permanent delete is a separate, explicit step (CAMP-NEW-04, CAMP-TWEAK-04). |
| 6 | Changing starting gold mid-campaign (BUG-78) | The dialog **asks each time** whether to adjust existing warbands: ticked before the start, unticked after. Adjustments are ledger "Adjustment" rows, never rewrites (CAMP-TWEAK-05). |
| 7 | Stuck battles | Owner and admins (through `manage_battles`) see active battles; a **banner on the overview after 24 h idle**; the "In Active Battle" badge links there (CAMP-NEW-05). |
| 8 | Chat and bulletin | Owner and admins can **remove chat and bulletin posts** (soft delete, shown as "removed by admin") (CAMP-NEW-06). The bulletin tab is enabled as it is today (CAMP-TWEAK-06); its feature set and design are [parked](#parked-for-design). |
| 9 | Locations and encampments | Locations: [parked](#parked-for-design); only the settings toggle becomes honest (CAMP-TWEAK-07). **Encampments:** a name, a description and an owner, with no game effect; the owner can be any member, assigned rather than necessarily the creator (CAMP-TWEAK-08; who edits and deletes is in [Calls I made](#calls-i-made)). |
| e, h, i | Optional features | **All wanted:** campaign changes reach other members without a reload (CAMP-NEW-07, IMP-73); the feedback report on the Campaigns page with a "sent" confirmation (CAMP-NEW-08, IMP-96); chat remembers what you've read, and Clear all never hides notifications that still need an answer (CAMP-TWEAK-09, -10, IMP-78). |

## Calls I made

**Confirmed by William on 2026-10-18 ("all fine").**
- **Encampments (please confirm).** Any member can add one and choose its owner from the campaign's members, defaulting to themselves. The encampment's owner, the campaign owner and admins can edit it, reassign it and delete it (soft: `removed_at`, hidden from the list). `manage_encampments` stays as a grant giving a player the same rights over every encampment (owners and admins hold it), so the rule is "the encampment's owner, or `manage_encampments`". The plan's `explorable` state and action-log entries are dropped, since encampments have no game effect.
- **Who removes.** The owner can remove any member but themself (an admin directly, without demoting first); admins can remove players. Nobody can remove the owner.
- **What "close" means.** In inviting, prebattle and active, the battle is cancelled for everyone (the owner's Cancel path, `mode="member_removed"`). In postbattle, only the removed player is skipped (their results aren't applied, as Close postbattle does) and the battle ends as normal when the others finish. Pending and accepted trades are closed. The dialog lists each one first.
- **Rejoining.** The membership row (role and grants) is deleted, not soft-deleted; warband, battles, ledger and encampments stay, so rejoining restores everything except grants (back to `add_custom`). While the player is away, their warband stays in history, pivotal moments and top killers but not in the roster or pickers, and encampments they own show "(left)".
- **Leaving.** Players and admins leave with removal's clean-up and preview; the owner is refused (`hand_over_first`), as decided; an owner alone in the campaign archives it instead.
- **Archive.** Owner only. Archiving closes open battles and trades as removal does and resolves pending notifications; an archived campaign is read-only for everyone (writes answer 403 `campaign_archived`) except Restore and Delete permanently, and sits in its own section of `/campaigns`. Permanent delete exists only for an archived campaign, asks for the campaign's name, lists what is destroyed and removes its notifications.
- **Before the start.** Battles and reported results are allowed with a warning, never refused; XP +/- keeps today's disabled state and tooltip, since decision 3 names only Start battle.
- **Starting gold.** The adjustment is new minus old for every warband, whatever its own starting row says.
- **Stuck battles.** The banner reads `active-battles/`, fetched only with `capabilities.manage_battles`, and shows when any open battle has been idle for 24 h. It and the Start dialog's busy label link to Settings → Active Battles, and the Campaign settings tab appears for anyone holding a capability for one of its cards. If pass 3 hasn't added `manage_battles` by then, PR A's seed migration does.
- **Bulletin.** "Enabled as it is today" means today's tab joins `overviewTabs` unchanged (its data already loads only while open). Authors' own deletes become soft too, so a removed note has one shape.
- **Live updates.** The unused pings channel becomes `private-campaign-{id}-events`, carrying `campaign.updated` (the payload without viewer fields); role, grant and removal changes go to that member's notification channel, which refetches their campaign query (or leaves the campaign with a toast).
- **Chat read state** lives on the membership (`chat_last_read_id`), so it follows a player between phone and desktop; the detail query counts unread messages; your own never count.
- **Clear all** resolves only notifications that can no longer be answered (expired trades, battles past inviting, settled results) and never declines anything.
- **Design 0.29.** Q1: seed `manage_spells` and rename `manage_features` to `manage_specials` (the design's default). Q2 stays with pass 5; Q3 is answered by decisions 1 and 2; Q4 is done in PR A.
- **Dead code.** Pings and the legacy `locations` flag go; `max_games` stays (stored and harmless; dropping it touches the create dialog).

## Parked for design

For a later conversation with William; nothing here is proposed in this pass.
- **Bulletin tab.** What it is for and what it shows: notes (280 characters, newest first), the "wanted poster", the "most dangerous" top-killers table, who may post, pinning and layout. `BulletinBoardTab.tsx` (297 lines) stays as it is; this pass only switches the tab on (CAMP-TWEAK-06) and adds moderation (CAMP-NEW-06).
- **Locations.** CAMP-UX-03's location half (delete, timestamps, an action log, what disabling does to existing records, splitting `manage_locations`), the Marketplace, Infamous Haunts and Cursed Marshes the toggle promised, and the open decisions in `LOCATIONS_AND_ENCAMPMENTS_PLAN.md`. `Locations.tsx` (355) and `LocationsTable.tsx` (257) keep their size; PR B only swaps their gate to `capabilities`.

## Planned changes

Types: **New**, **Tweak**, **Remove**. IDs: `CAMP-NEW-NN`, `CAMP-TWEAK-NN`, `CAMP-REMOVE-NN`. Status: Proposed → Agreed → Done.

| ID | Type | Change | Notes / acceptance | Status |
| --- | --- | --- | --- | --- |
| CAMP-TWEAK-01 | Tweak | One "Remove from campaign" action; Kick merged into it | Decision 1. The owner removes any member but themself; admins remove players. The dialog first lists what happens: the warband is kept and comes back on rejoin; open battles close (cancelled up to active, skipped for them in postbattle); pending and accepted trades close; their notifications are resolved. Kick, its dialog and its warband DELETE call go. | Agreed |
| CAMP-NEW-01 | New | Regenerate the join code | Decision 1. Owner and admins, from Settings ("New code"); the confirm says the old code stops working at once; other members' screens update (CAMP-NEW-07). | Agreed |
| CAMP-TWEAK-02 | Tweak | Owner and admins start the campaign | Decision 2. `capabilities.start` for owner and admins; the server accepts `in_progress` from either; the button follows the flag. | Agreed |
| CAMP-TWEAK-03 | Tweak | Starting enables battles and XP, nothing else | Decision 3. The start dialog says so (no "lock in the roster"). Before the start, Start battle is greyed out but clickable: "The campaign hasn't started yet. Start a battle anyway?", with Start campaign beside it for those who may; the server returns `campaign_not_started` as a warning. | Agreed |
| CAMP-NEW-02 | New | Hand ownership to an admin | Decision 4. Owner only, to an admin; one transaction swaps the two roles; both see the change at once (CAMP-TEST-13). | Agreed |
| CAMP-NEW-03 | New | Leave a campaign | Decision 4. Settings → Personal → Leave campaign, with removal's clean-up and preview; the owner is told to hand ownership over first. | Agreed |
| CAMP-NEW-04 | New | Archive and restore | Decision 5. "Archive campaign" replaces "Close campaign"; an archived campaign is read-only for everyone, listed under Archived on `/campaigns`, and the owner can restore it. | Agreed |
| CAMP-TWEAK-04 | Tweak | Permanent delete is its own step | Decision 5. Only for an archived campaign: type the campaign's name; the dialog lists what is destroyed (warbands, battles, trades, logs, house-rule items); its notifications go too (CAMP-TEST-28). | Agreed |
| CAMP-TWEAK-05 | Tweak | Changing starting gold asks about existing warbands | Decision 6. "Adjust existing warbands by +100 gc", ticked before the start and unticked after; each adjusted warband gets one Adjustment row; no row is rewritten; the player's gold and treasury refresh. | Agreed |
| CAMP-NEW-05 | New | Stuck battles: banner and link | Decision 7. With `manage_battles` (owners and admins by default): "1 battle idle for 5 days: Review" on the overview after 24 h idle, linking to Settings → Active Battles (pass 3's idle time and tools); the Start dialog's "In active battle" label links there too. | Agreed |
| CAMP-NEW-06 | New | Remove chat and bulletin posts | Decision 8. Owner and admins; soft delete; the post reads "removed by admin" for everyone, live through a `chat.removed` event. | Agreed |
| CAMP-TWEAK-06 | Tweak | The bulletin tab is switched on as it is | Decision 8. Added to the overview tabs unchanged; its data loads only while it's open; `wanted_poster.png` (1.6 MB) is converted to WebP. Everything else is parked. | Agreed |
| CAMP-TWEAK-07 | Tweak | An honest Locations toggle | Decision 9. The toggle says only what exists ("Show the Locations page"); nothing else about locations changes. | Agreed |
| CAMP-TWEAK-08 | Tweak | Encampments: any member adds one; the owner is assigned | Decision 9. A name, a description and an owner (any member, defaulting to whoever adds it); no game effect. The encampment's owner, the campaign owner and admins can edit, reassign and soft-delete it (a Call I made). | Agreed |
| CAMP-NEW-07 | New | Campaign changes reach members live | Optional e (IMP-73). A start, feature toggles, settings, the join code, roles and grants update other members' screens without a reload; a removed member is taken to `/campaigns` with a toast. | Agreed |
| CAMP-NEW-08 | New | Feedback report on the Campaigns page | Optional h (IMP-96). The same card on `/campaigns`, without campaign fields; "Thanks, report sent" on success, there and in Settings. | Agreed |
| CAMP-TWEAK-09 | Tweak | Chat remembers what you've read | Optional i (IMP-78). The badge counts messages after your last read, across devices and reloads; your own messages never count. | Agreed |
| CAMP-TWEAK-10 | Tweak | Clear all keeps what needs an answer | Optional i (IMP-78). Clear all removes only notifications that can no longer be answered; invites and requests stay until answered; clearing never declines anything. | Agreed |

## Production data checks

None: data is disposable (both databases can be wiped and only the catalogue is reseeded), so this pass has no backfills, drift reports or read-only SQL to run first. BUGS.md's campaign checks (permission codes, orphan campaigns, over-full campaigns, ghost warbands, orphan notifications) are no longer needed.
