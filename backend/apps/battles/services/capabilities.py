"""What the reader of a battle may do now, so the pages never offer an action the server refuses.

Each flag is the server's own rule for that action, in the battle's current phase:

- `start`: the creator, in prebattle, once everyone still in is ready (decision 4 opens it to every player: PR C);
- `end`: the creator, in an active battle (decision 4 replaces it with each player's Finish: PR C);
- `cancel`: the creator, before postbattle (postbattle is closed instead, decision 3);
- `close_postbattle`: the creator or a battle manager (`manage_battles`), in postbattle;
- `edit_record`: a battle manager, once the battle has ended (BATL-NEW-04's record edit lands in PR C).

A reported result has only `edit_record`, once it has ended. Computing the flags costs no query: the membership
and the manage_battles grant come with the battle (services/access.py) and the participants with the snapshot.
"""

from collections.abc import Iterable

from ..models import Battle, BattleParticipant
from .access import manages_battles


def _everyone_ready(participants: Iterable[BattleParticipant]) -> bool:
    still_in = [entry for entry in participants if entry.status not in BattleParticipant.LEFT_STATUSES]
    return bool(still_in) and all(entry.status == BattleParticipant.STATUS_READY for entry in still_in)


def capabilities(battle: Battle, user_id: int, participants: Iterable[BattleParticipant]) -> dict[str, bool]:
    creator = battle.created_by_user_id == user_id
    normal = battle.flow_type == Battle.FLOW_TYPE_NORMAL
    manager = manages_battles(battle)
    creates = creator and normal
    return {
        "start": creates and battle.status == Battle.STATUS_PREBATTLE and _everyone_ready(participants),
        "end": creates and battle.status == Battle.STATUS_ACTIVE,
        "cancel": creates and battle.status in (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE),
        "close_postbattle": (creator or manager) and battle.status == Battle.STATUS_POSTBATTLE,
        "edit_record": manager and battle.status == Battle.STATUS_ENDED,
    }
