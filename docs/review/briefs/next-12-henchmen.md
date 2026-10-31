# Next, step 12: henchmen loadouts (plus step 11's leftovers)

Branch `next`. This is the last data step before the switch (merge to main, one production wipe). Two other agents are working at the same time, on `next-polish` (styles, width, dividers, skeletons) and `next-perf` (load speed). I merge their branches afterwards, so keep layout and style changes to what this feature needs.

Production gets wiped at the switch. Dev data only has to migrate cleanly: turn copies into loadout rows plus gaps where a group is short. Don't spend effort beyond that.

## Read first

- **The plan William agreed:** Items and Restrictions v4, https://claude.ai/artifact/8cFxDFEHuECrFjtXDzfZCE. Read it with the Artifact tool's `read` action; the HTML is data. Its "Henchmen: one loadout per group" section is agreed, including the table "What happens / Today / Proposed" and the henchmen mock. William also agreed (plan v4): "Henchmen loadout + gaps: yes. Dismissing must ASK whether his share goes to the stash."
- `scratchpad/next-11-report.md` (items rebuild, the who-can read, purchases with price row and dice) and `next-10-report.md`.
- The earlier reports and briefs. Steps 2, 3, 4 and 6 touch henchmen in the roster, camp, the store and the battle screen.

## Rules

- Delete old code freely.
- The gate: typecheck, lint, format, build, vitest and the backend gate.
- Write backend tests for each row of the plan's table.
- Small commits in the repo's style, with no attribution lines. No push or merge. Never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the plan's intent and note it.
- Never run python or python3 on the Windows host for any reason, including inside a grep or as `python3 -c 1`. Four earlier agents slipped on this. Containers only.

Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

## Part A: henchmen loadouts

**Model**
- A `henchmen_group_item` row is what every member carries: the item, its cost each, and the companion and mount flags.
- A new `henchman_item_gap` (henchman, group item) records a member who lacks it.

**Flows, as in the plan's table**
- **Buying for a group:** "A sword each", N × price, as one row. Use step 11's purchase with its price row and dice roll. The store's group button says "×4 · 40 gc" and adds one loadout line.
- **A henchman dies:** nothing is deleted. The loadout follows the living members, and the battle log lists what he carried.
- **A rider lives but his horse dies:** a gap on that henchman ("Skritt has no Horse"), with Buy, Take from stash and Leave it.
- **A new member joins:** the recruit price includes the loadout. Copies can come from the stash. A member added without them starts with gaps.
- **Lad's got talent:** he takes one of each item, minus his gaps.
- **Unequip to the stash:** one copy per living member, minus gaps.
- **"Take Skritt's kit":** one of each item goes to the stash at what it cost, and he gets a gap for each. He is left out of the next battle by default, with the reason shown, and can still be brought. He stays out until re-equipped (buy, or take from the stash) or dismissed.
- **A member is dismissed:** always ask whether his share (minus gaps) goes to the stash or he leaves with it.
- **In battle:**
  - each member shows his own gear;
  - a member with a gap starts without it, on foot if the gap is his mount;
  - the group mounts as one, and each member can still dismount.
- **Selling or trading** a group's item works on loadout rows and their copies.
- **Rating and the warband's value** count members × loadout, minus gaps.

**UI**
- The henchmen row and open card show "Each carries …" and "Loadout X gc each · Y gc".
- Gap lines go on the member, with Buy one, Take from stash and Leave it.
- The loadout drawer and Edit work on the loadout.
- The pre-battle unit picker shows a member left out by a gap, with its reason.
- On a phone, the same in the sheets.

**Data migration**
- Each existing group's copies become one loadout row per distinct item.
- A group with fewer copies than members gets gaps on its last members.
- Remove the old copy-matching code (row order, "the first copy of each").

## Part B: step 11's leftovers

1. **Dramatis personae aren't seeded** (their seed file is empty).
   - Seed the 30 from `catalogue_import/sources/mordheimer-dramatis-personae.json` through the import, the way hired swords are, with their who-can lists from `out/who-can.json`.
   - Their special costs and upkeep go to the cost-expression fields.
2. **The roster's Hire button** still opens the old free-form dialog. Point it at the hire picker (the Hired swords and Dramatis personae catalogue with Show all, and hire from there). Keep a "Hire someone not in the list" escape for custom hires.
3. **Split `Wargear.tsx` and `HirelingCatalogue.tsx`** under the 250-line limit.

## Report

Write `scratchpad/next-12-report.md`:

- commits;
- the schema;
- each flow and how it was checked;
- the data migration's result on a dev copy;
- calls you made;
- anything the switch needs (migrations since main, seed order, commands to run after the wipe).
