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
            models.UniqueConstraint(
                fields=["campaign", "type", "restriction"],
                name="unique_restriction",
            ),
        ]

    def __str__(self):
        return f"{self.restriction} ({self.type})"


class RestrictionCampaignType(models.Model):
    campaign_type = models.ForeignKey(
        "campaigns.CampaignType",
        related_name="restriction_links",
        on_delete=models.CASCADE,
    )
    restriction = models.ForeignKey(
        Restriction,
        related_name="campaign_types",
        on_delete=models.CASCADE,
    )

    class Meta:
        db_table = "restriction_campaign_type"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign_type", "restriction"],
                name="unique_restriction_campaign_type",
            )
        ]

    def __str__(self):
        return f"{self.campaign_type_id}:{self.restriction_id}"
