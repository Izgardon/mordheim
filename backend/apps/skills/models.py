"""Skills and the groups they are learned from (skill groups, phase 1a; William, 4 Nov 2026: "skills exist as they are
without a skill group column. we than have a skill group table and a pivot table linking them, so a single skill can
be owned by multiple skill groups").

A skill is one row per name in its scope (the book, or a campaign). A group (Combat, Shooting, Academic, Strength and
Speed like any other, or a warband's own list) holds skills through `SkillGroupSkill` and says who learns from it:
for everyone, or the warbands its who-can lines name (`SkillGroupWarband`), whether it is a Large unit's group and the
note shown when learning from it ("Vampire only"). A unit's skill access is a list of group names (apps/skills/access.py
resolves them). A campaign's version of a skill stands in for it in every group through `replaces`; a campaign's
version of a group copies its links and who-can lines like other child rows.
"""

from django.db import models

from apps.core.models import CatalogueEntry, PrebattleRoll, version_constraints
from apps.warbands.models.types import WarbandAccess, access_constraints


class Skill(CatalogueEntry, PrebattleRoll):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="skills",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = (
        models.ForeignKey(  # its setting, which holds its grade (grading phase 1); null counts as Mordheim's
            "campaigns.CampaignType", related_name="skills", null=True, blank=True, on_delete=models.RESTRICT
        )
    )
    name = models.CharField(max_length=160)
    description = models.TextField(max_length=4000, blank=True, default="")

    class Meta:
        db_table = "skill"
        constraints = [
            *version_constraints("skill"),
            # one per name in the book and in each campaign (BUG-17, IMP-83; skill groups phase 1a)
            models.UniqueConstraint(fields=["campaign", "name"], name="skill_unique_name", nulls_distinct=False),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class SkillGroup(CatalogueEntry):
    """A group skills are learned from, and who learns from it: everyone, or the warbands its lines name. A Large
    unit's group warns for any other unit and its note is shown when learning, neither ever blocks."""

    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="skill_groups",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    for_everyone = models.BooleanField(default=True)
    large_only = models.BooleanField(default=False)
    learn_note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "skill_group"
        constraints = [
            *version_constraints("skill_group"),
            models.UniqueConstraint(fields=["campaign", "name"], name="skill_group_unique_name", nulls_distinct=False),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class SkillGroupSkill(models.Model):
    """A skill in a group: a skill may be in several."""

    group = models.ForeignKey(SkillGroup, related_name="skill_links", on_delete=models.CASCADE)
    skill = models.ForeignKey(Skill, related_name="group_links", on_delete=models.CASCADE)

    class Meta:
        db_table = "skill_group_skill"
        ordering = ["id"]
        constraints = [models.UniqueConstraint(fields=["group", "skill"], name="skill_group_skill_once")]

    def __str__(self):
        return f"{self.group_id}:{self.skill_id}"


class SkillGroupWarband(WarbandAccess):
    """Who may (or may not) learn from the group: a warband type or group."""

    group = models.ForeignKey(SkillGroup, related_name="warband_links", on_delete=models.CASCADE)

    class Meta:
        db_table = "skill_group_warband"
        ordering = ["id"]
        constraints = access_constraints("skill_group_warband")

    def __str__(self):
        return f"{self.group_id}:{self.warband_type_id or self.warband_group_id}"
