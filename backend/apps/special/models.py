from django.db import models


class Special(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="specials",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "special"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class SpecialCampaignType(models.Model):
    campaign_type = models.ForeignKey(
        "campaigns.CampaignType",
        related_name="special_links",
        on_delete=models.CASCADE,
    )
    special = models.ForeignKey(
        Special, related_name="campaign_types", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "special_campaign_type"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign_type", "special"], name="unique_special_campaign_type"
            )
        ]

    def __str__(self):
        return f"{self.campaign_type_id}:{self.special_id}"
