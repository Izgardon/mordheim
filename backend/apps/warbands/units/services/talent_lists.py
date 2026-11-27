"""The skill lists a henchman promoted by Lad's Got Talent picks (William, 27 Nov 2026: "When a henchman gets lads got
talent they can choose 2 skills lists out of the skill lists the current heroes in their warband have taken").

The offer is the skill lists (`available_skills`, group names) of the warband's heroes on the roster (alive, not
dismissed; never its hired swords), once each whatever the case, the leader's first, then the others' in the order
they joined. The choice becomes the new hero's `available_skills`. A guide, not a gatekeeper: a list none of the
heroes has, or other than two (or than the offer's one), warns and saves.
"""

from typing import Any

from rest_framework import serializers

from apps.skills.access import access_names
from apps.warbands.models import Hero, Warband
from apps.warbands.units.kinds import HERO

TALENT_LISTS = 2
NUMBER_WORDS = {0: "none", 1: "one", 2: "two", 3: "three"}


class SkillListsField(serializers.ListField):
    """The lists a promotion sends: names, each once (whatever the case), and a handful at most."""

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(child=serializers.CharField(max_length=120), max_length=8, **kwargs)

    def to_internal_value(self, data: Any) -> list[str]:
        names: list[str] = super().to_internal_value(data)
        if len({name.lower() for name in names}) != len(names):
            raise serializers.ValidationError("Pick each skill list once.")
        return names


def talent_skill_lists(warband: Warband) -> list[str]:
    """The lists on offer (one query)."""
    heroes = HERO.visible(Hero.objects.filter(warband=warband)).order_by("-is_leader", "id")
    offer: dict[str, str] = {}
    for held in heroes.values_list("available_skills", flat=True):
        for name in access_names(held):
            offer.setdefault(name.strip().lower(), name.strip())
    return list(offer.values())


def lists_to_pick(offer: list[str]) -> int:
    """How many lists he picks: two, or what the heroes hold when that is fewer."""
    return min(TALENT_LISTS, len(offer))


def _words(count: int) -> str:
    return NUMBER_WORDS.get(count, str(count))


def skill_list_warnings(offer: list[str], chosen: list[str]) -> list[dict[str, Any]]:
    """What the choice departs from: a list no hero holds, and a count other than the talent's."""
    offered = {name.lower() for name in offer}
    warnings = [
        {"code": "skill_list_not_offered", "message": f"None of the warband's heroes has {name}."}
        for name in chosen
        if name.lower() not in offered
    ]
    needed = lists_to_pick(offer)
    if len(chosen) != needed:
        lists = "skill list" if needed == 1 else "skill lists"
        picked = "was" if len(chosen) == 1 else "were"
        message = f"The lad's got talent picks {_words(needed)} {lists}; {_words(len(chosen))} {picked} picked."
        warnings.append({"code": "skill_list_count", "message": message})
    return warnings
