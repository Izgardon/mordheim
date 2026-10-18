"""The warband log entries a finalise writes, in this order: the battle's result, exploration, finds, each unit's
serious injury, kept stat changes, items lost with dead units and the unusual values that were allowed."""

from apps.logs.utils import log_warband_event

from ...models import Battle, BattleParticipant
from ..lifecycle import battle_result_log
from ..warnings import Warning
from .rewards import Exploration, Finds
from .units import UnitOutcome


def write_battle_logs(
    battle: Battle,
    participant: BattleParticipant,
    exploration: dict,
    explored: Exploration,
    finds: Finds,
    units: UnitOutcome,
    unusual: list[Warning],
) -> None:
    warband_id = participant.warband_id
    log_warband_event(warband_id, "battle", "complete", battle_result_log(battle, participant))
    exploration_log = {
        "dice": exploration.get("dice_values", []),
        "amount": explored.amount,
        "amount_override": exploration.get("amount_override"),
        "resource": explored.resource_name,
        "rerolls": exploration.get("previous_rolls", []),  # kept by the server (services/exploration.py)
    }
    log_warband_event(warband_id, "battle", "exploration", exploration_log)
    if finds.gold_crowns > 0 or finds.items:
        log_warband_event(warband_id, "battle", "finds", {"gold_crowns": finds.gold_crowns, "items": finds.items})
    for injury_log in filter(None, units.injury_logs):  # one per unit: the final roll, re-rolls, what was applied
        log_warband_event(warband_id, "personnel", "serious_injury", injury_log)
    for stat_log in units.stat_logs:  # the kept stat changes, before and after (decision 6)
        log_warband_event(warband_id, "personnel", "stats_kept", stat_log)
    if any(units.items_lost):
        log_warband_event(warband_id, "battle", "items_lost", {"units": list(filter(None, units.items_lost))})
    if unusual:  # allowed, answered and logged (decision 9)
        log_warband_event(warband_id, "battle", "warnings", {"warnings": unusual})
