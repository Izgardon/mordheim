"""Items (the items rebuild): an item, its rules, its price rows and who may buy each.

An item's text is its flavour (the fluff) and its rules in order (`ItemRuleLink`): a shared rule (`ItemRule`: Parry,
Concussion), worded the item's own way only where it differs, or a rule only it has, either with D6 tables. Its
figures (range, strength, save) hold short values only; conditions live in its rules. Its setting (`campaign_type`)
holds its grade: every book item has one (the import's), a campaign's own items none (always in play there).

A price row (`ItemAvailability`) is a cost with optional dice ("25 + 2D6", "200 + D6x25"), a rarity (none: Common), a
label naming the variant ("Brace") and a note shown when buying, never checked ("Heroes only"). Who may buy it is the
row's own list: for everyone (minus the excluded), or warband types and groups (`ItemAvailabilityWarband`).
`items/offers.py` picks the row a warband sees.
"""

from django.db import models

from apps.core.models import CatalogueEntry, PrebattleRoll, version_constraints
from apps.warbands.models.types import WarbandAccess, access_constraints

ANIMAL = "Animal"  # the item type of a beast: one per bestiary entry, written by the bestiary only


class Item(CatalogueEntry):
    """A catalogue item. `listed`: the shop sells it (an Animal item's follows its beast's `available_in_shop`; an item
    that isn't listed still resolves everywhere else). An Animal item is its beast's (`bestiary_entry`, one each),
    kept in step by the bestiary's writes and versioned, reverted, archived and removed with it. `variant` tells two
    items of one name apart (shown in brackets); the book is upserted by name and variant."""

    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="items",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    campaign_type = models.ForeignKey(  # its setting, which holds its grade; every book item has one
        "campaigns.CampaignType", related_name="items", null=True, blank=True, on_delete=models.RESTRICT
    )
    name = models.CharField(max_length=255)
    variant = models.CharField(max_length=80, blank=True, default="")
    type = models.CharField(max_length=80, db_index=True)
    subtype = models.CharField(max_length=80, blank=True, default="")
    single_use = models.BooleanField(default=False)
    flavour = models.TextField(max_length=4000, blank=True, default="")
    strength = models.CharField(max_length=80, blank=True, null=True)
    range = models.CharField(max_length=80, blank=True, null=True)
    save_value = models.CharField(max_length=80, blank=True, null=True, db_column="save")
    statblock = models.TextField(blank=True, null=True)  # JSON: a vehicle's or an animal's profile rows
    source = models.CharField(max_length=200, blank=True, default="")  # "Town Cryer #6"
    link_url = models.URLField(max_length=500, blank=True, default="")  # mordheimer's or Broheim's page
    tags = models.JSONField(default=list, blank=True)  # search words: "scimitar" finds Sword
    notes = models.TextField(max_length=4000, blank=True, default="")  # editor's notes
    # set on a house rule's generated version (its `replaces` is the book item the rule changes); editing the version
    # clears it, and the rule leaves the version alone from then on
    generated_effect_key = models.CharField(max_length=80, blank=True, null=True, db_index=True)
    bestiary_entry = models.OneToOneField(
        "bestiary.BestiaryEntry",
        related_name="animal_item",
        null=True,
        blank=True,
        on_delete=models.CASCADE,  # the item goes with its beast (RESTRICT holders keep both: the beast is archived)
    )
    listed = models.BooleanField(default=True)

    class Meta:
        db_table = "item"
        ordering = ["type", "name"]
        constraints = [
            *version_constraints("item"),  # one version per book item in a campaign, a house rule's clone included
            # one item per name and variant in the book and in a campaign (BUG-17, IMP-83). The effect key keeps a
            # house rule's clone apart from a custom item of the book armour's name
            models.UniqueConstraint(
                fields=["campaign", "name", "variant", "generated_effect_key"],
                name="item_unique_name_variant",
                nulls_distinct=False,
            ),
            models.CheckConstraint(  # an Animal item has its beast, and only an Animal item has one
                check=models.Q(type=ANIMAL, bestiary_entry__isnull=False)
                | (~models.Q(type=ANIMAL) & models.Q(bestiary_entry__isnull=True)),
                name="item_animal_has_its_beast",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.variant})" if self.variant else self.name


