# Battle Mode Build Guide (Editable)

This file is the working implementation plan for battle mode.
Edit this file when rules or priorities change.
Future sessions should read this first.

## Current Status
- Last updated: 2026-03-23
- Scope complete: Battle create flow + invite acceptance gate + prebattle UI + active battle cards + postbattle draft/finalize flow + reported-result approval flow
- Next focus: Reconnect hardening + broader validation polish

## Product Rules (Source of Truth)
1. Battle starts in `inviting`.
2. Every invited participant must accept before prebattle opens.
3. Invitees receive a user notification event when invited.
4. No auto-navigation to prebattle while battle is `inviting`.
5. When all participants accept, all participants are navigated to prebattle via user notification.
6. While in prebattle, participants can:
- Select/deselect units they bring
- Apply temporary per-battle stat edits (with reason)
- Add temporary custom units (battle-scoped only)
- Ready/unready
- Cancel participation and later rejoin
7. Battle creator can hard-cancel battle during `inviting` or `prebattle`.
8. If all participants cancel in prebattle, battle becomes `canceled`.
9. Battle can start only when all participants are `ready`.
10. In active battle, users can rejoin if disconnected.
11. Each user finishes their own battle session independently.
12. Battle creator ends the active battle for everyone and chooses one or more winners.
13. Battle ends only after all started participants finalize their own postbattle.
14. Kill totals are aggregated once on finalize and written to unit kills.
15. Custom units can emit battle events but are not attributed in permanent kill aggregation.
16. Users can also submit a reported battle result without using prebattle/active/postbattle.
17. Reported battle results create a real `battle` + `battle_participant` record, but use approval statuses instead of battle-phase statuses.
18. The submitter auto-approves the reported result and every other selected participant must approve it.
19. Any decline cancels the reported result and nothing is committed.
20. Once every selected participant approves, wins/losses update immediately and each participating warband gets the normal `battle:complete` log payload.
21. Pending reported results do not block those warbands from starting or joining normal battles.

## Data Model
### `battle`
- `id`
- `campaign_id`
- `created_by_user_id`
- `title` (new)
- `flow_type` = `normal|reported_result`
- `scenario`
- `status` = `inviting|reported_result_pending|prebattle|active|postbattle|ended|canceled`
- `winner_warband_ids_json` (new; multi-winner support)
- `settings_json`
- `created_at`
- `updated_at`
- `started_at`
- `ended_at`
- `post_processed_at`

### `battle_participant`
- `id`
- `battle_id`
- `user_id`
- `warband_id`
- `status` = `invited|accepted|reported_result_pending|reported_result_approved|reported_result_declined|joined_prebattle|ready|canceled_prebattle|in_battle|finished_battle|confirmed_postbattle`
- `connection_state` = `online|offline`
- `declared_rating` (new)
- `selected_unit_keys_json` (new)
- `stat_overrides_json` (new)
- `custom_units_json` (new; temporary units for this battle only)
- `postbattle_json` (new; participant-scoped postbattle draft)
- timeline fields (`invited_at`, `responded_at`, `joined_at`, `ready_at`, `finished_at`, `confirmed_at`)
- `last_event_id`
- `last_seen_at`

### `battle_event`
- append-only ordered timeline
- combat/result events include:
- `battle_created`
- `battle_started`
- `participant_joined_battle`
- `kill_recorded`
- `death_recorded`
- `item_used`
- `participant_finished_battle`
- `battle_entered_postbattle`
- `participant_confirmed_postbattle`
- `battle_ended`
- `battle_canceled`

