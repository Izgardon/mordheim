"""A wizard in armour (William, 27 Nov 2026: "If a unit is marked as a wizard and they have armour in their equipment then
it should warn the player they can't have armour. This shouldn't affect priests.").

The Wizard rule reads "He may cast no spell while he wears armour (including shields)": a unit whose caster is Wizard
holding any Armour item (a shield and a helmet too) is warned, a priest never. Barding is his mount's, not worn by him.
A warning, never a block: his payload carries it (`warnings`) and so does a purchase that arms him. Reads the item
rows already loaded with the unit, so it costs no query.
"""

from collections.abc import Iterable
from typing import Any

WIZARD_IN_ARMOUR = "wizard_in_armour"
WIZARD = "Wizard"
ARMOUR = "Armour"
NOT_WORN = frozenset({"barding"})  # Armour subtypes his mount wears


def worn_armour(item: Any) -> bool:
    return bool(item.type == ARMOUR and (item.subtype or "").strip().lower() not in NOT_WORN)


def armour_names(unit: Any, items: Iterable[Any]) -> list[str]:
    """The armour a wizard holds, by name once each; none for anyone else."""
    worn = list(dict.fromkeys(item.name for item in items if worn_armour(item)))
    return worn if worn and getattr(unit, "caster", None) == WIZARD else []


def rule_text(names: list[str]) -> str:
    return f"may cast no spell while he wears armour ({', '.join(names)})."


def wizard_armour_warnings(unit: Any, items: Iterable[Any]) -> list[dict[str, Any]]:
    """His card's warning: a wizard holding armour."""
    names = armour_names(unit, items)
    return [{"code": WIZARD_IN_ARMOUR, "message": f"A wizard {rule_text(names)}"}] if names else []


def armed_wizard_warning(unit: Any, items: Iterable[Any]) -> list[dict[str, Any]]:
    """A purchase's warning, naming him: the armour it just gave a wizard."""
    names = armour_names(unit, items)
    if not names:
        return []
    message = f"{unit.name} is a wizard: a wizard {rule_text(names)}"
    return [{"code": WIZARD_IN_ARMOUR, "message": message, "unit_id": unit.pk}]