class ItemRule(PrebattleRoll):
    """A rule several items share, from the import (`slug`); a campaign adds its own (no slug). A unit carrying an item
    with it rolls its pre-battle roll, if it has one (`PrebattleRoll`)."""

    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="item_rules", null=True, blank=True, on_delete=models.CASCADE
    )  # null: the book
    slug = models.SlugField(max_length=120, blank=True, default="")
    name = models.CharField(max_length=120)
    summary = models.TextField(max_length=1000, blank=True, default="")
    text = models.TextField(max_length=4000, blank=True, default="")

    class Meta:
        db_table = "item_rule"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(  # the import's rules, upserted by slug
                fields=["slug"], condition=models.Q(campaign__isnull=True) & ~models.Q(slug=""), name="item_rule_slug"
            ),
        ]

    def __str__(self):
        return self.name


class ItemRuleLink(models.Model):
    """One of an item's rules, in order: a shared rule (`rule`), its text only where the item words it differently, or
    (no rule) one only this item has, with its name. `table`: its D6 tables, each `{columns, rows}` (a row's first
    cell is the roll); a `{{table:N}}` marker in the text says where the Nth stands."""

    item = models.ForeignKey(Item, related_name="rule_links", on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField(default=0)
    rule = models.ForeignKey(ItemRule, related_name="links", null=True, blank=True, on_delete=models.RESTRICT)
    name = models.CharField(max_length=120, blank=True, default="")
    summary = models.TextField(max_length=1000, blank=True, default="")
    text = models.TextField(max_length=4000, blank=True, default="")
    table = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "item_rule_link"
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.item_id}:{self.rule_id or self.name}"


class ItemAvailability(models.Model):
    """One price of an item: its cost (none: see `cost_note`), dice added to it, rarity (none: Common), and who may buy
    it. `label` names a variant row ("Brace"); `note` is shown when buying and never checked."""

    item = models.ForeignKey(Item, related_name="availabilities", on_delete=models.CASCADE)
    label = models.CharField(max_length=80, blank=True, default="")
    cost = models.PositiveIntegerField(null=True, blank=True)
    dice = models.PositiveSmallIntegerField(null=True, blank=True)  # "30 + 2D6": 2
    dice_multiplier = models.PositiveIntegerField(null=True, blank=True)  # "200 + D6x25": 25
    cost_note = models.CharField(max_length=120, blank=True, default="")  # "per pair", "4 x Price"
    rarity = models.PositiveSmallIntegerField(null=True, blank=True)  # null: Common
    for_everyone = models.BooleanField(default=False)
    note = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        db_table = "item_availability"
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rarity__isnull=True) | models.Q(rarity__gte=2, rarity__lte=20),
                name="item_availability_rarity_range",
            ),
            models.CheckConstraint(
                check=models.Q(dice_multiplier__isnull=True) | models.Q(dice__isnull=False),
                name="item_availability_multiplier_has_dice",
            ),
        ]

    def __str__(self):
        return f"{self.item_id}: {self.cost}gc (rarity {self.rarity or 'Common'})"


class ItemAvailabilityWarband(WarbandAccess):
    """Who may (or may not) buy at a price row: a warband type or a warband group."""

    availability = models.ForeignKey(ItemAvailability, related_name="warband_links", on_delete=models.CASCADE)

    class Meta:
        db_table = "item_availability_warband"
        ordering = ["id"]
        constraints = access_constraints("item_availability_warband")

    def __str__(self):
        return f"{self.availability_id}:{self.warband_type_id or self.warband_group_id}"
