"""What the reader of a battle may do now, so the pages never offer an action the server refuses.

Each flag is the server's own rule for that action, in the battle's current phase:

- `start`: any participant still in the battle, in prebattle, once everyone still in is ready (decision 4);
- `finish_mine`: a participant still fighting, in an active battle (decision 4: there is no End button);
- `confirm_results`: the last player to finish, or a battle manager, in postbattle (until the battle ends);
- `cancel`: the creator, before postbattle (postbattle is closed instead, decision 3), and only while nobody has
  applied his postbattle;
- `close_postbattle`: the creator or a battle manager (`manage_battles`), in postbattle;
- `edit_record`: a battle manager, once the battle has ended (BATL-NEW-04);
- `nudge`: a participant still in an open battle (BATL-NEW-08), towards any other who still has something to do
  in it (his status isn't confirmed_postbattle, declined or cancelled).

A reported result has only `edit_record`, once it has ended. Computing the flags costs no query: the membership
and the manage_battles grant come with the battle (services/access.py) and the participants with the snapshot. The
state, every write's answer (the caller's flags) and every broadcast (`everyones_capabilities`) carry them, so a
status change costs no read.

`manager_actions` are the tools Settings > Active Battles offers a battle manager for each battle (BATL-NEW-03).
"""

from collections.abc import Iterable
from dataclasses import dataclass

from ..models import Battle, BattleParticipant
from .access import manages_battles
from .unfinished import BUSY_BATTLE_STATUSES


@dataclass(frozen=True)
class Facts:
    """What the flags are worked out from: the battle's phase and people, and each participant's status."""

    status: str
    flow_type: str
    created_by_user_id: int
    results_confirmer_user_id: int | None
    statuses: dict[int, str]  # by user id


def facts(battle: Battle, participants: Iterable[BattleParticipant]) -> Facts:
    statuses = {entry.user_id: entry.status for entry in participants}
    return Facts(battle.status, battle.flow_type, battle.created_by_user_id, battle.results_confirmer_id, statuses)


def snapshot_facts(snapshot: dict) -> Facts:
    """The same facts from a battle snapshot (`{"battle", "participants"}`, every participant)."""
    battle = snapshot["battle"]
    statuses = {entry["user"]["id"]: entry["status"] for entry in snapshot["participants"]}
    return Facts(
        battle["status"],
        battle["flow_type"],
        battle["created_by_user_id"],
        battle.get("results_confirmer_user_id"),
        statuses,
    )


def capabilities_from(known: Facts, user_id: int | None, manager: bool) -> dict[str, bool]:
    left = BattleParticipant.LEFT_STATUSES
    status, normal = known.status, known.flow_type == Battle.FLOW_TYPE_NORMAL
    creator = known.created_by_user_id == user_id
    mine = known.statuses.get(user_id) if user_id is not None else None
    still_in = mine is not None and mine not in left
    playing = [entry for entry in known.statuses.values() if entry not in left]
    everyone_ready = bool(playing) and all(entry == BattleParticipant.STATUS_READY for entry in playing)
    applied = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE in known.statuses.values()
    confirmer = user_id is not None and known.results_confirmer_user_id == user_id
    before_postbattle = (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE)
    return {
        "start": still_in and normal and status == Battle.STATUS_PREBATTLE and everyone_ready,
        "finish_mine": normal and mine == BattleParticipant.STATUS_IN_BATTLE and status == Battle.STATUS_ACTIVE,
        "confirm_results": normal and (confirmer or manager) and status == Battle.STATUS_POSTBATTLE,
        "cancel": creator and normal and status in before_postbattle and not applied,
        "close_postbattle": (creator or manager) and status == Battle.STATUS_POSTBATTLE,
        "edit_record": manager and status == Battle.STATUS_ENDED,
        "nudge": still_in and normal and status in BUSY_BATTLE_STATUSES,
    }


def capabilities(battle: Battle, user_id: int, participants: Iterable[BattleParticipant]) -> dict[str, bool]:
    """The reader's flags (a battle read through scoped_battles, which carries his manage_battles grant)."""
    return capabilities_from(facts(battle, participants), user_id, manages_battles(battle))


def everyones_capabilities(snapshot: dict) -> dict:
    """For a broadcast, which reaches every player: each participant's flags as a player (`by_user`), and those
    of a battle manager who isn't playing (`manager`). A reader who holds manage_battles (the campaign payload's
    `permissions`) ORs the two; every flag only ever widens with it."""
    known = snapshot_facts(snapshot)
    return {
        "by_user": {str(user_id): capabilities_from(known, user_id, False) for user_id in known.statuses},
        "manager": capabilities_from(known, None, True),
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
