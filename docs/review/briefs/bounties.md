# Bounties

Branch `feat/bounties`, in `.worktrees/bounties`. It is based on main `517f3467`, which is live. I merge it to main myself (main auto-deploys).

Another agent is working on `feat/battle-and-polish` at the same time. Keep to bounties, plus the Battles page caption fix at the end of this brief, which lives in the overview code you'll touch anyway.

## What William agreed (2026-10-25 and 2026-10-28)

- A player puts a bounty on an enemy **hero** for an amount of gold. The button lives on that hero's card on the other warband's page, and on the overview.
- It is **soft**: no gold is held when it's posted. Gold moves only when a claim is accepted.
- **Claiming:** the claimant says which of their units took the hero out, and optionally in which battle.
  - Both parties must accept, through notifications.
  - Then the gold moves from the poster to the claimant, as ledger rows on both warbands.
- **Out-of-action history as a suggestion:** when claiming, suggest the claimant's kills of that hero from `battle_kill`. Any kill or out-of-action of the target by the claimant's warband since the bounty was posted is a candidate.
- A bounty can be **withdrawn** by its poster while it's open.
- **Guide, not gatekeeper:** warn (for example, the poster can't afford it right now), never block.
- **Several bounties** on the same hero may exist.
- **When the hero dies or leaves:** the bounty stays open until claimed or withdrawn, with a note saying so.

## Design

The design E overview boards (`E-Web-Overview.dc.html`, `E-Mobile-Overview.dc.html`, in `C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`) include an "Open bounties" panel on the web and a Bounties tab on the phone. Step 5 left both out because there was no backend.

- Build them as the boards show.
- Add the Chronicle entries "Bounty posted" and "Bounty claimed", plus a Bounties chip in the Chronicle filter.
- A claimed bounty also shows in the battle's pivotal moments row if it is tied to a battle. This is optional; skip it if it's messy.

## Backend

- A `bounty` model:
  - campaign;
  - target hero (SET_NULL, plus a saved name and warband);
  - posted by warband and user;
  - amount;
  - note;
  - status: open, claimed, paid, declined or withdrawn;
  - timestamps.
- A `bounty_claim` model:
  - claimant warband and unit;
  - an optional kill (`battle_kill`) and battle;
  - status;
  - poster accepted and claimant accepted.

  Use your judgement on whether the claim is its own table or fields on the bounty. Several claims could compete, so a table is probably right.
- Endpoints for post, withdraw, claim, accept and decline. Use the campaign's realtime and notifications as other features do (for example trades).
- Access: campaign members only. Only the poster withdraws. Each side accepts its own part.
- Backend tests for the flow, with a fixed query budget on the list read.

## Also: the Battles page caption

While the rows load, the Battles page says "0 battles fought". Show the skeleton caption instead (fix in `features/campaigns`).

## Rules

- **Gate:** typecheck, lint, format, build, vitest, and the backend gate.
- **Commits:** small and in the repo's style, with no attribution lines. No push or merge. Never use a bare `git stash`.
- Don't stop for sign-off. Choose what keeps William's intent and note it.
- **Never run python or python3 on the Windows host** for any reason. Use the containers only.
- **Scripts** (in the scratchpad): `wt-bountiesbe.sh`, `bountiesbe-gate.sh`, `wt-febounties.sh`, `bountiesfe-gate.sh`.
  - Database: `mordheim_bounties`. Create it if needed.
  - node_modules volume: `mordheim_frontend_node_modules_bounties`. Run `npm ci` in it first.
- William's dev stack (`mordheim-*-1`, ports 5173 and 8000) stays untouched. Use your own containers, ports and browser tab, and close them at the end. Use a distinct host such as `bounties.localhost` so you don't share cookies with other sessions.

## Report

Write `scratchpad/bounties-report.md`:
- commits;
- the schema;
- the flow as checked in a browser with two players;
- calls you made.
