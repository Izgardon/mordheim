# Reference catalogue: items, skills, spells, specials, races, restrictions, bestiary, hired swords, seeders, rules

> Scope: `backend/apps/items` (models, views, serializers, services, `seed_items`), `backend/apps/skills`, `backend/apps/spells` (+ `seed_spells_and_special`), `backend/apps/special`, `backend/apps/races`, `backend/apps/restrictions` (+ `utils.parse_unique_to`), `backend/apps/bestiary` (views, models, serializers, `seed_bestiary`, `data/`), `backend/apps/campaigns/management/commands/seed_all.py`, the catalogue permission gates in `backend/apps/campaigns/{views,permissions}.py`; frontend `features/items`, `features/skills`, `features/spells`, `features/special`, `features/races`, `features/bestiary`, `features/rules`, the catalogue caches in `stores/app-store.tsx`, `features/warbands/hooks/campaign/useCampaign*.ts`, and the catalogue prefetch in `features/campaigns/routes/CampaignLayout.tsx`.

## Summary

| Dimension | Verdict |
| --- | --- |
| Performance | **Poor at the system level, fine per query.** List endpoints are not N+1 (4 to 14 queries each), but every user re-downloads ~380 KB of identical, uncompressed, uncacheable catalogue JSON every time they enter a campaign, and the whole campaign UI is blocked until it arrives. Detail endpoints for bestiary/hired swords are N+1 (39 to 45 queries). |
| Bugs | **Several data-integrity problems.** Deleting a custom entry silently cascades into every warband that owns it; any player can silently override a base item's price campaign-wide (the "Axe 25 gc" mystery); seeders crash on re-run once a campaign has custom/house-rule items; permission codes are inconsistent and partly unseeded. |
| Code quality | **Heavily duplicated.** skills/spells/special views are byte-for-byte clones; the "merge campaign overrides with base" block exists 8 times; every catalogue entity has two near-identical frontend forms; seeders duplicate helpers and disagree on scoping. |
| UI / UX | **Usable but misleading.** No marker distinguishes base, custom and house-rule entries; Edit buttons shown to players who will get a 403; bestiary/hired-sword custom entries cannot be edited or deleted from the UI. |
| Security | **One open write endpoint** (`POST /api/restrictions/` creates global rows for any logged-in user) and cross-campaign ID references on catalogue writes. |
| Tests | **Thin.** 2 catalogue tests in their own apps, 8 house-rule tests in campaigns, nothing for bestiary, hired swords, races, restrictions, skills, specials, list-merge semantics, permission gates or query budgets. |

**Top 5 findings**

1. **CAT-PERF-01** (P1): `CampaignLayout` blocks the entire campaign UI on 5 uncached catalogue downloads (~380 KB, ~35 queries) on every campaign entry, ignoring the in-memory cache.
2. **CAT-PERF-02** (P1): Catalogue responses carry no ETag/Cache-Control and are not compressed; identical data is re-queried and re-serialized per user per visit. Proposed versioned ETag + server cache + gzip, then a static base catalogue + small campaign delta.
3. **CAT-BUG-01** (P1): Deleting a custom item/skill/spell/special CASCADE-deletes every owned copy in every warband of the campaign, with no warning or refund.
4. **CAT-BUG-03** (P1): Custom entries silently shadow base entries campaign-wide by name only (ignoring type), and every player gets `add_custom` on join but cannot undo it. This explains Wargear showing Axe at 25 gc.
5. **CAT-BUG-02** (P1): `seed_all` is not safe to re-run: `seed_items`, `seed_skills`, `seed_spells_and_special` and `seed_bestiary` upsert without `campaign IS NULL`, so they hit `MultipleObjectsReturned` (14 colliding name/type pairs exist locally) and can leave partial state.

## How it works

**Models.** Every catalogue model has a nullable `campaign` FK: `NULL` = global (seeded) row, non-null = campaign-scoped custom row.

- `Item` (`item`): name, type (Weapon/Armour/Miscellaneous/Animal), subtype, grade, single_use, description, strength/range/save, statblock (JSON text), optional `bestiary_entry` (animals), and two house-rule fields: `source_item` (FK to the base item a clone was generated from) and `generated_effect_key`.
- **Prices are not on `Item`.** They live in `ItemAvailability` (`item_availability`: `cost`, `rarity` 2..20, `variable_cost` text). An item can have several availabilities, each limited by `ItemAvailabilityRestriction` rows (restriction + `additional_note`). Owned rows (`hero_item.cost`, `warband_items.cost`, etc.) persist their own `cost`, which the frontend sets to the catalogue base cost at acquisition (`features/items/utils/acquire-item-costs.ts`).
- `ItemProperty` / `ItemPropertyLink`: named rules ("Parry", "Concussion") per item type.
- `Skill`, `Spell` (+ `dc`, `roll`), `Special`: name, type, description.
- `Race` (stat caps), `Restriction` (type Warband / Warband Group / Setting / Artifact).
- `BestiaryEntry` (stat block, armour_save, large, caster) with through tables to skills, specials, spells and items (equipment). `HiredSwordProfile` (one-to-one with a `BestiaryEntry` of type "Hired Sword") adds hire/upkeep cost and expressions, rating, grade, race, `available_skill_types` and restrictions. `WarbandBestiaryFavourite` stores per-warband favourites.

**Endpoints** (all `IsAuthenticated`, function-free `APIView`s):

| Endpoint | Read gate | Create gate | Edit/delete gate |
| --- | --- | --- | --- |
| `/api/items/`, `/api/items/:id/` | membership if `campaign_id` | `add_custom` | `manage_items` (custom rows only) |
| `/api/item-properties/` | membership | `add_custom` | none (no edit/delete) |
| `/api/skills/` | membership | `add_custom` | `manage_skills` |
| `/api/spells/` | membership | `add_custom` | `manage_spells` (**not a seeded permission**) |
| `/api/special/` | membership | `add_custom` | `manage_features` (**not a seeded permission**) |
| `/api/races/` | membership | **membership only** | owner/admin (no delete) |
| `/api/restrictions/` | membership if `campaign_id` | **any logged-in user, global row** | none |
| `/api/bestiary/`, `/api/hired-swords/` | membership | `manage_bestiary` | `manage_bestiary` |
| `/api/warbands/:id/bestiary-favourites/` | membership | warband owner or `manage_warbands` | same |

Owner and admin roles pass every `has_campaign_permission` check. Players get `add_custom` automatically on join (`campaigns/views.py:543-545`).

**Scoping / merge rule.** With `?campaign_id=`, each list view returns campaign rows first, then base rows **whose name does not appear among the campaign rows** (`items/views.py:84-90` and 7 copies). A campaign row therefore silently replaces every base row with the same name.

**House rules.** Creating a `half_price_armour` or `improved_shields` house rule (`campaigns/views.py:1148-1213`) calls `items/services.py`, which clones the 8 base armours / 4 shields into campaign rows (`source_item` set, cost halved or save text annotated) and remaps owned rows in that campaign onto the clones. Removing the rule remaps owned rows back and deletes the clones. Growth is small and bounded (12 items + 12 availabilities per campaign, observed in campaign 2).

**Seeding.** `seed_all` runs `seed_races`, `seed_restrictions`, `seed_items`, `seed_skills`, `seed_spells_and_special`, `seed_bestiary` from JSON in each app's `data/` folder. `seed_bestiary` also creates the Animal shop items and HiredSwordProfiles, and auto-creates missing specials/skills. `mim-items.json` (62), `mim-bestiary.json` (18) and `skills/data/custom-skills.json` (91) are never loaded by any seeder.

**Frontend.** Routes `Items.tsx` (Wargear), `Skills.tsx`, `Spells.tsx`, `Bestiary.tsx`, `HiredSwords.tsx`, `Rules.tsx` (static HTML from `rules-content.ts`, 67 KB) and `HouseRules.tsx`. Items/skills/spells/specials/races/item-properties are cached in-memory per campaign in the global `AppStoreContext` (`stores/app-store.tsx:100-330`). `CampaignLayout` prefetches items, skills, spells, specials and races before rendering anything. Bestiary and hired-swords lists are not cached.

**Measured (local Docker, user 1, campaign 1, warm, best of 3; queries exclude the JWT user lookup)**

| Endpoint | Rows | Queries | Server ms | Bytes | Gzip bytes |
| --- | --- | --- | --- | --- | --- |
| `GET /api/items/?campaign_id=1` | 230 | 14 | 56 | 169,987 | 35,086 |
| `GET /api/items/` (no campaign) | 230 | 8 | 60 | 170,872 | 35,288 |
| `GET /api/item-properties/?campaign_id=1` | 239 | 2 | 4 | 93,865 | 28,932 |
| `GET /api/skills/?campaign_id=1` | 251 | 4 | 5 | 102,944 | 30,186 |
| `GET /api/spells/?campaign_id=1` | 184 | 4 | 4 | 41,139 | 10,727 |
| `GET /api/special/?campaign_id=1` | 186 | 4 | 4 | 60,524 | 18,797 |
| `GET /api/races/?campaign_id=1` | 26 | 4 | 3 | 4,611 | 651 |
| `GET /api/restrictions/?campaign_id=1` | 138 | 4 | 4 | 11,775 | n/a |
| `GET /api/bestiary/?campaign_id=1` | 86 | 4 | 5 | 59,260 | 17,296 |
| `GET /api/hired-swords/?campaign_id=1` | 72 | 6 | 11 | 86,853 | 19,294 |
| `GET /api/bestiary/31/` (Bounty Hunter, 8 items) | 1 | **43** | 25 | 6,823 | |
| `GET /api/hired-swords/17/` (Bounty Hunter) | 1 | **45** | 26 | 7,463 | |

