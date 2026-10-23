# Pass 5 brief: Catalogue

Step 1 of the pass loop in [PLAN.md](../PLAN.md). Full detail (repro, fix) is in [features/06-catalogue.md](../features/06-catalogue.md); IDs are from [BUGS.md](../BUGS.md), [PERFORMANCE.md](../PERFORMANCE.md), [IMPROVEMENTS.md](../IMPROVEMENTS.md) and [TEST_PLAN.md](../TEST_PLAN.md); the permission pattern is [design 0.29](../designs/permissions-and-capabilities.md). The review predates passes 1 to 4, so every finding below was re-checked against today's code: the main checkout `pass3/refactor-frontend` @ `4ebf649` (line numbers are from here). Its catalogue apps, `warbands/services/prices.py`, `units/catalogue_scope.py` and the catalogue pages are identical to `main`; pass 3's backend branch and pass 4's characterisation branch don't touch them.

**Already done (not proposed again):**
- Phase 0: the catalogue lives in TanStack Query (`lib/catalogue-queries.ts`: one shared, 5-minute list per kind, bestiary and hired swords included, read by pages and dialogs alike); the six app-store slices are gone (CAT-CQ-03). The shell waits only for the campaign (`CampaignLayout.tsx:330-332`; CAT-PERF-01, PERF-12) and most of CAT-PERF-03 is gone with it. Content ETags and `private, no-cache` turn unchanged lists into 304s (`settings.py:76`, `core/middleware.py:7-23`: PERF-13's byte half). Render already compresses (PERF-04). Rules is a lazy route (CAT-PERF-10). The seven list endpoints have budgets at today's counts (`core/tests/test_query_budgets.py:75-81`; items 7). Pages read the caller's codes from the campaign payload (`useCampaignPermissions`).
- Pass 1: unit writes reject another campaign's race, item, skill, special or spell (`warbands/units/catalogue_scope.py:41-82`, SEC-07's unit half); trait specials moved to `units/services/loadout.py`, the cross-campaign lookup left for this pass (BUG-103).
- Pass 2: stash writes are scoped (SEC-07's stash half); trade costs are real (BUG-40 / CAT-BUG-10); `services/prices.py` gives copies a `current_price` (what Buy again charges) and a `suggested_sale_price`, finding a campaign's replacement **by name** (BUG-18's pricing half). BUG-81 is fixed too: `HiredSwords.tsx:55` copies before sorting.
- Pass 4 (agreed, not built): `apps/campaigns/constants.py` plus a migration seeding every code (`manage_spells` seeded, `manage_features` renamed `manage_specials`), the grant menu built from `GET /permissions/`, `CampaignScopedView` with `capabilities` on the campaign payload, the `private-campaign-{id}-events` channel (CAMP-NEW-07), permanent campaign delete (CAMP-TWEAK-04), BUG-51's main half (clone PATCH and DELETE answer 403 `house_rule_item`, unique `(campaign, generated_effect_key, source_item)`, remaps keep stored costs) and one repricing path for house rules (IMP-67, which also covers CAT-CQ-05).

**Data is disposable** (`CLAUDE.md`): no backfills or drift reports. Every migration below runs on an empty database, and `seed_all` (run by `seed_catalogue_if_empty` on a wiped production database) keeps working, which CAT-TEST-12 proves.

**Your part:** every decision is answered (see [Decisions](#decisions-answered-by-william-2026-10-18)). The [Calls I made](#calls-i-made) were confirmed on 2026-10-19. What the agents decided along the way is under [Progress](#progress), for you to change.

## What it is today

- **Model.** Every catalogue table has a nullable `campaign`: NULL is the book (seeded), a value is that campaign's entry. Items carry prices in `ItemAvailability` (cost, rarity, restrictions) and two house-rule columns, `source_item` (CASCADE) and `generated_effect_key`. Bestiary entries link skills, specials, spells and equipment through four tables; a hired sword is a bestiary entry plus a one-to-one `HiredSwordProfile`. Nothing is archived; nothing records who changed what.
- **Overrides.** With `?campaign_id=`, each list returns the campaign's rows, then the book rows **whose name no campaign row uses**. A same-named custom entry therefore replaces a book entry campaign-wide, whatever its type. House rules clone 8 armours or 4 shields into campaign rows and remap owned copies onto them.
- **Rules.** Create needs `add_custom` (every player gets it on joining, `campaigns/views.py:561-563`); edit and delete need a per-kind `manage_*` code; races let any member create and only owners and admins edit; book entries can't be edited at all (403).
- **Seeding.** `seed_all` runs races, restrictions, items, skills, spells and specials, then the bestiary, each upserting by name and type. Only the bestiary seeder is atomic.
- **Frontend.** Wargear (`Items.tsx`), Skills, Spells, Bestiary and Hired Swords pages, plus Add forms on each page and near-identical dialogs on the warband pages (specials and races have no page of their own). Lists come from `useCatalogue(kind, campaignId)`; writes upsert the answer into the cached list and refetch it.
- **Main files.** Backend `items/views.py` 255, `items/services.py` 304, `bestiary/views.py` 434, `seed_bestiary.py` 450, `seed_items.py` 419; skills, spells and special views are 108-line clones. Two catalogue tests outside the house-rule ones. Frontend `Items.tsx` 841, `ItemFormDialog` 892, `AddItemForm` 769, `HiredSwordProfileFormDialog` 543, `BestiaryEntryFormDialog` 451, `SkillFormDialog` 441, `AddSpellForm` 408.

## What's wrong

### Overrides, names and permissions
- **BUG-18** (P1), unchanged: the name-only merge is written 8 times (`items/views.py:84-88`, `skills/views.py:29-33`, `spells/views.py:29-33`, `special/views.py:29-33`, `races/views.py:24-28`, `restrictions/views.py:31-35`, `bestiary/views.py:47-51`, `:273-281`). A custom skill "Infiltration" hides all six book ones. Pass 2's prices follow the same rule and also ignore type (`warbands/services/prices.py:48`, `:78`, `:118`), so a campaign "Shield" in Miscellaneous would set the armour Shield's Buy again and sale price; `test_economy_sale_prices.py:30-41` and `test_economy_purchases.py:68-80` pin the name rule.
- **BUG-103**: `get_trait_specials` (`units/services/loadout.py:26-28`) reads "Large", "Wizard" and "Priest" from every campaign; the last row wins.
- **BUG-15** (catalogue half): create needs `add_custom` (`items/views.py:101`, `:230`; skills, spells and special `views.py:46`) but edit needs `manage_items` (`items/views.py:150`, `:185`), `manage_skills` (`skills/views.py:83`, `:104`), `manage_spells` (`spells/views.py:83`, `:104`), `manage_features` (`special/views.py:83`, `:104`) or `manage_bestiary` (`bestiary/views.py:64`, `:113`, `:138`, `:294`, `:373`, `:430`), so a player can't fix their own typo. Skills and Spells show Edit on every campaign entry to everyone (`Skills.tsx:218-234`, `Spells.tsx:212-228`); Items and the bestiary pages gate correctly (`Items.tsx:207-210`, `Bestiary.tsx:62-65`, `HiredSwords.tsx:42-45`).
- **BUG-82**: race create checks membership only and there is no DELETE (`races/views.py:43-53`); edit is owner or admin (`:74`).

### Deleting and seeding
- **BUG-16** (P1), unchanged: owned copies reference the catalogue with CASCADE (`warbands/models/heroes.py:65`, `:77`, `:88`, `:99`; `henchmen.py:62`, `:74`, `:85`; `hired_swords.py:69`, `:81`, `:92`, `:103`; `warband.py:69`), and so do the bestiary link tables (`bestiary/models.py:70-74`, `:89-93`, `:108-112`, `:127-131`). Deleting a custom entry (`items/views.py:175-189`, the three `views.py:94-108`, `bestiary/views.py:128-142`, `:420-434`) removes it from every warband; the dialogs say only "This action cannot be undone" (`AddItemForm.tsx:757`, `ItemFormDialog.tsx:880`, `AddSkillForm.tsx:337`, `SkillFormDialog.tsx:429`, `AddSpellForm.tsx:396`). Five seeders' `--truncate` delete campaign rows too (`seed_items.py:206-209`, `seed_skills.py:101-102`, `seed_spells_and_special.py:26-28`, `seed_races.py:62-63`, `seed_restrictions.py:37-38`).
- **BUG-130** (new, P3): units reference their race with CASCADE (`heroes.py:9-15`, `henchmen.py:9-15`, `hired_swords.py:9-15`), so `seed_races --truncate` or any future race delete removes every hero, henchmen group and hired sword of that race.
- **BUG-17** (P1), unchanged: upserts without `campaign__isnull=True` (`seed_items.py:320-333`, `seed_skills.py:140`, `:199`, `seed_spells_and_special.py:60`, `:90`, `seed_bestiary.py:345-355`); restriction `get_or_create` by text alone and caches built across campaigns (`seed_items.py:148-151`, `:285-287`, `seed_bestiary.py:134-137`, `:232-234`); property cache and upsert unscoped (`seed_items.py:224-226`, `:271-277`); only `seed_bestiary` is atomic (`:244`). An empty database never hits it, but copy-on-write makes every edited entry a same-named campaign row, so this goes first.
- **BUG-51** (pass 5 half): clones never pick up a reseeded book price; nothing re-syncs them after `seed_items`.
- **BUG-54** (Giant Spider set aside, decision 8): `_extract_name_and_description` (`seed_bestiary.py:143-149`) keeps the "1 - " prefixes of the Dark Mage spells (`hired-swords.json:3562`, `:3566`), so the Dark Mage has none; `seed-warnings.txt` (61 lines) is stale.

### Writes and security
- **BUG-53**: item writes pass raw cost and rarity into `ItemAvailability.objects.create` (`items/views.py:30-63`) from a `DictField` list (`items/serializers.py:115`), outside any transaction (`:96-122`, `:140-173`; no `ATOMIC_REQUESTS`); the hired-sword POST saves the entry before its links and profile (`bestiary/views.py:289-334`), so an unknown id leaves an orphan; the PATCH assigns raw costs (`:376-387`); create ignores `grade` and `race` (`:317-326`).
- **SEC-07** (catalogue half): `property_ids` (`items/views.py:116-119`, `:165-170`), restriction ids (`:46-61`), `bestiary_entry_id` (`items/serializers.py:116-118`), bestiary link ids (`bestiary/views.py:204-252`) and favourites (`:175-180`) aren't checked against the campaign.
- **SEC-06**, unchanged: `POST /restrictions/` (`restrictions/views.py:43-50`) lets any logged-in user add a global row; nothing calls it (`items-api.ts:115`).
- **BUG-79**: `?campaign_id=abc` is a 500 on every list (`campaigns/permissions.py:4-5`).
- **BUG-80** (reworded): your own writes reconcile (`catalogue-queries.ts:109-144` writes the answer, then refetches), but other members see a change only after the 5-minute stale time (`:27`).

### Performance left after Phase 0
- **PERF-46**: `BestiaryEntrySerializer` reads the M2M managers (`bestiary/serializers.py:22-25`) while the views prefetch the through tables (`bestiary/views.py:83-92`, `:341-352`), and each equipment item nests a lazy `ItemSerializer`: 43 and 45 queries for the Bounty Hunter.
- **PERF-49**: the items list runs `exists()` and two prefetch chains (`items/views.py:84-88`): 7 queries without campaign rows, 14 with them.
- **PERF-13** (server half): a 304 still runs every query and the serialisation; only bytes are saved. **PERF-47**: the Bestiary page drops 72 of 86 entries client-side (`Bestiary.tsx:50`). **PERF-44** (writes): one SELECT and INSERT per link (`bestiary/views.py:204-252`, `items/views.py:116-119`). **PERF-48**: one `AcquireItemDialog` per Wargear row (`Items.tsx:705`) inside a memo rebuilt on every render (`:328-727`). **CAT-PERF-08**: property search fetches per keystroke (`AddItemForm.tsx:211-223`, same in `ItemFormDialog.tsx`); `DetailCardContent.tsx:30-80` fetches the entry, then its properties, and swallows the second error (`:79`).

### Code quality and UX
- **CAT-CQ-01** (IMP-79): skills, spells and special views differ only in names and the permission code; the five-step detail ladder is written 12 times. **CAT-CQ-02** (IMP-80): two forms per kind (above). **CAT-CQ-04** (IMP-81): seeder helpers written two or three times; `seed_skills` keeps a Google Sheets fallback (`:5`, `:15`, `:242`). **CAT-CQ-07, -09** (IMP-84, -85): unused `createRestriction`, a serializer field named `save` (`items/serializers.py:79`, `:113`), `races: Any` (`races/views.py:17`).
- **CAT-UX-01**: nothing marks custom or house-ruled entries. **CAT-UX-02**: no bestiary or hired-sword edit or delete in the UI (`bestiary-api.ts:48`, `:55`, `:110`, `:120` have no caller). **CAT-UX-03**: multi-availability items read as duplicate rows on mobile. **CAT-UX-05**: only `entry` survives navigation on the bestiary pages; Items, Skills and Spells keep no URL state. **CAT-UX-06**: rule tooltips aren't keyboard-reachable.

## What I propose for this pass

Order: characterisation tests, then PR A, PR B, PR C. **PR B comes before the override model** so copy-on-write, archive and the permission are written once on generic views, not eight times (see [Calls I made](#calls-i-made)).

### PR A: fixes

Backend
- BUG-17, IMP-83 (part): every seeder lookup and cache is `campaign__isnull=True` (restrictions by text and type); each seeder runs in `transaction.atomic()`; `--truncate` goes from all six; a base uniqueness constraint per table, `UniqueConstraint(campaign, campaign_type, name, type, nulls_distinct=False)` (restrictions on their text; bestiary on name), which `nulls_distinct` already supports (`warband.py:78`). The level-up placeholders (`units/services/level_up.py:89-92`) use `get_or_create` under it.
- BUG-51 (pass 5 half): `seed_items` ends by re-running the house-rule sync for every campaign with a rule. BUG-54: strip numeric prefixes, add aliases for the 14 unresolved links, fail loudly on a missing stat, delete `seed-warnings.txt` (CAT-TEST-13 without the Giant Spider assertion).
- BUG-16 safety net, BUG-130: owned copies, bestiary links and unit races become `on_delete=RESTRICT` (not PROTECT, so deleting a whole campaign still cascades); the delete views answer 409 `in_use` with counts instead of deleting (CAT-TEST-04). PR C turns this into archiving.
- BUG-53, SEC-07, PERF-44 (writes): nested input serializers (cost ≥ 0, rarity 2 to 20, scoped `PrimaryKeyRelatedField`s for properties, restrictions, bestiary entries, skills, specials, spells and items), every write atomic, links by `bulk_create`; the hired-sword PATCH validates its costs; create keeps `grade` and `race` (CAT-TEST-09, -10, -16).
- SEC-06: `POST /restrictions/` is removed and the restriction constraint gets `nulls_distinct=False` (CAT-TEST-05). BUG-79: one `parse_campaign_id`, a 400 on garbage (CAT-TEST-11). PERF-46: the CAT-PERF-04 prefetch, reused by POST and PATCH (CAT-TEST-08).
- Campaign types (CAT-NEW-04, schema only): `campaign_type` (`id`, unique `slug`, `name`), the pivot `campaign_campaign_type` (`campaign_id`, `campaign_type_id`, unique together), and a nullable `campaign_type` FK (RESTRICT) on `item`, `skill`, `spell`, `special`, `race`, `restriction` and `hired_sword_profile`; not on `bestiary_entry`, its link tables, availabilities or properties. No rows, no filtering; seeders leave it null. It lands here because the base constraint above includes it.

Decision-driven, backend
- BUG-15, BUG-82 (decision 4): one code, `edit_catalogue`, checked by every catalogue create, edit and delete, races included; joining grants it as `add_custom` is granted today; the warband sheet's `add_custom` capability (`warbands/access.py:65`) is renamed. Pass 4's code migration and constants gain `edit_catalogue` and lose `add_custom`, `manage_items`, `manage_skills`, `manage_spells`, `manage_specials` and `manage_bestiary` (a follow-up migration if pass 4 has merged). Test: every code checked exists (CAMP-TEST-08) and the per-route matrix (CAT-TEST-03, -27).

Frontend
- Edit, Add and Delete on every catalogue page follow `edit_catalogue` (CAT-TEST-18); deleting an entry in use shows the 409's counts and says nothing was deleted. CAT-PERF-08: property search filters the cached `item-properties` list. CAT-UX-03: each availability row shows its restriction under the name ("Forest Goblins · Common"); grouping is dropped (optional g). CAT-UX-04: `DetailCardContent` and the favourite star show errors with Retry or roll back.

### PR B: refactor (no behaviour change)

Backend
- Design 0.29 for the catalogue (IMP-79): `apps/core/catalogue/` with `kinds.py` (one spec per kind: model, serializers, child rows, the relations that own copies), `views.py` (`CatalogueListView` and `CatalogueDetailView` on pass 4's `CampaignScopedView`, deny by default) and `merge.py`. Skills, spells and special shrink to a few lines each; the access matrix covers every catalogue route. PERF-49: each list is one queryset with one prefetch chain (still today's name rule).
- PERF-13 (server half): `CampaignSettings.catalogue_version` and a global version, bumped by the one write path and by each seeder; list bodies cached under `(kind, campaign, version, query)`, so a revalidation costs at most 3 queries (CAT-TEST-06). PERF-47: `?exclude_type=` and `?view=summary`.
- IMP-81: `apps/core/seeding.py` (`upsert_global`, `resolve_restrictions`, `sync_availabilities`, `parse_int`); the Sheets fallback goes. IMP-85: the `save` field and `races: Any`. IMP-84: `createRestriction` goes; the bestiary API functions stay for CAT-NEW-01.

Frontend
- IMP-80: one `use<Kind>Form` and `<Kind>FormFields` per kind, inline on pages or in a dialog; `utils/statblock.ts`; a generic `CatalogueTable`. IMP-82, PERF-48: `Items.tsx` under 250 (`items-columns.tsx`, `useItemsFilters`, one page-level `AcquireItemDialog`). The two bestiary form dialogs split under 250 in edit-ready form. `DetailCardContent` reads entries and property text from the cached lists (CAT-PERF-03 rest).

### PR C: your decisions and Planned changes

**Data model for referenced overrides.** A nullable self-reference `replaces` (RESTRICT) on `Item`, `Skill`, `Spell`, `Special`, `Race` and `BestiaryEntry`, with `UniqueConstraint(campaign, replaces)` where set and a check that only campaign rows set it; the service also requires it to point at a book row. `Item.source_item` is renamed `replaces`: house-rule clones already are campaign rows standing in for a book row, so one column carries one meaning, and pass 4's `(campaign, generated_effect_key, source_item)` constraint becomes this one (the armour and shield rules touch different items). A hired sword's version is a copied entry plus a copied profile; the profile needs no column of its own. Also `archived_at` and `archived_by` on the same six tables. Why not the alternatives: matching on name and type is still name matching and breaks when a version is renamed; a field-level override table would need merge logic in every reader, because items have availabilities, restrictions and properties and entries have four link tables; a generic override table loses foreign keys; and read-time substitution would touch every sheet, battle, trade and stash reader, where remapping is what house rules already do.

Backend (`apps/core/catalogue/versions.py`, `archive.py`, `names.py`)
- BUG-18, decisions 1 and 2: editing a book entry copies it and its child rows into the campaign with `replaces` set, applies the edit and remaps the campaign's owned copies (pass 4's one remap path, stored costs kept, bulk) in one transaction; later edits change the version in place; `POST <kind>/:id/revert/` remaps back and deletes the version. Lists hide book rows by `~Exists(version replacing it)`. A create whose name (trimmed, any case, any type) is taken by a campaign entry, archived ones included, or a book entry answers 400 `name_taken` listing the matches; an edit may keep the name of the entry it replaces (CAT-TEST-02, -23, -24).
- Every "current version" lookup uses `replaces`: `prices.py` (`current_price`, `suggested_sale_price`, `availability_price`), list merges, trait specials (book Trait specials, then the campaign's versions of them: BUG-103), and the scope check in `catalogue_scope.py`, which maps a book id to the campaign's version on unit writes, hire presets, purchases, stash adds and battle finds in its existing query (CAT-TEST-26). Recruits already use recorded costs and need nothing.
- BUG-16, decision 5: `GET <kind>/:id/usage/` counts copies; DELETE of a custom entry deletes it when unused and archives it when used; `POST .../restore/`; lists leave archived entries out unless `?archived=1` (CAT-TEST-25). BUG-80: `catalogue.changed {kind}` on pass 4's events channel.

- Payloads gain `replaces` (the book entry's id, or null), `archived_at` and, for items, `generated_effect_key`; the campaign payload's `capabilities.edit_catalogue` gates every control.

Frontend (on PR B's shared forms and `CatalogueTable`)
- Edit on every row and detail panel opens the same form; the save writes the version into the cached list in place of the book entry (one `setQueryData`), so nothing flickers. Versions show Revert with the confirm in [Calls I made](#calls-i-made); generated ones show "Set by Half price armour" and a link to House Rules.
- A `name_taken` answer keeps the form open and lists the matches, each with "Edit this instead". Delete asks `usage/` first and words the confirm to match (deleted, or archived with its counts); an "Archived" filter shows Restore.
- The bestiary and hired-sword detail panels gain Edit, Revert and Delete (CAT-NEW-01); the five pages keep `tab`, `subtype`, `type`, `q` and `archived` in `useSearchParams` (CAT-NEW-02); `catalogue.changed` invalidates that kind's list for every member.

Risks, each with a test in CAT-TEST-23 or -26
- **Open battles.** Item-use events store `item_id` (`battles/services/item_use.py:17`, `:81`) and finds name item ids (`battles/views/shared.py:1127`), so an edit or Revert during a battle must not orphan them: finalise maps ids through the same version lookup.
- **Equipment and animals.** A campaign bestiary entry's equipment links move with the remap; the book Animal shop items keep pointing at the book bestiary entry until the item itself is edited.
- **Stale lists.** A client holding the book id for up to 5 minutes is handled by the write-side mapping, and `catalogue.changed` shortens the window.

New columns: `replaces` (renaming `Item.source_item`), `archived_at` and `archived_by` on six tables; `updated_by` and `updated_at` only if CAT-NEW-03 is agreed. One migration per app, all fine on an empty database.

### Coordination with pass 4
- **Codes.** Pass 4's constants and seed migration are where `edit_catalogue` goes (above). Its grant menu then offers one catalogue row instead of five.
- **Scoped views.** PR B builds on `CampaignScopedView` and the request-cached codes, so the catalogue views lose their extra membership and EXISTS queries.
- **House rules.** PR C renames the column pass 4 constrains and relaxes its 403 on PATCH (see Calls). Pass 4's single remap path is the one copy-on-write calls.
- **Events and delete.** `catalogue.changed` rides pass 4's events channel; RESTRICT keeps its permanent campaign delete cascading (a test deletes a campaign whose warbands hold its custom items).

### Query and request targets

| Request | Today | After pass 5 | Test |
| --- | --- | --- | --- |
| `GET items/?campaign_id=` | 7 (14 with campaign rows) | ≤ 7 either way | CAT-TEST-07 |
| A catalogue revalidation (304) | the full list's queries and serialisation | ≤ 3 queries, no serialisation | CAT-TEST-06 |
| `GET bestiary/:id/`, `hired-swords/:id/` (8 items) | 43 / 45 | ≤ 12 | CAT-TEST-08 |
| Hired-sword create, 6 skills, 3 specials, 6 items | about 35 (estimated) | ≤ 10 | PERF-44 |
| First edit or revert of a book item with W owned copies | n/a | constant in W | CAT-TEST-23 |
| Other lists | 4 | 4, constant as rows grow | CAT-TEST-07 |

## Characterisation tests to write first

Backend (factories; known bugs pinned with their ID so they flip later)
- Merge: a custom "Axe" hides the book Axe; a custom "Infiltration" hides all six types (BUG-18, CAT-TEST-02 baseline); sale price and Buy again following a same-named campaign item of another type (pass 2's prices); trait specials taken from another campaign's "Large" (BUG-103).
- Permissions: a player creates but can't edit or delete their entry; spells and specials need unseeded codes; any member creates a race and nobody deletes it (BUG-15, BUG-82, CAT-TEST-03); a non-member's `campaign_id` is a 404 on every list (CAT-TEST-01).
- Deleting and seeding: deleting a custom item a hero and a stash hold removes both copies (BUG-16, CAT-TEST-04); `seed_all` on an empty database, then again with a same-named campaign item and a half-price armour rule, crashing (BUG-17, CAT-TEST-12, expected failure); `parse_unique_to` (CAT-TEST-14); the Dark Mage with no spells (CAT-TEST-13, expected failure).
- Writes: cost -5 leaving an item without availabilities and a 500; an unknown skill id leaving an orphan entry; another campaign's skill accepted; `POST /restrictions/` creating a global row; `?campaign_id=abc` a 500 (CAT-TEST-09, -10, -16, -05, -11).
- Seeding and house rules: a reseed with a changed armour price leaving the half-price clone at the old one (BUG-51); deleting a race deleting the heroes of that race (BUG-130).
- Budgets at today's counts, plus items with campaign rows (14) and both bestiary details (43, 45).

New test IDs, written with the fixes (TEST_PLAN gains them)
- **CAT-TEST-23** copy-on-write: a first edit makes one version, moves hero, henchmen, hired-sword and stash copies with their costs, and leaves other campaigns alone; a second edit changes it in place; Revert moves them back; two concurrent first edits make one version; counts constant in copies.
- **CAT-TEST-24** names: create refused across case and type, archived entries included; an edit keeps its own name. **CAT-TEST-25** archive: delete when unused, archive when used, restore, archived entries absent from lists and accepted in unit PATCHes.
- **CAT-TEST-26** resolution: Buy again, sale price, a book id from a hire preset or a battle find, and trait specials all land on the campaign's version; a same-named entry of another type changes nothing. **CAT-TEST-27** the `edit_catalogue` matrix on every catalogue route, and a revoked player refused everywhere.

Frontend (the fake API server, `src/test/fake-api.ts`)
- Skills and Spells offering Edit to a player without the code (CAT-TEST-18); the delete dialogs' "cannot be undone"; another member's new entry absent until the stale time passes (BUG-80); a property search request per keystroke; Wargear forgetting its tab and search after a bestiary visit (CAT-UX-05 baseline); no Edit or Delete on bestiary and hired-sword detail; `DetailCardContent` making two sequential requests and hiding the second error.
- Manual QA: `features/06-catalogue.md` steps 1-14 (3, 7-10 and 13 change with the decisions). E2E-11 waits for Playwright.

## Decisions (answered by William, 2026-10-18)

| # | Decision | Answer |
| --- | --- | --- |
| 1, 2 | Editing book entries, without duplicate names (BUG-18) | **Every book entry gets Edit**, which saves a campaign version referencing the entry it replaces (copy-on-write), with **Revert to base**. A new entry whose name exists in the campaign or the book is **refused, with a pointer to Edit**. Overrides apply campaign-wide, and every lookup of the campaign's current version uses the reference (prices, pickers, trait specials, Buy again, recruits). "We don't need to be too protective over changing items." (CAT-TWEAK-01 to -03) |
| 3 | Who may edit what | Covered by 4: anyone holding the permission edits any entry, book entries through a campaign version and custom ones directly. |
| 4 | Permissions | **One permission for the whole catalogue** (items, skills, spells, specials, races, bestiary, hired swords); players hold it by default, as today; owners revoke it per player (CAT-TWEAK-05; naming in [Calls I made](#calls-i-made)). |
| 5 | Deleting an entry in use (BUG-16) | **Archive it**: hidden from shops and pickers; existing copies stay (CAT-TWEAK-04). **Book entries can be deleted too, for that campaign only** (2026-10-19): owners and admins, plus anyone given a new **"Delete catalogue"** permission (`delete_catalogue`) that players don't get on joining. Deleting a book entry hides it from that campaign (a campaign-scoped removal record; other campaigns and the book itself are untouched), following the same archive-if-in-use rule, and can be restored (CAT-NEW-05). |
| 6 | Bestiary and hired swords | **Edit and archive in the UI**, by the same rules (CAT-NEW-01). |
| 7 | Marienburg data | [Parked](#parked-for-design) for a future "campaign add-ons chosen at creation" feature. |
| 8 | Giant Spider (BUG-54 part) | Ignored for now; the rest of BUG-54 is fixed. |
| New | Campaign types | The `campaign_type` table, the nullable column on seven catalogue tables (not the bestiary) and the `campaign_campaign_type` pivot, with no data and no filtering yet (CAT-NEW-04). |
| d, f, g | Optional features | (d) "Custom" and "House rule" badges: **wanted, kept simple, with tooltips for the extra detail** (CAT-NEW-03). (f) Tab, filter and search in the URL: **wanted** (CAT-NEW-02). (g) Grouping same-named items: **dropped**, because same-named items can differ in rules as well as price. |

## Calls I made

**Confirmed by William on 2026-10-19**, with one change: book entries can be deleted per campaign (decision 5 above), so "Delete and archive" below applies to book entries as well as custom ones, behind `delete_catalogue` rather than `edit_catalogue`.
- **The permission.** "Edit catalogue" (`edit_catalogue`) replaces `add_custom`, `manage_items`, `manage_skills`, `manage_spells`, `manage_specials` (`manage_features` today) and `manage_bestiary`. Owners and admins hold it, joining grants it, and the owner (or an admin, as today) revokes it per player in Members. It covers create, edit, revert, archive and restore for all seven kinds, and races too. Design 0.29's Q2 falls away: no per-entry `can_edit` and no `created_by` for rights. If pass 4 hasn't merged when this starts, pass 4 seeds `edit_catalogue` directly.
- **Copies follow the version.** The first edit remaps the campaign's copies onto the version and Revert remaps them back, stored costs untouched, so sheets, battles and trades read the row they point at. Revert's dialog says so: "Every Axe in the campaign goes back to the book (5 gc). Copies already bought keep what was paid."
- **House rules and edits.** Editing a rule's generated version detaches it (its effect key is cleared, so the rule leaves it alone from then on), and the dialog says so; enabling a rule skips book entries that already have a hand-made version and returns `house_rule_skipped` naming them. This replaces pass 4's 403 for PATCH; DELETE of a generated version stays refused, and generated versions show "Set by Half price armour" instead of Revert.
- **Names.** Compared trimmed and in any case, across types, against the campaign's entries (archived included, with Restore as the pointer) and the book; the refusal lists every match ("Infiltration is already in the catalogue: Skaven, Dark Elf and 4 more skills. Edit one instead.").
- **Delete and archive.** Only custom entries delete or archive (versions revert; book entries do neither). Unused, it is deleted; used, it is archived, and the dialog says which before you confirm. Archived ids stay valid in unit writes (full-list PATCHes resend copies); a purchase of one from a stale list goes through with an `archived_entry` warning.
- **RESTRICT, not PROTECT**, on owned copies, links, unit races and `replaces`, so pass 4's permanent campaign delete still cascades. `--truncate` goes from the seeders: a wipe replaces it.
- **Scope.** Restrictions and item properties aren't editable kinds (decision 4 doesn't list them): restrictions lose their public POST, properties stay add-only under `edit_catalogue`. Campaign versions and custom entries keep `campaign_type` null; versions don't copy it.
- **Order.** The generic views (PR B) come before copy-on-write (PR C), so it is written once; meanwhile PR A ships the permission and a 409 safety net for BUG-16, so nothing in production can cascade.

## Parked for design

For a later conversation with William; nothing here is proposed in this pass.
- **Campaign add-ons chosen at creation (Marienburg).** Loading `mim-items.json` (62), `mim-bestiary.json` (18) and `skills/data/custom-skills.json` (91) as campaign types; filtering shops and pickers by a campaign's enabled types; adding and removing types on a running campaign; whether the bestiary gets a type; how the name rule treats add-on entries that share book names. **Tie the create dialog's `campaign_type` choice** ("standard" / "marienburg", `campaigns/serializers.py:123`, `views.py:395-411`, which only toggles encampments and locations and isn't stored) to the pivot; its behaviour is unchanged in this pass.
- **Giant Spider** S0 and its "Goblins" restriction (BUG-54 part, decision 8).

## Planned changes

Types: **New**, **Tweak**, **Remove**. IDs: `CAT-NEW-NN`, `CAT-TWEAK-NN`. Status: Proposed → Agreed → Done.

| ID | Type | Change | Notes / acceptance | Status |
| --- | --- | --- | --- | --- |
| CAT-TWEAK-01 | Tweak | Every book entry has Edit; saving makes a campaign version, with Revert to base | Decisions 1 and 2. Items, skills, spells, specials, races, bestiary entries and hired swords. The first save copies the entry into the campaign (`replaces` set) and moves the campaign's copies onto it; Revert moves them back and removes the version; both keep stored costs. | Done: the server for all seven kinds; Edit and Revert on Wargear, Skills and Spells (the bestiary pages wait for the bestiary rewrite) |
| CAT-TWEAK-02 | Tweak | No duplicate names | Decisions 1 and 2. Creating an entry whose name exists in the campaign or the book is refused with the matches and an "Edit it instead" link; editing may keep the replaced entry's name. | Done (`name_taken`; "Edit this instead" on the three pages, Restore for an archived match) |
| CAT-TWEAK-03 | Tweak | Overrides apply campaign-wide, by reference | Decisions 1 and 2. Prices (`current_price`, `suggested_sale_price`), shop and picker lists, trait specials (BUG-103), Buy again, hires and finds resolve through `replaces`, never the name; a same-named entry of another type changes nothing. | Done (open battles and trades included) |
| CAT-TWEAK-04 | Tweak | Deleting an entry in use archives it | Decision 5. The dialog first shows the usage ("Used by 3 units in 2 warbands"); archived entries leave shops and pickers, copies stay, and an "Archived" filter offers Restore. Unused custom entries are deleted. | Done (Wargear, Skills and Spells) |
| CAT-TWEAK-05 | Tweak | One "Edit catalogue" permission | Decision 4. Replaces the six catalogue codes; players hold it by default; the owner revokes it per player in Members; every Edit, Add, Revert and Delete control follows it. | Done (`edit_catalogue`; deletes need `delete_catalogue`) |
| CAT-NEW-01 | New | Edit and archive bestiary entries and hired swords | Decision 6. The existing form dialogs in edit mode from each detail panel; Revert on versions; archive and restore on custom entries; a hired sword keeps its grade and race. | Replaced by the bestiary rewrite (William, 2026-10-22). The server paths exist and are tested; the panels and the hired-sword form's grade and race wait for the rewrite |
| CAT-NEW-02 | New | Catalogue tab, filter and search in the URL | Optional f (IMP-90). `tab`, `subtype`, `type`, `q` and `archived` in the query string on Wargear, Skills, Spells, Bestiary and Hired Swords; back navigation and shared links restore them. | Done (all five pages, plus `page`, `entry` and `profile`) |
| CAT-NEW-03 | New | "Custom" and "House rule" badges | Optional d (IMP-86). "Custom" on campaign entries, "House rule" on versions, with who changed it, when, and the book value ("Book: 5 gc") in a tooltip; the badge itself stays a small, simple label; needs `updated_by` and `updated_at`. | Done (Wargear, Skills and Spells; every payload carries the fields, so the bestiary pages take them with the rewrite) |
| CAT-NEW-05 | New | Delete a book entry for one campaign | Owners, admins and holders of the new `delete_catalogue` permission (not granted on joining) can delete a book entry for their campaign only: a campaign-scoped removal record hides it from that campaign's catalogue, shops and pickers; archive-if-in-use applies; Restore brings it back. Custom entries delete under the same permission. | Done (Remove on Wargear, Skills and Spells) |
| CAT-NEW-04 | New | Campaign types (schema only) | William, 2026-10-18. `campaign_type` (`id`, unique `slug`, `name`); nullable `campaign_type_id` on `item`, `skill`, `spell`, `special`, `race`, `restriction` and `hired_sword_profile`; pivot `campaign_campaign_type` (unique campaign and type). No rows, no tagging, no filtering; migrates from empty; `seed_all` runs twice with it (CAT-TEST-12). Built in PR A. | Done |

## Progress

| Step | State |
| --- | --- |
| Characterisation tests | **Done.** Backend 956 → 1,070 (4 expected failures: the reseed crash, two BUG-54 data checks, the half-price clone after a reseed); frontend 1,187 → 1,295 through the fake API server. Coverage of the catalogue apps went from 66% to 95%, and of the seeders from 21% to 80%. Found BUG-145 to BUG-150. |
| PR A (fixes) | **Done.** Backend 1,070 → 1,093, every expected failure flipped: the seeders read and write only the book, each in one transaction, with no `--truncate`, and an exact duplicate (same name and type) in the book or one campaign is refused (`duplicate_entry`); `seed_items` re-syncs every campaign's house rules; every seeded link resolves (the Dark Mage's six spells; the Ninja's and the Knight's skills through aliases); a garbage `campaign_id` is a 400; deleting an entry in use is 409 `in_use` with counts, and unit races are `RESTRICT`; writes are validated whole, atomic, scoped to the campaign, with links in bulk (hired-sword create 96 → 20 queries), and unknown ids are refused instead of dropped; bestiary details 43 / 45 → 8 / 9 queries; `POST restrictions/` is gone; campaign types (schema only); `edit_catalogue` and `delete_catalogue` replace the six codes (migration 0023 renames `add_custom`). Frontend 1,354 (after rebasing on main) → 1,397: property search filters the cached list, a refused delete shows in its confirm, phone rows name their availability, the detail card reads the cached lists with Retry, the favourite star rolls back, every control follows the two codes, and refusals show on their fields. The two-user browser check passed and fixed BUG-165. |
| PR B (refactor) | **Done.** First, on PR A's branch, BUG-151 and BUG-152 (1,093 → 1,096). Then backend 1,096 → 1,123: `apps/core/catalogue/` (kinds registry, hooks, one write path, generic views on `CampaignScopedView`; the skills, spells and specials views 119 → 10 lines each), `apps/core/seeding.py` (`seed_items` 399 → 219 lines, `seed_bestiary` 433 → 182), lists cached per kind, campaign, catalogue version and query (a revalidation costs 1 query with no serialisation; lists 4 → 2 queries, items 14 → 5), and `?exclude_type=` and `?view=summary` on the bestiary. Frontend 1,397 → 1,403: one form hook and fields component per kind, a generic `CatalogueTable`, `Items.tsx` 817 → 221 lines with one Acquire dialog per page; catalogue code 13,279 → 11,713 lines. |
| PR C (decisions and features) | **Done**, except CAT-NEW-01, which William moved to the bestiary rewrite. Backend 1,123 → 1,183: copy-on-write versions with Revert for all seven kinds (one bulk remap; a first edit costs 28 queries however many copies move), every lookup through `replaces` (prices, trait specials, writes, open battles and trades), `name_taken` with every match, archive-or-delete by usage, a book entry removed for one campaign, Restore and `usage/`, house-rule clones that detach when edited (`house_rule_skipped`), badge fields and `catalogue.changed`. Frontend 1,403 → 1,444: on Wargear, Skills and Spells, Edit on every row (the version takes the book row's place) with Revert, badges with keyboard-reachable tooltips, `name_taken` with "Edit this instead" and Restore, usage-worded Delete, Archive and Remove, and an Archived list; on all five pages the URL keeps tab, filters, search and page, and a fresh link's Back goes to the list (BUG-150); the Bestiary asks without its hired swords (PERF-47); catalogue changes, and the warband sheets they touch, refresh live for every member. |
| Combined browser check (`release/p5-p6`) | **Passed**, two users, desktop and 375 px: all 24 PR C checks. Follow-ups filed: BUG-159 (the writer reads its lists twice), BUG-160 (Revert's price under a house rule), BUG-166 (copy slips); BUG-167 and BUG-168 come from the reports. |

Decided during PR C (change any of them):
- A book entry's Delete reads **Remove**, behind `delete_catalogue`, and hides the entry from this campaign whatever holds it. Versions offer Revert, never Delete; house-rule clones offer neither.
- Deleting a custom entry that something holds archives it (PR A's 409 `in_use` is gone). Bestiary entries and hired swords are never archived, because nothing holds them: a custom one is deleted, a book one removed.
- The delete confirm waits for the usage check, but if the check fails the delete still goes ahead, worded for either outcome.
- The Archived list needs no capability to view, and Restore needs `edit_catalogue`, so players restore by default.
- Revert answers the campaign's current entry, which under a house rule is the rule's new clone (its confirm still quotes the book price: BUG-160).
- A stale book `availability_id` after an edit is refused (400) rather than mapped; a sale by id stays unscoped.
- `duplicate_entry` is retired: `name_taken` covers every taken name, in any case and type. Two creates differing only in case at the same moment both succeed, since versions of different book entries may share a name.
- "Edit this instead" appears only on Wargear, Skills and Spells; the warband pages' dialogs list the matches with Restore only.
- `updated_by` and `updated_at` are stamped by creates and edits only, not by reverts, archives or house rules.
- A book race written without a campaign is now 403, like every other kind (it was 404).
- After any catalogue edit or Revert, the warband sheets and stashes on screen are read again, locally and for every member, for skills, spells, specials and races as well as items (one sheet read per change).
- "Set by …" names the rule from its effect key, with no extra request. Archive, removal and restore toast; a plain delete doesn't.
- Filter changes replace the history entry and opening an entry pushes one. Wargear's single-use filter is in the URL as `single=1`.
- PERF-47 uses `exclude_type` only; no page uses `?view=summary` yet.
- Removals live in one `catalogue_removal` table (no foreign key to the entry), and reverted versions in `catalogue_reverted_version`, which maps an old version id held by an open battle or trade back to its book entry.

## Production data checks

None: data is disposable (both databases can be wiped and only the catalogue is reseeded), so this pass has no backfills, drift reports or read-only SQL to run first. BUGS.md's catalogue checks (shadowed items, colliding names, duplicate clones, junk global restrictions, the Giant Spider) are no longer needed.

**When deploying:** a database that isn't wiped first may fail to add PR A's unique name constraints if it holds duplicate book rows, or exact same-name, same-type rows in one campaign. Wipe and reseed (`seed_all`), as `CLAUDE.md` says.
