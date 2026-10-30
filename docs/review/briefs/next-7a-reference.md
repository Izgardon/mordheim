# Next, step 7a: the reference pages and Search everything

Branch `next`. Read first:

- `scratchpad/next-1-report.md` to `next-4-report.md`, and `next-6-report.md`;
- the earlier briefs in this folder.

Same rules:

- Delete old code freely.
- Light testing: the gate is typecheck, lint, format, build, the remaining vitest suites, and the backend gate if the backend changes.
- Small commits in the repo's style, with no attribution lines. No push or merge, and never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the design's intent and note it.

The scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh` and `nextbe-gate.sh`.

**Functional reference:** main's old reference pages (`git show main:frontend/src/features/{items,skills,spells,bestiary,hirelings,rules,...}`, or the main checkout at the repo root). They show what each page does today, including adding and editing custom entries. Reuse the kept API and query hooks, and delete whatever ends up unused.

**Design boards** (local copies, current), in `C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`:

- `E-Web-Items.dc.html`: the Wargear reference on the web (the rail's Reference group, including "Search everything").
- `E-Mobile-Items.dc.html`: the phone version, with a Section picker and the big "What the <warband> can buy" toggle.
- The canvas notes say:
  - **Reference:** no shared or unique labels. Each item has Get this item, which opens the same panel as the store.
  - **Mobile reference:** one list with a big toggle for what you can buy. Tap a row for its rules and who can buy it. Settings and the other reference sections sit behind the Section picker.

## Part A: Wargear

Match `E-Web-Items` and `E-Mobile-Items`:

- search;
- "What <your warband> can buy", on by default. Use step 4's restriction logic in `features/items/store/`, so restricted items show with their short warning;
- the category chips;
- rows showing the name, kind, price and Common or Rare N. There are no shared or unique labels.
- Opening a row shows its rules, who can buy it (its availabilities and restrictions) and **Get this item**.
  - Get this item opens step 4's acquire panel (`AcquireForm`) and basket for your warband, with the store's behaviour.
  - With no warband in the campaign, Get is hidden.
- Adding and editing custom items, as today, behind a plain button.

## Part B: the other reference pages

Build Skills, Spells, Bestiary, Hired swords, Dramatis personae, Rules and House rules on one shared reference layout. That layout is the same list, search, chips and open-row pattern as Wargear, so each page is mostly its data and its row detail.

- **Skills:** by skill type, with the rules text. Custom skills as today.
- **Spells:** by lore, with difficulty and the rules text.
- **Bestiary:** creatures with their profile and specials.
- **Hired swords and Dramatis personae:**
  - profile, hire fee and upkeep, who can hire them and their rules;
  - Hire from here opens today's hire flow for your warband, if it can be reached without the warband page; otherwise leave it out and note it.
- **Rules:**
  - the rulebook sections today's rules endpoints provide;
  - a search that finds text inside rules, not just titles, and highlights the match.
- **House rules:** the campaign's house rules. They are editable by whoever can edit them today.
- **Section picker on a phone:** the reference sections sit behind a Section picker at the top, as `E-Mobile-Items` shows.
- Rows open to the rules panel the warband page already uses where they match. Reuse it instead of building a second one.

## Part C: Search everything

The rail's disabled row becomes a working search, and the phone's Reference sheet gains it too.

- **One field searching:**
  - items, skills, spells, bestiary creatures, hired swords and dramatis personae;
  - rules text;
  - this campaign's warbands and units, and its locations.
- **Results** are grouped by kind with counts. Each result opens the right page with its row open, or the warband page for a warband or unit.
- **Where it opens:** its own page (`/campaigns/:id/search?q=`). On the web, a keyboard shortcut (`/` or Ctrl+K) opens it from anywhere in a campaign.
- **Backend:** search on the frontend from the reference queries the pages already load, if that's fast enough. If rules text or the campaign's units aren't loaded anywhere, add one small read-only endpoint (`GET campaigns/<id>/search/?q=`) with a fixed query count and a test.

## Report

Write `scratchpad/next-7a-report.md`, covering:

- commits;
- what works;
- placeholders;
- backend changes;
- calls you made.
