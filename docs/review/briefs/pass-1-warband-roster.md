# Pass 1 brief — Warband roster

Step 1 of the pass loop in [PLAN.md](../PLAN.md). Full detail (file:line, repro, fix) is in [features/03-warband-roster.md](../features/03-warband-roster.md); IDs are from [BUGS.md](../BUGS.md), [PERFORMANCE.md](../PERFORMANCE.md), [IMPROVEMENTS.md](../IMPROVEMENTS.md) and [TEST_PLAN.md](../TEST_PLAN.md). Line counts are from `chore/foundations-0c`.

**Already done in Phase 0 (not proposed again):** the warband preamble's unused prefetches are gone (PERF-21); unit detail payloads are constant in queries via `backend/apps/warbands/prefetches.py` (PERF-22: heroes/detail 33 → 14, henchmen and hired-sword detail 18 → 11); summary 12 → 7 with rating, gold and unit lists batched in `services/summary.py` (PERF-25/41); frontend `tsc` is clean and the item-move wrong-list bug is fixed; query budgets live in `backend/apps/core/tests/test_query_budgets.py`; warband view coverage is 28–42%. TanStack Query is set up in 0.19 before this pass starts.

**Your part:** answer the [decisions](#decisions-i-need-from-you), pick any [ideas](#ideas-you-might-want), and add rows to [Planned changes](#planned-changes).

## What it is today

- **The sheet.** `routes/Warband.tsx` (1,070 lines) inside `CampaignLayout`: tabs Warband / Treasury / Backstory / Logs, and three sections (Heroes, Henchmen, Hired Swords) of summary cards that expand into detail cards. `useWarbandLoader` fetches the warband, then summary + the 3 unit lists in parallel (2 stages). The roster is also mirrored into the global store.
- **Edit mode, one section at a time.** "Edit X" fetches `.../detail/` and turns cards into forms. "Add X → Create X" POSTs immediately (recruit trade written, gold spent). Item purchases queue as `pendingPurchases`. Save = one PATCH per changed unit + one DELETE per dismissed unit, then a trade POST and a log POST per purchase, one at a time, then `GET summary`. Cancel only resets the forms. Hero edit state lives in the route; the henchmen and hired-sword sections own theirs.
- **XP and level-ups.** The XP bar's +/- PATCHes the whole unit. The server counts thresholds crossed in `(prev, next]` using the campaign's tables (hired swords default to the henchmen table `[2,5,9,14]`). "Level Up!" opens a dialog → `POST .../level-up/` adds +1 to a stat or a "New Skill/Spell/Special" placeholder you resolve later. Lad's Got Talent promotes a henchman through a 3–4-request client chain.
- **Loadouts and leaders.** A unit PATCH carrying item/skill/special/spell lists replaces the whole loadout. `ensure_single_living_leader` runs after hero create/update/delete and after postbattle.
- **Dismiss and death.** Dismiss hard-deletes the unit (its items cascade away, no refund, one log row). Postbattle sets `dead=True`; dead units stay in the DB but every roster endpoint hides them. Dead henchmen are rows inside their group.
- **Permissions.** View = campaign member; edit = warband owner, campaign owner/admin, or `manage_warbands`; deleting the warband = its owner only. Checked by hand in 43 handlers; the UI computes its own `canEdit`.
- **Main files.** Backend `apps/warbands/`: views `heroes.py` 412, `henchmen.py` 374, `hired_swords.py` 378, `warbands.py` 726; serializers `heroes.py` 549, `henchmen.py` 398, `hired_swords.py` 430; postbattle XP in `battles/views/shared.py` (1,968). Frontend `features/warbands/`: `HenchmenFormCard` 793, `UnitBasicInfo` 692, sections 675 / 655 / 435, expanded cards 554 / 481 / 417, `useWarbandHenchmenSave` 422, `useWarbandMobileTopBar` 395.

## What's wrong

### Data loss and gold
- **BUG-04** (P1, arguably P0): saving a henchmen group hard-deletes its dead henchmen and their kills. Lad's Got Talent's group update does the same.
- **BUG-34**: "Create" spends gold at once and Cancel doesn't undo it; "Dismiss… cannot be undone" is undone by Cancel; dismissing a fresh recruit refunds nothing; switching tabs silently drops edits; "Gold after pending" clamps at 0.
- **BUG-03** (P1): postbattle XP ignores custom thresholds and half-rate, so half-rate units gain double.
- **BUG-27**: XP edited down and back up awards the same level-ups again.
- **BUG-28**: Lad's Got Talent keeps the group's level-up; a failure midway leaves a duplicate model.
- **BUG-62**: level-up accepts any advance id, and two quick requests both spend one level-up.
- **BUG-85 / BUG-66**: henchman hire cost uses 2 × decimal XP (41.5 gc, then `int()` truncates it in the ledger) and, when the client sends no `cost`, charges the whole group's items.
- Save with purchases is 2K+1 sequential, non-atomic requests (ROST-PERF-05). The real fix is pass 2's purchase endpoint (PERF-30, BUG-07).

### Other bugs
- **BUG-29**: the hero cap counts dead heroes; any client can send `ignore_max_heroes`.
- **BUG-30 / BUG-63**: create a leader, then Cancel → two crowns. No DB constraint; a stale XP click moves the crown back and overwrites name/type/race.
- **BUG-31**: viewers get the Trade badge, XP +/- and pending-skill dialogs (silent 403s). Backstory is the reverse: admins can't edit it in the UI.
- **BUG-32**: racial maximums are shown but never enforced.
- **BUG-33**: the henchmen XP bar ignores half-rate.
- **BUG-64**: hero edits can't be saved with no leader, even with zero heroes.
- **BUG-65**: a hero created mid-session earns level-ups for its typed starting XP.
- **BUG-67**: group size and unit limits are UI-only; `max_units` defaults to 0.
- **BUG-86**: moving an item to another unit kind leaves the receiving card stale until reload.
- **BUG-87**: henchmen and hired-sword saves send `armour_save` as a string; everything else sends a number.
- **SEC-07** (unit half): another campaign's race/item/skill ids are accepted and read back. **SEC-14**: the warband-link iframe is unsandboxed and gets clipboard-read.
- Re-verify **BUG-24** (mobile top bar loses Save/Cancel) once PERF-20 is fixed.

### Performance left after Phase 0
- **PERF-23**: unit PATCH and level-up still `refresh_from_db()`, which drops the prefetch: about 77 queries per hero XP click. The leader check runs on every save.
- **PERF-24**: the sheet is still 5 requests in 2 sequential stages.
- **PERF-26**: summaries lack `race`, `kills`, `deeds`, so every expand and level-up dialog fetches the unit again (constant queries now, but uncached).
- **PERF-27**: henchmen/hired-sword XP clicks and level-ups refetch `/summary/` although gold can't change.
- **PERF-20** (Likely, verify at 375 px): mobile edit mode re-renders in an endless effect loop.
- **PERF-19** (roster half): the store mirror re-renders the page 3+ times per mutation.
- **PERF-28 / PERF-29 / ROST-PERF-11**: per-row henchmen writes; unindexed, unscoped kill-history scan; 2 queries per join-table prefetch.
- No budgets yet for the three list endpoints, single-unit GET, PATCH or level-up.

### Code quality
- **ROST-CQ-01 (IMP-24/26/27)**: heroes, henchmen and hired swords are written three times, about 5,200 of 12,400 lines (list blocks and level-up dialogs 98% identical, hero vs hired-sword views 87%). The drift already caused BUG-29, -33, -62, -65 and PERF-28.
- **ROST-CQ-02 (IMP-25/28)**: 43 hand-written permission preambles; dead `views/helpers.py`.
- **ROST-CQ-03 (IMP-29)**: `Warband.tsx` owns hero editing and drills ~87 props into `WarbandTabContent`.
- **ROST-CQ-04 (IMP-30)**: `HenchmenFormCard` re-implements `UnitBasicInfo`/`UnitLoadout`; 5 race-picker copies.
- **ROST-CQ-05/06/07 (IMP-36/37)**: dead code (create-on-Save branches, `loadHeroDetail`, hidden rating dialog, `Warband.restrictions`, no-op `PUT /restrictions/`, 4 stub dialogs); siblings disagree on atomicity, id coercion and `armour_save`; types don't match the wire, hence the "has detail" sniffing.
- A `window` `CustomEvent` bus (`warband:updated`) stands in for a cache. No hero CRUD, level-up, leader or permission tests exist.

### UX and accessibility
- **UX-02**: race pickers can't be used by keyboard, so keyboard users can't create units.
- **UX-03**: expand and XP +/- only appear on mouse hover; +/- have no accessible names.
- **UX-04**: level-up dialog has 9 unlabelled checkboxes, a hover-only roll table and no "max" marker.
- **UX-05**: stat inputs accept anything; a multi-unit Save that partly fails doesn't say which unit.
- **UX-06**: "Create hero" stays enabled at the limits it displays.

## What I propose for this pass

Order: characterisation tests → PR A → PR B → PR C (your Planned changes). PR B's target shape doubles as the 0.28/0.29 designs for sign-off.

### PR A — fixes

Backend
- BUG-04 — sync only living henchmen; this path never deletes dead rows; explicit `removed_ids` instead of "missing means delete".
- BUG-03, BUG-27 — one `apply_xp_change(unit, new_xp, settings)` in `warbands/services/xp.py`, used by the three update serializers and postbattle finalisation: per-kind campaign thresholds, half-rate, and the correction rule from decision 5.
- BUG-28 — `POST henchmen-groups/:id/promote/`: one transaction creates the hero, removes the henchman (or the emptied group), consumes the group level-up and logs; the hook makes one call.
- BUG-29, BUG-67 — limits count living units and are enforced server-side (heroes, group `max_size`, `max_units`); the client `ignore_max_heroes` goes; `max_units` defaults to 15, with a data fix for rows at 0.
- BUG-30, BUG-63 — partial unique constraint "one living leader per warband"; leader changes under `select_for_update` on the warband; the leader check runs only when `is_leader` or `dead` changes.
- BUG-32, BUG-62 — level-up validates the advance id and the race maximum (400) and decrements with `filter(level_up__gt=0).update(level_up=F(...) - 1)`.
- BUG-66, BUG-85 — hire cost per decision 7, always whole gc.
- BUG-87 — `armour_save` is a nullable integer on every write path.
- SEC-07 (unit half) — referenced catalogue ids must be global or from this campaign.
- PERF-23 — no `refresh_from_db()` or cache pops; re-fetch once with the shared prefetch; `select_related` the campaign settings; slim `PATCH .../xp/` returning `{id, xp, level_up}`.
- PERF-24 — `GET warbands/:id/sheet/` (+ `campaigns/:id/my-warband/sheet/`): warband, summary, capabilities and the three unit lists in detail shape, ≤ 20 queries. The frontend adopts it in PR B.
- PERF-26 — `race`, `kills`, `deeds` in summary payloads (until the sheet makes the split moot).
- PERF-28, PERF-29, ROST-PERF-11 — atomic bulk henchmen writes; partial index on kill events + campaign filter; `Prefetch(..., queryset=...select_related(...))` in `prefetches.py`.

Frontend
- BUG-31 — `canEdit` reaches the Trade badge, `ExperienceBar` (read-only) and pending entries; failed actions show an error; Backstory uses the page's `canEdit`.
- BUG-33 — `halfRate` on the three henchmen XP bars.
- BUG-34 (minimum) — honest Dismiss copy ("removed when you save"), confirm Cancel and tab switches when there are changes, negative "Gold after pending" in red. The recruit model itself (decision 1) lands in PR C on the shared editor.
- BUG-64, BUG-65 — leader required only when heroes exist; a new hero's seeded XP mints no level-ups.
- BUG-86 — refresh the receiving unit kind after a cross-kind item move.
- PERF-20 — stable save/cancel callbacks, primitives in state, shallow-equal bail-out; then re-check BUG-24.
- PERF-27 — XP and level-up mutations stop refetching `/summary/`.
- SEC-14 — `sandbox`, no `clipboard-read`, Google Drive/Docs hosts only.

### PR B — refactor (no behaviour change)

Backend (`backend/apps/warbands/`)
- `models/shared.py`: abstract `RosterUnit(StatBlock)` with the ~15 common fields; tables unchanged (`makemigrations --check` stays empty).
- `unit_kinds.py`: a `UnitKind` registry (model, join models, list/detail prefetches, read/write serializers, thresholds attribute, advance map, log feature, flags `has_spells` / `has_members` / `has_trade_action` / `can_lead`). Replaces `UNIT_TYPE_CONFIG` in `views/warbands.py`.
- `services/`: `xp.py` (from PR A), `level_up.py`, `loadout.py` (one replace-loadout + trait-special sync instead of three), `roster.py` (create, dismiss, promote, each atomic with its trade and log), `sheet.py`, plus the existing `summary.py`.
- `serializers/units.py`: base summary / detail / write serializers with `LoadoutWriteMixin` and `XpLevelMixin`; `heroes.py`, `henchmen.py`, `hired_swords.py` keep only their differences.
- `views/base.py`: `WarbandScopedView` (IMP-25). `initial()` loads the warband once with a per-view `warband_prefetch`, caches `request.membership`, applies `CanViewWarband`, plus `CanEditWarband` for unsafe methods. Responses carry `capabilities: {can_edit, can_delete, can_add_custom}`.
- `views/units.py`: generic `UnitListCreateView`, `UnitDetailListView`, `UnitDetailView`, `UnitLevelUpView`, `UnitKillHistoryView`; `urls.py` generates today's URLs per kind, so the API is unchanged.
- Delete `views/helpers.py`, the `Warband.restrictions` M2M, the no-op `PUT /restrictions/` and `restriction_ids`.

Frontend (`frontend/src/features/warbands/`)
- `api/warband-queries.ts`: `warbandKeys` (`['warband', id, 'sheet']`, `['warband', id, 'kill-history', kind, unitId]`), `useWarbandSheet`, and per-kind mutations that patch the cache from the response (`setQueryData`) and invalidate the summary only when gold can change. Deletes `useWarbandLoader`, `useWarbandUpdateListener`, `warbands-events.ts` and the store mirror.
- `units/unit-kinds.ts`: the `unitKinds` config (api, labels, `mapToForm`, `validate`, `buildPayload`, `getLevelInfo`, flags).
- `hooks/units/useUnitSectionEditor.ts` (forms, create, dismiss, save, cancel, pending purchases) replaces the 9 per-kind form/creation/save hooks; `useUnitLevelUp.ts` replaces the 3 level-up hooks (LGT behind a flag).
- `components/units/`: `UnitSection`, `UnitSummaryCard`, `UnitExpandedCard`, `UnitListBlocks`, `UnitLevelUpControl`, `UnitLevelUpDialog`, `UnitFormCard`, with slots for the henchmen member list and LGT. `HenchmenFormCard` becomes `UnitFormCard` + `HenchmenMemberList`. One `RacePicker` replaces the 5 copies (same behaviour for now).
- `Warband.tsx` → ≤ 250 lines: `WarbandDesktopHeader`, `useWarbandPage` (tab and edit-section state), a `CatalogContext` instead of ~15 catalogue props; gating from `capabilities`.
- `types/units.ts`: `UnitSummary<K>` / `UnitDetail<K>` matching the wire (IMP-37). Delete the dead code listed in ROST-CQ-05.
- Commit order: level-up dialog/control → cards and list blocks → forms → sections/editor → route. Expect 4,000–5,000 fewer lines.

After PR B, UX-02 to UX-06 and the recruit model are one change each instead of three, so I'll add them to Planned changes (PR C) once you've answered decisions 1–2.

### Characterisation tests to write first

Backend (0.14b factories; parametrised over the three kinds where behaviour should match; known divergences pinned with their bug ID so they flip in PR A)
- Budgets at today's counts for the 3 list endpoints, single-unit GET, `PATCH {xp}` and level-up POST (ROST-TEST-01/02).
- Permission matrix (ROST-TEST-11): non-member 404; viewer GET 200 and writes 403; owner, admin and `manage_warbands` 200; admin can't delete the warband.
- Create / update / delete per kind: recruit trade + log on create, loadout replace on PATCH, delete logs and refunds nothing.
- XP → level-ups via PATCH with default and custom thresholds per kind; seeded XP on create gives none; `count_new_*` with Decimal and string input (ROST-TEST-26).
- Level-up bodies per kind: stat +1, Skill/Spell/Special placeholders, history appended, `no_level_ups` → 400.
- Leader invariant (ROST-TEST-08); henchmen member rename/add/remove (living only); postbattle XP with default tables; the existing kill-history and summary tests.

Frontend (MSW harness)
- `useWarbandSave` (ROST-TEST-15): PATCH only changed heroes, DELETE dismissed ones, purchases committed, one summary GET.
- `commitPendingPurchases` order and failure behaviour (ROST-TEST-21, C).
- Per kind: Edit → change → Save sends the expected payload; Create posts the expected body; the level-up hook's request sequence (non-LGT); cards show the expected stats, XP and list blocks (asserted as visible text, so the generic components can swap in).
- The existing save-hook and loader tests keep their assertions, re-pointed at the new hooks.

## Decisions I need from you

1. **Recruit model (BUG-34).** (A) new units queue in the form and are created and charged on Save, in one request; Cancel discards everything. (B) keep immediate creation, relabel it "Recruit now (−X gc)", toast, and offer "Refund X gc" when dismissing a unit recruited this session. **Default: A** (pass 2 can add purchases to the same request).
2. **Unsaved edits.** Cancel and tab switches with changes: confirm before discarding, or keep the edit session alive across tabs? **Default: confirm.**
3. **Dismissing an existing unit.** Gold refund? Items? **Default: no refund; its items move to the stash** (today they are deleted with it).
4. **Dead and dismissed units as records.** Keep them (hidden from the roster, kills still counted in history and top killers) instead of deleting rows? **Default: yes; Dismiss becomes a soft "dismissed" status.**
5. **XP corrections (BUG-27).** (A) high-water mark: lowering XP never removes level-ups and raising it again never re-awards them, plus an editable "pending level-ups" count in edit mode for fixing typos. (B) derive level-ups from XP minus advances taken (self-correcting, but trusts `level_up_history` on old units). **Default: A.**
6. **Half-rate units (BUG-03, BUG-33).** Half the postbattle XP, +0.5 per XP click, thresholds counted on whole XP only. **Default: yes.**
7. **Henchman hire cost (BUG-85, BUG-66).** **Default: base + per-member share of group items + 2 × whole XP (fractions dropped), whole gc.**
8. **Hired-sword XP table.** It defaults to the henchmen table; I believe the rulebook has Hired Swords advance like Heroes. **Default: hero table for new campaigns; existing campaigns keep their stored setting.** Please confirm the rule.
9. **Lad's Got Talent (BUG-28).** Today the new hero copies the group's profile, XP, skills and his share of items, starts with 2 advances (one spent on the re-rolled stat), and ignores the hero cap. **Default: keep all of that, but respect the cap** (I believe the rulebook says re-roll when the warband is full). Confirm.
10. **Race maximums (BUG-32).** Block or warn? **Default: block on level-up; warn but allow in free edit** (for house rules and hand fixes).
11. **`armour_save` (BUG-87).** **Default: a whole number 1–6 or empty, shown as "N+"; typing "5+" is accepted.**
12. **Limits and leader (BUG-29, -63, -64, -67).** **Default: server-enforced, living units only, `max_units` 15, blood-pacted hired swords exempt; exactly one living leader whenever there are heroes, auto-assigned when the leader dies.**
13. **Backstory (BUG-31).** **Default: editable by anyone who can edit the rest of the sheet.**

## Ideas you might want

Options from the review that are your call; copy any you want into Planned changes.
- **Duplicate a unit**: copies stats, items and skills; charges the recruit cost.
- **Undo instead of confirm**: a 5-second "Undo" toast for XP clicks and Dismiss.
- **Better level-up flow**: roll 2d6/d6 in the dialog, roll table inline, maxed stats skipped with the "choose the other stat" rule applied, and pick the new skill or spell right there from the unit's allowed lists instead of resolving a placeholder later.
- **Advance log** per unit from `level_up_history` (or drop the field).
- **"Fallen and dismissed" list** with their kills (pairs with decision 4).
- **Tap anywhere on a card to expand** instead of a hover-only icon (UX-03).
- **One Edit mode for the whole roster** instead of one section at a time.
- **Per-unit save results** when part of a Save fails (UX-05).
- **Revive a fallen unit** (added after PR A): an explicit "Return to the roster" action on a dead hero, henchman or hired sword, for house rules and mis-clicks. PATCH can't do it, because dead units are read-only on that path, so this would be its own small endpoint with a log entry.

## Planned changes

Types: **New**, **Tweak**, **Remove**. IDs: `ROST-NEW-NN`, `ROST-TWEAK-NN`, `ROST-REMOVE-NN`. Status: Proposed → Agreed → Done.

| ID | Type | Change | Notes / acceptance | Status |
| --- | --- | --- | --- | --- |
| ROST-NEW-01 | New | Duplicate a unit | Available wherever adding that kind of unit is allowed (respects the hero / hired-sword caps). Copies profile, race, type, items, skills, spells and specials into a new unrecruited entry in the edit form, named "<name> (copy)"; it is charged like any new recruit on Save. | Agreed |
| ROST-NEW-02 | New | Catalogue entries created mid-edit are immediately searchable | A new item, skill, spell, special or race created from inside a unit form shows up in every following unit's pickers straight away, without a page refresh. TanStack catalogue queries are invalidated or updated on create (PR 0-D groundwork); add a test per picker. | Agreed |
| ROST-TWEAK-01 | Tweak | Queue new units until Save, and show the gold they will cost | Decision 1. New units are created and charged on Save in one request. The header shows remaining gold after pending recruits, e.g. "440 gc (60 pending)". Cancel discards. | Agreed |
| ROST-TWEAK-02 | Tweak | Clear wording when dismissing | Decision 3: "All items this unit carries are lost. Move them to the stash first to keep them." No refund. | Agreed |
| ROST-TWEAK-03 | Tweak | Soft delete for dead and dismissed units | Decision 4. Hidden from the roster; kills still count in history and top killers. | Agreed |
| ROST-TWEAK-04 | Tweak | Lad's Got Talent at the hero cap | Decision 9: when the warband is full, offer to dismiss a hero to make room (simplest option), then promote. | Agreed |
| ROST-TWEAK-05 | Tweak | Warn on unit-count and race maximums | Decisions 10 and 12: warn on the warband page and in forms, never block. Hero and hired-sword caps still block adding new units directly. Blood-pacted hired swords count towards warband size but not the hired-sword cap; other hired swords the reverse. | Agreed |
| ROST-TWEAK-06 | Tweak | Backstory editable by the warband owner only | Decision 13. | Agreed |

## Decisions (answered by William, 2026-10-17)

Guiding principle: **the app is a guide with warnings, not many hard blockers.** The rules change all the time (recorded in `CLAUDE.md` and `docs/ENGINEERING_RULES.md` §0).

| # | Decision | Answer |
| --- | --- | --- |
| 1 | Recruit model | **A** (queue until Save, one request), provided the UI shows remaining gold counting pending units as spent (ROST-TWEAK-01). |
| 2 | Unsaved edits | Default: **confirm before discarding**. |
| 3 | Dismissing a unit | **Items are lost, as the rules say**; no refund. The player can move items to the stash first, and the dialog says so (ROST-TWEAK-02). *Differs from the default, which moved items to the stash.* |
| 4 | Dead and dismissed as records | **Yes, soft delete.** This is good practice for most places in the app. |
| 5 | XP corrections | Default **A**: high-water mark plus an editable pending level-ups count. |
| 6 | Half-rate units | Default: half postbattle XP, +0.5 per click, thresholds on whole XP. |
| 7 | Henchman hire cost | **Yes**: base + per-member share of group items + 2 × whole XP, in whole gc. |
| 8 | Hired-sword XP table | **Use the hero table**, and don't preserve existing campaigns' setting. |
| 9 | Lad's Got Talent | Keep today's behaviour; at the hero cap, offer to **dismiss someone to make room** (ROST-TWEAK-04). |
| 10 | Race maximums | **Warn everywhere, never block** (not even on level-up). |
| 11 | `armour_save` | Allow values better than 1+ (Strength modifiers can push it there on paper), but make it clear that a roll of 1 always fails, e.g. a hint next to "1+" or better. Accept "5+"-style input. |
| 12 | Limits and leader | **Warn on the warband page when over the size limit; don't restrict.** Honour the hero and hired-sword caps when adding new units directly. **Counting (confirmed):** blood-pacted hired swords do **not** count towards the hired-sword cap but **do** count towards the warband size (`max_units`); other hired swords count towards the hired-sword cap but **not** towards the warband size. Leader auto-assignment as in the default. |
| 13 | Backstory | **Warband owner only.** |

## Progress

| Step | State |
| --- | --- |
| Characterisation tests | **Done.** 119 tests in `backend/apps/warbands/tests/test_roster_characterisation_*.py` plus unit query budgets; warband views coverage 33% → 96%. |
| PR A (fixes) | **Done** on `pass1/warband-roster`, rebased onto `chore/foundations-0e`: BUG-03, BUG-04 and BUG-88 to BUG-95, each with a regression test. Backend 299 tests. See the [fix log](../BUGS.md#fix-log). |
| PR B (refactor) | Next: shared unit abstraction ([design](../designs/unit-abstraction.md)), backend then frontend, with the roster moved onto TanStack Query. No behaviour change. |
| PR C (your changes) | After PR B: the Planned changes above, plus BUG-27 (XP high-water mark), BUG-85 (whole-XP hire cost), BUG-96 and BUG-97. |

Calls I made during PR A (change any of them):
- **Dead henchmen are read-only on the group PATCH.** An entry naming a dead member is ignored, even with `dead: false`, the same way dead heroes, groups and hired swords already return 404 on PATCH. This stops a stale form resurrecting a member or overwriting his kills. Bringing someone back would be the "revive" idea above.
- **`no_level_ups` stays as it is on both paths.** Postbattle awards such units no XP at all; a manual XP edit still changes XP but awards no level-ups (heroes ignore the flag). A manual edit is the player's override, which fits "warn, don't block".
- **"Missing means removed" stays for living henchmen** on the group PATCH. An explicit `removed_ids` list would need a frontend change, and soft delete in PR C changes this path anyway.
