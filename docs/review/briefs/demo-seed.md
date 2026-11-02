# A demo campaign seed for local dev

Branch `feat/demo-seed`, in `.worktrees/demo`, based on main `06cb9641`. I merge to main myself.

**William's request:** "create a seed command we can run locally that creates a campaign and a main user, tell me its email and make their passwords all password. it should have battles completed, warbands created just so it looks like a fledged campaign".

## The command

Name it `python manage.py seed_demo_campaign`. Base it on, or sit it beside, the existing `seed_campaign_users`.

**Users:**
- The main user is `captain@mordheim.test`, display name "Cap". He is the campaign owner.
- Three more players: `player2@mordheim.test`, `player3@mordheim.test` and `player4@mordheim.test`, with Mordheim-ish display names.
- Every password is `password`. Set it with `set_password` so the validators don't refuse it.
- `.test` is a reserved domain, so nothing can ever be sent there.

**Safety, so these weak passwords can never reach production:**
- The command refuses to run unless `settings.DEBUG` is true.
- It also refuses unless the database host is a local docker host (`db`, `localhost` or `127.0.0.1`) or `--force-local` is passed. Give a clear error.
- Never call it from `seed_all`, `seed_catalogue_if_empty` or the gunicorn boot path.

**Re-running:**
- It is idempotent, or takes `--reset`: it finds its own campaign (a fixed name such as "The Shattered Crown", plus a marker) and its `@mordheim.test` users, deletes them, and rebuilds them.
- It never touches other campaigns or users.

**Catalogue:** it needs the catalogue. If the catalogue is empty, run `seed_all` first, or tell the user to.

## What "fleshed out" means

Build it through the real services wherever they exist (raising warbands, recruiting, purchases, battles, kills, finalise, level-ups, bounties, trades), so every derived thing is consistent: ledgers and gold, XP and advances, `battle_kill`, pivotal moments, the chronicle, battle numbers and rounds. Fall back to model writes only where no service exists, and note where you did.

**Campaign:**
- the "Up to 1c" preset;
- Encampments and Locations on;
- a few locations with areas;
- an encampment or two;
- house rules optional.

**Four warbands of different types:** for example Reiklanders (Cap's), Skaven of Clan Eshin, Undead and Witch Hunters. Each has:
- 3–5 heroes, with names, races, profiles, skill access, skills and some items;
- 2–3 henchmen groups with loadouts, where one member has a gap;
- a hired sword on at least one warband;
- resources (gold, wyrdstone);
- a backstory line.

Starting gold is spent through real purchases, so the treasury reads right.

**Six to eight completed battles across the players:**
- a mix of winners;
- rounds with kills, including henchmen kills and one on a neutral creature;
- out-of-actions;
- serious injuries (one hero dead, one with a lasting injury, a henchman lost);
- XP gained, with a couple of advances taken (stat and skill) and one pending "Skill to choose";
- exploration with wyrdstone and a find;
- upkeep paid;
- each battle finalised through the post-game, so the Aftermath data is real.

Pivotal moments come out naturally: First Blood, Hero Slayer and so on.

**Plus:**
- one reported result, approved;
- one bounty paid and one still open;
- one completed trade;
- a few chat messages, if chat is easy to write to.

**End state:** every warband is Ready, with no battle open. Optionally add a flag, `--with-open-battle`, that leaves one battle in pre-battle so the battle screen can be tried.

## Checks

- **A backend test** runs the command against the test database and checks:
  - the counts (users, warbands, battles ended);
  - that every user's password checks as `password`;
  - that the guard refuses when DEBUG is off.
- Run it twice locally against your own database copy. It must be idempotent.
- Run the backend gate (`scratchpad/wt-demobe.sh` and `demobe-gate.sh`, database `mordheim_demo`).
- **Spot check in a browser:** sign in as `captain@mordheim.test` and confirm that the overview, Battles, the Chronicle, the warband page and the Aftermath of an old battle all look populated.

## Docs

In `CLAUDE.md`'s dev commands section, add one line on how to run it and the main user's email.

## Rules

- Small commits, with no attribution lines.
- No push or merge. Never a bare `git stash`.
- Never run python on the Windows host; use containers only.
- Never touch Neon.
- Leave William's dev stack (`mordheim-*-1`) alone, apart from a read-only `pg_dump`.
- Use your own containers and database, and remove them at the end.
- Another agent is working in `.worktrees/adv` on the level-up flow, specials and XP. Keep out of those files.

## Report

Write `scratchpad/demo-seed-report.md`, or put it in your reply:
- the commits;
- how to run it;
- what it creates, with counts;
- where it falls back to model writes.
