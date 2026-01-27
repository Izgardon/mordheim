from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Item(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="items",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=80, db_index=True)
    subtype = models.CharField(max_length=80, blank=True, default="")
    grade = models.CharField(max_length=20, blank=True, default="")
    cost = models.PositiveIntegerField(default=0)
    rarity = models.PositiveSmallIntegerField(
        default=2, validators=[MinValueValidator(2), MaxValueValidator(20)]
    )
    unique_to = models.CharField(max_length=200, blank=True, default="")
    variable = models.CharField(max_length=120, null=True, blank=True)
    single_use = models.BooleanField(default=False)
    description = models.TextField(max_length=2000, blank=True, default="")
    strength = models.CharField(max_length=40, blank=True, null=True)
    range = models.CharField(max_length=40, blank=True, null=True)
    save_value = models.CharField(
        max_length=40, blank=True, null=True, db_column="save"
    )
    statblock = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "item"
        ordering = ["type", "name"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rarity__gte=2, rarity__lte=20),
                name="item_rarity_range",
            )
        ]

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


class ItemProperty(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="item_properties",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    description = models.TextField(max_length=4000, blank=True, default="")
    type = models.CharField(max_length=80, blank=True, default="")

    class Meta:
        db_table = "item_property"
        ordering = ["name"]

    def __str__(self):
        return self.name


class ItemPropertyLink(models.Model):
    item = models.ForeignKey(
        Item, related_name="property_links", on_delete=models.CASCADE
    )
    property = models.ForeignKey(
        ItemProperty, related_name="item_links", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "item_property_link"
        constraints = [
            models.UniqueConstraint(
                fields=["item", "property"],
                name="unique_item_property_link",
            )
        ]

    def __str__(self):
        return f"{self.item_id}:{self.property_id}"
