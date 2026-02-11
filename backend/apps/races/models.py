from django.db import models

from apps.warbands.models.shared import StatBlock, stat_constraints


class Race(StatBlock):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="races",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)

    class Meta:
        db_table = "race"
        ordering = ["name"]
        constraints = stat_constraints("race")

    def __str__(self):
        return self.name
