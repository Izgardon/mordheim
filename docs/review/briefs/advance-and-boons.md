# Advances that guide, Boons & Banes, skill icons, XP, and the Edit layout

Branch `feat/advance-and-boons` in `.worktrees/adv`, based on main `06cb9641` (live). I merge to main myself; main auto-deploys, and production is wiped and reseeded when catalogue data changes (0 users).

Read `CLAUDE.md` first, especially "A guide, not a gatekeeper" and "No fluff text". Then read `scratchpad/warband-ux-report.md`, which built the current cards, Edit form, SearchSelect and game icons. William's words are quoted below, and his answers to my questions are marked **Decided**.

## 1. The advance (level-up) flow, the most important part

> "again we have over simplified the level up screen and it isnt as guiding as it could be. for a start it isnt very clear, no information about what will be received or why, and it doesnt allow things to be chosen within that modal which is the entire point. so both within the modal and then within the card when clicking a 'spell to choose' for example, for both spells and skills it should be guiding the user, skills from within their available list and spells another option to roll within one of the schools they already have a spell for (continuing with the ability to get the same spell again and therefore reducing its difficulty by 1)."

**The Advance modal: hero, hired sword and henchmen group.** Walk through it step by step, in the same modal:

1. **Roll.** Roll 2D6, or type a roll. Show the unit's advance table, either the hero table or the henchmen table, with the rolled row highlighted, so it's clear what the result means and why.
2. **Follow-ups.** Results that need another roll or a choice get it right there:
   - the D6 for S/A, I/Ld or W/T;
   - the choice between WS and BS;
   - for henchmen, "the lad's got talent" (the existing flow).
3. **Stat result.** For a stat advance, show the stat change against the race maximum, as "S 3 → 4 (max 4)". Over the maximum warns but still applies.
4. **New skill.** Show the unit's skill access as tabs or chips (Combat, Shooting, Academic, Strength, Speed and its special lists). Then list that list's skills with SearchSelect-style rows (title and description), and pick one in the modal.
   - **Decided:** skills outside his lists sit behind "Show all", greyed out with the "not usually" warning, and can still be picked.
5. **Caster.** A Wizard or Priest who rolls a new skill may instead take a new spell, through the spell flow below.
6. **Defer.** "Choose later" keeps the pick as today's pending "Skill to choose" or "Spell to choose".
7. **Confirm.** A summary of what the unit gains, then Confirm.

**"Skill to choose" and "Spell to choose" on the card.** These open the same guided picker as step 4 and the spell flow, not a bare search.

**Spells. Decided:** roll on a lore, with a fallback.

