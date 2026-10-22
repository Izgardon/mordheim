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
    campaign_type = models.ForeignKey(  # an add-on's entry (CAT-NEW-04: schema only, always null today)
        "campaigns.CampaignType", related_name="races", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=160)

    class Meta:
        db_table = "race"
        ordering = ["name"]
        constraints = [
            *stat_constraints("race"),
            *version_constraints("race"),
            # one race per name in the book, an add-on and a campaign (BUG-17, IMP-83)
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "name"], name="race_unique_name", nulls_distinct=False
            ),
        ]

    def __str__(self):
        return self.name
