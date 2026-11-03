"""One battle at a time (William, 3 Nov 2026: "shouldnt be able to be invited or invite to a battle when in one for
real, only muliple pre battles. as soon as you accept one all other pre battles are cancelled").

- A player fighting a battle (`FIGHTING`, services/unfinished.py) can't be put in another one: a new battle with him in
  it (as its creator or an invitee) is refused, and so is his joining another (`join/`: accepting an invitation, or
  coming back to a pre-battle or a fight he left), with `player_in_battle` naming who and where. This overrides
  decision 1 for battles under way; pre-battles and post-games still only warn.
"""

from apps.users.names import display_name

from ..models import Battle, BattleParticipant
from .errors import Refused
from .unfinished import FIGHTING

PREBATTLE_STATUSES = (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE)
PLAYER_IN_BATTLE = "player_in_battle"
# `join/` puts these in the battle (an invitation, or a pre-battle or fight he left) rather than moving them on in it
ENTERING = (BattleParticipant.STATUS_INVITED, BattleParticipant.STATUS_CANCELED_PREBATTLE)


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
