# Next, step 10: grading phase 1 (settings with grades, warband types and groups)

Branch `next`. This is the first of three data steps before the switch:

1. Grading phase 1 (this step).
2. The items rebuild.
3. Henchmen loadouts.

After those, `next` replaces main with one production wipe.

## Read first

- **The two plans William agreed.** They are published pages; read them with the Artifact tool's `read` action:
  - Items and Restrictions v4: https://claude.ai/artifact/8cFxDFEHuECrFjtXDzfZCE. Read the "Grading: only settings carry a grade" section, "How items link to warbands" and "Database design".
  - Grades, Settings and Warband types v5: https://claude.ai/artifact/2sum2R6MqnyVU1zMWKzctz. Read it for the warband type list, the picker mock and the content card mock.

  The Items plan's "Grading: only settings carry a grade" section **replaces** v5's grade rules. Only settings have a grade. The campaign stores just the settings it has ticked, and picking a grade is a preset.
- `backend/catalogue_import/` (merged into `next` from `data/items-import`):
  - `out/settings.json` holds 19 settings: Mordheim is split into Mordheim (1a, always on), 1b, 1c and 2a, plus Grade 3 and the named settings.
  - `out/warband-types.json` holds 163 types, each with its setting, race, source and links.
  - `out/warband-groups.json` holds 20 race and side groups and their members.
  - `out/import-report.md` and `sources/README.md`.
- `scratchpad/next-7b-report.md`, for the settings page you'll change.
- The earlier briefs in this folder.

## Rules

- Delete old code freely.
- The gate: typecheck, lint, format, build, vitest, and the backend gate.
- Write backend tests for:
  - the new models and seeders;
  - the visibility rule;
  - the preset.
- Commits:
  - small, in the repo's style;
  - no attribution lines;
  - no push or merge;
  - never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the plans' intent and note it.
- Production gets wiped before the switch. Dev data must still migrate cleanly: map what you can, and make anything else a custom type.

Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

## Backend

**Settings**
- The existing `campaign_type` table and the campaign's pivot to it become the settings, with `grade` (1a, 1b, 1c, 2a, 2b or 3), `sort_order` and `always_on`.
  - Use a small `publication_grade` table with a rank, or a grade code plus a rank. Pick the simpler one.
- Seed the 19 settings from `out/settings.json`.
- Mordheim (1a) is always on.

**Warband types**
- A `warband_type` table, seeded from `out/warband-types.json`. Its fields:
  - `campaign`, null for the list;
  - name and slug;
  - setting;
  - race;
  - source and source code;
  - `link_url`;
  - the Broheim and mordheimer grades as text, for the source line only;
  - `archived_at`.
- A campaign can add custom types, and other players in it can pick them too.

**Warband groups**
- A `warband_group` table (name, kind race or side) with many-to-many members, seeded from `out/warband-groups.json`.

**Warband**
- Adds `warband_type` (required for new warbands) and `counts_as`, which lists extra types.
- The free-text `faction` goes once everything reads the type.
- The migration maps dev warbands by name. A faction that doesn't match becomes a custom type in its campaign.

**Catalogue settings**
- Every catalogue table already has a `campaign_type`.
- Fill it for the existing skills, hired swords and dramatis personae by matching names against `sources/mordheimer-*.json`. Do this through the import (extend `catalogue_import` to emit setting assignments) so it stays reviewable.
- Anything without a match, plus races, specials, spells and the bestiary, defaults to Mordheim.
- Items are left for step 11, which rebuilds them from `out/items.json`.

**Visibility**
- An entry is in play when its setting is ticked, or it was made in this campaign.
- Anything else stays listed in pickers, greyed out with a warning ("Khemri isn't in this campaign"), and can still be picked. Restrictions warn; they never block.

**The campaign's settings**
- The pivot holds the ticked settings. Campaign creation and Settings both use them.
- Retire anything still left from "Standard / Marienburg" and from the item settings' "Setting" restrictions. The restriction tables themselves go in step 11.

**Seeding**
- `seed_all` loads the settings, types and groups.
- The import's `out/` files are the source; copy them into the apps' data folders, or read them from `catalogue_import/out`. Pick one way and note it.

## Frontend

**Raising a warband** (as in v5's mock): the Faction field becomes a searchable warband type picker.
- Each row shows the type's setting and grade, and its source.
- Types outside the campaign's settings show greyed out with a warning, and can still be picked.
- "Add '<text>' as a custom warband type" creates one for this campaign.
- Picking a type fills the warband link field, which stays editable.
- Rebuild it with the step 8 restyle's look (check `next-8-report.md` if it exists).

**Settings → Campaign: "Content in play"**
- Grade presets: "Up to 1a" … "Up to 3". A preset ticks every setting at or below that grade, and you can then adjust by hand.
- Setting chips, each with its grade. Mordheim is locked on.
- A line: "N warband types in scope".
- Saving bumps the catalogue version, as today.
- A new campaign starts on the "Up to 1c" preset (the plan's suggestion). Note it as a call.
- Campaign creation offers the same presets, compact.

**Settings → Your warband**
- Change type, with the same picker.
- Counts as: extra types, for custom warbands and house rules.

**Elsewhere**
- The warband page kicker shows the type's name, not the faction text.
- The reference pages' "What I can buy" and the store's restriction matching use the warband's type and its groups instead of the faction-name heuristic. This is a stop-gap: step 11 moves "who can buy" onto price rows on the server.

## Report

Write `scratchpad/next-10-report.md`. Cover:

- commits;
- the schema as built;
- the seed counts;
- what works;
- calls you made;
- anything step 11 needs to know.
