"""Missing games at finalise (units/services/missing.py has the rest of the feature).

Each battle a warband finalises counts one game for every unit of it that is missing (heroes, hired swords and henchmen
groups, whether or not they fought); at 0 the unit is back and forgets its reason. A cancelled battle, and a postbattle
skipped or closed (nothing applied), count nothing. Then the serious injuries the player confirmed set a hero's or
hired sword's missing games for the games after this one, replacing any count left. Both run after the unit results,
upkeep and finds are written (upkeep reads who was missing for this battle), and write the edit mode's log rows.
"""

from collections import defaultdict
from typing import Any

from django.db.models import Case, F, IntegerField, Value, When
from django.utils import timezone

from apps.warbands.models import HenchmenGroup, Hero, Hireling, on_roster
from apps.warbands.units.kinds import KIND_BY_MODEL
from apps.warbands.units.services.missing import LogEntry, missing_log, returns_log

from ...validation.unit_keys import parse_unit_key
from .context import FinaliseContext

MODELS: tuple[Any, ...] = (Hero, HenchmenGroup, Hireling)


def _name(model: Any, name: str, unit_type: str) -> str:
    return name or unit_type or KIND_BY_MODEL[model].unknown_name


def count_down(warband_id: int) -> list[LogEntry]:
    """One game off each missing unit on the warband's roster: one read for the three kinds, then one UPDATE per kind
    that has one (its version moves, so an edit begun before it is refused rather than undoing it). The "returns"
    rows of the units back."""
    reads = [
        on_roster(model.objects.filter(warband_id=warband_id, missing_games__gt=0))
        .annotate(v_kind=Value(index, output_field=IntegerField()))
        .values_list("v_kind", "id", "name", "unit_type", "missing_games")
        for index, model in enumerate(MODELS)
    ]
    ids: defaultdict[int, list[int]] = defaultdict(list)
    logs = []
    for index, unit_id, name, unit_type, games in reads[0].union(*reads[1:], all=True).order_by("v_kind", "id"):
        ids[index].append(unit_id)
        if games == 1:
            logs.append(returns_log(_name(MODELS[index], name, unit_type)))
    now = timezone.now()
    for index, unit_ids in ids.items():
        MODELS[index].objects.filter(id__in=unit_ids).update(
            missing_games=F("missing_games") - 1,
            missing_reason=Case(When(missing_games=1, then=Value("")), default=F("missing_reason")),
            updated_at=now,
        )
    return logs


def _injured_unit(context: FinaliseContext, unit_key: str) -> Any:
    """The hero or hired sword of a result, while still on the roster and alive after this battle (else None)."""
    parsed = parse_unit_key(unit_key)
    if parsed["unit_type"] == "hero":
        unit: Any = context.hero(parsed["unit_id"])
    elif parsed["unit_type"] == "hireling":
        unit = context.hirelings.get(parsed["unit_id"])
    else:
        return None
    return None if unit is None or unit.dead or unit.dismissed_at is not None else unit


def set_from_injuries(context: FinaliseContext, unit_results: dict[str, dict]) -> list[LogEntry]:
    """The missing games each confirmed injury sets (a result's `missing_games`), on the rows finalise holds: one
    UPDATE per kind that has one, nothing read. The "misses" rows."""
    rows: defaultdict[Any, list[Any]] = defaultdict(list)
    logs = []
    now = timezone.now()
    for unit_key, result in unit_results.items():
        missing = result.get("missing_games")
        if not missing:
            continue
        unit = _injured_unit(context, unit_key)
        if unit is None:
            continue
        unit.missing_games, unit.missing_reason, unit.updated_at = missing["games"], missing["reason"], now
        rows[type(unit)].append(unit)
        logs.append(missing_log(_name(type(unit), unit.name, unit.unit_type), missing["games"], missing["reason"]))
    for model, units in rows.items():
        model.objects.bulk_update(units, ["missing_games", "missing_reason", "updated_at"])
    return logs


def apply_missing_games(context: FinaliseContext, unit_results: dict[str, dict]) -> list[LogEntry]:
    """This battle's game off every missing unit of the warband (nothing read when it has none), then the injuries'
    new counts; the log rows, in that order."""
    counted = count_down(context.warband.id) if context.has_missing else []
    return counted + set_from_injuries(context, unit_results)
