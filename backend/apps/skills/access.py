"""A unit's skill access (skill groups, phase 1a): `available_skills` on heroes and hirelings, and a hired sword's or
dramatis persona's `available_skill_types` (what a hire copies onto him), are lists of group names, so "Combat,
Academic, Dwarves" still reads.

A name stands for the book group of that name or the campaign's own group of that name, then for the campaign's
current entry for it: a campaign's version of the book group, under whatever name the version has (renaming a version
changes nothing a unit holds; a Revert brings the book's name back). A name no current group answers to (a group the
campaign removed or deleted) stands for nothing, and the pages show it as it is. A skill shows under the group it
comes through for a unit: the first of his groups holding it, else its first group. The pages read the same from the
groups list (`access_name`, `skill_ids`); the server reads it for the log of a skill he learns.
"""

from collections.abc import Iterable
from typing import Any

from .models import SkillGroup
from .selectors import current_skill_id, group_skills, in_group_order


def access_name(group: Any) -> str:
    """What a unit's skill access names the group by: its book entry's name for a version, else its own."""
    return str(group.replaces.name if group.replaces_id else group.name)


def current_groups(campaign_id: int) -> list[SkillGroup]:
    """The campaign's current groups in their order, each with its skills as the campaign's current entries (two
    queries)."""
    from apps.core.catalogue.kinds import SKILL_GROUPS  # the registry imports this app's serializers
    from apps.core.catalogue.merge import campaign_list

    rows = campaign_list(SKILL_GROUPS, SkillGroup.objects.select_related("replaces"), campaign_id)
    return list(in_group_order(rows).prefetch_related(group_skills(campaign_id)))


def unit_groups(groups: Iterable[SkillGroup], names: Iterable[str]) -> list[SkillGroup]:
    """A unit's skill access as groups, in his order (a name no group answers to is left out)."""
    by_name = {access_name(group).strip().lower(): group for group in groups}
    found = [by_name.get(str(name).strip().lower()) for name in names]
    return list(dict.fromkeys(group for group in found if group is not None))


def came_through(groups: list[SkillGroup], skill_id: int, names: Iterable[str]) -> SkillGroup | None:
    """The group a unit learns the skill (the campaign's current entry) through: the first of his groups holding it,
    else its first group; None when no group holds it."""
    holding = [group for group in groups if any(current_skill_id(link) == skill_id for link in group.skill_links.all())]
    his = [group for group in unit_groups(groups, names) if group in holding]
    found = his or holding
    return found[0] if found else None


CORE_ABBREVIATIONS = {"C": "Combat", "Sh": "Shooting", "A": "Academic", "St": "Strength", "Sp": "Speed"}


def access_names(raw: Any) -> list[str]:
    """A unit's `available_skills` as names: a list of names, or the old `{name: true}` form (the core groups by
    their letters, "Spc" a flag and no group)."""
    if isinstance(raw, dict):
        named = [CORE_ABBREVIATIONS.get(str(name), str(name)) for name, on in raw.items() if on and name != "Spc"]
        return list(dict.fromkeys(named))
    return [str(name) for name in raw or [] if name] if isinstance(raw, list) else []


def learned_through(skill: Any, unit: Any, campaign_id: int, groups: list[SkillGroup] | None = None) -> str:
    """The name of the group the unit learns the skill through (his log: "learned the Combat skill"), or ""."""
    names = access_names(getattr(unit, "available_skills", None))
    found = came_through(groups if groups is not None else current_groups(campaign_id), skill.pk, names)
    return found.name if found is not None else ""
