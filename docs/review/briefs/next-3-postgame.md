# Next, step 3: post-game (plus step 2's leftovers)

Branch `next`. Read first:

- the step 1 and 2 reports: `scratchpad/next-1-report.md` and `scratchpad/next-2-report.md`;
- the earlier briefs in this folder.

Same rules:

- Delete old code freely.
- Light testing: the gate is typecheck, lint, format, build, the remaining vitest suites and the backend gate when the backend changes.
- Small commits in the repo's style, no attribution lines, no push or merge, never bare `git stash`.
- Don't stop for sign-off. Choose the option that keeps the design's intent and note it in the report.

Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

Design boards (local copies, current):

`C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`

- `E-Web-Aftermath.dc.html`, `E-Mobile-Aftermath.dc.html`
- `E-Web-Warband.dc.html`: the post-game bar, the camp sidebar, and the sell, recruit and ready modals.
- `E-Mobile-Warband.dc.html`: the post-game card, the camp block, and the sell, recruit and ready sheets.

## Part A: finish step 2 first

1. Trade with a player in the warband ⋯ menu: invite, offer gold and stash items with a trader hero, accept or decline. Use the kept data hooks, on the new primitives.
2. Level-up:
   - lad's got talent (promote a henchman to hero, offering to dismiss a hero at the cap);
   - resolving pending New skill, spell and special picks from the card.
3. Edit gains race (including a custom race) and skill access. Add item in Edit opens the loadout.
4. Edit on a phone opens as a bottom sheet, as `E-Mobile-Warband` shows.
5. The ledger's Edit for hand-entered rows.
6. Locations get an area.
   - **Backend:** an optional `area` text field on locations, editable wherever locations are edited.
   - **Panel:** area filter chips built from the areas in use, plus search, and an area tag on each location.
7. Run the full backend suite once and fix whatever fails.

## Part B: post-game

**Aftermath page:** today's post-battle route, rebuilt as `E-Web-Aftermath` and `E-Mobile-Aftermath`. It has three tabs; reuse today's post-battle API and draft.

- **Injuries:**
  - serious-injury rolls for heroes and hired swords (D66);
  - henchmen (D6, dead on 1–2);
  - mount survival;
  - the missing-games offer for injuries that keep a unit out;
  - Undo on each roll.
- **Experience:**
  - each unit's XP with its reasons;
  - − and + to correct it;
  - XP boxes for the current block;
  - when a threshold is reached, Advance (roll 2D6). After the roll, show the result and the next block of boxes, so a unit can advance twice.
- **Explore:**
  - the dice;
  - the total and shards;
  - "Add them to" a resource;
  - doubles results with Read and roll.
- **Rest of the page:**
  - the results banner (confirm winners) and the Battle 5 facts aside;
  - Everyone else's status.
- **Saving:** everything saves as you go to the existing draft. It can change until Ready.
- **After Explore:** "To camp" goes to the warband page.

**Camp on the warband page (web)**
- **Post-game bar:** the Aftermath chips link to the Aftermath page. The Camp chips (Sell, Recruit, Upkeep, Buy, Ready) tick when done and jump to their sidebar row; Ready opens the confirm.
- **Sidebar "Camp":** all rows at once, top to bottom (title and subtitle on the left, actions on the right).
  - **Sell:** opens a modal to pick the resource, how many and the gold received.
  - **Veterans:** the action rolls 2D6 and records it. The total is a shared XP pool. The row then says "N XP available" and the button becomes Recruit, which opens the recruit helper: a new group (name and type) or an existing group, then recruits whose XP is shared out of the pool, with a cost per model.
  - **Hired swords:** Hire.
  - **Upkeep:** Pay all, and an indented row per hired sword with Pay and Let go.
  - **Buy items:** opens the store (step 4's drawer; a placeholder until then).
  - **Ready up:** at the bottom. It opens a confirm with the headline results (deaths, advances, injuries, gold, shards). Confirming finalises the post-game; the bar and sidebar disappear and the side panel says you're ready.
- **Phone:** the same flow in the post-game card (the Aftermath row, the camp block with the same rows, Ready up at the bottom) and in sheets.
- **Backend:**
  - Add the veterans pool if it can't live in the existing draft or log.
  - Recruiting henchmen with starting XP.
  - Map today's upkeep and finalise onto these rows.
  - Keep the changes small, with a few backend tests.

## Report

Write `scratchpad/next-3-report.md`:

- commits;
- what works;
- placeholders;
- backend changes;
- calls you made.
