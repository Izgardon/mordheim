"""One battle at a time (William, 3 Nov 2026: "shouldnt be able to be invited or invite to a battle when in one for
real, only muliple pre battles. as soon as you accept one all other pre battles are cancelled").

- A player fighting a battle (`FIGHTING`, services/unfinished.py) can't be put in another one: a new battle with him in
  it (as its creator or an invitee) is refused, and so is his joining another (`join/`: accepting an invitation, or
  coming back to a pre-battle or a fight he left), with `player_in_battle` naming who and where. This overrides
  decision 1 for battles under way; pre-battles and post-games still only warn.
- He may be in several pre-battles (`prebattle_places`) until he commits to one: he accepts its invitation (or comes
  back to one he left), or it starts, for everyone in it. That clears his others in the same transaction
  (`clear_prebattles`): a pre-battle he created is cancelled for everyone; in one he was invited to he declines (an
  invitation he hadn't answered) or leaves (one he had accepted), and `settle_after_leaving` decides whether it goes
  on without him. Each battle cleared is broadcast after commit as its own write.
- The other battles are locked with this one, in id order, before any participant row (services/locks.py): the view
  names them first (`BattleScopedView.battles_also_written`, from `other_prebattles`).
"""

from collections.abc import Collection, Iterable
from typing import Any

from django.db.models import QuerySet

from apps.users.names import display_name

from ..models import Battle, BattleParticipant
from ..serializers import battle_snapshot
from .broadcast import ALL, bump_state_version, publish
from .errors import Refused
from .expiry import settle_during_write
from .invites import decline_invitation
from .lifecycle import cancel_battle
from .locks import locked
from .prebattle import leave
from .unfinished import FIGHTING

PREBATTLE_STATUSES = (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE)
PLAYER_IN_BATTLE = "player_in_battle"
ANOTHER_BATTLE = "another_battle"  # why a pre-battle was cleared: the cancel's mode, the decline's reason
# `join/` puts these in the battle (an invitation, or a pre-battle or fight he left) rather than moving them on in it
ENTERING = (BattleParticipant.STATUS_INVITED, BattleParticipant.STATUS_CANCELED_PREBATTLE)
COMMITTED = (*BattleParticipant.ACCEPTED_STATUSES, BattleParticipant.STATUS_IN_BATTLE)


def _where(battle: Battle) -> str:
    return f"Battle {battle.number}" if battle.number else f"battle #{battle.id}"


def _fighting_message(places: list[BattleParticipant], you: int) -> str:
    """Mira is already fighting in Battle 6 ("You are", for you); with several, "Already fighting: you (Battle 6),
    Mira (Battle 7)"."""
    if len(places) == 1:
        place = places[0]
        who = "You are" if place.user_id == you else f"{display_name(place.user)} is"
        return f"{who} already fighting in {_where(place.battle)}."
    names = [("you" if place.user_id == you else display_name(place.user), _where(place.battle)) for place in places]
    return "Already fighting: " + ", ".join(f"{name} ({where})" for name, where in names) + "."


def fighting_refusal(campaign_id: int, user_ids, *, you: int, besides: int | None = None) -> Refused | None:
    """`player_in_battle` when any of these players is fighting a battle of the campaign (other than `besides`),
    naming each (`you` reads "you"); None when nobody is."""
    rows = BattleParticipant.objects.filter(FIGHTING, user_id__in=user_ids, battle__campaign_id=campaign_id)
    if besides is not None:
        rows = rows.exclude(battle_id=besides)
    places: dict[int, BattleParticipant] = {}
    for place in rows.select_related("user", "battle").order_by("user__first_name", "user__email", "battle_id"):
        places.setdefault(place.user_id, place)
    if not places:
        return None
    ordered = sorted(places.values(), key=lambda place: place.user_id != you)  # you first
    players = [
        {"user_id": entry.user_id, "battle_id": entry.battle_id, "battle_number": entry.battle.number}
        for entry in ordered
    ]
    return Refused(_fighting_message(ordered, you), code=PLAYER_IN_BATTLE, extra={"players": players})


def enters(battle: Battle, participant: BattleParticipant) -> bool:
    """Whether `join/` would put the participant in the battle, before it ends, rather than move him on in it."""
    return battle.status in (*PREBATTLE_STATUSES, Battle.STATUS_ACTIVE) and participant.status in ENTERING


