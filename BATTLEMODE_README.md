# Battle Mode Build Guide (Editable)

This file is the working implementation plan for battle mode.
Edit this file when rules or priorities change.
Future sessions should read this first.

## Current Status
- Last updated: 2026-02-21
- Scope complete: Battle create flow + invite acceptance gate + prebattle UI + participant config persistence
- Next focus: Active battle page + postbattle page

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
12. Last finisher declares winner in postbattle.
13. Battle ends only after winner declared and all participants confirm.
14. Kill totals are aggregated once on finalize and written to unit kills.
15. Custom units can emit battle events but are not attributed in permanent kill aggregation.

## Data Model
### `battle`
- `id`
- `campaign_id`
- `created_by_user_id`
- `title` (new)
- `scenario`
- `status` = `inviting|prebattle|active|postbattle|ended|canceled`
- `winner_warband_id`
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
- `status` = `invited|accepted|joined_prebattle|ready|canceled_prebattle|in_battle|finished_battle|confirmed_postbattle`
- `connection_state` = `online|offline`
- `declared_rating` (new)
- `selected_unit_keys_json` (new)
- `stat_overrides_json` (new)
- `custom_units_json` (new; temporary units for this battle only)
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
- `winner_declared`
- `participant_confirmed_postbattle`
- `battle_ended`
- `battle_canceled`

## API (Implemented)
- `GET /api/campaigns/:campaign_id/battles/`
- `POST /api/campaigns/:campaign_id/battles/`
- `GET /api/campaigns/:campaign_id/battles/:battle_id/state/?sinceEventId=:id`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/join/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/config/` (persist selection + temp stats)
- `POST /api/campaigns/:campaign_id/battles/:battle_id/ready/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/cancel/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/cancel-battle/` (creator-only hard cancel)
- `POST /api/campaigns/:campaign_id/battles/:battle_id/start/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/events/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/finish/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/winner/`
- `POST /api/campaigns/:campaign_id/battles/:battle_id/confirm/`

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
- [x] Create/list/state/join/ready/cancel/start/events/finish/winner/confirm
- [x] Enforce invite acceptance gate before prebattle
- [x] Enforce all-ready before start
- [x] Enforce winner by last finisher
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
- [ ] Build active page (kills/deaths/items, reconnect flow)
- [ ] Build postbattle page (winner + confirms)
- [ ] Wire config persistence reuse from prebattle into active edits

6. Hardening
- [ ] Add reconnect integration tests across all phases
- [ ] Add stronger validation for gameplay event payloads
- [x] Add overview CTA for open battle rejoin/status
- [ ] Add full open-battle list UI if multiple concurrent battles are allowed

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