- Pick one of the lores the caster already has a spell from (the unit's spell lists, where step 2 of the templates plan will add them later), then roll D6 on that lore's table.
- If the roll is a spell he already has, that spell's difficulty drops by 1 for this unit. That needs a per-unit difficulty change: store it on the unit's spell link. Show it as "Difficulty 7 → 6".
- "Pick instead" allows a manual choice from any spell, with a warning.
- A caster with no spells yet picks a lore from the lists his caster type allows. If nothing tells us which, any lore, with a warning.

**Backend.** Keep the existing level-up service as the source of truth. Add only what's missing:
- the spell roll and its result;
- the per-unit difficulty change;
- a pick made inside the advance.

Backend tests for the spell roll, the duplicate spell lowering its difficulty, and a pick made in the modal.

## 2. Boons & Banes (was "Specials")

> "Special i want to rename to something which shows it can be good and bad things ... i then want to categories what specials we have as one of those 2 things in the database and then give the pill an icon depending on which one it is"

**Decided:** the name is **"Boons & Banes"**, with a **third group, "Trait"**, for neutral rules (Leader, Large, Wizard, Priest, Animal, Mount, hired-sword terms and the like).

- **Backend:** a `kind` field on Special, `boon`, `bane` or `trait`, set for every book special in the seed data or the catalogue import, so it can be reviewed. Custom specials pick their kind in their form (default `trait`). Add a migration.
- **Classify all the book specials.** List the classification in the report as three lists, so William can correct them. Rules of thumb:
  - **Boon:** helps the unit (Fear, Hard to Kill, Dodge).
  - **Bane:** a drawback (Stupidity, Animosity, Hatred's frenzy downsides, Cumbersome, mutations that hurt).
  - **Trait:** neither.
- **Frontend:**
  - "Specials" becomes "Boons & Banes" everywhere a player sees it: card sections, Edit, reference pages, the rail and filters.
  - Each pill gets an icon by kind from `game-icons.tsx`: one for boon, one for bane, one for trait.
  - Internal names in the code can stay.

## 3. Skill and spell icons

> "lets reword the icons for skills, lets give the core ones strength, academic etc a related icon, then just a generic one for special lists, i dont like the current title skill icon it isnt fantastical enough so change that to match the special skill icon in the pills. spell pills dont need icons."

- **Skill pills:** an icon per core list, plus one generic icon for every special list.
  - Combat: crossed swords.
  - Shooting: a bow or target.
  - Academic: a book or scroll.
  - Strength: a fist or flexed arm.
  - Speed: a running figure or winged boot.
- **The Skills section title** uses the same icon as the special-list pills.
- **Spell pills:** no icon.
- All icon choices stay in `game-icons.tsx`.

## 4. Experience

> "i do like experience being a full width bar with animation on the bar when adding experience. half rate not actually doing anything right now."

- **The XP bar** is full width, in the open card and in Edit, and animates when XP is added: the fill grows, and a box ticks when a block completes. Respect `prefers-reduced-motion`.
- **Half-rate XP.** **Decided:** "all XP, including + and −". With half rate on, every XP point added or removed counts half, whether from battle XP or the manual buttons, and fractions are kept (the model already stores decimal XP: check `docs/review` BUG-85 for the history).
  - Find out why the toggle does nothing today and fix it, server side.
  - Display: "XP 12½ / 14".
  - Backend tests for both battle XP and a manual change.

## 5. The Edit layout

> "edit screen we can hide the top section that shows name, type and stat points to save space, straight into the form, the inputs on the first line for name, type etc should grow in height to match the race input when on the same line as it. experience can move onto this line as well which allows profile and skill access to share a row, both taking up 50%. then under that we can have the grid of pills, move items into spot 1 and be part of the 2 by 2 grid"

- While editing, hide the card's top section (name, type and the stat line) and go straight into the form.
- **Row 1:** name, type, race and experience. Every input on the row is the same height as the race SearchSelect, and the half-rate toggle stays in XP's label row.
- **Row 2:** Profile and Skill access, 50% each.
- **Row 3:** the pill sections as a 2 × 2 grid, in this order:
  - Items;
  - Skills;
  - Boons & Banes;
  - Spells (only for casters; otherwise Injuries, or whatever fills the grid).
- A phone stays one column.

## Rules

- **Order of work.** Commit as you go, each commit gate-green. If I message you to stop for the usage limit, finish the commit, write the report covering what's done and what's left, and stop. The order:
  1. part 4's half-rate fix;
  2. part 5;
  3. parts 2 and 3;
  4. part 1;
  5. part 4's bar animation.
- **Gate:** typecheck, lint, format, build, vitest and the backend gate.
- **Commits:** small, in the repo's style, with no attribution lines. No push or merge, and never a bare `git stash`.
- Never run python or python3 on the Windows host. Containers only.
- **Scripts** (in the scratchpad):
  - `wt-feadv.sh` and `advfe-gate.sh` (node_modules volume `mordheim_frontend_node_modules_polish2`);
  - `wt-advbe.sh` and `advbe-gate.sh` (database `mordheim_adv`).
- **Browser:** use your own containers, ports and tab, with a distinct host (`adv.localhost`). William's dev stack (`mordheim-*-1`) stays untouched apart from a read-only `pg_dump`.

## Report

Write `scratchpad/advance-and-boons-report.md` (or put it in your reply). It needs:
- the commits;
- what each part does;
- the three classification lists;
- the icon choices;
- calls you made.