Serializing + rendering the 230 items alone costs ~30 ms of CPU locally (`ItemSerializer(...).data` + `JSONRenderer`), so expect 3 to 10 times that on a fractional-CPU Render instance. No catalogue response has `ETag` or `Cache-Control`, and there is no `GZipMiddleware` in `config/settings.py:60-69`.

**When the frontend fetches catalogue data**

| Trigger | Requests | Cached? |
| --- | --- | --- |
| Entering any campaign route (CampaignLayout mount) | items, skills, spells, specials, races | **Always refetched**, blocks render |
| Wargear page | item-properties (94 KB) + items | Uses cache after layout prefetch |
| Skills / Spells page | list | Uses cache |
| Bestiary page, Hired Swords page, BestiaryPicker (prebattle), AddHiredSwordForm | bestiary or hired-swords list | **Every mount** |
| Opening "New skill" / "New spell" dialog on a hero or hired sword | full skills (103 KB) or spells (41 KB) list | **Every open** |
| Opening an item/skill/spell detail popup (`DetailCardContent`) | `GET /items/:id/` then `GET /item-properties/?type=` | Every open, sequential |
| Opening Acquire Item dialog | heroes, henchmen groups, trades (not items) | Every open |
| Each catalogue page visited by a player | `GET /campaigns/:id/permissions/me/` | Every mount |
| Typing in the item-property search of item forms | `GET /item-properties/?search=` | Every keystroke, no debounce |

To answer the brief directly: opening the Acquire Item dialog does **not** refetch the items list, but opening the New Skill/New Spell dialogs does refetch the full skills/spells list on every open.

## Performance

### CAT-PERF-01 · P1 · Campaign shell blocks on 5 uncached catalogue downloads on every campaign entry
- **Where:** `frontend/src/features/campaigns/routes/CampaignLayout.tsx:345-405` (prefetch), `:579` (gate); `frontend/src/features/warbands/hooks/campaign/useCampaignItems.ts:24-46` (and the identical `useCampaignSkills/Spells/Special/Races.ts`)
- **What:** After `getCampaign` resolves, `CampaignLayout` calls `loadItems()`, `loadSkills()`, `loadSpells()`, `loadSpecials()` and `loadRaces()` via `Promise.allSettled` and renders `<LoadingScreen message="Preparing the campaign..." />` until all five settle. The `load*` callbacks never check `cacheEntry.loaded`, so the fetch happens on every layout mount (opening a campaign from the list, returning to it, reload), even though the app store already holds the data. The fetch also waits for `getCampaign` first, so there are two sequential round-trip phases before first paint.
- **Impact:** Per user per campaign entry: 5 requests, ~35 DB queries (14+4+4+4+4 plus one JWT user lookup each), ~379 KB uncompressed JSON (~95 KB if gzipped), and ~30 ms+ of server CPU for items alone, all for data that is identical for every member. In production each request also opens a fresh TLS connection to Neon (no `conn_max_age`, see INFRA), so at 10 ms per query the items list alone spends ~160 ms in the DB; if Render and Neon are cross-region (~100 to 150 ms RTT) it is 1.5 to 2.5 s. When several players open the campaign at once, these identical requests compete for the same small CPU, which matches the "slows down with multiple users" complaint. Nothing in the shell needs these lists; only `Warband.tsx` and `HouseRules.tsx` read `lookups`.
- **Fix:** (1) Remove the gate: render the layout as soon as `campaign` is loaded and let `Warband.tsx` show its own skeleton until `lookups` are ready. (2) Make `load*` stale-while-revalidate: return cached data immediately if `loaded`, revalidate in the background (cheap once CAT-PERF-02 adds ETags, since the browser turns it into a 304). (3) Persist the cache (IndexedDB/localStorage keyed by `campaignId` + catalogue version) so a reload paints instantly. TanStack Query with `staleTime: Infinity` + a persister does all three with little code; see CAT-CQ-03.
- **Effort:** M · **Confidence:** Confirmed (code path read end to end; sizes and query counts measured)

### CAT-PERF-02 · P1 · No HTTP caching, no compression, and no server cache for read-only, shared catalogue data
- **Where:** All catalogue list views: `backend/apps/items/views.py:69-94`, `skills/views.py:14-39`, `spells/views.py:14-39`, `special/views.py:14-39`, `races/views.py:16-41`, `restrictions/views.py:14-41`, `bestiary/views.py:30-57`, `:258-287`; `backend/config/settings.py:60-69` (no `GZipMiddleware`), `:165-170` (LocMem cache only)
- **What:** Responses have no `ETag`, `Last-Modified` or `Cache-Control`, so the browser cannot revalidate, and every request re-runs the queries and re-serializes from scratch. Bodies are sent uncompressed (gzip shrinks them 3 to 5 times: items 170 KB to 35 KB). Catalogue data changes only on rare writes (custom entry, house rule, reseed).
- **Impact:** Every catalogue request in production costs a full set of Neon round trips + serialization CPU + 40 to 170 KB of transfer. Combined with CAT-PERF-01 and CAT-PERF-03 this is the largest avoidable read load in the app.
- **Fix:** In order of payoff:
  1. Add `django.middleware.gzip.GZipMiddleware` right after `SecurityMiddleware` (cross-ref INFRA; check that Render does not already compress).
  2. Add a catalogue version per campaign plus a global version, bumped on every catalogue write (post_save/post_delete signals on Item, ItemAvailability, ItemAvailabilityRestriction, ItemProperty(+Link), Skill, Spell, Special, Race, Restriction, BestiaryEntry(+through tables), HiredSwordProfile(+restriction), inside the house-rule sync, and at the end of each seeder). Store it in a shared cache (Redis / Render Key Value, or `DatabaseCache`), or as an integer column on `CampaignSettings` updated with `F("catalogue_version") + 1`, so every worker sees it. Then:
     ```python
     # apps/core/catalogue_cache.py (sketch)
     def cached_catalogue_response(request, kind, campaign_id, build):
         version = get_catalogue_version(campaign_id)            # 0-1 query
         key = f"cat:{kind}:{campaign_id or 'base'}:{version}:{request.GET.urlencode()}"
         etag = f'"{hashlib.md5(key.encode()).hexdigest()}"'
         inm = request.headers.get("If-None-Match", "").replace("W/", "")
         headers = {"ETag": etag, "Cache-Control": "private, no-cache"}
         if etag in inm:
             return HttpResponse(status=304, headers=headers)
         body = cache.get(key)
         if body is None:
             body = JSONRenderer().render(build())               # queries + serialization only on a miss
             cache.set(key, body, 24 * 3600)
         return HttpResponse(body, content_type="application/json", headers=headers)
     ```
     Call it after the membership check, so a revalidation costs 2 queries (JWT user + membership) instead of 5 to 16. The frontend `fetch` uses the default cache mode, so browsers send `If-None-Match` automatically and no client change is needed.
  3. Longer term: split the payload. The **base catalogue** is identical for every user and campaign and changes only on reseed: publish it as a content-hashed static JSON (Vercel CDN, `Cache-Control: public, max-age=31536000, immutable`) or a public endpoint with long `max-age`. Then expose a **campaign delta** endpoint returning only campaign rows plus the list of shadowed base ids (2 to 13 rows today, 3 to 6 queries). Clients merge locally.
- **Effort:** S for gzip; M for ETag + server cache; L for the static/delta split · **Confidence:** Confirmed (headers and sizes measured)

### CAT-PERF-03 · P2 · Redundant refetches of full catalogue lists from pages and dialogs
- **Where:** `frontend/src/features/skills/components/NewSkillDialog.tsx:59-62`, `NewHiredSwordSkillDialog.tsx:49-51`, `features/spells/components/NewSpellDialog.tsx:64`, `NewHiredSwordSpellDialog.tsx:55`; `features/bestiary/routes/Bestiary.tsx:76-90`, `HiredSwords.tsx:66-80`, `components/BestiaryPicker.tsx:25-44`; `features/warbands/components/hiredswords/forms/AddHiredSwordForm.tsx:88-95`; `features/warbands/components/shared/unit_details/DetailCardContent.tsx:29-80`; `features/items/routes/Items.tsx:281-314`; permission fetch duplicated at `Items.tsx:318`, `Skills.tsx:128`, `Spells.tsx:114`, `Bestiary.tsx:69`, `HiredSwords.tsx:59`
- **What:** The New Skill/New Spell dialogs bypass the app-store cache and download the full skills (103 KB) or spells (41 KB) list on every open. Bestiary and hired-sword lists (59 KB and 87 KB) have no cache at all and are refetched by four different components. `DetailCardContent` does a sequential `getItem` then `listItemProperties(type)` (32 KB for weapons) per popup open, only to look up property descriptions for 1 to 4 properties. The Wargear page downloads all 239 item properties (94 KB) just for tooltip text. Each catalogue page refetches `/permissions/me/` for players.
- **Impact:** Repeated identical traffic and DB work on the most common warband actions (learning a skill, viewing an item). Each dialog open costs a round trip before the list populates.
- **Fix:** Route all of these through the shared catalogue cache (CAT-CQ-03), add `bestiary` and `hiredSwords` slices, and read item/skill details from the cached list instead of `GET /:id/`. Include `description` in `ItemPropertySummarySerializer` (`items/serializers.py:8-15`, ~20 bytes per link on average) so the property map fetch disappears. Fetch member permissions once in `CampaignLayout` and pass them through the outlet context.
- **Effort:** M · **Confidence:** Confirmed

