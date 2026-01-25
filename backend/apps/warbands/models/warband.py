from django.conf import settings
from django.db import models


class Warband(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="warbands", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="warbands", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120)
    faction = models.CharField(max_length=80)
    wins = models.PositiveSmallIntegerField(null=True, blank=True)
    losses = models.PositiveSmallIntegerField(null=True, blank=True)
    backstory = models.TextField(max_length=5000, null=True, blank=True)
    max_units = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    items = models.ManyToManyField(
        "items.Item",
        through="WarbandItem",
        related_name="warbands",
        blank=True,
    )

    class Meta:
        db_table = "warband"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "user"], name="unique_campaign_warband"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.campaign_id}:{self.user_id})"


class WarbandItem(models.Model):
    warband = models.ForeignKey(
        Warband, related_name="warband_items", on_delete=models.CASCADE
    )
    item = models.ForeignKey(
        "items.Item", related_name="warband_items", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "warband_items"
        constraints = [
            models.UniqueConstraint(
                fields=["warband", "item"], name="unique_warband_item"
            )
        ]

    def __str__(self):
        return f"{self.warband_id}:{self.item_id}"


class WarbandLog(models.Model):
    warband = models.ForeignKey(
        Warband, related_name="logs", on_delete=models.CASCADE
    )
    feature = models.CharField(max_length=80)
    entry_type = models.CharField(max_length=80, db_column="type")
    payload = models.JSONField(db_column="json")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "warband_log"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.warband_id}:{self.feature}:{self.entry_type}"


class WarbandResource(models.Model):
    warband = models.ForeignKey(
        Warband, related_name="resources", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120)
    amount = models.IntegerField(default=0)

    class Meta:
        db_table = "warband_resources"
        constraints = [
            models.UniqueConstraint(
                fields=["warband", "name"], name="unique_warband_resource"
            )
        ]

    def __str__(self):
        return f"{self.warband_id}:{self.name}"
