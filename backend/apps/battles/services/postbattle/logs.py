"""The warband log entries a finalise writes, in one INSERT and in this order: exploration, finds, each unit's
serious injury, kept stat changes, items lost with dead units and the unusual values that were allowed (PERF-36:
they were written one by one). The battle's result is logged when the battle ends (services/lifecycle.py)."""

from apps.warbands.models import WarbandLog

from ...models import Battle, BattleParticipant
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
    entries: list[tuple[str, str, dict]] = []
    exploration_log = {
        "dice": exploration.get("dice_values", []),
        "amount": explored.amount,
        "amount_override": exploration.get("amount_override"),
        "resource": explored.resource_name,
        "rerolls": exploration.get("previous_rolls", []),  # kept by the server (services/exploration.py)
    }
    entries.append(("battle", "exploration", exploration_log))
    if finds.gold_crowns > 0 or finds.items:
        entries.append(("battle", "finds", {"gold_crowns": finds.gold_crowns, "items": finds.items}))
    # one injury log per unit: the final roll, re-rolls, what was applied; kept stat changes before and after
    entries += [("personnel", "serious_injury", injury_log) for injury_log in units.injury_logs if injury_log]
    entries += [("personnel", "stats_kept", stat_log) for stat_log in units.stat_logs]
    if any(units.items_lost):
        entries.append(("battle", "items_lost", {"units": [entry for entry in units.items_lost if entry]}))
    if unusual:  # allowed, answered and logged (decision 9)
        entries.append(("battle", "warnings", {"warnings": unusual}))
    WarbandLog.objects.bulk_create(
        WarbandLog(warband_id=participant.warband_id, feature=feature, entry_type=entry_type, payload=payload)
        for feature, entry_type, payload in entries
    )