### CAT-PERF-04 · P2 · Bestiary and hired-sword detail endpoints are N+1 (39 to 45 queries)
- **Where:** `backend/apps/bestiary/views.py:82-101` (entry detail), `:340-361` (profile detail), `:76`, `:126`, `:331-334`, `:418` (POST/PATCH responses with no prefetch); `bestiary/serializers.py:12-25`
- **What:** The views prefetch the through tables (`bestiary_entry_skills__skill`, etc.), but `BestiaryEntrySerializer` reads the M2M managers `skills`, `specials` and `spells`, so the prefetches are wasted and three more queries run. `equipment` nests the full `ItemSerializer` per item, and each item then lazily loads `property_links`, each `property` (one query per link), `availabilities` and `restriction_links`: 3 to 5 queries per item. Measured: Bounty Hunter entry 43 queries, hired-sword profile 45.
- **Impact:** Each hired-sword or bestiary detail view in production costs ~45 Neon round trips (0.5 to 2 s depending on region). Opened from the Hired Swords page, the warband hire flow and the bestiary page.
- **Fix:**
  ```python
  item_qs = Item.objects.prefetch_related(
      "property_links__property", "bestiary_entry__specials",
      Prefetch("availabilities", queryset=ItemAvailability.objects.prefetch_related("restriction_links__restriction")),
  )
  BestiaryEntry.objects.prefetch_related(
      "skills", "specials", "spells",
      Prefetch("bestiary_entry_items", queryset=BestiaryEntryItem.objects.select_related("item").prefetch_related(
          Prefetch("item", queryset=item_qs))),
  )
  ```
  Use the same prefetch for the POST/PATCH responses. Expected ~10 queries. Add an `assertNumQueries` test (CAT-TEST-08).
- **Effort:** S · **Confidence:** Confirmed (measured)

### CAT-PERF-05 · P2 · Over-fetching: rows and fields the client throws away
- **Where:** `frontend/src/features/bestiary/routes/Bestiary.tsx:82`; `backend/apps/bestiary/views.py:30-57`; `items/serializers.py:77-102`; `skills/serializers.py`; `bestiary/serializers.py:117-138`
- **What:** The bestiary list returns all 86 entries; the page immediately drops the 72 of type "Hired Sword" (84% of rows, about 50 KB of the 59 KB). Long descriptions dominate every payload: 49 KB of the 170 KB items list, 81 KB of the 103 KB skills list, 74 KB of the 94 KB item-properties list, 33 KB of the 87 KB hired-swords list. The warband pickers that consume `lookups` only need id, name, type and costs. Hired swords are shown 12 per page, but all 72 profiles with full descriptions are sent.
- **Impact:** Two to five times more bytes and serialization CPU than needed for the common case.
- **Fix:** Add `?exclude_type=Hired Sword` (or `type__in`) to `/api/bestiary/` and use it in `Bestiary.tsx`. Add `?view=summary` to the list endpoints, omitting `description`/`statblock` (and for items the nested `bestiary_entry`), and load descriptions on row expand from a detail endpoint or a separate cached `descriptions` map. Do this after CAT-PERF-02, since caching removes most of the cost anyway.
- **Effort:** S · **Confidence:** Confirmed (measured)

### CAT-PERF-06 · P2 · Wargear table mounts a full Acquire dialog state machine per row and re-renders all of them on every interaction
- **Where:** `frontend/src/features/items/routes/Items.tsx:772` (one `<AcquireItemDialog>` per row), `:446-797` (`columns` memo); `features/items/hooks/useAcquireItemDialogShared.tsx:156-622`; `features/items/components/ItemsTable.tsx`
- **What:** Each of the ~100 to 110 rows on the Weapons or Miscellaneous tab renders an `AcquireItemDialog`, which runs `useAcquireItemDialogShared` even while closed: about 28 `useState`, 12 `useEffect` and 10 `useMemo`, plus a `useAppStore()` subscription. The `columns` memo depends on `handleDeleted` and `handleUpdated`, which are recreated every render, so it is rebuilt on every render; every expand click, keystroke in search or app-store update re-renders all rows and all hook instances. The table is not virtualised and rows are not memoised.
- **Impact:** Sluggish typing and expanding on low-end phones; any unrelated app-store change (notifications, warband refresh) re-renders 100+ dialog hooks.
- **Fix:** Render a single `AcquireItemDialog` at page level, controlled by `selectedRow` state; rows only render a lightweight "Acquire" button. Wrap handlers in `useCallback`, fix the memo deps, and `React.memo` the row component. Split the app store into separate contexts (cross-ref FE) so catalogue updates do not re-render warband consumers.
- **Effort:** M · **Confidence:** Likely (structure confirmed in code; not profiled)

### CAT-PERF-07 · P3 · Items list runs the prefetch chain twice and the merge with extra queries
- **Where:** `backend/apps/items/views.py:84-90` (same pattern in 7 other views, see CAT-CQ-01)
- **What:** With `campaign_id`, the view evaluates `custom_items.exists()`, then two separate prefetching querysets (custom, then base), each running its own 6-query prefetch chain: 14 queries versus 8 without a campaign.
- **Impact:** 6 extra round trips per items request (60 to 900 ms in production depending on region). Moot once CAT-PERF-02 lands, but cheap to fix.
- **Fix:** One queryset: `Item.objects.filter(Q(campaign_id=cid) | Q(campaign__isnull=True, ~Exists(Item.objects.filter(campaign_id=cid, name=OuterRef("name"), type=OuterRef("type")))))` with a single prefetch chain, ordered by `(campaign_id IS NULL, name, id)`. This also fixes the name-only shadowing in CAT-BUG-03.
- **Effort:** S · **Confidence:** Confirmed

### CAT-PERF-08 · P3 · Item-property search sends a request per keystroke and can show stale results
- **Where:** `frontend/src/features/items/components/AddItemForm.tsx:221-233`, `ItemFormDialog.tsx:266-278`
- **What:** `useEffect([form.type, propertySearch, campaignId])` calls `listItemProperties({search})` on every character, with no debounce and no cancellation. Responses can arrive out of order and overwrite newer results.
- **Impact:** N requests for an N-letter search; occasionally wrong suggestions.
- **Fix:** Filter client-side from the cached item-properties list (already in the store for the Wargear page). If a server search is kept, debounce by 250 ms and ignore stale responses with an `active` flag, as `BattlePostbattle.tsx:516-540` does.
- **Effort:** S · **Confidence:** Confirmed

### CAT-PERF-09 · P3 · Write paths issue one or two queries per related row
- **Where:** `backend/apps/bestiary/views.py:204-234` (`_sync_m2m`: delete, then `get_or_create` per id), `:237-252`; `backend/apps/items/views.py:39-63` (one `create` plus one restriction lookup per availability), `:116-119` (`get_or_create` per property); `backend/apps/items/services.py:85-128`, `:135-186` (per-row `save()` in the remap loops)
- **What:** Each id costs a SELECT plus an INSERT. Creating a hired sword with 6 skills, 3 specials and 6 items costs about 35 queries; toggling a house rule costs one UPDATE per owned armour row.
- **Impact:** Slow saves (rare operations, so low priority).
- **Fix:** After the delete, use `bulk_create([...], ignore_conflicts=True)`; for remaps use `bulk_update(rows, ["item", "cost"])` or a single `UPDATE ... SET item_id = CASE ...`.
- **Effort:** S · **Confidence:** Confirmed

### CAT-PERF-10 · P3 · 67 KB of static rules HTML ships in the main bundle
- **Where:** `frontend/src/features/rules/data/rules-content.ts` (66,988 bytes), imported eagerly through `frontend/src/app/routes/routes.tsx:17`
- **What:** All routes are imported statically, so the rules text is downloaded and parsed on first load by every user, including those who never open Rules.
- **Impact:** Larger initial bundle on mobile (cross-ref FE bundle findings).
- **Fix:** `const Rules = lazy(() => import("../../features/rules/routes/Rules"))`, or move the content to `/public/rules/*.html` and fetch on tab change.
- **Effort:** S · **Confidence:** Confirmed

**Indexes.** Every filter column used by catalogue queries is indexed (`campaign_id`, `type`, FKs, through-table pairs), and tables hold under 3k rows, so no index work is needed. The missing *unique* constraints are a correctness issue; see CAT-CQ-08.

