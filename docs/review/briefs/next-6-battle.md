# Next, step 6: the battle screen (plus the invitation and pre-battle pages)

Branch `next`. Read first: `scratchpad/next-1-report.md` to `next-4-report.md`, and the earlier briefs in this folder.

Same rules:

- Delete old code freely.
- Light testing: the gate is typecheck, lint, format, build, the remaining vitest suites and the backend gate when the backend changes.
- Small commits in the repo's style, no attribution lines, no push or merge, never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the design's intent and note it.

Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

**Functional reference:** main's old battle UI (`git show main:frontend/src/features/battles/...`, or the main checkout at the repo root). It covers what today's flow does: invitation, pre-battle, active battle, finishing, undo, single-use items, temporary units, notes and realtime patching. The kept hooks and state in `frontend/src/features/battles/` (`state/battle-machine.ts`, `battle-cache.ts`, `useBattleState`, `useEventUndo`, `usePrebattle*`, `useFinishMine`, `useCustomUnitDraft`, `useUsedSingleUseItems`, `useNudge` and the rest) are the data layer: reuse them and delete whatever ends up unused.

Design boards (local copies, current):

`C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`

- `E-Mobile-Battle.dc.html` holds every state in one board. Its `view` prop is `landing`, `kill`, `round`, `waiting`, `menu`, `gear`, `neutral` or `dice`; the `E-Mobile-Battle-*.dc.html` boards just import it with a view set. Its `renderVals` has the sample data and the behaviour (the status cycle, wounds, the kill sheet's fields, the round popup's text).
- `E-Function-Map.dc.html`, the "Battle and the rest" group: where each of today's battle actions moves to.
- The canvas note for the battle (summarised):
  - Next round is top right; everyone else gets a popup to agree, and Start anyway pushes it through.
  - The bottom bar has Rules, Melee, Ranged, Dice and Menu. Crits sit inside Melee and Ranged.
  - The mount line just says "On a Warhorse", with a Dismounted switch.
  - Status is one button that cycles Standing, Knocked down, Stunned and Out of action, next to wounds. Gear and Skills (or Spells) sit on the bottom row of the card.
  - The strip under the top bar holds every warband in the battle plus neutral groups; duplicate creatures are numbered.
  - The feed scrolls in its own box, and an arrow jumps back to the latest.
  - The kill sheet lists hired swords and animals; Someone else takes a typed name; XP earned is a switch.

There is no web board. On the web, use the shell's battle-mode bar from step 1 and lay the same pieces out wider: the strip and unit cards in the main column, the feed as a side column, the bottom bar's tools as buttons in the header or a toolbar. Same components, same behaviour.

## Part A: the invitation and pre-battle pages

There's no design E board for these. Build them plainly from the step 1 primitives, matching the battle board's look, on today's API and hooks:

- **Invitation:** who invited you, the scenario and the players. Accept or Decline.
- **Pre-battle:**
  - choose your units;
  - the battle's config (today's options);
  - the rating;
  - everyone's state;
  - Ready, and Start and Cancel for the creator.
  - Unready on leaving, as today.
- **Routing:** `battles/:battleId/*` sends each player to the page for his status: invitation, pre-battle, battle, or the Aftermath (already built). Replace step 6's placeholder route.
- The overview's unfinished-battle banner and the rail's Rejoin must land on the right page.

## Part B: the battle screen

Match `E-Mobile-Battle` closely: layout, spacing, type and behaviour, in light and dark.

- **Top bar:**
  - back;
  - the battle and scenario, with "Round N · live";
  - Next round, top right.
