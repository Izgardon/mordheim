from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import CatalogueEntry, version_constraints


class Item(CatalogueEntry):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="items",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = models.ForeignKey(  # an add-on's entry (CAT-NEW-04: schema only, always null today)
        "campaigns.CampaignType", related_name="items", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=80, db_index=True)
    subtype = models.CharField(max_length=80, blank=True, default="")
    grade = models.CharField(max_length=20, blank=True, default="")
    single_use = models.BooleanField(default=False)
    description = models.TextField(max_length=2000, blank=True, default="")
    strength = models.CharField(max_length=40, blank=True, null=True)
    range = models.CharField(max_length=40, blank=True, null=True)
    save_value = models.CharField(max_length=40, blank=True, null=True, db_column="save")
    statblock = models.TextField(blank=True, null=True)
    # set on a house rule's generated version (its `replaces` is the book item the rule changes); editing the version
    # clears it, and the rule leaves the version alone from then on
    generated_effect_key = models.CharField(max_length=80, blank=True, null=True, db_index=True)
    bestiary_entry = models.ForeignKey(
        "bestiary.BestiaryEntry",
        related_name="shop_items",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        db_table = "item"
        ordering = ["type", "name"]
        constraints = [
            *version_constraints("item"),  # one version per book item in a campaign, a house rule's clone included
            # one item per name and type in the book, an add-on and a campaign (BUG-17, IMP-83). The effect key keeps
            # a house rule's clone apart from a custom item of the book armour's name, which a campaign may already
            # hold when the rule is switched on (a condition would do the same, but Django 5.0 writes a partial
            # NULLS NOT DISTINCT index's SQL in the wrong order)
            models.UniqueConstraint(
                fields=["campaign", "campaign_type", "name", "type", "generated_effect_key"],
                name="item_unique_name_type",
                nulls_distinct=False,
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.type})"


class ItemAvailability(models.Model):
    """
    One availability option for an item. Items may have multiple availabilities
    with different cost/rarity for different restriction groups.
    """

    item = models.ForeignKey(Item, related_name="availabilities", on_delete=models.CASCADE)
    cost = models.PositiveIntegerField(default=0)
    rarity = models.PositiveSmallIntegerField(default=2, validators=[MinValueValidator(2), MaxValueValidator(20)])
    restrictions: models.ManyToManyField = models.ManyToManyField(
        "restrictions.Restriction",
        through="ItemAvailabilityRestriction",
        related_name="item_availabilities",
        blank=True,
    )
    variable_cost = models.CharField(max_length=120, null=True, blank=True)

    class Meta:
        db_table = "item_availability"
        ordering = ["cost"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rarity__gte=2, rarity__lte=20),
                name="item_availability_rarity_range",
            )
        ]

    def __str__(self):
        return f"{self.item_id}: {self.cost}gc (rarity {self.rarity})"


class ItemAvailabilityRestriction(models.Model):
    item_availability = models.ForeignKey(
        ItemAvailability,
        related_name="restriction_links",
        on_delete=models.CASCADE,
    )
    restriction = models.ForeignKey(
        "restrictions.Restriction",
        related_name="item_availability_links",
        on_delete=models.CASCADE,
    )
    additional_note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "item_availability_restriction"
        constraints = [
            models.UniqueConstraint(
                fields=["item_availability", "restriction", "additional_note"],
                name="unique_item_availability_restriction",
            )
        ]

    def __str__(self):
        return f"{self.item_availability_id}:{self.restriction_id}"


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
    item = models.ForeignKey(Item, related_name="property_links", on_delete=models.CASCADE)
    property = models.ForeignKey(ItemProperty, related_name="item_links", on_delete=models.CASCADE)

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
