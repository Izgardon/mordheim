# Battle screen gaps, William's small decisions, and a polish batch

Branch `feat/battle-and-polish`, in `.worktrees/polish2`, based on main `517f3467` (live). I merge to main myself; main auto-deploys.

Another agent is building bounties on `feat/bounties` and touches the overview and Battles pages. Keep out of `features/campaigns/components/overview/` and the Battles page, except for the battle-number display described below. Keep that change small, because I'll resolve any overlap.

## Part A: the battle screen (William: "would be nice to fix all of these")

1. **Henchmen tiles get wound buttons** (− and +), as heroes have, on the battle screen. Each model's wounds are shared state, like heroes'.
2. **Per-unit battle notes are back.** Any unit can have a note during the battle, autosaved and visible to its owner as before. They were removed in step 6; main's history (`useUnitNotesAutosave`, and the participant's `unit_information_json` notes) shows how they worked. Put the note behind a small button on the unit card, and keep it unobtrusive.
3. **Battle number.** William: "campaign battle number will just be greatest games played between the players". A battle's number is the highest count of games played among its participating warbands, with this battle included.
   - Show it as "Battle N" on the battle screen's top bar, the pre-battle, the Aftermath title ("After battle N"), the overview's battle rows, the Battles page and the readiness bar.
   - Compute it on the server and store it on the battle when it starts, so it never shifts later.
   - Backfill ended battles with a data migration.
4. **`PrebattleUnits.tsx` is over the 250-line limit.** Split it.

## Part B: William's decisions

1. **Reported results count down missing games.** A reported result (a battle reported rather than played in the app) counts as a game for every participating warband's units that are missing games, exactly as a played battle's finalise does. Add a backend test.
2. **Start anyway** (forcing the next round) is allowed for the battle's creator and for campaign admins and battle managers, not just anyone still fighting. Other players can still ask and agree. Hide the button for anyone else, and refuse it on the server.
3. **Chaos Fury summoning text** (Aksho'akhash, a dramatis persona; "do what you think is best, not that important"). His hire is a summoning ritual described in his "who can hire" note. Make sure the hire picker shows that note in full as his fee's rules, with the fee kind `special`, and that nothing tries to automate the ritual. That should be a check plus at most a small display fix.
4. **Hired-sword races.** Leave a race as unknown where the source has none. No work is needed beyond confirming the hire and card pages show "Unknown race" or nothing, rather than an error.

## Part C: polish and dead code (William: "fix all polish")

1. **An archived campaign's banner overlaps the top bars** (the readiness bar and post-game bar). Make it sit in the flow.
2. **Input borders are below 3:1 contrast against the cards**, in light and dark. Raise the input border token, or the border used on inputs, so it passes 3:1 against `surface` and `panel`. Check focus rings too.
3. **Remove dead backend endpoints the rebuilt UI no longer uses.** William: "3D dice maybe in the future, top killers maybe in the future, others can go".
   - Keep top killers.
   - Remove the bestiary favourites, the bulletin and pivotal-moments-style leftovers, the battle record endpoints the UI doesn't call, and anything else nothing in the frontend calls. Check carefully with the frontend's API layer.
   - Remove each with its tests, serializers and URLs. List what you removed.
4. **Items from the old "After the passes" list in `docs/review/PLAN.md`.** Check each and fix it if it's still present:
   - creature group members are named "Henchman 6" and "Henchman 7" in battle (use the creature's name and number);
   - the dramatis persona card prints its name twice;
   - realtime gaps: only beast writes send `warband.changed`; purchases, renames, roster saves, XP, transfers and sales should too, so other players' open warband pages refresh;
   - the Skills and Spells pages may list one row fewer than the database.
5. **Switch the CSP from report-only to enforcing.** First check the browser console on every page (landing, campaigns, overview, warband, store, battle, Aftermath, reference, settings) for violations. Fix them, then enforce. Note the header's final value in the report.

## Rules

- **Gate:** typecheck, lint, format, build, vitest and the backend gate. Write backend tests for the battle number, missing games on reported results and the Start anyway permission.
- Small commits in the repo's style, with no attribution lines. No push or merge. Never a bare `git stash`.
- Don't stop for sign-off; make the call that keeps William's intent and note it.
- Never run `python` or `python3` on the Windows host for any reason. Use containers only.
- **Scripts** (in the scratchpad): `wt-polish2be.sh`, `polish2be-gate.sh`, `wt-fepolish2.sh`, `polish2fe-gate.sh`.
  - Database: `mordheim_polish2` (create it if needed).
  - node_modules volume: `mordheim_frontend_node_modules_polish2` (`npm ci` first).
- **William's dev stack** (`mordheim-*-1`, ports 5173/8000) stays untouched.
  - Use your own containers, ports and browser tab, and close them at the end.
  - Use a distinct host such as `polish.localhost` so you don't share cookies with other sessions.

## Report

Write `scratchpad/battle-and-polish-report.md` with:

- commits;
- what was fixed;
- the dead endpoints removed;
- the CSP;
- calls you made.