## Bugs

### CAT-BUG-01 · P1 · Deleting a custom catalogue entry silently deletes it from every warband in the campaign
- **Where:** `backend/apps/warbands/models/heroes.py:78`, `:90`, `:101`, `:112`; `henchmen.py:74`, `:86`, `:97`; `hired_swords.py:82`, `:94`, `:105`, `:116`; `warband.py:54` (all `on_delete=models.CASCADE`); delete views `items/views.py:175-189`, `skills/views.py:94-108`, `spells/views.py:94-108`, `special/views.py:94-108`, `bestiary/views.py:128-142`, `:420-434`; also `items/services.py:248-253` (stale clones deleted without remap); confirmation copy `frontend/src/features/items/components/AddItemForm.tsx:764-777`, `skills/components/AddSkillForm.tsx:331-344`
- **What:** Owned rows (`hero_item`, `warband_items`, `henchmen_group_item`, `hired_sword_item`, hero/henchmen/hired-sword skills, spells and specials) reference catalogue rows with CASCADE. Deleting a custom item, skill, spell or special (any manager can, from the Wargear/Skills/Spells edit form) removes every owned copy across all warbands in the campaign: no refund, no ledger entry, no notification. The confirm dialog only says "This action cannot be undone." In campaign 1 today, deleting the custom Axe (id 231) would delete two stash rows worth 25 gc each. The house-rule sync's `stale_clones.delete()` and `seed_items --truncate` (`seed_items.py:206-209`, which deletes all items including campaign ones) have the same effect.
- **Impact:** Silent loss of player equipment and progression; other players' open warband sheets keep showing the items until they reload.
- **Fix:** Change these FKs to `on_delete=PROTECT` (migration), and in the delete views catch `ProtectedError` and return `409 {"detail": "In use by N units", "usages": [...]}`. Alternatively add an `archived` flag: hide the entry from shop lists but keep owned rows. Show usage counts in the confirm dialog. Guard `--truncate` behind `campaign__isnull=True` or an explicit `--i-know` flag.
- **Effort:** M · **Confidence:** Confirmed (FKs and delete paths read; not executed, per review rules)

### CAT-BUG-02 · P1 · `seed_all` is not idempotent: re-running crashes or corrupts once campaigns have custom or house-rule rows
- **Where:** `backend/apps/items/management/commands/seed_items.py:320-333` (`Item.objects.update_or_create(name=, type=)`), `:148` (`Restriction.objects.get_or_create(restriction=)`), `:285-287` (restriction cache built from all campaigns); `bestiary/management/commands/seed_bestiary.py:345-355` (Animal items), `:134`, `:233-234`; `skills/management/commands/seed_skills.py:140`, `:199`; `spells/management/commands/seed_spells_and_special.py:60`, `:90`; `seed_items.py:224-226` + `:256-259` (property cache includes campaign properties)
- **What:** These upserts match on name and type **without** `campaign__isnull=True`. When a campaign row shares a base row's name and type (custom override or house-rule clone), `update_or_create` raises `MultipleObjectsReturned`. Locally there are already 14 such pairs: Axe and Beastlash (campaign 1), plus 8 armours and 4 shields (campaign 2 clones). If the base row is missing, the seeder instead overwrites the campaign's custom row. `seed_items` has no `transaction.atomic`, so a crash part-way leaves items before the crash point already updated, with availabilities deleted and recreated under new ids. The restriction and property caches are keyed by text across all campaigns, so a campaign-scoped or user-created global row (CAT-SEC-01) can be linked to base items. By contrast `seed_races` (`:106`) and `seed_restrictions` (`:61-64`) scope correctly.
- **Impact:** You cannot reseed production to fix catalogue data (for example the Giant Spider in CAT-BUG-06) without the seeder crashing or editing players' custom rows. The README instructs running `seed_all`.
- **Fix:** Add `campaign=None` to every seeder lookup (`update_or_create(name=..., type=..., campaign__isnull=True, defaults=...)`), and include `type` and `campaign__isnull=True` in the restriction `get_or_create`. Build caches from `campaign__isnull=True` rows only. Wrap each seeder's `handle` in `transaction.atomic()`. Add a test that seeds twice with a campaign override present (CAT-TEST-12).
- **Effort:** S · **Confidence:** Confirmed (code plus the duplicate pairs present in the DB; the seeder was not run, per review rules)

### CAT-BUG-03 · P1 · Custom entries silently override base entries campaign-wide, match on name only, and any player can create them (the "Axe 25 gc" case)
- **Where:** Merge logic `backend/apps/items/views.py:84-90`, `skills/views.py:29-35`, `spells/views.py:29-35`, `special/views.py:29-35`, `races/views.py:24-28`, `restrictions/views.py:31-37`, `bestiary/views.py:47-53`, `:273-283`; default `add_custom` on join `backend/apps/campaigns/views.py:543-545`; create gates `items/views.py:101`, `skills/views.py:46`, `spells/views.py:46`, `special/views.py:46`; frontend gates `features/items/routes/Items.tsx:219-226`, `features/skills/routes/Skills.tsx:73-76`
- **What:** Explaining the observation:
  - **Data.** Prices live in `item_availability.cost`. The base Axe (`item` 1) has one availability at **5 gc**, matching the canonical Mordheim price. Campaign 1 also has a custom "Axe" (`item` 231, Weapon/Melee) at **25 gc**, created by a campaign member. Campaign 1 has a second override too: Beastlash at 4 gc rarity 3, against the base 10 gc rarity 8. The list views drop every base row whose name matches a campaign row, so campaign 1's Wargear shows only the 25 gc Axe.
  - **The two prices you saw.** The treasury entry "Axe (5 gc)" is a henchman purchase from 2026-02-26 that references base item 1, made before the override existed. Postbattle finds on 2026-04-18 reference item 231 at 25 gc, and two stash rows still hold it at 25. The same campaign therefore holds two different "Axe" items at two prices.
  - **The underlying flaws.** (a) Matching is by `name` only, ignoring `type`: a custom skill "Infiltration" would hide all 6 base "Infiltration" skills (Dark Elf, Skink, Skaven, Sea Ghosts, Skaven Metal Mongers, Strigany); a custom spell "Lifestealer" would hide both Necromancy variants. 20 skill names and 15 spell names repeat across types today. (b) Every player gets `add_custom` on join, so any player can reprice any base item for the whole campaign, but cannot edit or delete the result (that needs `manage_items`). (c) Nothing records who created an override or when.
- **Impact:** Silent, campaign-wide price changes by any player in a competitive campaign; inconsistent prices for the same item name; unrelated skills or spells disappearing from pickers.
- **Fix:** Make overriding explicit. Add `overrides = FK(self, null=True)` (or match on `(name, type)`) and only hide base rows that are explicitly overridden. Require `manage_items`/`manage_skills` to create an entry whose name and type collide with a base row; plain `add_custom` can create new names only. Add `created_by` and `created_at` to catalogue models and show them (CAT-UX-01). Consider dropping `add_custom` from the default player permissions (product decision for William).
- **Effort:** M · **Confidence:** Confirmed (DB rows, logs and code)

### CAT-BUG-04 · P2 · Catalogue permission codes are inconsistent and partly impossible to grant; Edit buttons lie
- **Where:** `backend/apps/campaigns/views.py:84-93` (`PERMISSION_SEED`); `spells/views.py:83`, `:104` (`manage_spells`); `special/views.py:83`, `:104` (`manage_features`); `frontend/src/features/campaigns/constants/campaign-settings.ts:3-34` (`permissionOptions`); `frontend/src/features/skills/routes/Skills.tsx:296-313`, `features/spells/routes/Spells.tsx:278-295`
- **What:**
  - `manage_spells` and `manage_features` are checked but not in `PERMISSION_SEED` (verified: the `campaign_permission` table has 8 codes, neither present), so only the owner or an admin can ever edit or delete custom spells and specials.
  - The member-permissions UI (`MembersCard.tsx:315`) offers only 6 codes and omits `manage_bestiary` and `manage_encampments`, so owners cannot grant bestiary management from the UI.
  - Creating needs `add_custom`, but editing needs `manage_*`, so a player can create an entry and cannot fix a typo in it.
  - Skills and Spells show the Edit (pencil) button on every custom entry to everyone; Items correctly gates on `canManage` (`Items.tsx:776`). A plain player who edits a skill gets a 403 after filling in the form.
  - Races use yet another gate: any member can create, only owner/admin can edit (`races/views.py:43-53`, `:74`).

  Re the NOTES question: "Add skill" and "Add item" being visible to a plain player is **consistent with the backend** (players hold `add_custom` by default; verified for member 4 in campaign 1). It is the edit affordances that mislead.
- **Impact:** Confusing 403s; delegation of catalogue management to trusted players is impossible for spells, specials and the bestiary.
- **Fix:** Pick one model. Suggested: `add_custom` covers create **and** edit/delete of entries you created (`created_by == user`); `manage_catalogue` (or the existing per-kind codes, all seeded) covers everything. Seed `manage_spells`/`manage_features` (or rename the checks to `manage_skills`), add `manage_bestiary` and `manage_encampments` to `permissionOptions`, and gate the Skills/Spells Edit buttons on the same permission the backend checks. Expose the effective permissions from one place (see CAT-PERF-03).
- **Effort:** S · **Confidence:** Confirmed