## API (Implemented)
- `GET /api/campaigns/:campaign_id/battles/`
- `POST /api/campaigns/:campaign_id/battles/`
- `POST /api/campaigns/:campaign_id/battles/report-result/`
- `GET /api/campaigns/:campaign_id/battles/:battle_id/state/?sinceEventId=:id`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/approve-result/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/decline-result/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/join/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/config/` (persist selection + temp stats)
- `POST /api/campaigns/:campaign_id/battles/:battle_id/ready/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/cancel/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/cancel-battle/` (creator-only hard cancel)
- `POST /api/campaigns/:campaign_id/battles/:battle_id/start/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/events/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/finish/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/postbattle/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/finalize-postbattle/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/confirm/` (legacy alias to finalize)

## Event Payload Notes
- `kill_recorded` supports:
- attributed units: `killer_unit_type = hero|hired_sword|henchman` with `killer_unit_id` (aggregated at finalize)
- custom units: `killer_unit_type = custom` with `killer_unit_key` (stored as event only, not aggregated)

## Frontend (Implemented So Far)
### Start battle dialog
- file: `frontend/src/features/campaigns/components/overview/StartBattleDialog.tsx`
- title field moved to first position
- scenario/label text cleaned (no required/optional markers)
- creator is auto-selected and cannot be deselected
- each selected participant can declare rating
- payload sends `title` and `participant_ratings`

### Report battle result dialog
- file: `frontend/src/features/campaigns/components/overview/ReportBattleResultDialog.tsx`
- available from campaign overview beside normal `Start battle`
- selects participants and one or more winners
- creates a reported-result battle record instead of opening prebattle
- other participants receive a user notification and can approve/decline from notifications or overview
- pending reported results show on campaign overview and do not count as resumable battle sessions

### Prebattle page
- file: `frontend/src/features/battles/routes/BattlePrebattle.tsx`
- invite acceptance gate before prebattle access
- `My Warband` tab and `Other Warbands` tab
- henchmen groups expanded to individual henchmen rows
- default selected units for current user
- temporary stat edits with reason capture
- temporary stat model includes `armour_save` as a core stat
- custom unit creation/removal (battle-scoped, non-persistent to warband tables)
- explicit apply button persists participant config to backend
- ready/unready
- cancel and rejoin actions
- creator-only hard cancel action with confirmation dialog
- start battle action when all ready

### Campaign overview battle resume/status actions
- file: `frontend/src/features/campaigns/routes/CampaignOverview.tsx`
- if user has an open battle (`inviting|prebattle|active|postbattle`), primary CTA changes to `Rejoin Battle`
- route resolution is automatic by battle phase:
- `inviting|prebattle` -> prebattle page
- `active` -> active page
- `postbattle` -> postbattle page
- special case: if current user already accepted invite but battle still `inviting`, CTA changes to `See Status`
- `See Status` opens participant status dialog with player/warband/rating/status and creator cancel control

## Realtime
- private channel: `private-battle-{battle_id}`
- event name: `battle.event`
- payload shape:
```json
{
  "type": "battle_started",
  "payload": {
    "id": 123,
    "battle_id": 9,
    "type": "battle_started",
    "actor_user_id": 7,
    "payload_json": {},
    "created_at": "..."
  }
}
```
- lifecycle state-change pushes can also use:
```json
{
  "type": "battle_state_updated",
  "payload": {
    "battle_id": 9,
    "campaign_id": 3,
    "status": "prebattle",
    "actor_user_id": 7,
    "reason": "participant_ready_changed"
  }
}
```

## Step-by-Step Build Plan
1. Database + event model
- [x] Add battle app models + migrations
- [x] Add battle title column
- [x] Add participant rating + config persistence columns
- [x] Keep invite/prebattle lifecycle in `battle_participant` + realtime state updates

2. Backend lifecycle APIs
- [x] Create/list/state/join/ready/cancel/start/events/finish
- [x] Add postbattle draft + finalize APIs
- [x] Enforce invite acceptance gate before prebattle
- [x] Enforce all-ready before start
- [x] Enforce creator-selected winners at active battle end
- [x] Enforce idempotent finalize + kill aggregation

3. Realtime integration
- [x] Channel auth for battle participants
- [x] Event emission on lifecycle updates
- [x] Frontend subscription helper

4. Prebattle UI
- [x] Start battle dialog integration on campaign overview
- [x] Mobile-first prebattle layout
- [x] Participant rosters and tabs
- [x] Persisted unit selection + temp stat edits
- [x] Invite acceptance + waiting state
- [x] Cancel/rejoin handling

5. Active/Postbattle UI
- [x] Build active page (kills/deaths/items, reconnect flow)
- [x] Build streamlined active unit cards (name/type + OOA + kill actions + expand)
- [x] Build postbattle page (exploration + death rolls + XP + hero injuries + finalize)
- [x] Wire config persistence reuse from prebattle into active edits

6. Hardening
- [ ] Add reconnect integration tests across all phases
- [ ] Add stronger validation for gameplay event payloads
- [x] Add overview CTA for open battle rejoin/status
- [x] Exploration rewritten to local-only postbattle editing. Dice count defaults to heroes not OOA plus winner bonus, is editable up to 10, supports one-time roll-all per mount, individual rerolls/manual edits, and only submits the flat final dice array on finalise.
- [x] Add option to submit a battle result without a pre/active/post battle. This now uses `flow_type=reported_result`, approval notifications, `battle_participant` proof rows, and the normal `battle:complete` warband log payload on unanimous approval.
- [ ] 

## Active Battle Cards Plan (Detailed)
This section is the approved build plan for the next step.
Progress (2026-03-22):
- Backend: added `unit_information_json`, `unit-ooa` and `unit-kill` endpoints, and new unit event types.
- Frontend: active roster now renders dedicated active unit cards with OOA and kill dialog wiring.
- Remaining: postbattle UI and final flow polish.

### Goal
Build a streamlined active-battle card surface where each unit can:
- be marked Out of Action (`OOA`) with a reversible overlay state
- record kills through a kill dialog
- keep compact card UI with an expand control for extra details 

### Clarification: `selected_unit_keys_json`
`selected_unit_keys_json` is the per-participant list of unit keys that were brought into this battle.
It is currently used for:
- prebattle include/exclude selection
- deciding which units are treated as participating in battle mode

It should remain for now. It solves “who is in this battle” cleanly and avoids recomputing from events.

### Data Shape Proposal
Current `stat_overrides_json` is too narrow for active combat state.

Proposed replacement:
- add `unit_information_json` on `battle_participant`
- keep `selected_unit_keys_json`
- keep `custom_units_json`

Proposed `unit_information_json` shape:
```json
{
  "hero:12": {
    "stats_override": { "weapon_skill": 4, "armour_save": "6+" },
    "stats_reason": "Injury",
    "out_of_action": false,
    "kill_count": 0
  },
  "henchman:88": {
    "out_of_action": true,
    "kill_count": 1
  }
}
```

Notes:
- This keeps battle-scoped mutable unit state in one place.
- `kill_count` here is for live UI state; authoritative timeline stays in `battle_event`.
- We can migrate `stat_overrides_json` data into `unit_information_json` and deprecate `stat_overrides_json`.

### Event Model Additions
Add active-combat focused events:
- `unit_ooa_set`
- `unit_ooa_unset`
- `unit_kill_recorded`

`unit_kill_recorded` payload:
```json
{
  "killer": { "unit_key": "hero:12", "unit_type": "hero", "unit_id": 12, "warband_id": 5 },
  "victim": { "unit_key": "henchman:88", "unit_type": "henchman", "unit_id": 88, "warband_id": 8 },
  "earned_xp": true
}
```

### API Changes (Transactional)
Use dedicated endpoints so DB updates + event append happen atomically.

Add:
- `POST /api/campaigns/:campaign_id/battles/:battle_id/unit-ooa/`
  - body: `{ unit_key, out_of_action }`
  - updates `battle_participant.unit_information_json[unit_key].out_of_action`
  - appends `unit_ooa_set` or `unit_ooa_unset`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/unit-kill/`
  - body: `{ killer_unit_key, victim_unit_key, earned_xp }`
  - increments `kill_count` for killer in `unit_information_json`
  - appends `unit_kill_recorded`

