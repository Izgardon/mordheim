"""The skill lists a henchman promoted by Lad's Got Talent picks (William, 27 Nov 2026: "When a henchman gets lads got
talent they can choose 2 skills lists out of the skill lists the current heroes in their warband have taken").

The offer is the skill lists (`available_skills`, group names) of the warband's heroes on the roster (alive, not
dismissed; never its hired swords), once each whatever the case, the leader's first, then the others' in the order
they joined, then the warband's special list if it has one (William, 27 Nov 2026: "should also include the warbands
special list if it has one": a skill group not for everyone that names its type or group, as who-can's special skills
read it, by the name a unit's skill access gives it). The choice becomes the new hero's `available_skills`. A guide, not a gatekeeper: a list none of the
heroes has, or other than two (or than the offer's one), warns and saves.
"""

from typing import Any

from rest_framework import serializers

from apps.skills.access import access_name, access_names
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


def special_lists(warband: Warband) -> list[str]:
    """The warband's special skill lists: the campaign's current groups not for everyone whose lines let its type or
    group in (`who_can.step` at 1 or 2), in the groups' order (a fixed number of queries, none when it has no type)."""
    from apps.core.catalogue.kinds import SKILL_GROUPS  # the registry imports the warbands app
    from apps.core.catalogue.merge import campaign_list
    from apps.skills.models import SkillGroup
    from apps.skills.selectors import in_group_order
    from apps.warbands.services.who_can import buyer_of, step

    buyer = buyer_of(warband)
    if not buyer.type_ids:
        return []
    rows = campaign_list(SKILL_GROUPS, SkillGroup.objects.filter(for_everyone=False), warband.campaign_id)
    groups = in_group_order(rows.select_related("replaces")).prefetch_related("warband_links")
    return [access_name(group) for group in groups if step(False, group.warband_links.all(), buyer) in (1, 2)]


def talent_skill_lists(warband: Warband) -> list[str]:
    """The lists on offer: the heroes' (one query), then the warband's special lists."""
    heroes = HERO.visible(Hero.objects.filter(warband=warband)).order_by("-is_leader", "id")
    offer: dict[str, str] = {}
    for held in [*heroes.values_list("available_skills", flat=True), special_lists(warband)]:
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
