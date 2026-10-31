# Next, step 9: a real kill table, and pivotal moments in the battle rows

Branch `next-kills`, in worktree `.worktrees/next-kills`. It branches from `next`; another agent is restyling on `next` at the same time.

- Commit only to `next-kills`.
- Don't merge. I merge it into `next` afterwards.

**Read first:**

- `scratchpad/next-6-report.md` (rounds, neutral groups, the kill sheet).
- `scratchpad/next-4-report.md` (battle moments, the chronicle).
- The briefs in this folder.

**Rules:**

- Delete old code freely.
- Light testing. The gate is typecheck, lint, format, build, vitest and the backend gate. Write tests for the new table and moments.
- Small commits in the repo's style, with no attribution lines. No push or merge. Never bare `git stash`.
- Don't stop for sign-off. Choose what keeps William's intent and note it.

**Scripts** (in the scratchpad, made for this worktree): `wt-killsbe.sh`, `killsbe-gate.sh`, `wt-fekills.sh`, `killsfe-gate.sh`.

- The backend uses database `mordheim_kills`; create it in the db container if a command needs it.
- The frontend uses its own node_modules volume, `mordheim_frontend_node_modules_kills`. Run `npm ci` in it first.
- For a browser check, use container and network names that don't clash with `mordheim-next-*`.

## Part A: the kill table (agreed with William)

Today a kill lives only in a `unit_kill_recorded` event's JSON payload, and everything that counts kills digs through those payloads. Instead, add a `battle_kill` table: one row per kill, written in the same transaction as the event.

**Killer:** always one of a warband's own units in the battle, never a temporary unit or a creature. Hired animals such as war dogs are henchmen groups (`source_beast`), so they count as henchmen.

- `killer_warband` → warband (not null);
- `killer_kind`: `hero`, `henchman` or `hireling`;
- `killer_hero` → hero, `killer_henchman` → henchman (the model) **and** `killer_group` → henchmen_group, `killer_hireling` → hireling (hired swords and dramatis personae).
  - Exactly the keys matching the kind are set: a DB check constraint.
  - The keys are `SET_NULL` on delete.
- `killer_name`, saved at the time of the kill.

**Victim:**

- `victim_kind`: `hero`, `henchman`, `hireling`, `temporary`, `creature` or `someone_else`;
- `victim_warband` → warband (null for a creature or someone else);
- `victim_hero`, `victim_henchman` + `victim_group`, `victim_hireling`, with the same check constraint and `SET_NULL`;
- **Victims that aren't rows** (a temporary unit, a third-party creature, someone else) are only columns:
  - `victim_name`;
  - `victim_type` (for example "Zombie" or "Pit Fighter");
  - `victim_key` (the battle-scoped key of the temporary unit or creature, so undo can stand it back up).
  - Neutral groups and temporary units stay JSON as they are.
- `victim_name` and `victim_type` are saved for every kind;
- the victim's traits at the time: `victim_leader`, `victim_large` and `victim_caster` (`""`, `"Wizard"` or `"Priest"`).

**The kill itself:**

- `battle`, `campaign` (denormalised, for campaign-wide reads), `event` → battle_event (one to one);
- `round` (null if logged after the fight), `phase` (`fight` or `after`, today's `source`);
- `how` (`melee`, `shooting`, `magic` or `other`, nullable), `earns_xp` and `took_out_victim`;
- `voided_at`: undo sets it. An undone kill keeps its row, but nothing counts it.
- `created_at`.
- Indexes for each killer key, `(campaign, created_at)` and `battle`.

**Use it everywhere kills are counted or read:**

- live kill counts in the battle;
- XP at finalise (live kills with `earns_xp`);
- the units' `kills` counters;
- the chronicle's kills;
- step 5's battle moments (until Part B replaces them);
- `kills.py`, `kill_list.py` and anything else that reads kill payloads.
- The event stays as the feed and the undo log, and keeps its payload so the feed reads the same.

**Data:**

- A data migration fills `battle_kill` from the existing kill and void events, so dev data keeps its history. Unit keys like `hero:12` and `henchman:88` map to rows.
- Prod gets wiped before the switch anyway, but don't rely on that.

**Frontend:**

- Temporary units and neutral creatures get no kill button on the battle screen (William: a killer is never one).
- The kill sheet's victims are unchanged.

**Kill history on unit cards:** on the warband page's open unit card, a small "Kills" list, newest first. Each line shows the victim, the battle date or scenario, the round and how (for example "Magister Halvard · Street Fight · round 2 · melee"). It reads from a small endpoint or rides the warband read, whichever costs fewer queries. For a henchmen group, the group's kills, each noting which model scored it.

## Part B: pivotal moments in the battle rows (agreed with William)

The pivotal moments (`apps/campaigns/pivotal_moments.py`, the `PivotalMoment` model) replace step 5's plain moments (`battle_moments.py`) in the overview's and Battles page's expanded rows. Ordinary kills stay in the Chronicle.

- **Battle only:** nothing from the post-game.
- **Built from `battle_kill` and the battle's out-of-action data.**
- **New moments:**
  - **First Blood:** the battle's first kill, its killer.
  - **Monster Hunter:** a third-party creature slain (`victim_kind = creature`).
  - **Sharpshooter:** 2+ shooting kills by one unit in the battle.
  - **Spellslinger:** 2+ magic kills by one unit in the battle.
  - **Last One Standing:** a winner whose other selected units were all out of action at the end.
  - **Underdog:** the warband with the lower declared rating wins (with a margin you choose, say 10%+).
- **Kept as they are:**
  - Hero Slayer, Giant Slayer, "I don't believe in fairies", There can be only one and Carried the Fight;
  - Untouched Triumph, Pyrrhic Victory and Wiped Out, which use out of action.
- **Changed:**
  - **Bloody Martyr** becomes "2+ kills, then taken out of action in the same battle", no longer tied to dying in the post-game.
  - **Black Day** is dropped, because it counts post-game deaths.
- **Model:** each moment carries its `round` (from its kill; null for result moments) and points at its kill (`source_kill` → battle_kill) where it has one. Keep `unit_key` and `unit_name`, or replace them with the kill's killer keys, whichever is cleaner.
- **When they're made:** today they're generated when the battle ends.
  - Keep that, and add a management command that regenerates them for ended battles (dev data, or after a rules change).
  - The command must be idempotent.
- **The read:** battle history gives each battle its pivotal moments in place of `moments`, in fight order (by round, then kill order), with the result moments last. Remove `battle_moments.py` and its old shape once nothing uses it.
- **The row:**
  - each moment shows its round tag ("Round 2", or "Result"), its title (for example Hero Slayer), the detail line and its warband;
  - the unit's name links to that unit on its warband page (the `?unit=` deep link from step 7a's search, or whatever the warband page uses);
  - a battle with no moments says so plainly.
- **Chronicle:** leave it as it is, but move its kills to `battle_kill`.

## Report

Write `scratchpad/next-9-report.md`, covering:

- commits;
- the schema as built;
- what works;
- the data migration's results on the dev copy;
- calls you made.
