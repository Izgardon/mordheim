from django.db import models


class Item(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="items",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    cost = models.PositiveIntegerField(default=0)
    rarity = models.PositiveSmallIntegerField(default=0)
    unique_to = models.CharField(max_length=200, blank=True, default="")
    variable = models.CharField(max_length=120, null=True, blank=True)
    description = models.TextField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "item"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class ItemCampaignType(models.Model):
    campaign_type = models.ForeignKey(
        "campaigns.CampaignType",
        related_name="item_links",
        on_delete=models.CASCADE,
    )
    item = models.ForeignKey(
        Item, related_name="campaign_types", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "item_campaign_type"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign_type", "item"], name="unique_item_campaign_type"
            )
        ]

    def __str__(self):
        return f"{self.campaign_type_id}:{self.item_id}"
