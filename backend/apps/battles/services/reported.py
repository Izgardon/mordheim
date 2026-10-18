"""Reported results: a battle played away from the app, reported by one player and approved by the others (BUG-46).

It ends when every other player approves it, recording wins and losses (none for "No winner") and each warband's
battle log, and is cancelled when one declines or the submitter withdraws it.
"""

from apps.logs.utils import log_warband_event

from ..models import Battle, BattleParticipant
from .lifecycle import battle_result_log, record_wins_and_losses


def everyone_approved(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return (
        participants.exists()
        and not participants.exclude(status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED).exists()
    )


def commit_reported_result(battle: Battle) -> None:
    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status=BattleParticipant.STATUS_REPORTED_RESULT_DECLINED)
        .order_by("id")
    )
    record_wins_and_losses(battle)  # none when nobody won (decision 8)
    for participant in participants:
        log_warband_event(participant.warband_id, "battle", "complete", battle_result_log(battle, participant))