Validation requirements:
- unit belongs to selected/battle-participating units
- unit is not OOA when recording kill
- victim selectable from all battle participants’ units

### Frontend Build Plan
1. Shared unit list utility
- Add util to flatten all participant units into searchable options.
- Include henchman member names (not group names).

2. New `ActiveUnitCard` component
- Surface is two sections + bottom expand button.
- Header section:
- left: unit name + type
- right: skull icon + fight icon + kill number
- OOA interaction:
- skull click sets OOA
- card darkens, shows centered large `skull2`
- only centered `skull2` is clickable to clear OOA
- all other interactions disabled while OOA

3. Kill dialog
- Searchable unit dropdown of all battle unit names
- `earned_xp` checkbox (default checked)
- save/cancel actions
- save triggers `unit-kill` endpoint

4. Active page integration
- Replace placeholder content with active cards grouped by section
- Keep existing mobile top bar (warband + section + dice)
- Keep existing mobile bottom bar (leave + finish + creator cancel)

5. Realtime update path
- On `battle.event` for new unit events, refresh battle state (or apply optimistic patch + reconcile)

### Acceptance Criteria
- No prebattle checkbox in active cards.
- OOA state visibly disables card and is reversible.
- Kill recording works with searchable victim list across warbands.
- Non-editable participant cards do not show edit/use actions.
- Unit OOA/kill state persists through refresh/rejoin.
- Wounds can be adjusted inline on active cards without opening a dialog.
- Expanded active card details allow general stat edits with reason persistence.

## Runbook
### Backend checks
```bash
cd backend
..\.venv\Scripts\python manage.py check
..\.venv\Scripts\python manage.py makemigrations --check
```

### Frontend checks
```bash
cd frontend
npm run build
```

### Known issue
- Full Django test run currently fails in existing spell migration state with duplicate `spell.roll` column.
- This is pre-existing and unrelated to battle-mode changes.