- **Strip:** a chip for each warband in the battle plus each neutral group, with its standing count and a bar. Tapping a chip shows its units. Duplicate creatures are numbered (Zombie 1, Zombie 2).
- **Unit cards** (your own units; other warbands' are read-only unless today's capabilities allow more):
  - name and type;
  - the kills button ("Log a kill for X, N so far");
  - the status button that cycles Standing → Knocked down → Stunned → Out of action;
  - wounds − and + beside it.
  - Out of action goes through today's out-of-action event, so kills, moments and the post-game keep working. Undo works as today.
  - The mount line ("On a Warhorse" or "On foot") with the Dismounted switch (today's dismount).
  - The bottom row: Gear, and Skills or Spells. Each opens the quick-gear sheet (`gear` view): each item with its type and rules, and Use for single-use items (today's item use, marked used afterwards).
  - Henchmen groups show a status per model. A kill is logged against the model.
  - Add a unit, at the end of your list.
- **Kill sheet** (`kill` view):
  - who (the unit, and the model for henchmen);
  - the victim, picked from the other warbands' units, including hired swords, animals and neutral units, or Someone else with a typed name;
  - how (melee, ranged and so on, as the board has);
  - the XP earned switch, on by default.
  - Saving records the kill and puts the victim out of action, as today.
  - Add a typed victim name and the XP flag to the kill payload if they're missing. XP should only count kills with the flag on.
- **Feed:**
  - in its own scrolling box: the battle's events in plain words, newest at the bottom;
  - an arrow that jumps back to the latest when you've scrolled up;
  - Undo on your own recent events, as today.
- **Next round** (`round` and `waiting` views):
  - Tapping it asks everyone else, who get a popup to agree.
  - The asker sees who has agreed and can tap Start anyway.
  - When everyone agrees, or Start anyway is tapped, the round goes up for all players. Knocked down models stand up and stunned models become knocked down, as the board's popup says.
  - Do this with today's realtime path (`services/broadcast.py`, `state_version` and the battle channel).
- **Bottom bar:**
  - **Rules:** the battle's rules reference (today's rules endpoint).
  - **Melee** and **Ranged:** the to-hit and to-wound helpers, with crits inside each (`data/critical-hits.ts`).
  - **Dice:** the battle dice sheet (`dice` view). Battle dice record nothing.
  - **Menu** (`menu` view):
    - End my battle (today's finish: I won, I lost, and the rest);
    - Leave;
    - Notes;
    - Edit stats (temporary stat changes, apply and reset);
    - Add a unit (to your warband or to a neutral group);
    - Add a neutral group;
    - Chat and Notifications (the step 2 drawers);
    - for the creator or a battle manager, today's manager actions (cancel, nudge, end a stuck fight).
- **Neutral groups** (`neutral` view): creatures nobody plays.
  - Anyone in the battle can add one (a name, a creature type from the bestiary, how many) and track each creature's status and wounds.
  - They can be kill victims.
  - They are not rostered and nothing from them reaches the post-game.

## Backend

Add only what's missing, kept small, with a few tests:

- **Rounds:**
  - `round` on the battle, starting at 1;
  - a next-round request: who asked and who has agreed;
  - endpoints to ask, agree and force;
  - every change broadcast like other shared writes.
  - Stamp the current round on kill and out-of-action events.
  - Then step 5's battle moments (`apps/campaigns/battle_moments.py`) group by "Round N" when events carry one, with old events staying under "During".
- **Status and wounds:** if knocked down, stunned and wounds aren't already shared battle state (check `unit_information_json` and the battle machine), store them so other players see them, broadcast like other writes. The round change applies the stand-up step on the server.
- **Neutral groups:** store them on the battle, for example a JSON field. Each group has a name, a creature type and its creatures with status and wounds, each with a stable key so it can be a kill victim. They go in the battle snapshot.
- **Kills:** a typed victim name, and the XP flag counted where kills award XP.

## Leftovers from step 4–5 (only if cheap)

- Drop the stale `test_mordheim_next_4` database in the db container.
- A mount bought for a unit in the store lands ridden rather than carried, if the purchase API makes that a one-line change.

## Report

Write `scratchpad/next-6-report.md`:

- commits;
- what works;
- placeholders;
- backend changes;
- calls you made.
