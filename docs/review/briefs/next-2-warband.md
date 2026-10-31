# Next, step 2: the warband page

Branch `next`, on top of step 1's tokens, primitives and shell. Same rules as step 1:

- Delete old code freely.
- Light testing: the gate is typecheck, lint, format, build and whatever vitest suites remain.
- Small commits in the repo's style, no attribution lines, no push or merge, never bare `git stash`.
- Don't stop for sign-off. Choose the option that keeps the design's intent and note it in the report.

## Step numbering (for placeholders)

1. Foundation and shell (done).
2. Warband page, with its drawers.
3. Post-game: the Aftermath page plus camp.
4. Store and the Wargear page's Get.
5. Overview, plus a Battles list page.
6. Battle screen.
7. Reference pages, Search everything, settings, encampment and the rest.

Wargear stays a reference catalogue page (rebuilt in step 7); its "Get this item" opens step 4's store panel.

## Design

Local copies of the boards, which are current:

`C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`

- `E-Web-Warband.dc.html`: one interactive board holding every state. Its `view` prop shows hero open, henchmen open, edit, store, stash, locations, dice, chat, ready, recruit and sell.
- `E-Mobile-Warband.dc.html`: the phone equivalent, using bottom sheets.

Match them closely: layout, spacing, type and behaviour.

## Scope

**Routes:** your own warband (`/campaigns/:id/warband`) and someone else's (`/campaigns/:id/warbands/:warbandId`). Other people's warbands are view only: no Edit, XP buttons, loadout actions or resource buttons.

**Header**
- Kicker (faction · player) and name.
- Store, Stash and Locations as three equal buttons.
- A ⋯ menu with Trade with a player (the existing trade invite), the warband sheet link if one is set, and the rating breakdown.

**Info line:** Rating (click for the breakdown), Gold, Units (x of max), Record.

**Resources:** a half-width section beside the info line.
- Inline − and +.
- Add resource.
- A small menu per resource with Rename, Delete and Sell (camp's Sell row comes in step 3; keep this one).

**Tabs:** Roster, Treasury (the ledger, restyled: rows, Add trade entry, Correct, Edit), Backstory and Log (paged, filterable). Keep them simple.

**Roster**
- Heroes are cards in a grid. An open hero card spans the full row.
- Henchmen and hired swords (dramatis personae included) share the row style from the design:
  - **Left:** name and type, plus a box per model.
  - **Top right:** XP, then Edit (when open), the armour loadout button and the expand arrow, which is always far right.
  - **Under those buttons:** the stats.
  - **Count:** ×3 becomes ×3/5 when open.
  - **Henchmen** show the group name and its type.
  - **Creatures** get a Creature badge, no loadout and "No XP".
- **Closed cards** show the gear summary and "XP 24 / 28", plus Advance ready and Missing badges.
- **Open cards** show:
  - the XP bar with − and +, and Advance (reuse the existing level-up logic in a restyled modal, including pending skill and spell picks and lad's got talent);
  - boxes for Items (the type only underneath), Skills, Specials, Spells and Injuries;
  - Kills, the trading action (one place; toggle with a confirm), and Upkeep for hired swords.
- **Clicking any box** opens its rules panel. Items also get Move to, To stash, Sell and Buy again (the existing item actions).
- **Riding:** the mount chip toggles riding, as today.
- **Section headers** have Add hero, Add group and Hire, using today's recruit and hire flows restyled to the new modal.

**Edit (one unit at a time):** inline in the open card on web; a bottom sheet on the phone.
- Name, type, race, cost or hire fee.
- XP and half-rate XP.
- Missing games and why.
- Profile.
- Skill access.
- Items, skills, spells and specials: add and remove.
- Traits: Leader, Large, Trading action, Caster (none, wizard or priest), and Bloodpacted and No level ups where today's form has them.
- Henchmen roster: rename, add and remove a model.
- Duplicate and Dismiss.
- Save one unit through the existing batch save, with only that unit in it.

**Drawers on web (right side) and sheets on the phone**
- **Loadout:** from the armour button and from Add item.
  - Carrying, with To stash and Give to.
  - The stash, with Equip.
  - "Buy something in the store".
- **Stash:** from the header.
- **Store:** a placeholder drawer until step 4.
- **Locations:**
  - search;
  - an area filter, if the data has an area or type, otherwise leave it out and note it;
  - flags;
  - Send a hero, then log gold, an item or an injury by hand with today's API.
- **Dice:**
  - quick rolls, any number of D3 to D100 plus D66, and a modifier;
  - an optional reason;
  - kept in your warband log through the existing dice log;
  - your recent rolls listed underneath.
- **Chat and Notifications:** drawers wired to today's data, opened from the shell's tool buttons.

**Post-game:** leave room for step 3's top bar, sidebar and phone card. No placeholder text is needed.

**Light and dark** must both look right.

## Backend

Only small additions where a field the design needs is missing (for example a henchmen group's name as well as its type). Any change must pass the backend gate (`scratchpad/rewrite-precommit.sh`, adapted to this worktree).

## Report

Write `scratchpad/next-2-report.md`:

- commits;
- what works;
- what's still a placeholder;
- backend changes;
- any calls you made.
