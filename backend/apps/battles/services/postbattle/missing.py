"""Missing games at finalise (units/services/missing.py has the rest of the feature).

Each battle a warband finalises counts one game for every unit of it that is missing (heroes, hired swords and henchmen
groups, whether or not they fought); at 0 the unit is back and forgets its reason. A cancelled battle, and a postbattle
skipped or closed (nothing applied), count nothing. It runs after the unit results, upkeep
and finds are written (upkeep reads who was missing for this battle), and writes the edit mode's log rows.
"""

from collections import defaultdict
from typing import Any

from django.db.models import Case, F, IntegerField, Value, When
from django.utils import timezone

from apps.warbands.models import HenchmenGroup, Hero, Hireling, on_roster
from apps.warbands.units.kinds import KIND_BY_MODEL
from apps.warbands.units.services.missing import LogEntry, returns_log

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


def apply_missing_games(context: FinaliseContext) -> list[LogEntry]:
    """This battle's game off every missing unit of the warband (nothing read when it has none); the log rows."""
    return count_down(context.warband.id) if context.has_missing else []
