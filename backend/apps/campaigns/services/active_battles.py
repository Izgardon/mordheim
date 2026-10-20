"""Settings > Active Battles: the campaign's open battles for battle managers, and cancelling one of them.

Both need `manage_battles` (owners and admins hold it; it can be granted, BATL-NEW-04). The list settles overdue
battles first (pass 3, decision 2); a cancel takes the battle row's lock first, as every battle write does (BUG-106).
"""

from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from django.db.models import Prefetch

from apps.battles.models import Battle, BattleParticipant
from apps.battles.serializers import serialize_battle, serialize_participant
from apps.battles.services.broadcast import bump_state_version
from apps.battles.services.capabilities import manager_actions
from apps.battles.services.expiry import expire_overdue
from apps.battles.services.lifecycle import POSTBATTLE_APPLIED, cancel_battle, someone_finalised
from apps.battles.services.locks import locked

from ..errors import Refused
from .removal_battles import OPEN_STATUSES


def listing(campaign_id: int) -> list[dict[str, Any]]:
    """Each open battle, newest first, with its participants and the manager tools that apply."""
    participants = BattleParticipant.objects.select_related("user", "warband").order_by("id")
    battles = (
        Battle.objects.filter(campaign_id=campaign_id, status__in=OPEN_STATUSES)
        .prefetch_related(Prefetch("participants", queryset=participants))
        .order_by("-created_at", "-id")
    )
    if expire_overdue(battles):  # settle what is past its deadline (decision 2), then read again
        battles = battles.all()
    return [_active_battle(battle) for battle in battles]


def _active_battle(battle: Battle) -> dict[str, Any]:
    participants = battle.participants.all()
    return {
        "battle": serialize_battle(battle),  # its last_activity_at is the idle time
        "participants": [serialize_participant(participant) for participant in participants],
        "actions": manager_actions(battle, participants),  # the owner tools that apply (BATL-NEW-03)
    }


@dataclass
class Cancelled:
    """The cancel's outcome: its events and the battle's new state_version (None: it was already cancelled)."""

    battle_id: int
    events: list[dict] = field(default_factory=list)
    version: int | None = None


def cancel(campaign_id: int, battle_id: int, actor_user: Any, mode: str) -> Cancelled:
    """Cancel the open battle for everyone; Refused once it has ended, in postbattle, or after someone applied his
    postbattle (decisions 3 and 4, BUG-09)."""
    with transaction.atomic():
        battle = locked(Battle.objects.filter(id=battle_id, campaign_id=campaign_id)).first()
        if not battle:
            raise Refused("Not found", status=404)
        if battle.status == Battle.STATUS_CANCELED:
            return Cancelled(battle.id)
        if battle.status == Battle.STATUS_ENDED:
            raise Refused("Battle is already ended")
        if battle.status == Battle.STATUS_POSTBATTLE:  # decision 3, BUG-09
            raise Refused("Postbattle can't be cancelled; close it instead", code="use_close_postbattle")
        if battle.status == Battle.STATUS_ACTIVE and someone_finalised(battle.id):  # decision 4, BUG-09
            raise Refused(POSTBATTLE_APPLIED, code="postbattle_applied")
        event = cancel_battle(battle, actor_user=actor_user, mode=mode)
        return Cancelled(battle.id, [event], bump_state_version(battle))
