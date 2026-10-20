from django.db import models

RESTRICTION_TYPE_CHOICES = [
    ("Warband", "Warband"),
    ("Warband Group", "Warband Group"),
    ("Setting", "Setting"),
    ("Artifact", "Artifact"),
]


class Restriction(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="restrictions",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = models.ForeignKey(  # an add-on's entry (CAT-NEW-04: schema only, always null today)
        "campaigns.CampaignType", related_name="restrictions", null=True, blank=True, on_delete=models.RESTRICT
    )
    type = models.CharField(
        max_length=20,
        choices=RESTRICTION_TYPE_CHOICES,
        default="Warband",
    )
    restriction = models.CharField(max_length=200)

    class Meta:
        db_table = "restriction"
        ordering = ["type", "restriction"]
        constraints = [
            # one row per text and type in the book (NULLs not distinct: SEC-06, BUG-17), in an add-on and in a campaign
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "restriction", "type"],
                name="restriction_unique_text_type",
                nulls_distinct=False,
            ),
        ]

    def __str__(self):
        return f"{self.restriction} ({self.type})"
