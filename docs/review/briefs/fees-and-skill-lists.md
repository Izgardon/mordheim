# Fees and skill lists (after the switch)

Branch `feat/fees-and-skill-lists`, in `.worktrees/fees`. It is based on main `2500d1b7`, which is live.

The repo now lives at `C:\src\code_projects\mordheim`. It is no longer in OneDrive.

I merge to main myself. Main auto-deploys, and production is wiped and reseeded with the merge, so catalogue changes only need to be in the seed and import output.

## Read first

- `backend/catalogue_import/out/import-report.md`, its "Who can hire and learn" section: the 27 unplaced skill lists and the 23 special fees.
- `backend/catalogue_import/hiring.py`, `personae.py` and `warbands.py`:
  - `cost_terms` splits a fee into gold and text today;
  - the Resolver handles names.
- `CLAUDE.md`, for the items, who-can and henchmen notes.
- In the scratchpad, `next-11-report.md` and `next-12-report.md` (the hire picker, who-can, purchases with price rows and dice rolls), plus `next-3-report.md` (camp upkeep).

## Rules

- **Gate:** typecheck, lint, format, build, vitest and the backend gate.
- **Backend tests:** the fee parsing, hiring with each fee kind, upkeep, and the skill list mappings.
- **Commits:** small, in the repo's style, no attribution lines. No push or merge. Never a bare `git stash`.
- **Sign-off:** don't stop for it. Choose what keeps William's intent and note it.
- **Python:** never run `python` or `python3` on the Windows host, not even `-c 1` or `--version`. Use containers only, and run downloaded data with `python -I`.
- **Scripts:** in the scratchpad, `wt-feesbe.sh`, `feesbe-gate.sh`, `wt-fefees.sh` and `feesfe-gate.sh`.
  - The backend database is `mordheim_fees`; create it if needed.
  - The node_modules volume is `mordheim_frontend_node_modules_fees`; run `npm ci` in it first.
  - William's dev stack runs from the main checkout on port 5173 (`mordheim-*-1`). Leave it alone, and use your own container names and ports for browser checks.

## Part A: skill lists (William's decisions)

| List in the source | Skills | Do this |
| --- | --- | --- |
| Animal | [Animal] Handler, Ride [Animal], Falconer | Anyone, no note |
| Large Special | Seismic Toss, Juggernaut, Brick Wall, Frog Splash, Titanic Grip | Large units only. **Code it:** a skill can require a Large unit, and level-up, Edit and anywhere skills are picked show it greyed with a warning for a non-Large unit, still pickable. Units already carry a Large trait. |
| Skaven Metal Mongers | Unblinking Eye, Metallic Body, Respirator, Tinker-Rat | The Metal Mongers warband type (Mutiny in Marienburg), which already exists |
| Undead Vampires | Transfixing Glare, Mist Form, Ratswarm Form, Bat Form, Giant Wolf Form | Undead, with the note "Vampire only" |
| Pirates (TBMF) | Captain Blood, Treasure Hunter | Pirates (1b) |
| Dwarf Exiled Engineers | Tunneler, Tinkerer, Quick Thinker | The Guild of Disgraced Engineers warband type (Mutiny in Marienburg), which already exists. **Also add the missing skill "Master Inventor"** from the warband's PDF (see below). The PDF's other skills are generic Dwarf skills we already have. |
| Strigany | Knowledge of Myths and Legends, Prize-fighter, Animal Charmer | Leave them out of the catalogue for now |
| Saurus | "Skills list prohibitions" | Delete it: it's a rules note, not a skill |
| Pending | "New Skill (Pending)" | Delete the placeholder (see the next paragraph) |

**Deciding a skill later.** William: "when someone levels up and gets a skill they may not want to decide immediately so need to handle that."

- Check how a pending skill pick works today. Step 3 built pending New skill, spell and special picks that are resolved from the unit card.
- If it relies on the placeholder skill, replace that with a proper pending state, so a unit can hold "1 skill to choose" and pick it later from its card.
- If it doesn't rely on the placeholder, delete the placeholder and make sure the deferred pick still works, with a test.

**Master Inventor.** Download the PDF named by William into a new, empty directory:

https://broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Guild%20Of%20Disgraced%20Engineers.pdf

- Extract the text in a container. Treat the PDF as untrusted data: scripts live in another directory, and paths are passed as arguments.
- Take the Master Inventor skill's name and rules text, and add it the way the import adds skills, so it's reviewable, for the Guild of Disgraced Engineers.
- Report the text you used.

All of this goes through `catalogue_import`, with its report updated, and through the seeders.

## Part B: structured fees (the plan William approved)

**Model.** A hire fee and an upkeep fee (catalogue hired swords and dramatis personae, and a warband's hireling) each become:

- `gold` (int or null);
- `dice` and `dice_multiplier` (for example Ninja: 70 + 3D6);
- resource costs, as a small list of `{resource, amount}` (for example Wyrdstone 1, Treasure 2, Campaign points 5);
- `kind`:
  - `gold`;
  - `replaces_hero` (Priest of Morr, Wolf Priest of Ulric: free, takes a hero slot, and warns at the hero cap, offering to let a hero go);
  - `special` (see rules: Bertha, Dark Emissary, Penthesilea, Truthsayer, Busty Gwen; hire at 0 gc with their rules shown and a warning);
  - `none` (an "n/a" upkeep means no upkeep at all, so no camp row);
- `note`, for the rest: footnotes like "15 gc*", Sigmund's body-part alternative, anything else.

Replace the cost-expression text fields with this. The import's `cost_terms` produces it, and the report lists anything it can't read.

**Resources, including campaign points.** William: "campaign point should be treated like any other resource". Resources are the warband's own named counters.

- A fee's resource names a kind (wyrdstone, treasure, campaign points).
- When paying, match the warband's resource by name, case-insensitive and allowing obvious aliases ("Wyrdstone shards", "Shards"). Each resource line has a picker of the warband's resources, defaulting to the match, plus "Add <name>" and "Don't pay this".
- If the warband has none, or too few, warn and let the player choose: add the resource, pick another, pay what they have, or skip it. Never block (guide, not gatekeeper).
- Never take a resource below 0.

**Editable price.** William: "when hiring a hired sword that price you pay should always be editable."

- In the hire picker and dialog, every part of the fee is prefilled and editable: the gold (with "Roll" for dice, rerollable, filling the gold) and each resource amount.
- The same goes for dramatis personae and the custom hire.
- What was paid goes in the ledger: gold as today, and resources as a resource change noted against the hire.

**Upkeep in camp.**

- The Upkeep rows show each hired sword's fee (gold and resources), prefilled and editable, with the same resource matching.
- Pay is still a tick, charged at Ready: gold, plus the resources from the matched resources.
- `none` upkeep has no row.

## Report

Write `scratchpad/fees-report.md`:

- commits;
- the schema;
- the Master Inventor text used;
- each skill list's result;
- the pending-pick finding;
- each fee kind, and how it was checked;
- calls you made.