### CAT-BUG-05 · P2 · Catalogue writes are not atomic and nested input is unvalidated, causing partial writes and 500s
- **Where:** `backend/apps/items/views.py:96-122`, `:140-173`, `:30-63`; `backend/apps/bestiary/views.py:59-76`, `:103-126`, `:289-334`, `:363-418`; `backend/config/settings.py:93-105` (DATABASES config has no `ATOMIC_REQUESTS`)
- **What:** Each view saves the parent row, then syncs children in separate autocommit statements:
  - **Items.** `_sync_availabilities` passes `cost`/`rarity` straight from the request into `ItemAvailability.objects.create`. A negative cost, rarity outside 2..20 or a non-number raises `IntegrityError`/`ValueError`, a 500 **after** the item row was committed, leaving an item with no availability. `availabilities` is declared as `ListField(child=DictField())` with no inner schema. `property_ids` and `restriction_id`s are not checked against campaign scope (see CAT-SEC-02).
  - **Bestiary / hired swords.** An unknown `skill_ids`/`special_ids`/`spell_ids`/`item_entries` id fails the deferred FK check, a 500 after the `BestiaryEntry` was committed. For hired swords the profile is never created, leaving an orphan "Hired Sword" entry that the Bestiary page filters out and nothing can delete. The hired-sword PATCH assigns `hire_cost`, `upkeep_cost` and `rating` from `request.data` unvalidated (`:376-387`): "abc" or -5 gives a 500.
- **Impact:** Half-created catalogue rows, invisible orphans, 500 errors in place of 400 validation messages.
- **Fix:** Decorate write methods with `@transaction.atomic`, or set `ATOMIC_REQUESTS=True` globally (cross-ref INFRA). Replace `DictField` with nested serializers (`AvailabilityInputSerializer(cost=IntegerField(min_value=0), rarity=IntegerField(min_value=2, max_value=20), restrictions=RestrictionLinkInput(many=True))`) and use `PrimaryKeyRelatedField` with querysets limited to `Q(campaign_id=cid) | Q(campaign__isnull=True)`. Validate hired-sword cost fields through a `HiredSwordProfileWriteSerializer`.
- **Effort:** M · **Confidence:** Confirmed by code reading (not executed: these are writes)

### CAT-BUG-06 · P2 · Catalogue data errors: Giant Spider has S0, and 14 seeded links are silently dropped
- **Where:** `backend/apps/bestiary/data/bestiary.json` (Giant Spider: `"strength": 0`); `seed_bestiary.py:264-265` (`_parse_int(..., 0)`), `:279-340`; `backend/apps/bestiary/data/seed-warnings.txt`
- **What:**
  - Giant Spider (Mount, `bestiary_entry` 6) is seeded with M7 WS3 BS0 **S0** T3 W1 I4 A1 Ld4. It is the only entry with S0 and A>0; a mount with an attack and "Poisoned Attack" cannot have S0. The value is in the source JSON, so this is a transcription error; confirm the correct S against the Forest Goblins source. The seeder silently coerces missing or garbled stats to 0, which hides this class of error.
  - `seed-warnings.txt` is stale: it lists 61 warnings, but replaying the seeder's resolution logic against current data leaves 14 unresolved links: Highwayman and Roadwarden "Horse"; Clan Skryre Rat Ogre "Warpfire Thrower"; Priest of Morr "Scythe"; Thief "Thief's Cloak"; Ninja skills "Lightning Speed" and "Leap of Faith"; Knight of the White Wolf "Ride Warhorse"; and all 6 Dark Elf "Dark Mage" spells, whose names carry a "1 - " to "6 - " prefix so they never match. The Dark Mage therefore has no spells in the app.
  - "Giant Spider" is restricted to "Goblins", a restriction separate from "Forest Goblins" and "Night Goblins", also used by 4 items and 1 hired sword. Check that it matches the intended warbands.
