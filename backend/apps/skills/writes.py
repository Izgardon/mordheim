"""Skill groups and a skill's groups, written in the catalogue's one transaction (skill groups, phase 1a).

A group's write replaces each list it sends: who learns from it (`warbands`) and its skills (`skill_ids`, already the
campaign's current entries: CatalogueIdsField). A skill's write may send the groups that should hold it (`group_ids`,
the campaign's current groups): a group gaining or losing it is written like any edit of it, so a book group gets the
campaign's version first (versions.editable) and the book and every other campaign keep theirs. A campaign's version
of a skill stands in for the book skill in every group (a link to either is the skill's), so the links read and
removed are those to the skill or to the book skill it replaces.
"""

from collections.abc import Mapping
from typing import Any

from django.db.models import Q

from .models import Skill, SkillGroup, SkillGroupSkill, SkillGroupWarband

LISTS = ("warbands", "skill_ids")
LINE_FIELDS = ("warband_type_id", "warband_group_id", "excluded")


def write_group_lists(group: SkillGroup, data: Mapping[str, Any], *, replace: bool) -> None:
    """Each list `data` holds becomes the group's: its who-can lines and its skills (one INSERT each)."""
    if "warbands" in data:
        if replace:
            SkillGroupWarband.objects.filter(group=group).delete()
        lines = [{field: line.get(field) for field in LINE_FIELDS} for line in data["warbands"]]
        SkillGroupWarband.objects.bulk_create(
            [SkillGroupWarband(group=group, **{**line, "excluded": bool(line["excluded"])}) for line in lines]
        )
    if "skill_ids" in data:
        if replace:
            SkillGroupSkill.objects.filter(group=group).delete()
        SkillGroupSkill.objects.bulk_create([SkillGroupSkill(group=group, skill_id=pk) for pk in data["skill_ids"]])


def _fields(data: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key not in LISTS}


def create_group(campaign_id: int, data: Mapping[str, Any]) -> SkillGroup:
    group = SkillGroup.objects.create(campaign_id=campaign_id, **_fields(data))
    write_group_lists(group, data, replace=False)
    return group


def update_group(group: SkillGroup, data: Mapping[str, Any]) -> None:
    fields = _fields(data)
    for field, value in fields.items():
        setattr(group, field, value)
    if fields:
        group.save(update_fields=list(fields))
    write_group_lists(group, data, replace=True)


def _links_of(skill: Skill) -> Q:
    """Links to the skill, or to the book skill it is the campaign's version of."""
    held = [skill.pk, *([skill.replaces_id] if skill.replaces_id else [])]
    return Q(skill_id__in=held)


def set_skill_groups(skill: Skill, group_ids: list[int], campaign_id: int) -> None:
    """The campaign's groups holding the skill become `group_ids` (current groups): each group it joins or leaves is
    the campaign's own, or its version of a book group made by this write."""
    from apps.core.catalogue.kinds import SKILL_GROUPS  # the registry imports this app's serializers
    from apps.core.catalogue.merge import campaign_list
    from apps.core.catalogue.versions import editable

    current = campaign_list(SKILL_GROUPS, SkillGroup.objects.all(), campaign_id)
    holding = set(
        SkillGroupSkill.objects.filter(_links_of(skill), group__in=current).values_list("group_id", flat=True)
    )
    wanted = set(group_ids)
    changed = SkillGroup.objects.filter(pk__in=(wanted ^ holding)).order_by("pk")
    for group in changed:
        written = editable(SKILL_GROUPS, group, campaign_id)
        if group.pk in wanted:
            SkillGroupSkill.objects.get_or_create(group=written, skill=skill)
        else:
            SkillGroupSkill.objects.filter(_links_of(skill), group=written).delete()
