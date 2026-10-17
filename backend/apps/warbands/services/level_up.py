"""Spending a level-up, shared by heroes, henchmen groups and hired swords (BUG-62)."""

from collections.abc import Mapping
from typing import Any

from django.db.models import F, Func, JSONField, Model, Value
from django.db.models.functions import Least
from django.utils import timezone

from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

from .xp import RosterUnit

# Advances that add a "New Skill" / "New Spell" / "New Special" entry the player resolves later.
PLACEHOLDER_ADVANCES = ("Skill", "Spell", "Special")
MAX_STAT = 10


def advance_record(advance: Mapping[str, Any], labels: Mapping[str, str]) -> dict[str, Any]:
    """The level_up_history entry for an advance: its code, the client's label (or the default one) and the time."""
    code = advance["id"]
    label = advance.get("label")
    if not isinstance(label, str) or not label.strip():
        label = labels.get(code, code)
    return {"code": code, "label": label, "timestamp": timezone.now().isoformat()}


def spend_level_up(unit: RosterUnit, *, stat_field: str | None, record: dict[str, Any]) -> bool:
    """Spend one of `unit`'s level-ups in a single UPDATE; False if it has none left.

    The UPDATE only matches while `level_up > 0`, so two requests can't both spend the last one, and it
    raises the stat (to at most 10) and appends `record` to the history in the database, so concurrent
    advances can't overwrite each other either.
    """
    changes: dict[str, Any] = {
        "level_up": F("level_up") - 1,
        "level_up_history": Func(
            F("level_up_history"),
            Value([record], output_field=JSONField()),
            function="",
            arg_joiner=" || ",
            output_field=JSONField(),
        ),
    }
    if stat_field:
        changes[stat_field] = Least(F(stat_field) + 1, Value(MAX_STAT))
    return type(unit).objects.filter(pk=unit.pk, level_up__gt=0).update(**changes) == 1


def pending_placeholder(model: type[Skill] | type[Spell] | type[Special], name: str) -> Any:
    """The global placeholder entry (e.g. Skill "New Skill", type "Pending"), created if it is missing."""
    placeholder: Model | None = model.objects.filter(campaign__isnull=True, name=name, type="Pending").first()
    if placeholder is None:
        placeholder = model.objects.create(name=name, type="Pending")
    return placeholder
