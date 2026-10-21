from django.db import models

from apps.core.models import CatalogueEntry, version_constraints


class Skill(CatalogueEntry):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="skills",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = models.ForeignKey(  # an add-on's entry (CAT-NEW-04: schema only, always null today)
        "campaigns.CampaignType", related_name="skills", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=4000, blank=True, default="")

    class Meta:
        db_table = "skill"
        constraints = [
            *version_constraints("skill"),
            # one per name and type in the book, an add-on and a campaign (BUG-17, IMP-83)
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "name", "type"],
                name="skill_unique_name_type",
                nulls_distinct=False,
            ),
        ]
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"
