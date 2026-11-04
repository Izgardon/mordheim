"""How skill groups are read (skill groups, phase 1a): who learns from each (one query for every group's lines), the
skills each holds as the campaign's current entries (one query), and the order every list of groups takes: the five
core groups first (by the book's name, so a campaign's renamed version of Combat stays first), then the rest by name.
"""

from typing import Any

from django.db.models import Case, F, OuterRef, Prefetch, Q, QuerySet, Subquery, Value, When
from django.db.models.functions import Coalesce, Lower

from .models import Skill, SkillGroup, SkillGroupSkill, SkillGroupWarband

CORE_GROUPS = ("Combat", "Shooting", "Academic", "Strength", "Speed")  # the book's order


def group_learners(prefix: str = "") -> Prefetch:
    """A group's who-can lines, each with its warband type or group."""
    lines = SkillGroupWarband.objects.select_related("warband_type", "warband_group").order_by("id")
    return Prefetch(f"{prefix}warband_links", queryset=lines)


def group_skills(campaign_id: int | None = None, prefix: str = "") -> Prefetch:
    """A group's links in its skills' name order, each with `current_id`: the campaign's version of the skill where it
    has one (a campaign's version of a skill stands in for it in every group), else the skill. Without `campaign_id`,
    each group's own campaign (none for the book)."""
    campaign: Any = campaign_id if campaign_id is not None else OuterRef("group__campaign_id")
    version = Skill.objects.filter(campaign_id=campaign, replaces_id=OuterRef("skill_id")).values("id")[:1]
    links = SkillGroupSkill.objects.annotate(current_id=Coalesce(Subquery(version), F("skill_id")))
    return Prefetch(f"{prefix}skill_links", queryset=links.order_by("skill__name", "id"))


def current_skill_id(link: Any) -> int:
    """A link's skill as the campaign's current entry (`group_skills`), else its own."""
    return int(getattr(link, "current_id", link.skill_id))


def group_rank() -> Case:
    """0 to 4 for the core groups (a version by its book entry's name), 5 for the rest."""
    whens = [
        When(Q(name__iexact=name) | Q(replaces__name__iexact=name), then=Value(index))
        for index, name in enumerate(CORE_GROUPS)
    ]
    return Case(*whens, default=Value(len(CORE_GROUPS)))


def in_group_order[RowsT: QuerySet[SkillGroup]](rows: RowsT) -> RowsT:
    """Groups in the order every list of them takes: the core five, then by name."""
    ordered: RowsT = rows.annotate(rank=group_rank()).order_by("rank", Lower("name"), "id")
    return ordered
