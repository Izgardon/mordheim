from django.db import models


class Other(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="others",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "other"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class OtherCampaignType(models.Model):
    campaign_type = models.ForeignKey(
        "campaigns.CampaignType",
        related_name="other_links",
        on_delete=models.CASCADE,
    )
    other = models.ForeignKey(
        Other, related_name="campaign_types", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "other_campaign_type"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign_type", "other"], name="unique_other_campaign_type"
            )
        ]

    def __str__(self):
        return f"{self.campaign_type_id}:{self.other_id}"
