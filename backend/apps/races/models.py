from django.db import models

from apps.core.models import CatalogueEntry, version_constraints
from apps.warbands.models.shared import StatBlock, stat_constraints


class Race(StatBlock, CatalogueEntry):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="races",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = (
        models.ForeignKey(  # its setting, which holds its grade (grading phase 1); null counts as Mordheim's
            "campaigns.CampaignType", related_name="races", null=True, blank=True, on_delete=models.RESTRICT
        )
    )
    name = models.CharField(max_length=160)

    class Meta:
        db_table = "race"
        ordering = ["name"]
        constraints = [
            *stat_constraints("race"),
            *version_constraints("race"),
            # one race per name in each setting of the book and in a campaign (BUG-17, IMP-83)
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "name"], name="race_unique_name", nulls_distinct=False
            ),
        ]

    def __str__(self):
        return self.name
