"""How a battle moves between phases and how its result is recorded (decision 3, BUG-09).

Wins and losses count once, when the battle ends: when the last player finishes postbattle, or postbattle is closed
(by a player with the right, or when its deadline passes). The end (`end_battle`) runs under the battle lock with
its status as the guard, so it runs once per battle; PR C's automatic end (decision 4) calls the same function.
"""

from dataclasses import dataclass

from django.db.models import Count, F, Q, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notifications_for_reference
from apps.warbands.models import Hero, Warband

from ..models import Battle, BattleEvent, BattleParticipant
from .events import append_event, notify_result_updated


@dataclass(frozen=True)
class Headcount:
    """The participants still in a battle (not declined or cancelled), and how many have accepted or are ready."""

    total: int
    accepted: int
    ready: int


def participants_all_in(battle_id: int) -> Headcount:
    """One aggregate; declined and cancelled rows don't count (BUG-45: a cancelled row blocked start for ever)."""
    counts = (
        BattleParticipant.objects.filter(battle_id=battle_id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .aggregate(
            total=Count("id"),
            accepted=Count("id", filter=Q(status__in=BattleParticipant.ACCEPTED_STATUSES)),
            ready=Count("id", filter=Q(status=BattleParticipant.STATUS_READY)),
        )
    )
    return Headcount(total=counts["total"], accepted=counts["accepted"], ready=counts["ready"])


def everyone_ready(battle_id: int) -> bool:
    headcount = participants_all_in(battle_id)
    return headcount.total > 0 and headcount.ready == headcount.total


def everyone_accepted(battle_id: int) -> bool:
    headcount = participants_all_in(battle_id)
    return headcount.total > 0 and headcount.accepted == headcount.total


def everyone_confirmed(battle_id: int) -> bool:
    """Every participant still in the battle has finished postbattle (finalised or skipped)."""
    participants = BattleParticipant.objects.filter(battle_id=battle_id).exclude(
        status__in=BattleParticipant.LEFT_STATUSES
    )
    return (
        participants.exists()
        and not participants.exclude(status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE).exists()
    )


def record_wins_and_losses(battle: Battle) -> None:
    """A win for each winning warband still in the battle and a loss for every other one; nothing at all when
    nobody won ("No winner", decision 8)."""
    winner_ids = set(battle.winner_warband_ids_json or [])
    if not winner_ids:
        return
    warband_ids = set(
        BattleParticipant.objects.filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .values_list("warband_id", flat=True)
    )
    winners, losers = warband_ids & winner_ids, warband_ids - winner_ids
    if winners:
        Warband.objects.filter(id__in=winners).update(wins=Coalesce(F("wins"), Value(0)) + 1)
    if losers:
        Warband.objects.filter(id__in=losers).update(losses=Coalesce(F("losses"), Value(0)) + 1)


def end_battle(battle: Battle, actor_user, events: list[dict], **ended: object) -> None:
    """End the battle (the battle is locked; its status guards against a second end): wins and losses recorded
    once (decision 3), the battle_ended event (with `ended`, e.g. who closed postbattle) and pivotal moments."""
    if battle.status == Battle.STATUS_ENDED:
        return
    now = timezone.now()
    if not battle.post_processed_at:
        battle.post_processed_at = now
    battle.status = Battle.STATUS_ENDED
    battle.ended_at = battle.ended_at or now
    battle.save(update_fields=["status", "ended_at", "post_processed_at", "updated_at"])
    payload = {"winner_warband_ids": battle.winner_warband_ids_json or [], **ended}
    events.append(append_event(battle, BattleEvent.TYPE_BATTLE_ENDED, actor_user=actor_user, payload=payload))
    record_wins_and_losses(battle)
    # trading actions were reset at End battle, once (BUG-122)
    from apps.campaigns.pivotal_moments import generate_pivotal_moments_for_battle

    generate_pivotal_moments_for_battle(battle)


def _cancel_rows(battle: Battle, participants: list[BattleParticipant], now) -> None:
    for entry in participants:
        # a finished postbattle is a record, never rewritten (BUG-09; cancels refuse postbattle anyway)
        if entry.status in (*BattleParticipant.LEFT_STATUSES, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE):
            continue
        entry.status = BattleParticipant.STATUS_CANCELED_PREBATTLE
        entry.canceled_at = entry.canceled_at or now
        entry.responded_at = entry.responded_at or now
        entry.save(update_fields=["status", "canceled_at", "responded_at", "updated_at"])
    resolve_notifications_for_reference(Notification.TYPE_BATTLE_INVITE, str(battle.id))


def _decline_reported_rows(battle: Battle, participants: list[BattleParticipant], now) -> None:
    for entry in participants:
        update_fields = []
        if entry.status != BattleParticipant.STATUS_REPORTED_RESULT_DECLINED:
            entry.status = BattleParticipant.STATUS_REPORTED_RESULT_DECLINED
            update_fields.append("status")
        if entry.responded_at is None:
            entry.responded_at = now
            update_fields.append("responded_at")
        if update_fields:
            entry.save(update_fields=[*update_fields, "updated_at"])
    resolve_notifications_for_reference(Notification.TYPE_BATTLE_RESULT_REQUEST, str(battle.id))
    notify_result_updated(battle, [entry.user_id for entry in participants])


def cancel_battle(battle: Battle, *, actor_user, mode: str) -> dict:
    """Cancel the battle (locked) for everyone still in it and return its battle_canceled event. A reported result
    is declined for everyone instead, and every player is told."""
    now = timezone.now()
    battle.status = Battle.STATUS_CANCELED
    battle.ended_at = battle.ended_at or now
    battle.save(update_fields=["status", "ended_at", "updated_at"])
    participants = list(BattleParticipant.objects.select_for_update().filter(battle_id=battle.id))
    if battle.flow_type == Battle.FLOW_TYPE_NORMAL:
        _cancel_rows(battle, participants, now)
    else:
        _decline_reported_rows(battle, participants, now)
    payload = {"canceled_by_user_id": actor_user.id if actor_user else None, "mode": mode}
    return append_event(battle, BattleEvent.TYPE_BATTLE_CANCELED, actor_user=actor_user, payload=payload)


def _is_most_recent_for_warband(battle: Battle, warband_id: int) -> bool:
    latest_battle_id = (
        Battle.objects.filter(participants__warband_id=warband_id, status=Battle.STATUS_ENDED, ended_at__isnull=False)
        .distinct()
        .order_by("-ended_at", "-created_at", "-id")
        .values_list("id", flat=True)
        .first()
    )
    return latest_battle_id == battle.id


def reset_trading_actions(battle: Battle, *, only_if_most_recent: bool = False) -> None:
    """Give every hero of the battle's warbands his trading action back (at End battle, once: BUG-122)."""
    warband_ids = list(
        BattleParticipant.objects.filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .values_list("warband_id", flat=True)
    )
    for warband_id in dict.fromkeys(warband_ids):
        if only_if_most_recent and not _is_most_recent_for_warband(battle, warband_id):
            continue
        Hero.objects.filter(warband_id=warband_id).update(trading_action=True)


def battle_result_log(battle: Battle, participant: BattleParticipant) -> dict:
    """The participant's `battle:complete` log: won or lost, with and against whom (or "No winner")."""
    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .order_by("id")
    )
    winner_ids = set(battle.winner_warband_ids_json or [])
    participant_won = participant.warband_id in winner_ids
    others = [entry for entry in participants if entry.warband_id != participant.warband_id]
    if not winner_ids:  # "No winner" (decision 8): everyone fought everyone
        return {"result": "no_winner", "with": [], "against": [entry.warband.name for entry in others]}
    with_names = [entry.warband.name for entry in others if (entry.warband_id in winner_ids) == participant_won]
    against_names = [entry.warband.name for entry in others if (entry.warband_id in winner_ids) != participant_won]
    return {"result": "won" if participant_won else "lost", "with": with_names, "against": against_names}
