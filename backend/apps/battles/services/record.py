"""Editing an ended battle's record (decision 3, BATL-NEW-04), behind `manage_battles`.

A battle manager can correct the scenario name and link, the date, the participants (and their declared ratings)
and the winners and losers. These edits change only that battle's record: the warbands' win and loss counters, XP,
gold, kills and pivotal moments are not recalculated. A participant taken off the record is kept, marked
`removed_from_record` (and drops out of the winners); a warband added afterwards joins with nothing applied
(`skipped_postbattle`). Each edit is a `battle_record_edited` event naming the editor, with each changed field's
before and after.
"""

from django.utils import timezone

from apps.users.names import display_name
from apps.warbands.models import Warband

from ..models import Battle, BattleEvent, BattleParticipant
from ..validation.record import KEEP, RecordEdit
from .errors import field_error
from .events import append_event
from .finishing import check_sides
from .locks import locked
from .reported import start_of


def in_record(participants) -> list[BattleParticipant]:
    """The participants the record counts: still in the battle and not taken off it."""
    return [
        entry
        for entry in participants
        if entry.status not in BattleParticipant.LEFT_STATUSES and not entry.removed_from_record
    ]


def _date(battle: Battle) -> str | None:
    return timezone.localdate(battle.ended_at).isoformat() if battle.ended_at else None


def record_payload(battle: Battle, participants: list[BattleParticipant]) -> dict:
    """The record as the Edit dialog shows it (participants with their warbands and users)."""
    playing = [entry for entry in participants if entry.status not in BattleParticipant.LEFT_STATUSES]
    winners = list(battle.winner_warband_ids_json or [])
    counted = in_record(participants)
    return {
        "battle_id": battle.id,
        "flow_type": battle.flow_type,
        "scenario": battle.scenario,
        "scenario_link": battle.scenario_link,
        "date": _date(battle),
        "participants": [
            {
                "warband_id": entry.warband_id,
                "warband_name": entry.warband.name,
                "user_id": entry.user_id,
                "user_label": display_name(entry.user),
                "declared_rating": entry.declared_rating,
                "removed": entry.removed_from_record,
            }
            for entry in playing
        ],
        "winner_warband_ids": winners,
        "loser_warband_ids": [entry.warband_id for entry in counted if entry.warband_id not in winners]
        if winners
        else [],
    }


def record_participants(battle: Battle, *, lock: bool = False) -> list[BattleParticipant]:
    rows = BattleParticipant.objects.select_related("user", "warband").filter(battle_id=battle.id).order_by("id")
    return list(locked(rows) if lock else rows)


def _change(changes: dict, name: str, before, after) -> bool:
    if before == after:
        return False
    changes[name] = {"before": before, "after": after}
    return True


def _edit_battle_fields(battle: Battle, edit: RecordEdit, changes: dict) -> list[str]:
    fields = []
    if "scenario" in edit.sent and _change(changes, "scenario", battle.scenario, edit.scenario):
        battle.scenario = edit.scenario
        fields.append("scenario")
    if "scenario_link" in edit.sent and _change(changes, "scenario_link", battle.scenario_link, edit.scenario_link):
        battle.scenario_link = edit.scenario_link
        fields.append("scenario_link")
    if "date" in edit.sent and edit.battle_date is not None:
        if _change(changes, "date", _date(battle), edit.battle_date.isoformat()):
            battle.ended_at = start_of(edit.battle_date)
            fields.append("ended_at")
    return fields


def _added(battle: Battle, participants: list[BattleParticipant], warband_ids: list[int], actor):
    """New participants for warbands added to the record: members' warbands of the campaign, one per player."""
    warbands = {
        warband.id: warband
        for warband in Warband.objects.filter(campaign_id=battle.campaign_id, id__in=warband_ids, user__isnull=False)
    }
    if set(warbands) != set(warband_ids):
        raise field_error("participants", "participants must be warbands of this campaign", "Pick this campaign's.")
    playing_users = {entry.user_id for entry in participants}
    if any(warband.user_id in playing_users for warband in warbands.values()):
        raise field_error("participants", "A player has another warband in this battle", "One warband per player.")
    now = timezone.now()
    return [
        BattleParticipant(
            battle=battle,
            user_id=warband.user_id,
            warband=warband,
            status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            skipped_postbattle=True,  # nothing was applied for him
            invited_by_user=actor,
            invited_at=now,
            confirmed_at=now,
        )
        for warband in warbands.values()
    ]