- **Impact:** Wrong statlines shown to players; hired swords missing gear, skills or spells.
- **Fix:** Correct the JSON, strip numeric prefixes from spell names in `_extract_name_and_description`, and add aliases (for example "horse" to the actual mount item). Make the seeder fail, or print a summary table, when a required stat is missing instead of defaulting to 0. Regenerate or delete `seed-warnings.txt`. Add a data test asserting no unresolved links (CAT-TEST-13).
- **Effort:** S · **Confidence:** Confirmed (DB and JSON inspected; unresolved list produced by importing the seeder's own resolver read-only)

### CAT-BUG-07 · P3 · A non-numeric `campaign_id` query parameter returns 500 on every catalogue list
- **Where:** `backend/apps/campaigns/permissions.py:4-5`, reached from every list view's `get_membership(request.user, campaign_id)`
- **What:** `GET /api/items/?campaign_id=abc` and `/api/skills/?campaign_id=1.5` return 500 (`ValueError: Field 'id' expected a number`). Verified.
- **Impact:** Noise in error tracking; a 500 instead of a 400.
- **Fix:** Parse with `int()` inside a try in a shared helper (`parse_campaign_id(request)`) and return 400 on failure; use it in the base view from CAT-CQ-01.
- **Effort:** S · **Confidence:** Confirmed

### CAT-BUG-08 · P3 · House-rule clones: staleness, id churn, editability and concurrency gaps
- **Where:** `backend/apps/items/services.py:131-186`, `:189-256`; `items/views.py:140-189`; `campaigns/views.py:1148-1213`
- **What:**
  - Clones are copied once and never refreshed when base items are reseeded (prices or descriptions drift) until the rule is saved again.
  - Every rule PATCH deletes and recreates all clone availabilities, and every toggle deletes and recreates the clone items, so ids churn; postbattle logs that store `item_id` and client caches holding `initialAvailabilityId` then point at deleted rows.
  - Clones have a `campaign_id`, so managers can PATCH (overwritten at the next sync) or DELETE them (cascading owned items; see CAT-BUG-01).
  - The remap sets `cost=None` for any source with more than one availability (`_single_availability_cost`). This is latent: all 12 armours and shields currently have exactly one.
  - Nothing prevents two concurrent rule saves from creating duplicate clones: there is no unique constraint on `(campaign, source_item, generated_effect_key)` and no `select_for_update`.
  - A campaign that already overrides "Heavy Armour" gets a clone with the same name as well.
- **Impact:** Low today (one campaign uses rules), but the clones' data quietly drifts and is fragile.
- **Fix:** Upsert clone availabilities in place instead of delete and recreate. Make clones read-only in `ItemDetailView` (`if item.generated_effect_key: 403`). Add `UniqueConstraint(fields=["campaign", "source_item", "generated_effect_key"])`. Re-run `_sync_house_rule_effect` for all campaigns at the end of `seed_items`. Keep the stored cost unchanged when the source has several availabilities.
- **Effort:** M · **Confidence:** Confirmed (code); the impact on logs is Likely

### CAT-BUG-09 · P3 · The client catalogue cache never reconciles overrides and never learns about other members' changes
- **Where:** `frontend/src/features/items/routes/Items.tsx:401-423`; `stores/app-store.tsx:250-290`; equivalents in `Skills.tsx` and `Spells.tsx`
- **What:** After creating a custom "Axe", the page prepends it but keeps the base Axe (the server would hide it), so both are listed and either can be bought. Deleting the override does not bring the base row back. The cache has no TTL or version, so custom entries created by another member never appear until a full reload (and a reload refetches everything; see CAT-PERF-01). `AddItemForm` and `Items.tsx` both call `upsertItemCache` for the same item (harmless, but duplicated).
- **Impact:** The list disagrees with the server; stale catalogues during a session.
- **Fix:** After a write, invalidate and refetch (cheap with ETags), or apply the server's merge rule locally. Broadcast `catalogue-updated` on the existing `campaign-{id}` Pusher channel and invalidate on receipt.
- **Effort:** S · **Confidence:** Confirmed

### CAT-BUG-10 · P3 · Trade offers record item cost as 0 because `Item` has no `cost` attribute (cross-ref ECON)
- **Where:** `backend/apps/trades/views.py:77`
- **What:** `costs = {entry.item_id: getattr(entry.item, "cost", 0) ...}`. Prices live on `ItemAvailability` and the owned row (`WarbandItem.cost`), so this always yields 0 in the normalised offer payload.
- **Impact:** Trade offers show and store 0 gc item values.
- **Fix:** Use `entry.cost` (the persisted cost on the stash row).
- **Effort:** S · **Confidence:** Confirmed

### CAT-BUG-11 · P3 · Hired Swords page mutates React state while sorting
- **Where:** `frontend/src/features/bestiary/routes/HiredSwords.tsx:91`
- **What:** `profiles.sort(...)` inside `useMemo` sorts the state array in place when the search is empty.
- **Impact:** Violates React's immutability contract; can cause stale renders.
- **Fix:** `[...profiles].sort(...)`.
- **Effort:** S · **Confidence:** Confirmed

### CAT-BUG-12 · P3 · Custom races can be created by any member without a permission check
- **Where:** `backend/apps/races/views.py:43-53`
- **What:** `RaceListView.post` checks membership only (no `add_custom`), and there is no delete endpoint, so a player can add races that only the owner or an admin can edit and nobody can remove. Race stat caps drive hero creation.
- **Impact:** Uncontrolled additions that cannot be removed.
- **Fix:** Require `add_custom` (or the unified permission from CAT-BUG-04) and add a guarded DELETE (refuse while heroes reference the race).
- **Effort:** S · **Confidence:** Confirmed

## Code quality

### CAT-CQ-01 · P2 · Backend catalogue apps are copy-pasted; the merge block exists 8 times
- **Where:** `backend/apps/skills/views.py` vs `spells/views.py` vs `special/views.py` (108 lines each; `diff` shows only renames and the permission code); merge blocks at `items/views.py:84-90`, `skills/views.py:29-35`, `spells/views.py:29-35`, `special/views.py:29-35`, `races/views.py:24-28`, `restrictions/views.py:31-37`, `bestiary/views.py:47-53`, `:273-283`; the same five-step detail permission ladder (fetch, 404, base → 403, membership → 404, permission → 403) in 12 methods
- **What:** Seven near-identical apps, with behaviour already diverging (races search in Python; restrictions with no membership check on POST; different permission codes).
- **Impact:** Each fix (CAT-BUG-03, -04, -07, CAT-PERF-02) has to be made 8 times.
- **Fix:** Create `apps/core/catalogue.py` with `CampaignCatalogueListView(model, serializer, create_serializer, create_perm, merge_keys=("name","type"))` and `CampaignCatalogueDetailView(manage_perm)`, plus `merge_campaign_overrides(qs, campaign_id, keys)` and `parse_campaign_id`. skills, spells and special shrink to about 10 lines each (~324 lines to ~90); items, races, restrictions and bestiary reuse the helpers. Consider merging Skill, Spell and Special into one model with a `kind` column in the long run.
- **Effort:** M · **Confidence:** Confirmed

### CAT-CQ-02 · P2 · Every catalogue entity has two near-identical frontend forms
- **Where:** `features/items/components/AddItemForm.tsx` (782 lines) vs `ItemFormDialog.tsx` (887): `STAT_KEYS`, `createEmptyStatblock`, `parseStatblock`, `initialState`, `itemTypeOptions`, `buildFormFromItem`, `mapPropertiesFromItem` at `AddItemForm.tsx:58-165` vs `ItemFormDialog.tsx:58-207`; handlers `AddItemForm.tsx:248-410` vs `ItemFormDialog.tsx:311-450`. Same pattern: `skills/components/AddSkillForm.tsx` (349) vs `SkillFormDialog.tsx` (449); `spells/components/AddSpellForm.tsx` (414) vs `CreateSpellDialog.tsx` (371); `special/components/AddSpecialForm.tsx` (259) vs `CreateSpecialDialog.tsx` (306). `SkillsTable.tsx` vs `SpellsTable.tsx` differ by 36 lines after renaming. A third `parseStatblock` exists in `items/routes/Items.tsx:122-135`.
- **What:** About 3,800 lines where about 1,500 would do; bugs fixed in one copy linger in the other (for example property search behaviour).
- **Impact:** Maintenance cost and drift.
- **Fix:** For each kind, extract `use<Kind>Form({ editing, campaignId })` (state, validation, save/delete) and a `<Kind>FormFields>` component, rendered either inline (route pages) or inside `<Dialog>` (warband pages). Move statblock helpers to `features/items/utils/statblock.ts`. Make a generic `CatalogueTable<T>`.
- **Effort:** L · **Confidence:** Confirmed

### CAT-CQ-03 · P2 · Hand-rolled catalogue cache: 6 cloned store slices and 5 cloned hooks inside one giant context
- **Where:** `frontend/src/stores/app-store.tsx:100-330` (`set*/upsert*/remove*Cache` for skills, spells, specials, items, item properties, races), `:400-520` (one memoised value with ~45 deps); `features/warbands/hooks/campaign/useCampaignItems.ts`, `useCampaignSkills.ts`, `useCampaignSpells.ts`, `useCampaignSpecial.ts`, `useCampaignRaces.ts`
- **What:** The same CacheEntry logic is repeated per kind. There is no TTL, versioning or persistence, and `loaded` is ignored by `load*` (CAT-PERF-01). Because everything lives in one context, any cache write re-renders every `useAppStore()` consumer.
- **Impact:** The root cause of CAT-PERF-01, CAT-PERF-03 and CAT-BUG-09; hard to extend to bestiary and hired swords.
- **Fix:** Replace with TanStack Query (`useQuery(["catalogue", kind, campaignId], ..., { staleTime: Infinity })`, `invalidateQueries` after writes, a persister for reloads), or one generic `useCatalogue(kind, campaignId)` backed by a small dedicated store. Delete the six slices and five hooks.
- **Effort:** M · **Confidence:** Confirmed

### CAT-CQ-04 · P2 · Seeders duplicate helpers and disagree on scoping
- **Where:** `_resolve_restrictions` at `seed_items.py:134-154` and `seed_bestiary.py:127-140`; `_sync_availabilities` at `seed_items.py:157-182`, `seed_bestiary.py:152-177` and a third variant in `items/views.py:30-63`; `_parse_int`/`_normalize_rarity` at `seed_items.py:74-103` and `seed_bestiary.py:89-100`; campaign scoping present in `seed_races.py:106` and `seed_restrictions.py:61-64`, absent elsewhere (CAT-BUG-02); only `seed_bestiary` uses a transaction (`:244`)
- **What:** Same logic, different edge-case behaviour (for example `seed_items._parse_int` accepts "5gc", `seed_bestiary._parse_int` does not).
- **Impact:** Bug fixes need to land in 2 or 3 places; inconsistent idempotency.
- **Fix:** Create `apps/core/seeding.py` with `upsert_global(model, lookup, defaults)` (always `campaign__isnull=True`), `resolve_restrictions`, `sync_availabilities` and `parse_int`; wrap every seeder in `transaction.atomic`; make `seed_all` print one summary. `seed_skills` should also drop the Google Sheets `urlopen` fallback (`:15`, `:236-241`) now that the JSON is committed.
- **Effort:** M · **Confidence:** Confirmed

### CAT-CQ-05 · P3 · `items/services.py` duplicates near-identical functions
- **Where:** `backend/apps/items/services.py:14-47` (two prefetch functions differing only in `subtype`), `:85-128` (`_sync_discounted_availabilities` vs `_sync_matching_availabilities`, differing only in the cost transform), `:135-163` (three identical remap loops)
- **What:** Parametrisable code written out three times.
- **Impact:** 312 lines where about 170 would do.
- **Fix:** `_prefetched_base_items(subtype)`, `_sync_availabilities(source, clone, cost_fn)`, and a loop over `(HeroItem, "hero__warband__campaign_id"), (HenchmenGroupItem, ...), (HiredSwordItem, ...)` with `bulk_update`.
- **Effort:** S · **Confidence:** Confirmed

### CAT-CQ-06 · P3 · `Items.tsx` is 908 lines, with a wrong memo and an in-file duplicate in Skills
- **Where:** `frontend/src/features/items/routes/Items.tsx` (column config `:446-797` is 350 lines; statblock parsing and rendering `:122-185`; filtering `:329-399`); memo deps `:797` (missing `navigate`, `id`, `handleEdit`; includes unstable handlers); `features/skills/routes/Skills.tsx:138-181` (the same sort comparator written twice)
- **What:** One component holds data loading, permissions, filtering, row flattening, four column sets and rendering.
- **Impact:** Hard to review; hidden re-render costs (CAT-PERF-06).
- **Fix:** Split into `items-columns.tsx` (pure function `buildItemColumns(tab, ctx)`), `useItemsFilters.ts`, `utils/statblock.tsx`, and a ~200-line route. Hoist the Skills comparator into a module-level `compareSkills`.
- **Effort:** M · **Confidence:** Confirmed

### CAT-CQ-07 · P3 · Dead code, unused data and stale artefacts
- **Where:** `frontend/src/features/items/api/items-api.ts:113-118` (`createRestriction`, unused); `features/bestiary/api/bestiary-api.ts:47`, `:57`, `:124`, `:134` (update/delete functions with no UI); unseeded `backend/apps/items/data/mim-items.json` (62 items), `bestiary/data/mim-bestiary.json` (18), `skills/data/custom-skills.json` (91); stale `bestiary/data/seed-warnings.txt`; duplicated tests with identical bodies: `features/items/utils/acquire-item-costs.test.ts` = `utils/__tests__/acquire-item-costs.test.ts`, `components/AcquireItemDialog/RaritySection.test.tsx` = `__tests__/RaritySection.test.tsx`, `hooks/useAcquireItemDialogShared.test.tsx` = `hooks/__tests__/useAcquireItemDialogShared.test.tsx` (repo-wide pattern, 12 pairs)
- **What:** Files that look meaningful but are not wired up, and tests that run twice.
- **Impact:** Confusion (is the Marienburg data supposed to be live?); doubled test time.
- **Fix:** Decide whether the `mim-*` and `custom-skills` data should be seeded (perhaps for `campaign_type == "marienburg"`) and either wire it in or delete it. Delete one copy of each duplicate test. Remove `createRestriction`, or build the bestiary edit UI (CAT-UX-02).
- **Effort:** S · **Confidence:** Confirmed

### CAT-CQ-08 · P3 · Missing uniqueness and audit columns on catalogue tables
- **Where:** `backend/apps/items/models.py:5-44`, `skills/models.py`, `spells/models.py`, `special/models.py`, `races/models.py`, `bestiary/models.py:6-61`, `:64-118`; `restrictions/models.py:29-34`
- **What:**
  - Nothing enforces unique `(campaign, name, type)`, which is what makes the seeders' `update_or_create` fragile.
  - `Restriction`'s `UniqueConstraint(campaign, type, restriction)` does not apply to global rows, because Postgres treats NULLs as distinct; duplicate global restrictions are therefore possible (and creatable through CAT-SEC-01).
  - The bestiary through tables (`BestiaryEntrySkill/Special/Spell`) have no unique pair.
  - No catalogue model has `created_by` or `created_at`, so the author of the 25 gc Axe cannot be identified.
- **Impact:** Duplicates and an untraceable history.
- **Fix:** Add `UniqueConstraint(fields=["campaign", "name", "type"], nulls_distinct=False, name=...)` (Django 5.0+, PostgreSQL 15+; check Neon's version) after de-duplicating; add the same to `Restriction`; add unique pairs to the through tables; add `created_by` (nullable FK) and `created_at` to the campaign-scopable models.
- **Effort:** M · **Confidence:** Confirmed

### CAT-CQ-09 · P3 · Typing and naming smells
- **Where:** `backend/apps/items/serializers.py:79`, `:113` (a field named `save`, forcing `# type: ignore[operator]` at `items/views.py:111`, `:160`); `items/serializers.py:104-109` (`SerializerMethodField` where a nested `ItemPropertySummarySerializer(source=..., many=True)` would do); `races/views.py:17` (`races: Any`)
- **What:** The `save` field works only because DRF's metaclass pops declared fields off the class; it reads as if it shadows `Serializer.save()`.
- **Impact:** Readability; suppressed type checking.
- **Fix:** Declare the field as `save_value = CharField(...)` and rename the output key with `to_representation`, or keep the name but document it. Replace the method field. Type `races` as `QuerySet[Race] | list[Race]`.
- **Effort:** S · **Confidence:** Confirmed

## UI / UX

### CAT-UX-01 · P2 · Base, custom and house-rule entries look identical
- **Where:** `frontend/src/features/items/routes/Items.tsx:478-482` (name cells, repeated at `:543`, `:591`, `:641`), `features/skills/components/SkillsTable.tsx`, `features/spells/components/SpellsTable.tsx`, `features/bestiary/components/BestiaryEntryCard.tsx`, `HiredSwordProfileCard.tsx`
- **What:** No badge, tooltip or creator distinguishes a campaign override (custom Axe at 25 gc), a house-rule clone (half-price Heavy Armour) or a base entry. Custom rows are also forced to the top of each list by the API ordering.
- **Impact:** This is exactly why the Axe price looked like a bug; players cannot tell which prices are house-ruled.
- **Fix:** Show a "Custom" badge (tooltip: "Added by <user> on <date>; replaces base price 5 gc") and a "House rule: Half price armour" badge linking to House Rules. Sort custom rows alphabetically with the base rows.
- **Effort:** S (once `created_by` exists, CAT-CQ-08) · **Confidence:** Confirmed

### CAT-UX-02 · P2 · Catalogue editors are incomplete: no bestiary edit/delete; no restrictions on custom items or hired swords
- **Where:** `frontend/src/features/bestiary/components/BestiaryEntryFormDialog.tsx`, `HiredSwordProfileFormDialog.tsx:210-249` (create only; payload has no `grade`, `race` or `restriction_ids`); `features/items/components/AddItemForm.tsx:149-151`, `:331-334` (restrictions are only carried over from existing items; there is no control to add one); backend ignores `grade`/`race` on create (`bestiary/views.py:297-326`)
- **What:** A manager who mistypes a custom bestiary entry or hired sword cannot fix or remove it from the UI, although `PATCH`/`DELETE` exist. Custom items are always unrestricted. Custom hired swords have an empty race and grade.
- **Impact:** Bad entries live forever unless someone uses the API by hand.
- **Fix:** Reuse the form dialogs in edit mode (pass `editing`), add a delete action with a usage-aware confirmation (CAT-BUG-01), add a restriction picker fed by the cached `/restrictions/` list, and accept and persist `grade`/`race`.
- **Effort:** M · **Confidence:** Confirmed

### CAT-UX-03 · P3 · Multi-availability items appear as unexplained duplicate rows (Blowpipe)
- **Where:** `frontend/src/features/items/routes/Items.tsx:370-388` (one row per availability); `features/items/components/ItemsTable.tsx:52-140` (mobile shows only Name, Price and actions)
- **What:** The two "Blowpipe" rows are intentional: one `Item` (id 61) with two seeded availabilities, 25 gc rarity 2 for Forest Goblins and 25 gc rarity 7 for Lizardmen/Skaven, straight from `standard-items.json`. On mobile both rows read "Blowpipe · 25" with nothing to tell them apart until expanded. The same applies to the 10 items with several availabilities.
- **Impact:** Looks like duplicated data.
- **Fix:** Render the restriction as a subtitle under the name ("Forest Goblins · Common", "Lizardmen, Skaven · Rare 7"), or group availabilities into one row with an inline list.
- **Effort:** S · **Confidence:** Confirmed

### CAT-UX-04 · P3 · Swallowed errors make empty states lie
- **Where:** `NewSkillDialog.tsx:61`, `NewHiredSwordSkillDialog.tsx:50`, `NewSpellDialog.tsx:64`, `NewHiredSwordSpellDialog.tsx:55` (`.catch(() => {})`); `Bestiary.tsx:104-125` ("silently fail" on favourite toggle); `AddItemForm.tsx:229`, `DetailCardContent.tsx:79` (property errors become empty maps)
- **What:** A network failure shows as "no skills available" or a star that does not toggle, with no message.
- **Impact:** Users assume data is missing.
- **Fix:** Surface an inline error with a Retry button; on favourite failure, roll back and show a toast.
- **Effort:** S · **Confidence:** Confirmed

### CAT-UX-05 · P3 · Tab, filter and search state is not in the URL
- **Where:** `frontend/src/features/items/routes/Items.tsx:206-209`, `:323-327` (filters reset on tab change); `Skills.tsx`, `Spells.tsx`, `Bestiary.tsx:50-53`
- **What:** Navigating to a bestiary entry and back resets the Wargear tab to Weapons and clears the search; links cannot be shared ("look at Armour → Shields").
- **Impact:** Friction on mobile, where users hop between pages often.
- **Fix:** Store `tab`, `subtype` and `q` in `useSearchParams` (Bestiary already does this for `entry`).
- **Effort:** S · **Confidence:** Confirmed

### CAT-UX-06 · P3 · Property and special-rule tooltips are not keyboard-reachable
- **Where:** `frontend/src/features/items/routes/Items.tsx:450-473`, `:688-712` (Tooltip trigger is a plain `<span>`); `frontend/src/components/ui/tooltip.tsx` (forwards `tabIndex` only if passed)
- **What:** Rule text for "Parry", "Poisoned Attack" and similar is reachable only by hover or touch.
- **Impact:** Accessibility gap for keyboard and screen-reader users.
- **Fix:** Render the trigger as a `<button type="button">` or pass `tabIndex={0}` with `aria-describedby`.
- **Effort:** S · **Confidence:** Likely

## Security

### CAT-SEC-01 · P2 · Any logged-in user can create global restrictions
- **Where:** `backend/apps/restrictions/views.py:43-50`, `serializers.py:7-20`
- **What:** `RestrictionListView.post` has no membership or permission check. `campaign` is read-only in the serializer, so every row created is **global** (`campaign=NULL`) and appears in every campaign's `/api/restrictions/` list. Because the unique constraint does not cover NULL campaigns (CAT-CQ-08), the same text can be inserted repeatedly. The seeders' restriction cache is keyed by text across all rows (`seed_items.py:285-287`, `seed_bestiary.py:232-234`), so a junk row can end up linked to base items on the next reseed. Only type "Setting" is blocked. No frontend code calls this endpoint (`createRestriction` is unused).
- **Impact:** Any registered user (registration is open) can pollute shared reference data and influence future seeding.
- **Fix:** Remove the POST, or require a campaign `campaign_id` plus `add_custom` and save with `campaign_id=...`. Add `nulls_distinct=False` to the constraint. Delete any user-created global rows (compare against `restrictions.json`).
- **Effort:** S · **Confidence:** Confirmed (code; not exercised, since it is a write)

### CAT-SEC-02 · P3 · Catalogue writes accept ids from other campaigns, which leak their custom content
- **Where:** `backend/apps/items/views.py:116-119`, `:165-170` (`property_ids`), `:46-61` (`restriction_id`), `serializers.py:116-118` (`bestiary_entry_id`); `backend/apps/bestiary/views.py:204-252` (`skill_ids`, `special_ids`, `spell_ids`, `item_entries`, `restriction_ids`), `:175-180` (favourites accept any `bestiary_entry_id`)
- **What:** None of these ids are checked against `campaign_id IN (this campaign, NULL)`. With sequential ids, a member of campaign A can link campaign B's custom skills, items or bestiary entries and then read their full text and stats through A's detail endpoints (`ItemSerializer.bestiary_entry`, `BestiaryEntrySerializer.skills`, `equipment`).
- **Impact:** Low-value information disclosure across campaigns, and cross-tenant references that break if B deletes the row.
- **Fix:** Validate with scoped `PrimaryKeyRelatedField(queryset=Model.objects.filter(Q(campaign_id=cid) | Q(campaign__isnull=True)))` in the nested input serializers proposed in CAT-BUG-05.
- **Effort:** S · **Confidence:** Confirmed (code)

## Test plan

### Existing coverage

| Area | Tests | What they cover |
| --- | --- | --- |
| `backend/apps/items/tests/test_seed_items.py` | 1 | Same property name allowed for different item types |
| `backend/apps/spells/tests/test_spells_api.py` | 1 | Spell description longer than 500 chars accepted |
| `backend/apps/campaigns/tests/test_campaigns_api.py:257-529` | 8 | Half-price armour and improved shields: clone creation, idempotency, remap of owned rows, revert, stash merge on revert |
| `backend/apps/campaigns/tests/test_campaigns_api.py:211-257`, `:580-710` | 6 | Campaign item settings; effective warband restrictions; posting a Setting restriction rejected |
| `backend/apps/warbands/tests/test_warbands_api.py:70-170` | 6 | Owned-item cost defaults from a single availability |
| `frontend/src/stores/app-store.test.tsx` | 2 | Catalogue cache upsert/remove; unloaded caches stay fetchable |
| `frontend/src/features/warbands/hooks/campaign/__tests__` | 2 | `loadItems` writes the cache; special upserts visible immediately |
| `frontend/src/features/items/...` | 9 (each duplicated) | Acquire-item cost persistence (5), RaritySection (3), acquire dialog rarity flow (1) |

**No tests at all for:** skills/special/races/restrictions/bestiary/hired-sword/favourite endpoints; `parse_unique_to`; `seed_bestiary`, `seed_skills`, `seed_spells_and_special`, `seed_races`, `seed_restrictions`, `seed_all`; list merge/shadow semantics; catalogue permission gates; query-count budgets; the Items, Skills, Spells, Bestiary and HiredSwords routes; the catalogue form components; the `CampaignLayout` lookup gate.

### Gaps and proposed tests

| ID | Level | Scenario | Expected result | Priority |
| --- | --- | --- | --- | --- |
| CAT-TEST-01 | API | For each list endpoint (`items`, `skills`, `spells`, `special`, `races`, `restrictions`, `bestiary`, `hired-swords`, `item-properties`), a non-member passes `campaign_id` | 404; base-only list still 200 without `campaign_id` | P1 |
| CAT-TEST-02 | API | Campaign custom skill "Infiltration" (type Skaven) exists; list skills for the campaign | Only the Skaven base "Infiltration" is hidden (after the CAT-BUG-03 fix); other types remain | P1 |
| CAT-TEST-03 | API | Player with default perms creates a custom item, then PATCHes and DELETEs it | Create 201; edit/delete follow the chosen model (CAT-BUG-04): 200/204 for own entries, 403 for others | P1 |
| CAT-TEST-04 | API | DELETE a custom item that is in a hero's loadout and a stash | 409 with usage count (after CAT-BUG-01); owned rows untouched | P1 |
| CAT-TEST-05 | API | POST `/api/restrictions/` as a random user | 403 or 405 (after CAT-SEC-01) | P1 |
| CAT-TEST-06 | API | `GET /api/items/?campaign_id=1` twice with `If-None-Match` from the first response | Second is 304 with at most 2 queries; after creating a custom item, 200 with a new ETag | P1 |
| CAT-TEST-07 | API | Query budgets with `assertNumQueries` for each list endpoint (current: items 14, others 4 to 6) | Counts do not grow with row count (add 50 items, same count) | P1 |
| CAT-TEST-08 | API | `GET /api/bestiary/:id/` and `/api/hired-swords/:id/` for an entry with 8 equipment items | At most 12 queries (currently 43/45) | P2 |
| CAT-TEST-09 | API | POST item with `availabilities=[{"cost": -5, "rarity": 1}]` | 400 with field errors; no item row created | P2 |
| CAT-TEST-10 | API | POST hired sword with `skill_ids=[999999]` | 400; no orphan `BestiaryEntry` | P2 |
| CAT-TEST-11 | API | `?campaign_id=abc` on each list | 400, not 500 | P3 |
| CAT-TEST-12 | unit (command) | Seed, create a campaign override "Axe" and a half-price-armour rule, run `seed_all` again | Succeeds; base rows updated; campaign rows untouched; no duplicates | P1 |
| CAT-TEST-13 | unit (data) | Replay `seed_bestiary` resolution against the committed JSON | Zero unresolved equipment/skills/spells; no entry with S0 and A>0 | P2 |
| CAT-TEST-14 | unit | `parse_unique_to` table test: "Goblins only", "Khemri Setting", "Shadow Warriors - Shadow Weavers", "Dark Elves, Lizardmen, Norse and Marauders only", "Pirates only, one per model", every key in `_RESTRICTION_CORRECTIONS` | Matches docstring examples and corrections | P2 |
| CAT-TEST-15 | API | Toggle a house rule twice concurrently (two threads) | Exactly 12 clones; owned rows point at clones | P3 |
| CAT-TEST-16 | API | Member of campaign A links campaign B's custom skill id to A's bestiary entry | 400 (after CAT-SEC-02) | P3 |
| CAT-TEST-17 | component | `CampaignLayout` with lookups pending | Shell and overview render; Warband route shows its own skeleton (after CAT-PERF-01) | P1 |
| CAT-TEST-18 | component | `Skills.tsx` as a player without `manage_skills` | No Edit button on custom skills | P2 |
| CAT-TEST-19 | component | `Items.tsx` with an item that has 2 availabilities, mobile viewport | Two rows, each showing its restriction label | P3 |
| CAT-TEST-20 | component | `NewSkillDialog` opened twice | `listSkills` called at most once (served from cache) | P2 |
| CAT-TEST-21 | component | `HiredSwords.tsx` sorts without mutating props/state | Original array order unchanged | P3 |
| CAT-TEST-22 | e2e | Owner creates custom "Axe" at 25 gc; player opens Wargear | Single Axe row with a "Custom" badge showing the base price; the acquire dialog uses 25 gc | P2 |

### Manual QA script

1. Log in as the campaign owner (user 1) and open campaign "Shards". In DevTools Network, count the requests fired before the campaign overview renders. Expected today: `campaigns/1/` plus 5 catalogue requests totalling ~380 KB. After the fixes: the overview renders without waiting for catalogue requests.
2. Go back to the campaign list and re-enter the campaign. Expected after the fixes: catalogue requests return 304 (or come from cache), with no loading screen.
3. Open **Wargear → Weapons**. Find "Axe": confirm it shows a "Custom" badge with author and base price (after CAT-UX-01). Today it shows 25 gc with no badge.
4. Find "Blowpipe": confirm two rows exist and that each shows its restriction (Forest Goblins vs Lizardmen/Skaven), including on a 375 px wide viewport.
5. Expand a few rows and type in the search box; the page should stay responsive on a mid-range phone (CAT-PERF-06).
6. Open **Bestiary**, select "Giant Spider": check S is no longer 0 (after the data fix). Open a hired sword (Bounty Hunter); in DevTools confirm a single detail request and check the server log query count (at most 12 after CAT-PERF-04).
7. Log in as a plain player (member 4, `claude-tester@example.test`). Open **Skills**: "Add skill" is visible (expected; players have `add_custom`). Confirm no Edit pencil appears on custom skills unless you created them (after CAT-BUG-04).
8. As that player, create a custom skill named after an existing base skill of a different type (for example "Infiltration", type "Combat"). Confirm the base "Infiltration" entries of other types are still listed.
9. As that player, try to create a custom item named "Gromril Armour" priced 1 gc. Expected after CAT-BUG-03: rejected or requires `manage_items`; today it silently reprices the item for everyone.
10. As the owner, give a hero a custom item, then try to delete that custom item from Wargear. Expected after CAT-BUG-01: blocked with "in use by 1 unit"; today the item disappears from the hero.
11. As the owner, create the "Half Price Armour" house rule, then open Wargear → Armour: armour prices are halved and show a "House rule" badge. Delete the rule: prices return and owned armour is still present.
12. Open a hero, click "Learn new skill" twice in a row; in DevTools confirm the skills list is not downloaded again on the second open (after CAT-PERF-03).
13. As the owner, open member permissions in settings: confirm "Manage bestiary" (and spells/specials, if kept separate) can be granted, then verify a player with that permission can add and edit a bestiary entry.
14. Call `GET /api/items/?campaign_id=abc` with a valid token: expect 400, not 500.
