"""Rarity rolls, saved on the server (decision 9, ECON-TWEAK-01).

The hero who searched for a rare item spends his trading action and the roll is logged. Nothing is refused for
game reasons: a hero who already used his action this round may search again, and a failed roll doesn't stop
the purchase; each is a warning. A hero who isn't on the warband's roster is refused.
"""

from collections.abc import Mapping
from typing import Any

from apps.items.models import Item
from apps.warbands.models import Hero, Warband, on_roster

from . import economy_log

TRADING_ACTION_SPENT = "trading_action_spent"
RARITY_ROLL_FAILED = "rarity_roll_failed"


class RollRefused(ValueError):
    """The searching hero isn't on the warband's roster."""


def record_roll(warband: Warband, item: Item, roll: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Spend the searching hero's trading action and log the roll, in the caller's transaction; the warnings to
    show. RollRefused when the hero isn't on the roster."""
    heroes = on_roster(Hero.objects.filter(id=roll["hero_id"], warband=warband))
    hero = heroes.only("id", "name").first()
    if hero is None:
        raise RollRefused("Not a hero on this warband's roster.")
    name = hero.name or f"Hero {hero.id}"
    warnings = []
    if not heroes.filter(trading_action=True).update(trading_action=False):
        message = f"{name} already used his trading action this round."
        warnings.append({"code": TRADING_ACTION_SPENT, "message": message, "hero_id": hero.id})
    payload: dict[str, Any] = {"hero": name, "item": item.name, "rarity": roll.get("rarity", "")}
    payload |= {"roll": roll["roll"], "modifier": roll["modifier"]}
    if roll.get("reason"):
        payload["reason"] = roll["reason"]
    payload["success"] = roll["success"]
    economy_log.write(warband, "trading_action", "rarity roll", payload)
    if not roll["success"]:
        message = f"{name}'s rarity roll for {item.name} failed."
        warnings.append({"code": RARITY_ROLL_FAILED, "message": message, "hero_id": hero.id})
    return warnings
