"""What the reader of a battle may do now, so the pages never offer an action the server refuses.

Each flag is the server's own rule for that action, in the battle's current phase:

- `start`: any participant still in the battle, in prebattle, once everyone still in is ready (decision 4);
- `finish_mine`: a participant still fighting, in an active battle (decision 4: there is no End button);
- `confirm_results`: the last player to finish, or a battle manager, in postbattle (until the battle ends);
- `cancel`: the creator, before postbattle (postbattle is closed instead, decision 3), and only while nobody has
  applied his postbattle;
- `close_postbattle`: the creator or a battle manager (`manage_battles`), in postbattle;
- `edit_record`: a battle manager, once the battle has ended (BATL-NEW-04).

A reported result has only `edit_record`, once it has ended. Computing the flags costs no query: the membership
and the manage_battles grant come with the battle (services/access.py) and the participants with the snapshot.

`manager_actions` are the tools Settings > Active Battles offers a battle manager for each battle (BATL-NEW-03).
"""

from collections.abc import Iterable

from ..models import Battle, BattleParticipant
from .access import manages_battles


def _everyone_ready(participants: Iterable[BattleParticipant]) -> bool:
    still_in = [entry for entry in participants if entry.status not in BattleParticipant.LEFT_STATUSES]
    return bool(still_in) and all(entry.status == BattleParticipant.STATUS_READY for entry in still_in)


def capabilities(battle: Battle, user_id: int, participants: Iterable[BattleParticipant]) -> dict[str, bool]:
    participants = list(participants)
    creator = battle.created_by_user_id == user_id
    normal = battle.flow_type == Battle.FLOW_TYPE_NORMAL
    manager = manages_battles(battle)
    creates = creator and normal
    mine = next((entry for entry in participants if entry.user_id == user_id), None)
    still_in = mine is not None and mine.status not in BattleParticipant.LEFT_STATUSES
    fighting = mine is not None and mine.status == BattleParticipant.STATUS_IN_BATTLE
    confirmer = battle.results_confirmer_id == user_id
    applied = any(entry.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE for entry in participants)
    before_postbattle = (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE)
    return {
        "start": still_in and normal and battle.status == Battle.STATUS_PREBATTLE and _everyone_ready(participants),
        "finish_mine": normal and fighting and battle.status == Battle.STATUS_ACTIVE,
        "confirm_results": normal and (confirmer or manager) and battle.status == Battle.STATUS_POSTBATTLE,
        "cancel": creates and battle.status in before_postbattle and not applied,
        "close_postbattle": (creator or manager) and battle.status == Battle.STATUS_POSTBATTLE,
        "edit_record": manager and battle.status == Battle.STATUS_ENDED,
    }


def manager_actions(battle: Battle, participants: Iterable[BattleParticipant]) -> dict[str, bool]:
    """Settings > Active Battles, for a battle manager (BATL-NEW-03): end a stuck fight with its results
    (`finish/`), confirm the results of a postbattle (`results/`), close a postbattle, or cancel the battle before
    postbattle while nobody has applied his postbattle (`active-battles/:id/cancel/`)."""
    normal = battle.flow_type == Battle.FLOW_TYPE_NORMAL
    applied = any(entry.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE for entry in participants)
    cancellable = (
        Battle.STATUS_INVITING,
        Battle.STATUS_REPORTED_RESULT_PENDING,
        Battle.STATUS_PREBATTLE,
        Battle.STATUS_ACTIVE,
    )
    return {
        "end": normal and battle.status == Battle.STATUS_ACTIVE,
        "confirm_results": normal and battle.status == Battle.STATUS_POSTBATTLE,
        "close_postbattle": battle.status == Battle.STATUS_POSTBATTLE,
        "cancel": battle.status in cancellable and not applied,
    }
