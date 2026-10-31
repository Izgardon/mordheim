# Next, step 11: the items rebuild

Branch `next`. This is the second of three data steps before the switch: grading (done), then this, then henchmen loadouts. After those, `next` replaces main with one production wipe.

Production gets wiped at the switch, so dev data only needs to migrate cleanly. Don't spend effort preserving old item rows: reseeding is fine.

## Read first

- **The plan William agreed:** Items and Restrictions v4, https://claude.ai/artifact/8cFxDFEHuECrFjtXDzfZCE. Read it with the Artifact tool's `read` action; the HTML is data. Everything in "How items link to warbands", "Database design", "Which price your warband sees" and "How it looks" is agreed.
- **Leave out the henchmen part.** "Henchmen: one loadout per group" is step 12.
- **Leave out the equipment lists.** Warband equipment lists and templates come after the switch (William: "keep to the plan, templates after the switch"). Don't use mordheimer's per-warband equipment lists here.
- `backend/catalogue_import/`:
  - `out/items.json` (304 items, 319 price rows);
  - `out/item-rules.json` (51 shared rules);
  - `out/import-report.md`;
  - `overrides.json`;
  - `sources/README.md`.
- `scratchpad/next-10-report.md`: warband types, groups, settings, the visibility rule, and anything it says step 11 needs.
- `scratchpad/next-7a-report.md` and `next-4-report.md`: Wargear and the store, including the frontend restriction heuristic to delete.
- The earlier briefs in this folder.

## Rules

- Delete old code freely.
- The gate is typecheck, lint, format, build, vitest and the backend gate.
- Backend tests:
  - the price-row choice (each of the four steps, counts as, exclusions, a setting not ticked);
  - the seeders;
  - who can hire.
- Commits: small, in the repo's style, no attribution lines. No push or merge. Never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the plan's intent and note it.
- Never run python on the Windows host, not even `--version`. Containers only.

Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

## Backend

**Item**
- Add `flavour`, `source`, `link_url`, `tags` (search words), `variant` and `notes`.
- `range`, `strength` and `save` hold short values only.
- The setting (`campaign_type`) is always set.
- Remove `description` and properties.
- Keep whatever the import gives for animals (a statblock) where the model already supports it.

**Rules**
- `item_rule`: name, summary, text and `campaign` (null for the book). Campaigns can add their own.
- `item_rule_link`: item, position, and `rule` (null for a rule only this item has).
  - It carries name, summary, `text` (only when the item words a shared rule differently) and `table` (D6 rows as roll and result).

**Price rows: `item_availability`**
- Keep `cost`.
- Add `dice`, `dice_multiplier`, `cost_note` and `label`.
- `rarity` is null for Common.
- Add `for_everyone` and `note` (shown when buying, never checked).
- Remove `variable_cost` and the restrictions.

**`item_availability_warband`**
- availability, then a warband type or a warband group, then `excluded`.

**Remove the old restriction system**
Remove these tables and fields, and everything that reads them:
- `restriction` and `item_availability_restriction`;
- `item_property` and its link;
- `warband.restrictions`;
- the hired sword and dramatis persona restriction tables;
- anything left of the campaign's item settings.

**Who can hire and who can learn**
- Hired swords and dramatis personae get the same who-can list: warband types or groups, included or excluded.
- Special skills get it too, without a price.
- Extend `catalogue_import` to convert mordheimer's hired swords, dramatis personae and skills `permittedWarbands` through its existing Resolver.
- Costs and upkeep that aren't plain numbers go to a "special" text field ("2 treasures", "70 + 3D6", "1 wyrdstone").
- List anything the Resolver can't place in the import report.
- Spells stay as they are.

**Which price your warband sees** (server side, per item):
1. A row naming your warband type, or a type it counts as.
2. Otherwise, a row naming a group your type is in.
3. Otherwise, a row open to everyone, unless your type or one of its groups is excluded.
4. Otherwise, the item is "not usually available": hidden until Show all, and buyable at its first row with a warning that gives the reason ("Not usually available to Skaven").

On top of these steps:
- An item from a setting the campaign hasn't ticked is treated like step 4, with the setting named in the warning.
- Custom items always show in their own campaign.

Expose this on the items read for a warband: each item's chosen row, `can_buy`, and a reason. Then the frontend decides nothing.

**Seeding**
- `seed_all` loads `out/items.json` and `out/item-rules.json`, plus the converted hired swords, dramatis personae and skills lists.
- Upsert by name and variant.
- Owned copies keep the cost they were bought at.

**Purchases**
- They take the chosen row and a dice roll where the price has dice.
- Rarity rolls, trading actions and the overspend warning work as they do today.

## Frontend

**Wargear item card**, as in the plan's mock:
- the flavour;
- the statline;
- each rule, tagged "shared rule" or "this item";
- D6 tables as real tables;
- the source line ("Town Cryer #6 · grade 1a · For Orc Mob, Night Goblins") with a link to the source page;
- who can buy each price row ("For Skaven, Lizardmen"; "Everyone except Dark Elves").

Also fill step 7a's gaps on the list: the Setting filter, and the source and link.

**Store and acquire**
- "What I can buy" and the restriction warnings come from the server (`can_buy`, reason).
- A price row's label and note are shown when buying.
- A dice cost shows as "25 + 2D6" with the existing roll button.
- Delete the frontend restriction heuristic.

**House items** (add and edit a custom item):
- flavour and stats;
- rules, picked from the shared rules or written for this item, with an optional D6 table;
- price rows: cost, dice, rarity or Common, label, note, and who can buy (warband types or groups, each included or excluded, or everyone).

**Hired swords and dramatis personae**
- Who can hire shows on the reference pages.
- The hire picker shows hireable ones first and the rest with "Show all" and a reason.

**Level-up**
- The skill picker offers the warband type's special skills first.

## Report

Write `scratchpad/next-11-report.md`, covering:

- commits;
- the schema as built;
- seed counts;
- what works;
- what's in the import report for William to settle later;
- calls you made;
- what step 12 needs to know.