def prebattle_places(campaign_id: int, user_ids, *, besides: int) -> QuerySet[BattleParticipant]:
    """The players' places in the campaign's other pre-battles: normal flow, inviting or prebattle, and not left."""
    return (
        BattleParticipant.objects.filter(
            user_id__in=user_ids,
            battle__campaign_id=campaign_id,
            battle__flow_type=Battle.FLOW_TYPE_NORMAL,
            battle__status__in=PREBATTLE_STATUSES,
        )
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .exclude(battle_id=besides)
    )


def is_prebattle_place(battle: Battle, participant: BattleParticipant) -> bool:
    """`prebattle_places`' rule, for a place already read."""
    return (
        battle.flow_type == Battle.FLOW_TYPE_NORMAL
        and battle.status in PREBATTLE_STATUSES
        and participant.status not in BattleParticipant.LEFT_STATUSES
    )


def other_prebattles(campaign_id: int, user_ids, *, besides: int) -> list[int]:
    """The players' other pre-battles, for the view to lock with `besides` (one query)."""
    rows = prebattle_places(campaign_id, user_ids, besides=besides).values_list("battle_id", flat=True)
    return sorted(set(rows))


def players_still_in(battle_id: int) -> QuerySet[BattleParticipant, Any]:
    """The user ids of the battle's players still in it, as a subquery."""
    rows = BattleParticipant.objects.filter(battle_id=battle_id).exclude(status__in=BattleParticipant.LEFT_STATUSES)
    return rows.values("user_id")


def _withdraw(battle: Battle, place: BattleParticipant) -> list[dict]:
    """Out of a pre-battle someone else created: an invitation he hadn't answered is declined, else he leaves."""
    if place.status == BattleParticipant.STATUS_INVITED:
        return decline_invitation(battle, place, actor_user=place.user, reason=ANOTHER_BATTLE)
    return leave(battle, place, place.user) or []


def _clear(battle: Battle, user_ids: Collection[int]) -> tuple[list[dict], int | None]:
    """The players out of this (locked) pre-battle: cancelled if one of them created it, else each withdrawn.
    Returns the events and who acted, or no actor when there was nothing to clear."""
    if battle.flow_type != Battle.FLOW_TYPE_NORMAL or battle.status not in PREBATTLE_STATUSES:
        return [], None
    rows = locked(BattleParticipant.objects.select_related("user").filter(battle_id=battle.id, user_id__in=user_ids))
    places = [row for row in rows.order_by("id") if row.status not in BattleParticipant.LEFT_STATUSES]
    if not places:
        return [], None
    creator = next((place for place in places if place.user_id == battle.created_by_user_id), None)
    if creator is not None:
        return [cancel_battle(battle, actor_user=creator.user, mode=ANOTHER_BATTLE)], creator.user_id
    events: list[dict] = []
    for place in places:
        if battle.status not in PREBATTLE_STATUSES:  # the last of them out cancelled it
            break
        events += _withdraw(battle, place)
    return events, places[0].user_id


def clear_prebattles(battle_ids: Collection[int], user_ids: Collection[int]) -> None:
    """The players have committed to a battle: their places in these other pre-battles (which the caller locked with
    it, before any participant row) are cleared. A battle past its deadline is settled first (decision 2)."""
    if not battle_ids or not user_ids:
        return
    for battle in Battle.objects.filter(id__in=battle_ids).order_by("id"):  # read again under the caller's lock
        settle_during_write(battle)
        events, actor_id = _clear(battle, user_ids)
        if actor_id is None:
            continue
        version = bump_state_version(battle)
        snapshot = battle_snapshot(battle.id)
        reason = "participant_canceled_prebattle"
        publish(snapshot, events, version=version, changed=ALL, reason=reason, actor_user_id=actor_id, socket_id=None)


def accepting_clears(battles: Iterable[Battle], user_id: int) -> dict[int, list[dict]]:
    """For each of these battles (read with their participants) holding the user's invitation, what accepting it
    clears: his other pre-battles among them, `cancel` for one he created and `withdraw` for the rest."""
    places = []
    for battle in battles:
        mine = next((entry for entry in battle.participants.all() if entry.user_id == user_id), None)
        if mine is not None and is_prebattle_place(battle, mine):
            places.append((battle, mine))
    return {
        battle.id: [
            {"battle_id": other.id, "outcome": "cancel" if other.created_by_user_id == user_id else "withdraw"}
            for other, _ in places
            if other.id != battle.id
        ]
        for battle, mine in places
        if battle.status == Battle.STATUS_INVITING and mine.status == BattleParticipant.STATUS_INVITED
    }
