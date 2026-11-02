# Advance polish, the XP bar, pills, spell rolls and Boons & Banes scope

Branch `feat/advance-polish`, in `.worktrees/advp`, based on main `8fbaded6`, which is live. I merge it to main myself. Main auto-deploys, and production is wiped and reseeded when catalogue data changes; it has 0 users.

**Read first:**
- `CLAUDE.md`, especially "No fluff text" and "A guide, not a gatekeeper".
- `scratchpad/advance-and-boons-report.md`, which built the advance dialog, `SpellPicker`, `DiceTable` and Boons & Banes.
- `scratchpad/warband-ux-report.md`.

All of the following is William's wording from 2 Nov 2026.

## 1. The XP bar

> "the experience bar should just show that level range, not multiple, but can have delimiting faint lines behind each experience point."

The bar shows only the current block, from the last threshold reached to the next one. For example, at 7 XP with thresholds 2, 4, 6, 8 and 11, it runs 6 → 8.

- Draw a faint tick behind it at each XP point inside that range.
- The label still reads "XP 7 / 8".
- The animation from the last branch stays. When a threshold is crossed, the bar fills, then resets into the next block.
- Half-rate fractions fill a half step.

## 2. Pills

> "all pills should have a max width of 200px, just truncate lines that are too long"

- Every entry pill (items, skills, Boons & Banes, spells, injuries, anywhere they appear) has `max-width: 200px`.
- The title and the subtitle line each truncate with an ellipsis.
- The full text goes in `title`, and stays reachable to screen readers.

## 3. Spell rolls are unique within a lore

> "this spell list has 2 spells set to a roll of 6, can we never allow that, just have the second spell set to null or '-' and still make it clickable, just not naturally rollable."

- **Data:** in the seed or import, a lore that has two spells on the same roll keeps the first on it. The second gets `roll = null`. List every case in the report.
- **Server:** enforce it. No two spells in one lore share a roll within a campaign's view: book rows and that campaign's own rows. A custom spell that clashes is refused with a clear message, or saved with no roll and a warning. Pick the guide-not-gatekeeper option: save with roll null and say so.
- **Display:** a spell with no roll shows "–" in the roll column. Its row is still clickable to pick it, but a die roll never lands on it.
- **Tests:** backend tests for the uniqueness rule.

## 4. The skill picker

> "text here stays, should not mention the new spell as i am selecting a skill ... i also shouldnt see skills that arent part of my campaign"

- **Stale spell line:** in "Pick a new skill", a stale "New spell: Deathly Visage" line stays after switching to a skill. The summary must only describe the current choice. Clear the other choice when the kind changes.
- **Campaign scope:** the skill pickers show only skills in play in the campaign, like the reference pages since the last batch. Skills from settings that aren't ticked don't show at all. This applies to the advance dialog, "Skill to choose" and Edit.
- **"Show all":** it still reveals skills outside the unit's own lists, greyed with the warning, but only from within the campaign.

## 5. Boons & Banes scope

> "boons and banes - can we not show the hired swords/dramatis ones here, are they separated in the database by anything?"

- **Find out how a hired sword's or dramatis persona's own rules are told apart from general specials.** The templates plan says they are typed "Hired Sword - *name*". If that's the only marker, add a proper field, for example `owner_kind`: `general` or `hired_sword` / `dramatis_persona`, plus the owner. Set it in the seed or import, and migrate.
- **Hide those unit-specific rules from:**
  - the Boons & Banes reference page;
  - the Boons & Banes pickers in Edit and the advance.
- **Keep them on:**
  - the hired sword's or dramatis persona's own card;
  - their reference row.
- Report the answer: what separates them, and how many there are.

## 6. The advance dialog

> "new skill can also mean new spell or special so we need a dropdown for that. remove the buttons when 'by hand' as well as the by hand button, just let the table always be clickable ... and then options with multiple should just have a dropdown as well even if rolling just like skills/specials will. we dont need the line from second image as we already have the Gains line. for skills we dont need the 'Your warbands' option, the unit should have the skill lists already."

1. **"New skill" can be a skill, a spell or a boon or bane.**
   - A dropdown picks which: Skill, Spell, or Boon/Bane.
   - Spell shows for casters. For others it's still offered, with a warning.
   - Each option opens its own picker:
     - skills: the unit's skill lists;
     - spells: the lore roll from `SpellPicker`;
     - Boons & Banes: a SearchSelect of general boons, banes and traits.
2. **No "by hand" mode.**
   - Remove the "by hand" button and the extra buttons that appear with it.
   - Every dice table is always clickable: the 2D6 advance table and each D6 follow-up. A row takes that result as if the dice had shown it.
   - Rolling and typing a roll still work.
   - For a range row such as "2–5", clicking sets the result. Show the roll as the row's range, or leave it empty: either is fine.
3. **Rows with more than one outcome get a dropdown** (S or A, I or Ld, W or T, WS or BS). The dropdown is preset from the roll when there is one, and can always be changed. This is the same pattern as the skill and special dropdowns.
4. **Remove the stat change line** ("W 0 → 1 (max 5)"). The "Gains" summary already says it. Keep the over-maximum warning in the Gains line if it applies.
5. **Remove the "Your warband's" option from the skill picker.** The unit's own skill access lists are the tabs. "Show all" stays for the rest of the campaign's skills.
6. **No fluff text** anywhere in the dialog.

## Rules

- **Gate:** typecheck, lint, format, build, vitest and the backend gate.
- **Tests:**
  - vitest for the XP block range;
  - vitest for the advance dialog's dropdowns and clickable tables;
  - backend tests for the spell-roll uniqueness rule and the special owner field.
- **Commits:** small, in the repo's style, with no attribution lines. No push or merge. Never a bare `git stash`.
- **Python:** never run `python` or `python3` on the Windows host. Containers only.
- **Scripts** (in the scratchpad):
  - frontend: `wt-feadvp.sh` and `advpfe-gate.sh`, node_modules volume `mordheim_frontend_node_modules_polish2`;
  - backend: `wt-advpbe.sh` and `advpbe-gate.sh`, database `mordheim_advp`.
- **Browser check:** use the demo campaign. William's dev DB has it.
  - Take a read-only `pg_dump` of the dev DB into your own database copy, and use your own containers on host `advp.localhost`.
  - Sign in as `captain@mordheim.test` with password `password`. Those are the seed's own test values.
  - Leave William's `mordheim-*-1` stack untouched.

## Report

Write `scratchpad/advance-polish-report.md`, or put it in your reply. Cover:
- commits;
- each point;
- the duplicate spell rolls found;
- what separates the hired-sword and dramatis persona rules;
- calls you made.