def _edit_participants(battle: Battle, participants: list[BattleParticipant], edit: RecordEdit, actor, changes: dict):
    wanted = edit.participants
    before_ids = sorted(entry.warband_id for entry in in_record(participants))
    ratings_before = {str(entry.warband_id): entry.declared_rating for entry in in_record(participants)}
    present = {entry.warband_id for entry in participants}
    added = _added(battle, participants, [warband_id for warband_id in wanted if warband_id not in present], actor)
    changed: list[BattleParticipant] = []
    for entry in participants:
        listed = entry.warband_id in wanted
        rating = wanted.get(entry.warband_id, KEEP)
        if listed and (entry.removed_from_record or entry.status in BattleParticipant.LEFT_STATUSES):
            entry.removed_from_record = False
            if entry.status in BattleParticipant.LEFT_STATUSES:  # he played after all; nothing applied
                entry.status, entry.skipped_postbattle = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE, True
            changed.append(entry)
        elif not listed and not entry.removed_from_record and entry.status not in BattleParticipant.LEFT_STATUSES:
            entry.removed_from_record = True
            changed.append(entry)
        if listed and rating is not KEEP and rating != entry.declared_rating:
            entry.declared_rating = rating  # type: ignore[assignment]
            changed.append(entry)
    for entry in added:
        rating = wanted[entry.warband_id]
        entry.declared_rating = None if rating is KEEP else rating
    now = timezone.now()
    for entry in changed:
        entry.updated_at = now
    fields = ["removed_from_record", "status", "skipped_postbattle", "declared_rating", "updated_at"]
    BattleParticipant.objects.bulk_update(list(dict.fromkeys(changed)), fields)
    BattleParticipant.objects.bulk_create(added)
    participants += added
    _change(changes, "participants", before_ids, sorted(entry.warband_id for entry in in_record(participants)))
    ratings_after = {str(entry.warband_id): entry.declared_rating for entry in in_record(participants)}
    _change(changes, "declared_ratings", ratings_before, ratings_after)


def _edit_results(battle: Battle, participants: list[BattleParticipant], edit: RecordEdit, changes: dict) -> bool:
    counted = in_record(participants)
    if edit.results is not None:
        check_sides(counted, edit.results)
        winners = edit.results.winners
    else:  # a warband taken off the record leaves the winners
        record_ids = {entry.warband_id for entry in counted}
        winners = [warband_id for warband_id in battle.winner_warband_ids_json or [] if warband_id in record_ids]
    if not _change(changes, "winner_warband_ids", list(battle.winner_warband_ids_json or []), winners):
        return False
    battle.winner_warband_ids_json = winners
    return True


def edit_record(battle: Battle, edit: RecordEdit, actor) -> tuple[list[dict], list[BattleParticipant]]:
    """Apply the edit to the ended battle (locked) and its participants; returns the event (none when nothing
    changed) and the participants as they now stand. Nothing outside the battle's record is recalculated."""
    participants = record_participants(battle, lock=True)
    changes: dict = {}
    fields = _edit_battle_fields(battle, edit, changes)
    if "participants" in edit.sent:
        _edit_participants(battle, participants, edit, actor, changes)
    if _edit_results(battle, participants, edit, changes):
        fields.append("winner_warband_ids_json")
    if not changes:
        return [], participants
    battle.save(update_fields=[*fields, "updated_at"])
    payload = {"edited_by_user_id": actor.id, "changes": changes}
    return [
        append_event(battle, BattleEvent.TYPE_BATTLE_RECORD_EDITED, actor_user=actor, payload=payload)
    ], participants
