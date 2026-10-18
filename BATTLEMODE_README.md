# Battle mode

A short map of how battles work and where the code is. The rules and their reasons are in the review: [the pass 3 brief](docs/review/briefs/pass-3-battles.md) (decisions and planned changes) and [features/05-battles.md](docs/review/features/05-battles.md) (findings and the manual QA script). When this note and the code disagree, the code wins.

## Flow

| Battle status | Who moves it on | Page (`deriveBattleView`) |
| --- | --- | --- |
| `inviting` | every invitee accepts (`join/`) or declines (`decline/`); fewer than two left cancels it | the page it was opened on (prebattle shows the invite gate) |
| `prebattle` | everyone ready (`ready/`), then the creator starts (`start/`) | `/prebattle` |
| `active` | the creator ends it with winners or No winner (`finish/`) | `/active` |
| `postbattle` | each player finalises (`finalize-postbattle/`) or skips (`confirm/`); the creator or a battle manager can close it (`close-postbattle/`) | `/postbattle` |
| `ended`, `canceled` | | the campaign overview |

- Wins and losses are recorded once, when the battle ends (the last player finishes, postbattle is closed, or it expires), and not at all after No winner.
- The creator can cancel while inviting, in prebattle and in an active battle; postbattle is closed, not cancelled.
- Unanswered invites expire 72 hours after the battle is created, and an unfinished postbattle 72 hours after End battle; expired players count as declined or skipped.
- Reported results skip the phases: `report-result/`, then every other player approves or declines on the overview card.

The table mirrors `pageForStatus` in `frontend/src/features/battles/state/battle-machine.ts`, the one place the pages decide where a battle belongs.

## Frontend (`frontend/src/features/battles/`)

- `routes/BattleLayout.tsx` renders `BattleShell` (the phone bars) around `BattleProvider`, which owns the battle's two queries (`api/battle-queries.ts`: `['campaign', cid, 'battle', bid, 'state' | 'rosters']`), runs `deriveBattleView` and shares the battle through `BattleContext` (`useBattle()`). The provider stays mounted across phases, so a phase change reads nothing again.
- Each page composes one hook (`usePrebattlePage`, `useActivePage`, `usePostbattlePage`) and its components; shared hooks cover the shown warband, item uses, temporary units, the creator's cancel and serialised saves (`useSerializedSave`).
- `components/postbattle/postbattle-rules.ts` holds the rules the page still works out itself (exploration table, injury tables, suggested XP and dice), so the server's rules can replace one module.

## Realtime

- Channel `private-battle-<id>`, event `battle.event`. Each write others see raises `Battle.state_version`; its messages carry the version, and the last one carries the battle and the participants it changed.
- The pages patch the cached state from a message when its version is the cached one plus one (or equal), and read `state/` only on a gap, one read at a time (`state/battle-messages.ts`). An answer older than the cache never replaces it (`state/battle-cache.ts`).
- Writes send `X-Pusher-Socket-Id`, so the writing tab hears nothing back; its own answer is applied instead.
- The state is read again when the socket reconnects, when the tab is shown again, and when a write is refused with `battle_status_changed`.

## Backend (`backend/apps/battles/`)

Views in `views/`, business rules in `services/` (`broadcast.py` for versions and snapshots, `lifecycle.py` for the end of a battle, `kills.py`, `injuries.py`, `exploration.py`). Battle state lives on `BattleParticipant` (selected units, unit information, temporary units, the postbattle draft, the roster snapshot taken at start) and in the append-only `BattleEvent` timeline.
