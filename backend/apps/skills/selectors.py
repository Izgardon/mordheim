"""How skills are read with who may learn them (the items rebuild): one query for every row's lines."""

from django.db.models import Prefetch

from .models import SkillWarband


def skill_learners(prefix: str = "") -> Prefetch:
    """A skill's who-can lines, each with its warband type or group."""
    lines = SkillWarband.objects.select_related("warband_type", "warband_group").order_by("id")
    return Prefetch(f"{prefix}warband_links", queryset=lines)
