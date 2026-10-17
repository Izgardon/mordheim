# Warband roster: heroes, henchmen, hired swords, XP and level-ups

> **Status (2026-10-17): pass 1 complete.** The findings below describe the code before pass 1. What was fixed is in the [BUGS.md fix log](../BUGS.md#fix-log); what changed, the decisions and the final query counts are in [the pass 1 brief](../briefs/pass-1-warband-roster.md#progress). The unit code now lives in `backend/apps/warbands/units/` and `frontend/src/features/warbands/{units,components/units,hooks/units}`, so the file paths below are historical.

> Scope: `backend/apps/warbands/` (models, `views/heroes.py`, `views/henchmen.py`, `views/hired_swords.py`, `views/kill_history.py`, warband CRUD + summary parts of `views/warbands.py`, `views/mixins.py`, `views/helpers.py`, `serializers/heroes.py`, `serializers/henchmen.py`, `serializers/hired_swords.py`, `serializers/warbands.py`, `utils/hero_level.py`, `utils/henchmen_level.py`, `utils/leaders.py`, `permissions.py`, `restrictions.py`), plus the roster-relevant XP code in `backend/apps/battles/views/shared.py`; `frontend/src/features/warbands/` (`routes/Warband.tsx`, `components/{heroes,henchmen,hiredswords,shared,warband,tabs}`, `hooks/{heroes,henchmen,hiredswords,levelup,warband,shared}`, `utils/warband-utils.ts`, `utils/pending-purchases.ts`, `types/warband-types.ts`, `api/*`). Stash, trades, resources and logs belong to `04-warband-economy-trades.md` (ECON) and are only referenced where the roster flows call them.

Measurements were taken on 2026-10-16 against the local Docker stack (Postgres 16, Django 5.0.3) using `CaptureQueriesContext` + `APIClient.force_authenticate(user 1)`, GET only. Reference warband: **#2 "Monks"** (campaign 1 "Shards"): 2 living heroes (+1 dead), 3 living henchmen groups (+1 dead group, 2 dead henchmen), 3 living hired swords (+1 dead), 5 hero items, 5 henchmen items, 10 hired-sword items, 38 trades, 128 logs. In production every request also pays one extra query for the JWT user lookup, and every query is a round trip to Neon.

## Summary

| Dimension | Verdict |
| --- | --- |
| Performance | **Poor.** List endpoints are prefetched and O(1) in unit count, but every unit write (including a single XP "+" click) re-serializes the unit without prefetch: about **77 queries for one hero PATCH**. Every "detail" endpoint has an `ItemAvailability` N+1 (35 to 37 queries for 2 to 3 units). Each warband-scoped request repeats 5 overhead queries, 2 to 3 of them unused. Opening the sheet takes 5 requests (54 queries) in two sequential stages, after the campaign layout has finished loading 5 full catalogues. |
| Bugs | **Several real defects.** Saving a henchmen group deletes its dead henchmen (silent data loss). Postbattle XP ignores custom thresholds and half-rate. Editing XP down and back up awards the same level-ups again. Lad's Got Talent does not use up the group's level-up. The hero cap counts dead heroes. The frontend shows edit controls to non-editors (the Trade badge is confirmed, plus the XP +/- buttons and the pending-skill dialogs). Race maximums are never enforced. |
| Code quality | **Heavy triplication.** About 5,200 of 12,400 lines across the hero/henchmen/hired-sword files are near-copies once unit names are normalised. Every view repeats a hand-written permission preamble (43 handlers). `Warband.tsx` (1,070 lines) owns hero edit state while the henchmen and hired-sword sections own theirs. `HenchmenFormCard` re-implements the shared form components. There is dead code throughout. |
| UI/UX | **Confusing edit semantics.** "Create hero" spends gold immediately and Cancel does not undo it, while "Dismiss" says "cannot be undone" but Cancel does undo it. The race picker and the card expand/XP controls cannot be used from the keyboard. Edits are discarded silently when you switch tabs. |
| Security | Minor. Catalogue IDs are not scoped to the campaign (another campaign's custom race, item or skill can be attached and then read back). The warband-link iframe has no sandbox and is granted clipboard permissions. |
| Tests | Backend has 15 roster tests (item cost defaults, henchmen/hired-sword XP seeding and `no_level_ups`, hired-sword cap) and battles has 4 kill-history tests. There are **no hero CRUD, level-up, leader, permission or query-count tests.** The frontend has 17 test files (2 duplicated) and no coverage of the hero save, half-rate, permission gating or level-up hooks. |

**Top 5 findings**
1. **ROST-PERF-01**: Unit PATCH and level-up responses are serialized without prefetch: about 77 queries per hero XP click.
2. **ROST-PERF-02**: `ItemAvailability` N+1 in every unit detail payload (`heroes/detail` 37 queries, `hired-swords/detail` 36, single hero 35).
3. **ROST-BUG-02**: Saving a henchmen group deletes its dead henchmen and their kill records.
4. **ROST-BUG-01**: Postbattle XP ignores campaign-specific thresholds and the half-rate flag, so level-ups diverge from the XP bar.
5. **ROST-PERF-03**: The sheet load is 5 requests in 2 sequential stages (54 queries, 25 of them repeated overhead) and could be one request of about 15 to 20 queries.

Must-verify on a phone: **ROST-PERF-07** (likely an endless re-render loop while editing on mobile).

## How it works

### Data model (`backend/apps/warbands/models/`)
- `Warband` (unique per campaign+user) has `heroes`, `henchmen_groups` (each with `henchmen`), `hired_swords`, plus economy tables (`WarbandItem`, `WarbandTrade`, `WarbandLog`, `WarbandResource`). `Warband.restrictions` (M2M) still exists but is no longer read. Effective restrictions come from `campaign.settings.item_settings` (`restrictions.py:14`).
- `Hero`, `HenchmenGroup` and `HiredSword` all extend the abstract `StatBlock` (9 stats, validators 0–10 plus DB `CheckConstraint`s). Each repeats the same ~15 fields (`name`, `unit_type`, `race`, `price`, `xp` Decimal(6,1), `level_up`, `level_up_history` JSON, `deeds`, `armour_save`, `large`, `half_rate`, `dead`, timestamps) and has 3 to 4 through tables (`*Item` with `cost`, `*Skill`, `*Special`, `*Spell`). Differences: hero has `kills`, `is_leader`, `caster`, `available_skills`, `trading_action`; henchmen group has `max_size`, `no_level_ups`, and `Henchman` children (`name`, `kills`, `dead`); hired sword has hire/upkeep price and expressions, `rating`, `blood_pacted`, `no_level_ups`, `caster`, `available_skills`.
- `Race` is also a `StatBlock`. Its values are the **racial maximums** shown as "/max" in the UI.

### Endpoints (`backend/apps/warbands/urls.py`, all prefixed with `/api/`)
| Endpoint | View | Notes |
| --- | --- | --- |
| `GET/POST warbands/` | `WarbandListCreateView` | GET returns the user's warbands (filter `campaign_id`); POST creates the warband + "Treasure" resource + starting-gold trade |
| `GET/PATCH/DELETE warbands/:id/` | `WarbandDetailView` | delete is owner-only |
| `GET warbands/:id/summary/` | `WarbandSummaryView` | gold (sum of all trades), rating, resources, id/name lists of living units |
| `GET/POST warbands/:id/{heroes,henchmen-groups,hired-swords}/` | `*ListCreateView` | "summary" serializers; POST creates + logs + recruit trade |
| `GET warbands/:id/{...}/detail/` | `*DetailListView` | "detail" serializers (race object, item properties and availabilities), used when entering edit mode |
| `GET/PATCH/DELETE warbands/:id/{...}/:unit_id/` | `*DetailView` | PATCH replaces the whole loadout when lists are present; XP change → level-ups |
| `POST .../:unit_id/level-up/` | `*LevelUpView` | consumes one `level_up`, applies stat +1 or adds a "New Skill/Spell/Special" placeholder, appends `level_up_history` |
| `GET .../:unit_id/kill-history/` | `kill_history.py` | scans `BattleEvent` JSON payloads |
| `GET/PUT warbands/:id/restrictions/` | `WarbandRestrictionsView` | PUT is a no-op that echoes the effective list |

Permissions: view = campaign membership; edit = warband owner **or** a member whose role is owner or admin, or who holds `manage_warbands` (`permissions.py`). Every handler checks this by hand (see ROST-CQ-02). Leader invariant: `utils/leaders.py:ensure_single_living_leader` runs after hero create, update and delete, and after postbattle.

XP → level-ups: `count_new_level_ups(prev, next, thresholds)` (hero, Decimal-aware) and `count_new_henchmen_level_ups` (henchmen and hired swords, integer-truncated) count thresholds in `(prev, next]`. They are called from the unit update serializers with the campaign's `*_level_thresholds` when `xp` is sent without `level_up`. Seeded XP on create gives no level-ups. Hired swords default to the henchmen table `[2,5,9,14]` and the frontend uses `getHenchmenLevelInfo` for them. This is consistent within the app; whether it matches the Mordheim rule for Hired Swords is worth confirming with William. `no_level_ups` (henchmen and hired swords only) hides the XP bar and the level-up banner, makes the level-up endpoint return 400, and zeroes postbattle XP.

### Frontend flow
- `routes/Warband.tsx` (1,070 lines) renders inside `CampaignLayout`. That layout blocks rendering until the campaign **and 5 catalogue lists** (items, skills, spells, specials, races) have loaded (`CampaignLayout.tsx:381-405, 579`; owned by FE and CAT).
- `useWarbandLoader` makes `GET warbands/?campaign_id` (or `GET warbands/:id/`), **then** `Promise.all` of summary, heroes, hired-swords and henchmen-groups (`useWarbandLoader.ts:156-169`).
- `WarbandTabContent` renders the three sections. The **hero** edit state lives in `Warband.tsx` (`useHeroForms`, `useHeroCreationForm`, `useWarbandSave`, `useWarbandEditState`). The **henchmen** and **hired-sword** sections own their edit state internally (`WarbandHenchmenSection.tsx`, `WarbandHiredSwordsSection.tsx`).
- Cards: `*SummaryCard` (header, stats, `ExperienceBar`, `*ListBlocks`) expands into `*ExpandedCard`, which fetches the unit detail endpoint if the summary lacks race and similar fields. The "Level Up!" banner comes from `*LevelUpControl`, which opens `*LevelUpDialog` driven by `hooks/levelup/use*LevelUp.ts`.
- Edit mode: "Edit X" loads `GET .../detail/` → forms. "Add X" → "Create X" **POSTs immediately** (recruit trade, gold spent). Item purchases are queued as `pendingPurchases`. "Save" sends PATCH per changed unit + DELETE per dismissed unit, then sequential trade/log POSTs per purchase (`pending-purchases.ts:114`), then `GET summary`.
- Cross-component sync uses a `window` `CustomEvent("warband:updated")` (`api/warbands-events.ts`). `useWarbandUpdateListener` merges the payload and, **if no summary is attached, refetches `GET summary`**. `Warband.tsx:554-596` also mirrors local roster state into the global context store.

### Measured sheet load (warband 2 "Monks", user 1 = owner)

| # | Request | Stage | Queries | Bytes |
| --- | --- | --- | --- | --- |
| 1 | `GET /api/warbands/?campaign_id=1` | 1 | 4 | 673 |
| 2 | `GET /api/warbands/2/summary/` | 2 | 12 | 597 |
| 3 | `GET /api/warbands/2/heroes/` | 2 | 14 | 1,618 |
| 4 | `GET /api/warbands/2/hired-swords/` | 2 | 13 | 2,620 |
| 5 | `GET /api/warbands/2/henchmen-groups/` | 2 | 11 | 1,563 |
| | **Total** | 2 round-trip stages | **54** (+5 JWT lookups in prod) | |

Viewing another member's warband (`GET /api/warbands/2/` as user 2) costs 5 + the same 50. Follow-up actions:

| Action | Requests | Queries |
| --- | --- | --- |
| Expand a hero card (Monks hero #2) | `GET heroes/2/` | 35 |
| Open the hero level-up dialog | `GET heroes/2/` again (summary lacks `race`) | 35 |
| "Edit Heroes" | `GET heroes/detail/` | 37 |
| "Edit Henchmen" | `GET henchmen-groups/detail/` + `GET items/` | 20 + stash |
| "Edit Hired Swords" | `GET hired-swords/detail/` | 36 |
| Hover kill count → named kills | `GET heroes/2/kill-history/` | 8 (seq-scan on `battle_event`) |
| Hero XP "+" click | `PATCH heroes/2/` | about 77 (51 measured for the response alone) |
| Henchmen or hired-sword XP "+" click | `PATCH ...` + `GET summary/` | about 30–50 + 12 |

Scaling: summary and list endpoints are **constant** in the number of units, items and skills (prefetch). Every **detail** payload, and every PATCH and level-up response, grows by about `1 + A·(1 + R)` queries per item row (A = availabilities, R = restriction links per availability) plus 1 per skill, special or spell after writes.

## Performance

### ROST-PERF-01 · P1 · Unit PATCH and level-up responses re-query every relation (about 77 queries per hero XP click)
- **Where:** `backend/apps/warbands/serializers/heroes.py:648` (`hero.refresh_from_db()` at the end of `HeroUpdateSerializer.update`), `views/heroes.py:244`; `serializers/henchmen.py:388-392` and `serializers/hired_swords.py:417-424` (prefetch caches popped); `views/heroes.py:378-389` and `views/hired_swords.py:376-387` (`refresh_from_db()` + re-fetch); write-path extras in `serializers/heroes.py:563,586`, `utils/leaders.py:4-17`; client trigger `frontend/src/features/warbands/utils/warband-utils.ts:564-600` (XP saver), `components/shared/unit_details/ExperienceBar.tsx:61-121`.
- **What:** The view fetches the hero with a full prefetch. Django's `refresh_from_db()` (5.0.3, verified) then resets `_prefetched_objects_cache` and cached FKs, so `HeroDetailSerializer(hero)` falls back to `get_prefetched_or_query` → `list(hero.hero_items.all())` and then lazily loads `entry.item`, `item.property_links`, `item.availabilities` → `restriction_links` → `restriction`, and each `entry.skill/special/spell` one at a time. Measured: serializing Monks hero #2 (4 items, 3 skills, 5 specials, 3 spells) after refresh = **51 queries**; hired sword #41 (5 items) = 38; henchmen group #2 (3 items) = 23. The write path adds about 26 more for a plain XP change: warband fetch with 3 prefetches (4), membership (1), hero prefetch (11), race PK validation (1), `get_trait_specials` (1), UPDATE (1), `instance.warband.campaign.settings` (3 lazy loads, not select_related), `ensure_single_living_leader` (1 SELECT + 2 UPDATEs, even when the leader did not change), refresh (1). The XP saver sends `name/unit_type/race/price/xp/is_leader`, so every "+" click pays the whole path.
- **Impact:** At 5–20 ms per Neon round trip, a single XP click costs about 0.4–1.5 s of DB time, and cross-region far more. Editors click + several times per postbattle and per unit, so this multiplies directly with users. A full edit-mode Save of N heroes runs N such PATCHes in parallel (about 90 queries each with loadout rewrites), contending for the same DB connection budget.
- **Fix:** (1) Remove `hero.refresh_from_db()` and the cache pops. After `serializer.save()`, re-fetch once with a shared `UNIT_DETAIL_PREFETCH` (including availabilities, see PERF-02) and serialize that. (2) Select `warband__campaign__settings` when loading the unit (or pass `warband` into the serializer context) instead of `instance.warband.campaign.settings`. (3) Call `ensure_single_living_leader` only when `is_leader` or `dead` is in `validated_data`. (4) Add a slim `PATCH .../xp/` (or let the client send only `{xp}`) that does `filter(pk=..).update(xp=..., level_up=F("level_up")+n)` and returns `{id, xp, level_up}`. That is about 6 queries instead of 77.
- **Effort:** M · **Confidence:** Confirmed (response part measured; write part counted from code)

### ROST-PERF-02 · P1 · `ItemAvailability` N+1 in every unit detail payload
- **Where:** `backend/apps/warbands/serializers/heroes.py:175-201` (`ItemDetailSerializer.availabilities = ItemAvailabilitySerializer(many=True)`), used by `HeroDetailSerializer`, `HenchmenGroupDetailSerializer` and `HiredSwordDetailSerializer`; prefetch lists in `views/heroes.py:116`, `views/henchmen.py:147`, `views/hired_swords.py:119`, `views/warbands.py:58-88` (`UNIT_TYPE_CONFIG`, used by item transfer and sale responses).
- **What:** Prefetches stop at `..._items__item__property_links__property`. Each item row then runs `SELECT item_availability WHERE item_id = X`, plus one `item_availability_restriction` query per availability, plus one `restriction` query per link. Measured: `heroes/detail` = 16 base + 21 N+1 = **37**; `hired-swords/detail` = **36**; `henchmen-groups/detail` = 20; single `heroes/2/` = 35. Identical items on different rows are queried again because `.all()` on an unprefetched manager is not cached.
- **Impact:** Entering edit mode, expanding a card, opening a level-up dialog, and every item move or sell response (two unit serializations each) scale with item count. A typical 12–15-model warband with 25–40 items needs 100–200 queries per detail call.
- **Fix:** Either prefetch `..._items__item__availabilities__restriction_links__restriction` (constant 3 extra queries), **or** drop `availabilities` from unit item payloads. The only roster consumer is the rarity line in `components/shared/unit_details/DetailCardContent.tsx:110-114`, and the same data is already in the cached campaign item catalogue (`lookups.availableItems`), so look it up by `item.id` client-side. Also use `Prefetch("hero_items", queryset=HeroItem.objects.select_related("item"))` and the equivalents for skills, specials and spells to replace two queries per relation with one (see PERF-11).
- **Effort:** S · **Confidence:** Confirmed (measured)

### ROST-PERF-03 · P1 · Sheet load: 5 requests in 2 sequential stages with 25 repeated overhead queries
- **Where:** `frontend/src/features/warbands/hooks/warband/useWarbandLoader.ts:156-169`; `backend/apps/warbands/views/mixins.py:291-299` (`WarbandObjectMixin.get_warband`); `permissions.py:330-357`; `views/warbands.py:191-203`.
- **What:** The loader first resolves the warband (1 request), and only then fires summary, heroes, hired swords and henchmen in parallel (4 requests). Each warband-scoped request re-runs the same 5 queries: warband+campaign+settings, `resources`, `restrictions` (the `Warband.restrictions` M2M is **never read anywhere**), `campaign__settings__item_settings` (only read by `WarbandSerializer` and `/restrictions/`), and membership. That is 25 of the 54 queries. `GET warbands/?campaign_id` prefetches `resources` and `restrictions` for a serializer that uses neither. In production each request also pays a JWT user lookup, a new TLS connection to Neon (see INFRA), and Render's per-request overhead. All of this only starts after `CampaignLayout` has fetched 5 full catalogues (FE/CAT).
- **Impact:** At least two serial round trips plus about 59 DB round trips before the roster appears. With several players opening sheets at once, this is the dominant read load in this area.
- **Fix:** Add `GET /api/warbands/:id/sheet/` (and `GET /api/campaigns/:id/my-warband/sheet/`) returning `{warband, summary, heroes, henchmen_groups, hired_swords}`, built from one warband fetch, one membership check, aggregated gold (PERF-04) and the three unit querysets with `select_related` Prefetches. That is about 15–20 queries and one round trip. Keep the old endpoints for compatibility. Meanwhile, make the mixin's prefetch opt-in: drop `restrictions` everywhere, and prefetch `item_settings` and `resources` only in the views that serialize them. That alone is 2–3 queries fewer per request on 43 handlers.
- **Effort:** M · **Confidence:** Confirmed (measured)

### ROST-PERF-04 · P2 · Summary recomputes gold from every trade row and is refetched after unrelated edits
- **Where:** `backend/apps/warbands/serializers/warbands.py:286-341`; `frontend/src/features/warbands/hooks/warband/useWarbandUpdateListener.ts:90-99`; emitters `components/henchmen/WarbandHenchmenSection.tsx:336-345`, `components/hiredswords/WarbandHiredSwordsSection.tsx:341-349`.
- **What:** `get_gold` loads **all** `WarbandTrade` rows (38 for Monks, and growing for the life of the campaign) into Python. `get_rating` runs 3 aggregate queries and `get_heroes/hired_swords/henchmen_groups` 3 more, for a total of 12. The rating is computed again client-side (`calculateWarbandRating`). Any `emitWarbandUpdate` without a `summary` triggers `GET summary`, and that includes every henchmen or hired-sword XP click and level-up, although gold cannot change. Hero XP clicks do not trigger it, so the behaviour is inconsistent.
- **Impact:** An extra 12-query request per henchmen or hired-sword XP click or level-up. Transfer size and CPU for gold grow linearly with ledger size.
- **Fix:** `gold = trades.aggregate(total=Sum(Case(When(action__iregex=..., then=-Abs("price")), default=Abs("price"))))` (or store a signed price, which ECON already recommends). Compute rating and the id/name lists from one `values()` per unit table. In the frontend, only emit the event without a summary when gold can change (create, delete, purchase). For XP and level-up, pass `{henchmenGroups: [updated]}` and set a flag that skips the summary refetch.
- **Effort:** S · **Confidence:** Confirmed

### ROST-PERF-05 · P2 · Save with purchases runs 2K+1 sequential HTTP requests, not atomically
- **Where:** `frontend/src/features/warbands/utils/pending-purchases.ts:114-185`; `hooks/henchmen/useWarbandHenchmenSave.ts:369-372` (sequential stash removals); `hooks/warband/useWarbandSave.ts:206-211`; `hooks/hiredswords/useWarbandHiredSwordsSave.ts:191-196`.
- **What:** After the unit PATCHes, each pending purchase is `await createWarbandTrade(...)` **then** `await createWarbandLog(...)`, one at a time, plus a "Group" header when there is more than one purchase. Henchmen stash consumption is one awaited DELETE per item. Each request costs about 6–7 queries (mixin overhead + membership + insert). The item rows themselves were already attached by the PATCH, so a failure midway leaves items attached with no gold deducted, or gold half deducted.
- **Impact:** Buying 6 items for a group means 13 sequential round trips (several seconds on Render+Neon) while the Save button spins. A partial failure corrupts the treasury (ECON).
- **Fix:** Send purchases with the unit PATCH (for example `purchases: [{item_id, qty, unit_price, reason}]`) and create trades and logs server-side with `bulk_create` inside the same `transaction.atomic()`, or add a batch endpoint `POST warbands/:id/purchases/`. At minimum, `Promise.all` the log writes.
- **Effort:** M · **Confidence:** Confirmed

### ROST-PERF-06 · P2 · Card expand, level-up dialog and edit mode each refetch heavy detail endpoints
- **Where:** `frontend/src/features/warbands/components/heroes/cards/HeroExpandedCard.tsx:35-39,86-107` (and the henchmen and hired-sword copies at `HenchmenExpandedCard.tsx:35,67-87`, `HiredSwordExpandedCard.tsx:37,71-92`); `hooks/levelup/useHeroLevelUp.ts:66-75` (and `useHenchmenLevelUp.ts:110-118`); `routes/Warband.tsx:659-699`; `backend/apps/warbands/serializers/heroes.py:253-302` (summary lacks `race`, `kills`, `deeds`).
- **What:** The summary payload omits `race` even though the queryset already `select_related("race")`, so (1) every expand fetches `GET heroes/:id/` (35 queries) and stores the result only in the card's local state, so collapse and re-expand fetches again; (2) every level-up dialog fetches it again for race maximums. `Warband.tsx:loadHeroDetail` is dead because its `hasHeroDetail` treats `large` as a detail marker, but `large` is in the summary, so it never fetches while the card fetches anyway. Edit mode then loads `.../detail/` for the whole section.
- **Impact:** 2 to 3 extra requests of 13–51 queries each per unit a user inspects.
- **Fix:** Add `race` (RaceSummarySerializer, which costs no queries), `kills` and `deeds` to the summary serializers. With PERF-02 fixed, simply serve the detail shape from the list endpoints (or the sheet endpoint) and delete the summary/detail split and the `hasXDetail` heuristics. If a split remains, lift fetched detail into the section state (`setHeroes`) so it is cached for the session.
- **Effort:** S · **Confidence:** Confirmed

### ROST-PERF-07 · P1 · Mobile edit mode re-renders in an endless effect loop
- **Where:** `frontend/src/features/warbands/hooks/warband/useWarbandMobileTopBar.tsx:180-197` and `:286-330` (`useLayoutEffect` → `setMobileTopBar`); `hooks/warband/useWarbandSave.ts:76` (unmemoised `handleSaveChanges`); `components/henchmen/WarbandHenchmenSection.tsx:315,418-426` and `components/hiredswords/WarbandHiredSwordsSection.tsx:319,396-404`; `routes/Warband.tsx:1033-1040` (inline lambdas).
- **What:** While `isMobile && isEditing`, the hero effect depends on `handleSaveChanges`, which is a new function every render. Each run calls `setMobileEditState({...})` with a new object, so `Warband` re-renders, which produces a new `handleSaveChanges`, which runs the effect again, and so on. The layout effect also pushes new JSX into `CampaignLayout` via `setMobileTopBar` on every `mobileEditState` change, re-rendering the whole layout. The henchmen and hired-sword sections do the same through `onMobileEditChange` (new `cancelEditing`/`handleSaveChanges` plus an inline parent lambda each render). There is no equality guard. Desktop is unaffected because `handleMobileEditChange` returns early when `!isMobile`.
- **Impact:** On phones in edit mode, CPU stays busy re-rendering the campaign layout continuously: laggy typing and battery drain. React DEV should log "Maximum update depth exceeded… useEffect". Only the pure helpers of this hook are tested (`__tests__/useWarbandMobileTopBar.test.tsx`).
- **Fix:** Memoise `handleSaveChanges`/`cancelEditing` (`useCallback`, or keep the latest version in a ref and expose a stable wrapper). Store `onSave`/`onCancel` in refs and put only primitive fields (`section`, `isSaving`, navigation ids) in state. Bail out when unchanged (`setMobileEditState(prev => shallowEqual(prev, next) ? prev : next)`). Wrap the per-section callbacks in `Warband.tsx` with `useCallback`.
- **Effort:** S · **Confidence:** Likely. Verify in a 375 px viewport with the React profiler or by watching the console warning.

### ROST-PERF-08 · P2 · Mirroring the roster into the global context store re-renders the app on every unit change
- **Where:** `frontend/src/features/warbands/routes/Warband.tsx:554-596`; `hooks/warband/useWarbandLoader.ts:94-120`; `frontend/src/stores/app-store.tsx:81,422-523` (one React context, `useAppStore()` without selectors); consumers such as `hooks/shared/useExperienceBar.ts:29`.
- **What:** Every change to `heroes`, `hiredSwords` or `henchmenGroups` (XP click, trade badge, level-up) calls `setStoreWarband({...})`. That changes the context value, which re-renders **every** `useAppStore()` consumer, including each `ExperienceBar` (2 per unit card) and the layout. `initialWarband` changes in turn, and the loader's layout effect calls `setWarband(mergeWarbandSnapshots(...))`, which always returns a new object, so there is a second render pass before the equality check stops it.
- **Impact:** 3+ renders of the page and of all store consumers per mutation. This is noticeable on mobile with 10+ cards.
- **Fix:** Stop mirroring the full roster into the store. Store only `{id, campaign_id, name, gold}` if other pages need it, or move the roster into a query cache (TanStack Query, see FE). Split the store context or use `useSyncExternalStore` selectors (FE owns the store).
- **Effort:** M · **Confidence:** Likely

### ROST-PERF-09 · P3 · Henchmen create and update loop single-row writes and are not atomic
- **Where:** `backend/apps/warbands/views/henchmen.py:78-129,208-268`; `serializers/henchmen.py:360-386`; `views/hired_swords.py:65-101`.
- **What:** Creating a group of N henchmen runs `log_warband_event` + `TradeHelper.create_trade` per henchman (2N INSERTs). The update serializer issues one `UPDATE` per existing henchman on every save, even when nothing changed. Neither view uses `transaction.atomic()` (the hero POST does), so an exception midway leaves a group with no trade, or trades with no log.
- **Fix:** `bulk_create` logs and trades; `bulk_update` henchmen, only for changed rows; wrap create and update in `transaction.atomic()`.
- **Effort:** S · **Confidence:** Confirmed

### ROST-PERF-10 · P3 · Kill history seq-scans `battle_event` across all campaigns
- **Where:** `backend/apps/warbands/views/kill_history.py:84-92,112-120,146-154`.
- **What:** It filters by `type` plus JSON paths `payload_json #> '{killer,unit_type}'` and `'{killer,unit_id}'`, and neither is indexed. `EXPLAIN` shows `Seq Scan on battle_event`. The table grows with every combat event in every campaign. There is also no campaign scoping.
- **Fix:** Add a partial expression index `ON battle_event ((payload_json->'killer'->>'unit_type'), ((payload_json->'killer'->>'unit_id')::int)) WHERE type='unit_kill_recorded'`, or write `killer_unit_type`/`killer_unit_id` columns when recording kills (BATL). Filter on `battle__campaign_id` too.
- **Effort:** S · **Confidence:** Confirmed (plan checked; small table today)

### ROST-PERF-11 · P3 · Prefetching through join tables costs two queries per relation
- **Where:** `backend/apps/warbands/views/heroes.py:44-49,115-120`; `views/henchmen.py:57-62`; `views/hired_swords.py:44-49`.
- **What:** `prefetch_related("hero_skills__skill")` runs one query for `hero_skill` and another for `skill`. For heroes that is 8 queries over 4 relations. `Prefetch("hero_skills", queryset=HeroSkill.objects.select_related("skill"))` does it in 1. The model rows also load `level_up_history` and `available_skills` JSON that the summary does not need.
- **Fix:** Define `UNIT_PREFETCHES` per unit type with `select_related` Prefetches (the heroes list goes from 14 to 10 queries, hired swords from 13 to 9). Add `.defer("level_up_history")` on list querysets.
- **Effort:** S · **Confidence:** Confirmed

## Bugs

### ROST-BUG-01 · P1 · Postbattle XP ignores campaign thresholds and half-rate
- **Where:** `backend/apps/battles/views/shared.py:1747-1752` (heroes), `:1772-1777` (hired swords), `:1817-1822` (henchmen); compare `backend/apps/warbands/serializers/heroes.py:586-588`, `serializers/henchmen.py:320-322`, `serializers/hired_swords.py:363-365`.
- **What:** Postbattle, the main place XP accrues, calls `count_new_level_ups(previous_xp, next_xp)` and `count_new_henchmen_level_ups(...)` **without** `thresholds`, so it always uses the default tables. The roster PATCH path and the frontend XP bar (`getHeroLevelInfo(xp, campaign.hero_level_thresholds)`) use the campaign's custom thresholds. Postbattle also adds the full integer `xp_earned` (`_coerce_int`) regardless of `half_rate`. The frontend postbattle code never reads `half_rate` either (grep: no matches in `features/battles`).
- **Impact:** In any campaign with custom thresholds, the "Level Up!" banner count disagrees with the XP bar (missing or extra advances). Half-rate units (for example some hired swords and Typhus-style henchmen) gain double XP after every battle.
- **Fix:** Load `campaign.settings` once in finalisation and pass `hero_level_thresholds`, `henchmen_level_thresholds` and `hired_sword_level_thresholds`. Apply `xp_earned * Decimal("0.5")` when `unit.half_rate`; the field is Decimal(6,1), so halves are representable. Better: route both paths through one `apply_xp_gain(unit, delta, settings)` helper in `apps/warbands/utils/` (see BUG-03). Cross-reference BATL.
- **Effort:** S · **Confidence:** Confirmed (code)

### ROST-BUG-02 · P1 · Saving a henchmen group deletes its dead henchmen (silent data loss)
- **Where:** `backend/apps/warbands/serializers/henchmen.py:360-386`; `views/henchmen.py:39-40` (`_alive_henchmen_prefetch`); `frontend/src/features/warbands/hooks/henchmen/useWarbandHenchmenSave.ts:344-354`; `hooks/levelup/useHenchmenLevelUp.ts:241-255`.
- **What:** List and detail endpoints only return living henchmen (`Henchman.objects.filter(dead=False)`), so edit forms only contain living ones and the Save payload sends only living ones. The serializer computes `existing_ids = set(group.henchmen.values_list("id"))` (a fresh query that returns **all** henchmen, dead included) and deletes `existing_ids - incoming_ids`. Every edit of a group therefore hard-deletes the dead members that postbattle marked `dead=True` (`battles/views/shared.py:1804-1806`). Local data shows group 1 of Monks with two dead henchmen (`John`, kills=1, and `Alfred`) that would vanish on the next edit of that group. Lad's Got Talent's `updateWarbandHenchmenGroup(..., henchmen: nextHenchmen)` does the same.
- **Impact:** Kill counts of fallen henchmen disappear from the group kill history (`kill_history.py:140-142` sums member kills) and from campaign "top killers". Any audit trail of who died is lost. By the README rubric (data loss) this is arguably P0. It is graded P1 because only historical records are affected.
- **Fix:** Scope the sync to living members: `existing_ids = set(group.henchmen.filter(dead=False).values_list("id", flat=True))`, and never delete dead rows from this path. Better, make deletion explicit (`removed_ids: [...]`) instead of "missing means delete". Add a regression test (ROST-TEST-03).
- **Effort:** S · **Confidence:** Confirmed (code path read end to end)

### ROST-BUG-03 · P2 · Editing XP down and back up awards the same level-ups again
- **Where:** `backend/apps/warbands/utils/hero_level.py:64-75`, `utils/henchmen_level.py:123-133`; callers `serializers/heroes.py:581-591`, `serializers/henchmen.py:313-325`, `serializers/hired_swords.py:356-368`; UI XP inputs `frontend/src/features/warbands/components/shared/forms/UnitBasicInfo.tsx:535-545,633-643`, `components/henchmen/forms/HenchmenFormCard.tsx:450`.
- **What:** Level-ups are counted as "thresholds crossed going up on this request" and never decremented when XP goes down. Example: a typo saves XP 13 instead of 3 (+3 level-ups at 4, 6, 8, 11). Correcting it to 3 leaves the 3 level-ups. Later reaching 13 for real awards them again. The same works deliberately (3 → 1 → 3 repeats the threshold-2 level). The XP bar blocks "-" below the current threshold, but the edit form XP field does not.
- **Impact:** Phantom or duplicate advances, which corrupts the rules the app exists to track. Hard to notice and hard to undo (the level-up counter is not editable in the UI).
- **Fix:** Make the derivation idempotent: `level_up = max(0, count_level_thresholds(xp, thresholds) - advances_taken - seeded_levels)`, where `advances_taken = len(level_up_history)` and `seeded_levels = count_level_thresholds(initial_xp)` is stored at create (add `xp_seed` or `levels_seeded` columns). Alternatively persist `xp_high_water` and only count thresholds above it. Apply the same helper in postbattle (BUG-01).
- **Effort:** M · **Confidence:** Confirmed (logic)

### ROST-BUG-04 · P2 · Lad's Got Talent keeps the group's level-up, and the promotion is a 3–4-request non-atomic chain
- **Where:** `frontend/src/features/warbands/hooks/levelup/useHenchmenLevelUp.ts:186-262`.
- **What:** On a 10–12 roll the user re-rolls a stat. The hook then (1) `POST heroes/` with `level_up: 2` and `ignore_max_heroes: true`, (2) `POST heroes/:new/level-up/` applying the stat to the new hero, (3) PATCH or DELETE the group, (4) emits, which triggers `GET summary`. The group's own `level_up` is never decremented: `levelUpWarbandHenchmenGroup` is not called on this branch and the PATCH sends no `level_up`. After a promotion the group still shows "Level Up!" and can take another advance. If (2) or (3) fails, the new hero exists **and** the henchman is still in the group. Retrying creates a second hero.
- **Impact:** An extra advance per Lad's Got Talent result, and duplicate models after a flaky network on mobile.
- **Fix:** Add a backend endpoint `POST henchmen-groups/:id/promote/ {henchman_id, advance}` that in one transaction creates the hero (copying stats, skills, specials and the per-henchman share of items), removes the henchman (or deletes an emptied group), decrements `group.level_up`, appends history to both, and logs. The frontend then makes one call.
- **Effort:** M · **Confidence:** Likely (code read; confirm the intended rule with William)

### ROST-BUG-05 · P2 · The hero cap counts dead heroes on the server but living heroes in the UI, and the client can bypass it
- **Where:** `backend/apps/warbands/views/heroes.py:65-76`; `frontend/src/features/warbands/hooks/heroes/useHeroCreationForm.ts:130`; `hooks/levelup/useHenchmenLevelUp.ts:229`.
- **What:** The backend checks `Hero.objects.filter(warband=warband).count() >= max_heroes`, with no `dead=False`. The UI limit uses the living forms (`heroForms.length`). Monks has 3 heroes in the DB (1 dead) and 2 alive, so with `max_heroes=6` the UI allows a 6th living hero but the API answers "Warband already has 6 heroes" at 5 living. Separately, any client can send `ignore_max_heroes: true` (popped from `request.data`) to skip the check entirely. Hired swords count correctly (`dead=False`, excluding blood-pacted, `views/hired_swords.py:73-79`). Henchmen have no group-size (`max_size`) or warband `max_units` enforcement server-side at all (see BUG-15).
- **Fix:** Count `dead=False`. Replace the client flag with a server-side reason (the promotion endpoint from BUG-04 can bypass internally).
- **Effort:** S · **Confidence:** Confirmed

### ROST-BUG-06 · P2 · Creating a leader hero demotes the old leader in the DB immediately; Cancel leaves two crowns
- **Where:** `frontend/src/features/warbands/routes/Warband.tsx:220-259` (`appendHeroFormAsync`), `:374-399` (`cancelEditing`); `hooks/heroes/useHeroForms.ts:52-58`; `backend/apps/warbands/serializers/heroes.py:493-496`.
- **What:** "Create hero" with "Leader" ticked POSTs right away, and `ensure_single_living_leader(preferred=new)` demotes the previous leader **in the DB**. Locally, only the forms are updated (`appendHeroForm` clears `is_leader` on the other forms). The `heroes` state just appends `created`, so the old leader object still has `is_leader: true`. If the user presses Cancel, the forms are discarded, the new hero stays (it was persisted), and the roster shows **both** heroes with the crown until reload. A refetch then reveals that the leader silently changed.
- **Fix:** Return the leader change from the create response (for example `demoted_hero_ids`) and merge it, or refetch the hero list after create. Better: do not persist on "Create" (see UX-01).
- **Effort:** S · **Confidence:** Likely (traced; not reproduced in a browser)

### ROST-BUG-07 · P2 · Edit affordances shown to non-editors (the Trade badge is one of several)
- **Where:** `frontend/src/features/warbands/components/heroes/blocks/HeroCardHeader.tsx:29,31-46,84-96` (no `canEdit` prop, no `catch`); compare `components/heroes/cards/HeroExpandedCard.tsx:205,384` (`hero.trading_action && canEdit`); `components/shared/unit_details/ExperienceBar.tsx:60-73,109-122` and `hooks/shared/useExperienceBar.ts:244-246` (XP +/- buttons with no `canEdit`, `.then().finally()` without `catch`); `components/heroes/blocks/HeroListBlocks.tsx:134-140` + `components/heroes/cards/HeroSummaryCard.tsx:132-152` (pending "New Skill/Spell" opens `NewSkillDialog`/`NewSpellDialog` for anyone); `components/tabs/BackstoryTab.tsx:45` (the reverse: gated on `isWarbandOwner`, so admins and `manage_warbands` members cannot edit backstory in the UI although the API allows it).
- **What:** Confirmed: the compact hero card's Trade badge is a clickable button for anyone viewing the warband. Confirming it sends `PATCH heroes/:id {trading_action:false}` → 403. `handleConfirmTrade` has `try/finally` with no `catch`, so the dialog stays open with no message and the promise rejection is unhandled. The same pattern is not present in the henchmen or hired-sword headers (they have no Trade badge: `HiredSwordCardHeader.tsx`, `HenchmenSummaryCard.tsx:100-121`). However, **every** unit's `ExperienceBar` shows +/- to viewers: the click animates and optimistically changes XP, the PATCH returns 403, the value silently snaps back, and an unhandled rejection is logged. The backend enforces all of these correctly (`CanEditWarband`).
- **Fix:** Pass `canEdit` into `HeroCardHeader` and render the badge as a `<span>` when `!canEdit`. Add `readOnly` to `ExperienceBar` (hide the buttons). Gate the pending-entry click on `canEdit`. Add `catch` blocks that show a toast. In BackstoryTab use the same `canEdit` as the rest of the page.
- **Effort:** S · **Confidence:** Confirmed

### ROST-BUG-08 · P2 · Racial stat maximums are displayed but never enforced
- **Where:** `backend/apps/warbands/views/heroes.py:333-338`, `views/henchmen.py:354-356`, `views/hired_swords.py:331-336` (`min(10, current + 1)`); `frontend/src/features/warbands/components/heroes/dialogs/HeroLevelUpDialog.tsx:125-140`; `hooks/levelup/useHeroLevelUp.ts:96-120`; `components/shared/forms/UnitStatsGrid.tsx:89-107`.
- **What:** `Race` stores the maximum profile ("race sets the stat caps", NOTES). Level-up only clamps at the DB limit of 10. The dialog lets you tick, and the 2d6 roll auto-selects, a stat already at the race maximum, and the server applies it. A stat at 10 consumes the level-up with no effect. Edit-mode stat inputs are free text with a "/max" hint and no validation.
- **Impact:** Rules violations (for example a Human with WS 7) go unnoticed, and advances are wasted.
- **Fix:** On the server, reject (400) a stat advance when `getattr(unit, field) >= getattr(unit.race, field)` (if the unit has a race). In the UI, disable maxed stats in the dialog and, per the rules, prompt "choose the other stat" for 6/8/9 rolls. In edit mode, clamp or validate against `race` with an inline error.
- **Effort:** S · **Confidence:** Confirmed

### ROST-BUG-09 · P2 · The henchmen XP bar ignores half-rate
- **Where:** `frontend/src/features/warbands/components/henchmen/cards/HenchmenSummaryCard.tsx:129-135`, `components/henchmen/cards/HenchmenExpandedCard.tsx:188-192,397-401`.
- **What:** All three henchmen `ExperienceBar`s omit `halfRate={group.half_rate}`, so each "+" adds 1 XP to a half-rate group. The hero and hired-sword bars pass it, and the henchmen edit form honours it (`HenchmenFormCard.tsx:450`, `step={0.5}`). Combined with `getHenchmenLevelInfo`'s `Math.floor`, half steps display oddly as well.
- **Fix:** Pass `halfRate` at all three sites. Cover it with ROST-TEST-12.
- **Effort:** S · **Confidence:** Confirmed

### ROST-BUG-10 · P3 · Hero and hired-sword level-up accept any advance and can double-spend
- **Where:** `backend/apps/warbands/views/heroes.py:320-376`, `views/hired_swords.py:318-374`.
- **What:** Any `advance.id` (or none) consumes a level-up. Unknown ids are stored in history verbatim and a missing id writes no history. "Skill" and "Spell" silently do nothing if the `New Skill`/`New Spell` placeholder (seeded from `apps/skills/data/skills.json`) is missing, while "Special" creates its own placeholder. The henchmen view validates (`Invalid advance`, `views/henchmen.py:350-352`). There is no row lock: two concurrent requests (two devices, or owner + admin) both read `level_up=1` and both apply an advance.
- **Fix:** Validate `advance_id in STAT_MAP | {"Skill","Spell","Special"}`. Fail loudly if a placeholder is missing (or `get_or_create` consistently). Decrement atomically: `updated = Hero.objects.filter(pk=..., level_up__gt=0).update(level_up=F("level_up")-1)` inside `transaction.atomic()` (or `select_for_update()`), and abort if `updated == 0`.
- **Effort:** S · **Confidence:** Confirmed (code)

### ROST-BUG-11 · P3 · Leader uniqueness is best-effort; stale XP saves can move the crown back
- **Where:** `backend/apps/warbands/utils/leaders.py:4-17`; `frontend/src/features/warbands/utils/warband-utils.ts:564-575`.
- **What:** `ensure_single_living_leader` reads, then runs two UPDATEs, with no lock and no DB constraint. Two concurrent edits by different users choosing different leaders can interleave into two leaders. Concretely: the XP saver re-sends the card's cached `is_leader`. If another user has since made B the leader, a "+" click on the stale card of A sends `is_leader: true` and `ensure_single_living_leader(preferred=A)` reassigns the crown to A. The saver also re-sends `name/unit_type/race/price`, overwriting concurrent edits (lost update).
- **Fix:** Add `UniqueConstraint(fields=["warband"], condition=Q(is_leader=True, dead=False), name="one_living_leader")` and change leaders inside `transaction.atomic()` with `select_for_update()` on the warband row. XP saves must send only `xp` (PERF-01).
- **Effort:** S · **Confidence:** Likely (stale-saver path); Speculative (raw interleaving)

### ROST-BUG-12 · P3 · Hero edits cannot be saved when no hero is marked leader, including an empty list
- **Where:** `frontend/src/features/warbands/hooks/warband/useWarbandSave.ts:107-112`.
- **What:** `heroForms.some(h => h.is_leader)` is required. Dismissing the last hero, or opening "Edit Heroes" on a hero-less warband and saving, fails with "Select a leader before saving." The server auto-assigns a leader anyway (`leaders.py:10`).
- **Fix:** Only require a leader when `heroForms.length > 0`, or rely on the server rule and show who became leader.
- **Effort:** S · **Confidence:** Confirmed

### ROST-BUG-13 · P3 · Heroes created during an edit session earn level-ups for seeded XP (henchmen and hired swords do not)
- **Where:** `frontend/src/features/warbands/hooks/warband/useWarbandSave.ts:161-188` vs `hooks/henchmen/useWarbandHenchmenSave.ts:326,340` and `hooks/hiredswords/useWarbandHiredSwordsSave.ts:149,167`.
- **What:** The henchmen and hired-sword save hooks send `level_up: 0` for units created in the current session, so setting their starting XP in the edit card does not mint level-ups (tested). The hero save hook has no `sessionInitialHeroIds`. Creating a hero and then typing its starting XP into the edit form before Save produces level-ups for every threshold crossed.
- **Fix:** Mirror the session-created logic (or adopt the idempotent rule in BUG-03, which removes the need for it).
- **Effort:** S · **Confidence:** Confirmed

### ROST-BUG-14 · P3 · The default hire cost for a new henchman charges for the whole group's items
- **Where:** `backend/apps/warbands/views/henchmen.py:32-36,230,249-250`.
- **What:** When the client sends no `cost`, `_calculate_henchman_hire_cost` adds the sum of **all** `henchmen_group_items`. Group items are stored per member (the UI warns when counts are not divisible by the group size, `HenchmenSummaryCard.tsx:61-66`), so the charge is multiplied by the group size. The current UI always sends `cost`, so this only bites API or legacy callers.
- **Fix:** `items_cost = sum(costs) / max(1, living_count)`, or compute it from `getHenchmenItemMultiplier`-equivalent logic, or require `cost`.
- **Effort:** S · **Confidence:** Likely

### ROST-BUG-15 · P3 · Group size and warband unit limits are client-side only; the backend default contradicts the UI
- **Where:** `backend/apps/warbands/models/warband.py:27` (`max_units` default **0**), `models/henchmen.py:20` (`max_size`); `frontend/src/features/warbands/routes/Warband.tsx:614` (`?? 15`), `components/henchmen/forms/HenchmenFormCard.tsx:637`.
- **What:** Neither `max_size` (henchmen per group, displayed as "(n/5)") nor `max_units` is validated by any endpoint. A warband created via the API without `max_units` gets 0, which makes the UI treat every unit add as over the limit (`0 >= 0`), because `?? 15` only replaces null.
- **Fix:** Set the default to 15 (migration) and validate both limits in the create and patch views. Count `dead=False` throughout.
- **Effort:** S · **Confidence:** Confirmed

## Code quality

### ROST-CQ-01 · P1 · Heroes, henchmen and hired swords are implemented three times
- **Where:** Measured with `difflib` after normalising unit names (`hero|henchmen|hired_sword|group → UNIT`). Matching non-blank lines between siblings:

| Area | Files (lines) | Similarity (A–B / A–C / B–C) |
| --- | --- | --- |
| Backend views | `views/heroes.py` 423, `henchmen.py` 379, `hired_swords.py` 389 | 0.57 / **0.87** / 0.59 |
| Backend serializers | `serializers/heroes.py` 552, `henchmen.py` 398, `hired_swords.py` 430 | 0.58 / 0.70 / 0.79 |
| Sections | `WarbandHeroesSection` 435, `WarbandHenchmenSection` 656, `WarbandHiredSwordsSection` 675 | 0.44 / 0.48 / 0.74 |
| Summary cards | 185 / 179 / 184 | 0.74 / **0.92** / 0.77 |
| Expanded cards | 554 / 417 / 481 | 0.69 / 0.79 / 0.75 |
| List blocks | 261 / 261 / 261 | 0.74 / **0.98** / 0.73 |
| Form cards | 209 / 793 / 209 | 0.30 / **0.94** / 0.29 |
| Add forms | 257 / 181 / 462 | 0.61 / 0.60 / 0.42 |
| Save hooks | 244 / 422 / 237 | 0.47 / 0.72 / 0.55 |
| Forms + creation hooks | 89+129 / 72+127 / 69+144 | 0.72–0.80 |
| Level-up hooks | 196 / 332 / 189 | 0.45 / **0.86** / 0.39 |
| Level-up dialogs | 171 / 203 / 171 | 0.67 / **0.98** / 0.67 |
| Level-up controls | 52 / 54 / 51 | 0.85–0.93 |
| API modules | 78 / 81 / 87 | 0.64–0.78 |

  In total, about **5,200 of 12,400 lines** are near-copies. Representative duplicated blocks: the skill/special/spell added-entry logging in `views/heroes.py:188-242` = `views/hired_swords.py:190-242`; the level-up bodies `views/heroes.py:306-391` = `views/hired_swords.py:304-389`; the loadout replace logic `serializers/heroes.py:592-635` ≈ `serializers/hired_swords.py:370-415` ≈ `serializers/henchmen.py:327-358`; the `xp→level_up` block in three update serializers; `HeroLevelUpDialog.tsx` vs `HiredSwordLevelUpDialog.tsx` (98%); the `visuallyExpandedSlotId` timer in all three sections (`WarbandHeroesSection.tsx:170-182`, `WarbandHenchmenSection.tsx:359-371`, `WarbandHiredSwordsSection.tsx:427-439`); the `statusNode` loading list in all three sections; `merge*` helpers in the three save hooks and `useWarbandUpdateListener.ts:24-39`.
- **Impact:** Every fix has to be made 3 times and drifts. Examples already found: the half-rate prop is missing only on henchmen (BUG-09), session-created level-up suppression is missing only on heroes (BUG-13), only the henchmen level-up validates the advance (BUG-10), only the hero create is atomic (PERF-09), and the hero limit counts dead units while the hired-sword limit does not (BUG-05).
- **Fix (proposed shared abstraction):**
  - *Backend:* an abstract `RosterUnit(StatBlock)` holding the ~15 common fields (abstract base, so table layout is unchanged; use `related_name="%(class)s_set"` only where names already match, or keep the explicit FKs per model). A `UnitKind` registry generalising the existing `UNIT_TYPE_CONFIG` (`views/warbands.py:52-89`): `{model, join models, prefetches, read serializer, write serializer, thresholds_attr, advance_map, log_feature}`. Generic `UnitListCreateView`, `UnitDetailView`, `UnitLevelUpView` and `UnitKillHistoryView` parameterised by kind, with URLs generated per kind so the API is unchanged. Serializer mixins `LoadoutWriteMixin` (items/skills/specials/spells replace + trait-special sync) and `XpLevelMixin` (one `apply_xp_change` helper shared with postbattle). Henchmen-specific members, LGT and hire cost stay in subclasses.
  - *Frontend:* a `unitKinds` config (`api`, `mapToForm`, `validate`, `buildPayload`, `getLevelInfo`, labels, feature flags such as `hasMembers`, `hasSpells`, `hasTradeAction`). A single `useUnitSectionEditor(kind)` replacing the 3 forms, 3 creation and 3 save hooks. Generic `<UnitSection>`, `<UnitSummaryCard>`, `<UnitExpandedCard>`, `<UnitListBlocks>`, `<UnitLevelUpControl>`, `<UnitLevelUpDialog>` with slots for henchmen member lists and LGT. `HenchmenFormCard` built on `UnitBasicInfo` + `UnitLoadout` (CQ-04).
  - Expected reduction: about 4,000–5,000 lines. Do it incrementally: level-up dialog/control first (98% identical), then cards, then sections, with tests added first (see the test plan).
- **Effort:** L · **Confidence:** Confirmed (measured)

### ROST-CQ-02 · P2 · Permission checks are hand-written in 43 handlers; DRF permission classes are not wired
- **Where:** `backend/apps/warbands/views/*.py` (43 × `get_warband_or_404` + `CanViewWarband().has_object_permission(...)`, 27 × `CanEditWarband()...`); `permissions.py`; dead third copy in `views/helpers.py:1-19` (no importers); `views/warbands.py:234` (redundant `check_object_permissions` before the manual check).
- **What:** Each handler repeats 6–8 lines. Non-owner editors run `get_membership` twice (view, then edit) plus a permission query. A forgotten edit check on a new handler would be a privilege bug.
- **Fix:** A `WarbandScopedView(APIView)` whose `initial()` loads the warband (with a per-view `warband_prefetch`), caches `request.membership`, and enforces `permission_classes = [IsAuthenticated, CanViewWarband]`, plus `CanEditWarband` for unsafe methods via `get_permissions()`. Make `CanEditWarband` reuse the cached membership. Delete `views/helpers.py`.
- **Effort:** M · **Confidence:** Confirmed

### ROST-CQ-03 · P2 · `Warband.tsx` (1,070 lines) owns hero edit state; `WarbandTabContent` takes about 87 props
- **Where:** `frontend/src/features/warbands/routes/Warband.tsx:180-433,659-750,954-1043`; `components/warband/WarbandTabContent.tsx:23-47`.
- **What:** Hero forms, creation, save, cancel, pending purchases, detail loading and the mobile top bar for heroes live in the route. The henchmen and hired-sword sections encapsulate the same concerns themselves. The route also mirrors state into the store (PERF-08), renders a hidden duplicate `WarbandRatingDialog` (`:800-806`, `open={false}`), and drills about 87 props into `WarbandTabContent`, many of which only the hero section uses.
- **Fix:** Move hero editing into `WarbandHeroesSection` like the other two sections (or into `useUnitSectionEditor`, CQ-01). Extract `WarbandDesktopHeader` (`:773-898`) and `useWarbandPagePermissions` (`:304-312`). Pass catalogues via a `CatalogContext` instead of 15 props. Target: route under 300 lines.
- **Effort:** M · **Confidence:** Confirmed

### ROST-CQ-04 · P2 · `HenchmenFormCard` and the three "Add" forms re-implement shared components
- **Where:** `frontend/src/features/warbands/components/henchmen/forms/HenchmenFormCard.tsx` (793 lines; imports `SearchableDropdown`, `ItemFormDialog`, `SkillFormDialog`, `CreateSpecialDialog`, `AcquireItemDialog` directly instead of `UnitBasicInfo`/`UnitLoadout`); race pickers inlined in `heroes/forms/AddHeroForm.tsx:67-182`, `henchmen/forms/AddHenchmenGroupForm.tsx:54-142`, `hiredswords/forms/AddHiredSwordForm.tsx:202-379`, although `components/shared/forms/SearchableDropdown.tsx` exists.
- **What:** `HeroFormCard` and `HiredSwordFormCard` are 94% identical thin wrappers over `UnitBasicInfo` + `UnitStatsGrid` + `UnitLoadout`. Henchmen duplicate about 580 lines of that logic (race search, item/skill/special search, dialogs, pending-purchase plumbing). The blur-timeout dropdown pattern exists in 5 copies (UX-02).
- **Fix:** Give `UnitBasicInfo`/`UnitLoadout` a `variant="henchmen"` (no spells, member list tab, per-member item multiplier) and reduce `HenchmenFormCard` to a wrapper plus the member list. Make the Add forms use one `RacePicker` component.
- **Effort:** M · **Confidence:** Confirmed

### ROST-CQ-05 · P3 · Dead and vestigial code
- **Where / What:**
  - The create-on-Save branches in all three save hooks never run, because "Create X" always POSTs and assigns an id first: `useWarbandSave.ts:132-159`, `useWarbandHenchmenSave.ts:282-317` (including `buildRecruitNotes`'s no-choices branch, `:73-101`), `useWarbandHiredSwordsSave.ts:110-140`. `Warband.tsx:222-224` (`if (!warband) appendHeroForm`) is unreachable in edit mode.
  - `Warband.tsx:659-699`: `hasHeroDetail` is always true (summary includes `large`), so `loadHeroDetail` never fetches. `Warband.tsx:729`: `handleItemCreated` no-op. `Warband.tsx:800-806`: hidden duplicate dialog. `useHeroCreationForm.ts:125`: `isCreatingHero` is returned but unused.
  - `backend/apps/warbands/views/helpers.py` (unused). `Warband.restrictions` M2M (prefetched in 3 places, never read). `restriction_ids` accepted then discarded (`views/warbands.py:216,253`). `PUT /restrictions/` is a no-op (`views/warbands.py:712-723`), still called by `WarbandSettingsCard`.
  - `level_up_history` is written but never serialized; the frontend type declares it (`types/warband-types.ts:122,176,339`).
  - 4 stub files `features/warbands/dialogs/*.tsx` containing only "MOVED … delete this file".
  - Duplicated tests that differ only in import path: `components/shared/forms/UnitStatsGrid.test.tsx` = `forms/__tests__/UnitStatsGrid.test.tsx`; `unit_details/UnitKillHistoryTooltip.test.tsx` = `unit_details/__tests__/UnitKillHistoryTooltip.test.tsx`.
- **Fix:** Delete them. Expose `level_up_history` in detail serializers (useful for an advance log) or drop the type.
- **Effort:** S · **Confidence:** Confirmed

### ROST-CQ-06 · P3 · Sibling modules behave inconsistently
- **Where / What:**
  - Hero POST is atomic (`views/heroes.py:80`); henchmen and hired-sword POST and PATCH are not (`views/henchmen.py:78-125,208-266`, `views/hired_swords.py:81-99,184-242`).
  - The hero PATCH wraps only `serializer.save()` in `atomic`; loadout logging runs outside it.
  - `armour_save` is sent as a number for heroes (`useWarbandSave.ts:177`, `Number(...) || null`) but as a raw string for henchmen and hired swords (`useWarbandHenchmenSave.ts:335`, `useWarbandHiredSwordsSave.ts:159`), and creates use `toNullableNumber`.
  - The henchmen serializer compares raw `entry.get("id")` against int ids (`serializers/henchmen.py:365-366`), while the view coerces (`views/henchmen.py:219-223`). A string id would duplicate and then delete a member.
  - The postbattle "New Special" placeholder lookup order differs from Skill/Spell (`views/heroes.py:339-354`).
  - Two different `hasHeroDetail` heuristics (`Warband.tsx:659-666` uses `large`; `HeroExpandedCard.tsx:35-39` uses `dead`).
- **Fix:** Fold these into the shared implementation (CQ-01). Until then, align each pair.
- **Effort:** S · **Confidence:** Confirmed

### ROST-CQ-07 · P3 · Types do not describe the wire format
- **Where:** `frontend/src/features/warbands/types/warband-types.ts:111-213`.
- **What:** `WarbandHero` and `WarbandHiredSword` declare `created_at`/`updated_at` and required `dead`, which no hero serializer returns, and `level_up_history`, which none returns. The summary and detail shapes share one type with optional fields, which is why runtime "has detail" sniffing exists. The race shape is inlined twice. `WarbandHiredSword` duplicates about 90% of `WarbandHero`.
- **Fix:** `type UnitSummary<K>` / `UnitDetail<K>` generated from one base (or from OpenAPI via `drf-spectacular`). Make `race` required on detail. Remove unreturned fields.
- **Effort:** S · **Confidence:** Confirmed

## UI / UX

### ROST-UX-01 · P2 · Edit-mode semantics are inverted: "Create" commits and spends gold, "Dismiss" is reversible, Cancel undoes only some things
- **Where:** `frontend/src/features/warbands/routes/Warband.tsx:220-259,374-399`; `components/heroes/forms/HeroFormCard.tsx:89-110`; `components/shared/sections/WarbandSectionShell.tsx:139-141,174-196`; `backend/apps/warbands/views/heroes.py:246-274` (delete creates no refund trade). The henchmen and hired-sword sections behave the same (`WarbandHenchmenSection.tsx:123-168,315-323`, `WarbandHiredSwordsSection.tsx:138-173,319-328`).
- **What:** "Edit Heroes" → "Add hero" → **"Create hero" immediately POSTs**: the hero exists, a "Recruited" trade is written and gold drops at once (and any leader change is applied, BUG-06). **Cancel** then resets only the forms. The hero stays, the gold stays spent, and nothing tells the user. Conversely, "Dismiss" asks for confirmation and says "**This action cannot be undone**", but it only marks the unit for removal and Cancel restores it. Dismissing a hero created by mistake and saving deletes it **without refunding** the recruit cost. Item purchases, unlike unit creation, are deferred until Save. Switching to the Treasury, Backstory or Logs tab silently cancels every section's edits (`Warband.tsx:517-526`). Cancel never asks for confirmation even with pending purchases. "Gold after pending" is clamped at 0 (`WarbandSectionShell.tsx:139-141`), which hides overspending.
- **Impact:** Players lose gold, cannot tell what Cancel does, and fix the ledger by hand. This was one of the specific confusions raised for this review.
- **Fix:** Pick one model. **Option A (recommended):** queue new units in the form like item purchases and create them on Save, in one batched request together with their trades (PERF-05); Cancel discards everything. **Option B:** keep immediate creation but rename the button "Recruit now (−X gc)", show a toast "X recruited, −X gc", and make Dismiss of a unit recruited in this session offer "Refund X gc" (create a compensating trade server-side in the DELETE when `refund=true`). Either way: fix the Dismiss copy ("Removed when you save"), confirm Cancel when there are changes, warn before tab switches that discard edits, and show a negative "Gold after pending" in red.
- **Effort:** M · **Confidence:** Confirmed

### ROST-UX-02 · P2 · Race pickers cannot be used from the keyboard, so keyboard users cannot create units
- **Where:** `frontend/src/features/warbands/components/heroes/forms/AddHeroForm.tsx:67-79,131-182`; same pattern in `henchmen/forms/AddHenchmenGroupForm.tsx:63`, `hiredswords/forms/AddHiredSwordForm.tsx:211`, `shared/forms/SearchableDropdown.tsx:85-138` (used by `UnitBasicInfo.tsx:294-310` and `HenchmenFormCard`); `frontend/src/components/ui/action-search-input.tsx:61-63` (dropdown returns `null` when closed).
- **What:** The options are `<button onMouseDown={preventDefault}>` inside a list that opens on input focus and closes 120 ms after input **blur**. Tabbing out of the input blurs it, the list unmounts 120 ms later, and focus never reaches an option. There is no ArrowUp/ArrowDown/Enter handling, no `role="combobox"`/`listbox`/`aria-expanded`/`aria-activedescendant`, and the `<Label>`s are not associated with inputs (`AddHeroForm.tsx:101,115,129,186,200`; the "Leader" checkbox label is not clickable, `:214-225`). Race is required ("Name, type, and race are required."), so keyboard-only and switch users cannot create a hero, group or hired sword except through "Create race".
- **Fix:** Replace all five copies with one accessible combobox (Radix/shadcn `Command` + `Popover`, or `downshift`'s `useCombobox`): arrow-key navigation, Enter to select, Escape to close, focus stays in the input, and close on outside pointer instead of blur. Add `htmlFor`/`id` to labels.
- **Effort:** M · **Confidence:** Confirmed (code; behaviour follows directly)

### ROST-UX-03 · P2 · Card expand and XP controls only exist on mouse hover (desktop)
- **Where:** `frontend/src/features/warbands/components/heroes/cards/HeroSummaryCard.tsx:101-102,154-166` (same in the henchmen and hired-sword summary cards); `components/shared/unit_details/ExperienceBar.tsx:36-37,43-44,60,109`.
- **What:** On desktop (`expandButtonPlacement="hover"`), the expand button is only rendered while `onMouseEnter` state is true, and the XP +/- buttons only while the bar is hovered. Keyboard users cannot expand a unit (to see deeds, kills or the trade action) or adjust XP. Touch laptops wider than 960 px have the same problem. The +/- buttons also lack accessible names ("-" and "+" with no `aria-label`).
- **Fix:** Always render the buttons, visually hidden until `:hover`/`:focus-within` (CSS `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`), or make the whole card a disclosure button. Add `aria-label="Add 1 XP to {name}"` and similar.
- **Effort:** S · **Confidence:** Confirmed

### ROST-UX-04 · P3 · Level-up dialog accessibility and guidance
- **Where:** `frontend/src/features/warbands/components/heroes/dialogs/HeroLevelUpDialog.tsx:103-140` (and the hired-sword and henchmen copies).
- **What:** The per-stat checkboxes in the table's extra row have no labels (a screen reader hears "checkbox, not checked" 9 times). They behave as a single choice but are not a radio group. The roll table is only available in a hover tooltip. Maxed stats are not indicated (BUG-08). Nothing explains that the choice is only recorded and that new skills must be picked afterwards from the pending entry.
- **Fix:** A `RadioGroup` with `aria-label="Increase {stat}"`, the roll table inline (collapsible), maxed stats disabled with "(max)", and a hint after confirming.
- **Effort:** S · **Confidence:** Confirmed

### ROST-UX-05 · P3 · Weak validation feedback in edit forms
- **Where:** `frontend/src/features/warbands/components/shared/forms/UnitStatsGrid.tsx:89-107`; `utils/warband-utils.ts:299-309,405-415` (`buildStatPayload` drops non-numeric values); `frontend/src/lib/api-client.ts:118-132` (first error value only, without the field name).
- **What:** Stat inputs accept any text. "abc" is silently dropped (the old value is kept with no message). "12" fails server-side with a bare "Ensure this value is less than or equal to 10." that does not say which unit or stat. "4.5" fails with "A valid integer is required.". In a multi-unit Save, one failing PATCH rejects the whole `Promise.all`, but the other units are already saved, and the message does not say which failed.
- **Fix:** Use `inputMode="numeric"` with an integer 0..race-max clamp and inline errors per field. Save with `Promise.allSettled` and report per unit. Map DRF field errors to `{unit, field}`.
- **Effort:** S · **Confidence:** Confirmed

### ROST-UX-06 · P3 · The "Create hero" button ignores the limits it displays
- **Where:** `frontend/src/features/warbands/components/heroes/forms/AddHeroForm.tsx:235,245-254`; `hooks/heroes/useHeroCreationForm.ts:148-152`.
- **What:** The form shows "Maximum of N heroes reached" or "Warband unit limit reached" but leaves "Create hero" enabled. `handleAddHero` checks only the hero limit, not `isUnitLimitReached`. The backend uses a different count (BUG-05).
- **Fix:** Disable the button when either limit is hit and enforce both server-side.
- **Effort:** S · **Confidence:** Confirmed

## Security

### ROST-SEC-01 · P3 · Catalogue references are not scoped to the warband's campaign
- **Where:** `backend/apps/warbands/serializers/heroes.py:369-391` (`Item.objects.filter(id__in=...)`), `:467,476,485,597,607,628` (Skill, Special, Spell unscoped); `race` PrimaryKeyRelatedField on all create and update serializers; same in `serializers/henchmen.py` and `serializers/hired_swords.py`.
- **What:** A member can PATCH their unit with the ids of **another campaign's** custom race, items, skills, specials or spells. The detail response then returns that content (names, statblocks, properties, descriptions). The catalogue detail endpoints do check membership (`views/heroes.py:402-405,418-421`), so this is a bypass of that intent.
- **Fix:** Validate `obj.campaign_id in (None, warband.campaign_id)` for every referenced catalogue id. Ignore or 400 the others.
- **Effort:** S · **Confidence:** Confirmed (code)

### ROST-SEC-02 · P3 · The warband-link iframe has no sandbox and is granted clipboard access
- **Where:** `frontend/src/features/warbands/components/warband/WarbandPdfViewerDialog.tsx:52-60`.
- **What:** Any member's `warband_link` (any http(s) URL) is embedded with `allow="fullscreen; autoplay; clipboard-read; clipboard-write"` and no `sandbox`. Other members who click "Sheet" load an arbitrary third-party page inside the app, and that page may request clipboard read.
- **Fix:** Drop `clipboard-read`, add `sandbox="allow-scripts allow-same-origin allow-popups"`, and embed only known hosts (`drive.google.com`, `docs.google.com`). Open others in a new tab.
- **Effort:** S · **Confidence:** Confirmed

## Test plan

### Existing coverage
- **Backend** `apps/warbands/tests/test_warbands_api.py` (15 tests): item cost defaulting from a single availability (stash, hero, henchmen, hired sword); hired swords and henchmen: seeded XP gives no level-ups, XP gain adds level-ups, explicit `level_up` suppresses the increment, `no_level_ups` suppresses the increment and the level-up endpoint rejects it; the hired-sword cap (blood-pacted exempt).
- **Backend elsewhere:** `apps/battles/tests/test_battles_api.py`: kill history for hero, hired sword and henchmen group plus membership (4 tests), postbattle leader reassignment, postbattle `no_level_ups` XP skip. `apps/campaigns/tests/test_campaigns_api.py`: effective restrictions (3 tests), top killers (3).
- **Not covered:** hero CRUD, hero XP → level-ups (default and custom thresholds), any level-up endpoint body (stat increments, Skill/Spell/Special placeholders, invalid advance, concurrency), `ensure_single_living_leader` from the roster paths, permissions (view vs edit vs `manage_warbands`, owner-only delete), the hero cap with dead heroes, henchmen membership sync with dead members, warband summary gold and rating, and **any query-count assertion**.
- **Frontend** (17 files, about 45 cases): `useWarbandHenchmenSave` and `useWarbandHiredSwordsSave` (level_up seeding, 3 each), `useWarbandLoader` (stale responses, merge, 3), `WarbandDesktopEditActions` (section locking, 3), `useWarbandMobileTopBar` (pure helpers only), `useExperienceBar` (1), henchmen and hired-sword `no_level_ups` cards (2 each), `UnitStatsGrid` paste (duplicated file), `UnitKillHistoryTooltip` (duplicated file), `SearchableDropdown` (1), `WarbandSectionShell` (3), `DetailPopup`, `WarbandRecordIndicator`, `useCampaignCatalogs`.
- **Frontend not covered:** `useWarbandSave` (heroes), the hero creation and leader flows, `ExperienceBar` with `halfRate` or read-only, the level-up hooks (`useHeroLevelUp`, `useHenchmenLevelUp` including LGT), the `HeroCardHeader` trade badge gating, `pending-purchases` commit, the race picker keyboard path, `useWarbandUpdateListener`.

### Gaps and proposed tests

| ID | Level | Scenario | Expected result | Priority |
| --- | --- | --- | --- | --- |
| ROST-TEST-01 | API | `GET /warbands/:id/{summary,heroes,henchmen-groups,hired-swords}/` and `.../detail/` with `assertNumQueries` on a fixture of 3 units × 4 items × 2 availabilities | Fixed query budget independent of item count (for example detail ≤ 12, list ≤ 10, summary ≤ 6 after the fixes) | P1 |
| ROST-TEST-02 | API | `PATCH heroes/:id {xp}` query budget | ≤ 12 queries; response includes items, skills, specials and spells | P1 |
| ROST-TEST-03 | API | Group with 1 living + 1 dead henchman; PATCH the group with only the living member in `henchmen` | Dead henchman row still exists; group kill-history total unchanged | P1 |
| ROST-TEST-04 | API | Campaign with `hero_level_thresholds=[3,7]`; finalise postbattle with `xp_earned=4` for a hero at 0 XP | `level_up == 1` (threshold 3 only), not 2 | P1 |
| ROST-TEST-05 | API | Postbattle for a `half_rate` hired sword with `xp_earned=2` | XP +1.0 | P1 |
| ROST-TEST-06 | API | Hero XP 0 → 13 → 3 → 13 via PATCH | Total `level_up` equals the thresholds ≤ 13 crossed once | P2 |
| ROST-TEST-07 | API | `max_heroes=2`, one dead and one living hero; POST a hero | 201 (dead heroes do not count); `ignore_max_heroes` from the client is ignored | P2 |
| ROST-TEST-08 | API | POST hero with `is_leader=true` when another leader exists; PATCH a hero `dead`; DELETE the leader | Exactly one living leader after each operation | P2 |
| ROST-TEST-09 | API | Level-up hero: advance `WS` at race maximum; advance `"Foo"`; no advance; `level_up=0` | 400 in each case; `level_up` unchanged | P2 |
| ROST-TEST-10 | API | Two concurrent level-up POSTs for a unit with `level_up=1` (threads, `TransactionTestCase`) | Exactly one succeeds | P3 |
| ROST-TEST-11 | API | Permissions matrix: non-member (404), member viewer (GET 200, PATCH/POST/DELETE/level-up 403), owner (200), `manage_warbands` member (200), admin (200); warband DELETE by admin (403) | As listed | P1 |
| ROST-TEST-12 | component | `HenchmenSummaryCard` with `half_rate=true`, click "+" | `onSave` called with `xp + 0.5` | P2 |
| ROST-TEST-13 | component | `HeroCardHeader` / `HeroSummaryCard` with `canEdit=false` | Trade badge is not a button; no XP +/- buttons; pending skill click does nothing | P2 |
| ROST-TEST-14 | component | `HeroCardHeader` trade confirm with the API rejecting 403 | Error shown, dialog closable, no unhandled rejection | P3 |
| ROST-TEST-15 | hook | `useWarbandSave`: changed and unchanged heroes, removed ids, purchases | PATCH only for changed heroes; DELETE for removed; one summary GET; leader required only when heroes exist | P2 |
| ROST-TEST-16 | hook | `useWarbandSave` for a hero created in-session with edited XP | Sends `level_up: 0` (parity with henchmen) | P3 |
| ROST-TEST-17 | hook | `useHenchmenLevelUp` LGT path (mock API) | One promote call; group level-up consumed; on a failed second step nothing is left half-done | P2 |
| ROST-TEST-18 | hook | `useWarbandMobileTopBar` rendered with an unmemoised `handleSaveChanges` and `isMobile && isEditing` | Render count stays bounded (for example < 5) | P1 |
| ROST-TEST-19 | component | Race picker: focus input, ArrowDown, Enter | Race selected without a mouse; `aria-expanded` toggles | P2 |
| ROST-TEST-20 | component | Desktop `HeroSummaryCard`: Tab to the card | Expand button is focusable and works with Enter | P2 |
| ROST-TEST-21 | unit | `pending-purchases.commitPendingPurchases` with 3 entries | (After the fix) one batched call; before the fix, document ordering and failure behaviour | P3 |
| ROST-TEST-22 | API | PATCH a hero with a race, item or skill id from another campaign | 400 / ignored | P3 |
| ROST-TEST-23 | API | Summary gold with Group header + children + "Trade sent" | Equals the signed sum; matches frontend `getSignedTradePrice` | P3 |
| ROST-TEST-24 | API | Kill-history query plan uses an index (after migration), `EXPLAIN` check in test or manually | Index scan | P3 |
| ROST-TEST-25 | e2e | Warband page load on a 3G profile | ≤ 2 API requests after the layout; roster visible in < 2 s | P2 |
| ROST-TEST-26 | unit | `count_new_level_ups` / `count_new_henchmen_level_ups` with Decimal half steps and string inputs | Correct counts; no `ValueError` on `"4.5"` | P3 |

### Manual QA script

Users: **A** = user 1 (campaign owner, owns warband 2 "Monks"); **B** = user 2 (player, owns warband 1); **C** = a player granted `manage_warbands`. Use two browsers (or one normal and one private window) side by side. Have DevTools Network open with "Preserve log".

1. **Sheet load (A, desktop).** Open Campaign "Shards" → Warband. Count the API calls after `campaigns/1/` and the 5 catalogues: expect `warbands/?campaign_id=1`, then 4 parallel calls (summary, heroes, hired-swords, henchmen-groups). Note the waterfall timing.
2. **Expand and level-up fetches.** Hover a hero card → click expand → note `GET heroes/:id/`. Collapse and expand again → note a second identical request (PERF-06). If a "Level Up!" banner is shown, open it → note another detail GET.
3. **XP click cost.** Hover the hero XP bar → click "+" once. One `PATCH heroes/:id/` (time it). Do the same on a henchmen group: expect PATCH **plus** `GET summary/` (PERF-04).
4. **Half-rate henchmen (BUG-09).** Edit Henchmen → tick "Half rate experience" on a group → Save. Click "+" on its XP bar: XP should go up by 0.5. Expect the bug: +1.
5. **Viewer permissions (BUG-07).** As **B**, open Monks (`/campaigns/1/warbands/2`). Check that no "Edit" buttons are shown. Click the green "✓ Trade" badge on a hero card → confirm → expect a 403 in Network and a dialog that stays stuck. Hover an XP bar → "+" is visible → click → XP briefly changes then reverts (403). Click a pending "New Skill" entry, if any → a dialog opens for a non-editor.
6. **Edit-mode semantics (UX-01).** As **A**: note the gold. Edit Heroes → Add hero → fill name/type/race, recruit cost 20 → Create hero. Gold drops by 20 immediately and Treasury shows "Recruited". Press **Cancel**: the hero remains and the gold stays spent. Edit Heroes → Dismiss the new hero (read the "cannot be undone" copy) → Cancel: the hero is still there. Dismiss again → Save: the hero is gone and the gold is **not** refunded.
7. **Leader on create (BUG-06).** Edit Heroes → Add hero with "Leader" ticked → Create → Cancel. Look at the cards: two crowns. Reload: only the new hero is leader.
8. **Hero cap with dead heroes (BUG-05).** In campaign settings set Max heroes = 3 (Monks has 2 living + 1 dead). Edit Heroes → Add hero: the UI allows it → Create → expect the error "Warband already has 3 heroes". Restore the setting.
9. **Dead henchmen deletion (BUG-02). Use a throwaway warband.** Run a battle where one henchman of a 2-member group goes out of action and is marked dead in postbattle. Check the group kill history and Campaign Overview → top killers. Edit Henchmen → rename the group → Save. Recheck: the dead henchman's kills are gone. Confirm in pgweb (`select * from henchman where group_id=…`).
10. **XP re-crossing (BUG-03).** Edit Heroes → set a hero XP from 3 to 13 → Save (banner shows +3). Edit → set 3 → Save (banner still +3). Edit → set 13 → Save → the banner shows +6.
11. **Custom thresholds vs postbattle (BUG-01).** As **A**, set Hero thresholds to `3, 7` → finish a battle giving a 0-XP hero 4 XP. The XP bar says level 2, but the banner count comes from the default table (2 level-ups: thresholds 2 and 4).
12. **Race maximum (BUG-08).** Open a hero level-up dialog for a hero whose WS equals the race maximum (the "/max" superscript) → tick WS → Level up → WS exceeds the maximum.
13. **Keyboard-only (UX-02, UX-03).** Unplug the mouse. Edit Heroes → Add hero → Tab to Race, type "Hum", press ArrowDown/Enter/Tab: no option can be selected. On desktop, try to expand a card with Tab/Enter: no expand control is reachable.
14. **Concurrent editors (BUG-11).** **A** and **C** both open Monks. **C**: Edit Heroes → make hero X leader → Save. **A** (without reloading): click "+" XP on the old leader's card. Reload both: the crown is back on the old leader.
15. **Concurrent level-up (BUG-10).** Two tabs as **A** on a unit with exactly one level-up. Open both dialogs, pick a stat in each, click "Level up" in both quickly: both succeed and two stats increase.
16. **Mobile edit loop (PERF-07).** DevTools device mode 375×812, reload. Edit Heroes (via the mobile top bar). Watch the console for "Maximum update depth exceeded" and the Performance monitor for continuous script activity while idle. Repeat for henchmen and hired swords.
17. **Tab switch discards edits (UX-01).** Edit Henchmen → change a name and queue an item purchase → switch to the Treasury tab and back: edits and pending purchases are gone without a prompt. Any group created via "Create group" remains.
18. **Lad's Got Talent (BUG-04).** On a henchmen group with one level-up and 2+ members: Level Up → tick "Lads got talent" (or roll 10–12) → re-roll a stat → confirm. A new hero appears and the group shows one member fewer, but the group **still** shows "Level Up!". Repeat with DevTools set to "Offline" right after the first request to see a hero created while the henchman is still in the group.
