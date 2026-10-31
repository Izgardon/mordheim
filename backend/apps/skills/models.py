from django.db import models

from apps.core.models import CatalogueEntry, version_constraints
from apps.warbands.models.types import WarbandAccess, access_constraints


class Skill(CatalogueEntry):
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
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=4000, blank=True, default="")
    # who may learn it (the items rebuild): the general lists are for everyone, a special skill names its warbands
    for_everyone = models.BooleanField(default=True)
    # the fees and skill lists step: a Large unit's skill (the pages warn for any other unit, never block), and a
    # note shown when learning it ("Vampire only"), never checked
    large_only = models.BooleanField(default=False)
    learn_note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "skill"
        constraints = [
            *version_constraints("skill"),
            # one per name and type in each setting of the book and in a campaign (BUG-17, IMP-83)
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "name", "type"],
                name="skill_unique_name_type",
                nulls_distinct=False,
            ),
        ]
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class SkillWarband(WarbandAccess):
    """Who may (or may not) learn the skill: a warband type or group."""

    skill = models.ForeignKey(Skill, related_name="warband_links", on_delete=models.CASCADE)

    class Meta:
        db_table = "skill_warband"
        ordering = ["id"]
        constraints = access_constraints("skill_warband")

    def __str__(self):
        return f"{self.skill_id}:{self.warband_type_id or self.warband_group_id}"
