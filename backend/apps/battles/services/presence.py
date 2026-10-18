"""When each player was last seen in a battle, written by reads at most once a minute (PERF-35).

Writes no longer touch presence; a read writes it only when the last one is older than a minute, so reading a
battle stays a read nearly every time and never waits behind a battle lock to update it.
"""

from django.utils import timezone

from ..models import BattleParticipant

PRESENCE_REFRESH_SECONDS = 60


def mark_participant_seen(participant: BattleParticipant) -> None:
    now = timezone.now()
    last_seen = participant.last_seen_at
    if (
        participant.connection_state == BattleParticipant.CONNECTION_ONLINE
        and last_seen is not None
        and (now - last_seen).total_seconds() < PRESENCE_REFRESH_SECONDS
    ):
        return
    BattleParticipant.objects.filter(id=participant.id).update(
        connection_state=BattleParticipant.CONNECTION_ONLINE, last_seen_at=now
    )
