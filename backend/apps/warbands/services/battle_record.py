"""A warband's record window (William, 22 Nov 2026: "record (list of those battles with who they won or lost
against)"): its last ten ended battles, newest first, each with its number, scenario, date, the other warbands in it
and how it went for this one, in two queries.

The battles are the ones its wins and losses count (`lifecycle.record_wins_and_losses`): ended, with this warband
still in them and on the record. A battle nobody won is "no_winner", which records neither.
"""

from typing import Any

from django.db.models import Prefetch

from apps.battles.models import Battle, BattleParticipant
from apps.warbands.models import Warband

RECORD_LENGTH = 10
WON, LOST, NO_WINNER = "won", "lost", "no_winner"


def _on_record() -> Any:
    rows = BattleParticipant.objects.filter(removed_from_record=False)
    return rows.exclude(status__in=BattleParticipant.LEFT_STATUSES)


def _result(warband_id: int, winners: set[int]) -> str:
    if not winners:
        return NO_WINNER
    return WON if warband_id in winners else LOST


def warband_record(warband: Warband) -> list[dict[str, Any]]:
    """The warband's last `RECORD_LENGTH` ended battles, newest first."""
    played = _on_record().filter(warband_id=warband.id).values("battle_id")
    others = _on_record().exclude(warband_id=warband.id).select_related("warband").order_by("id")
    battles = (
        Battle.objects.filter(id__in=played, status=Battle.STATUS_ENDED)
        .only("id", "number", "scenario", "ended_at", "created_at", "winner_warband_ids_json")
        .prefetch_related(Prefetch("participants", queryset=others, to_attr="opponents"))
        .order_by("-ended_at", "-created_at", "-id")[:RECORD_LENGTH]
    )
    record = []
    for battle in battles:
        winners = set(battle.winner_warband_ids_json or [])
        record.append(
            {
                "id": battle.id,
                "number": battle.number,
                "scenario": battle.scenario,
                "date": (battle.ended_at or battle.created_at).isoformat(),
                "result": _result(warband.id, winners),
                "opponents": [
                    {"id": row.warband_id, "name": row.warband.name, "won": row.warband_id in winners}
                    for row in battle.opponents
                ],
            }
        )
    return record
