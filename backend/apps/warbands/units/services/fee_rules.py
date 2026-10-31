"""What a hire fee's kind asks of the hire (the fees and skill lists step): a fee in his rules warns, and one who
takes a hero's place (the Priest of Morr, the Wolf Priest of Ulric) counts towards the hero cap, warns when the heroes
are full and may let a hero go in the same request. Warnings, never refusals: a guide, not a gatekeeper."""

from collections.abc import Mapping
from typing import Any

from rest_framework.exceptions import ValidationError

from apps.warbands.models import Hero, Warband
from apps.warbands.units.kinds import HERO

from .create import cap_count, cap_limit
from .dismiss import dismiss


def make_room(warband: Warband, dismiss_hero_id: int | None) -> None:
    """Let the named hero go (one of the warband's on the roster) to make room; a 400 for any other id."""
    if dismiss_hero_id is None:
        return
    hero = HERO.visible(Hero.objects.filter(id=dismiss_hero_id, warband=warband)).first()
    if hero is None:
        raise ValidationError({"dismiss_hero_id": ["Not a hero on this warband's roster."]})
    dismiss(HERO, warband, hero)


def fee_warnings(warband: Warband, fee: Mapping[str, Any], name: str) -> list[dict[str, Any]]:
    """The warnings a fee's kind brings: a fee in his rules, or a hero's place when the heroes are full."""
    kind = fee.get("kind")
    if kind == "special":
        message = f"{name}'s fee is in his rules: check them. The hire took only what you set."
        return [{"code": "fee_special", "message": message}]
    if kind != "replaces_hero":
        return []
    limit = cap_limit(HERO, warband)
    taken = cap_count(HERO, warband)  # heroes and those in a hero's place, before this one
    if limit is None or taken < limit:
        return []
    message = f"{warband.name} has {taken} of {limit} heroes: {name} takes a hero's place. Let a hero go to make room."
    return [{"code": "hero_place_taken", "message": message, "heroes": taken, "max_heroes": limit}]
