from django.db import models

from apps.core.models import CatalogueEntry, version_constraints
from apps.warbands.models.shared import StatBlock, stat_constraints

MOUNT, PET, CREATURE = "mount", "pet", "creature"
BEAST_KINDS = ((MOUNT, "Mount"), (PET, "Pet"), (CREATURE, "Creature"))  # the Animal item's subtype is the label


class BestiaryEntry(StatBlock, CatalogueEntry):
    """A beast: a mount or a pet (a companion: it belongs to the unit carrying its item) or a creature (it becomes
    henchmen). `available_in_shop` decides whether the shop sells it.

    `has_profile` off: the beast has no stat line (most pets); its stats are kept at 0 and its save empty, and the
    pages hide them rather than show zeros. `gains_xp` is for creatures, `rating_bonus` for mounts (what the rider's
    rating gains: a horse 3, a warhorse 5).
    """

    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="bestiary_entries",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    kind = models.CharField(max_length=10, choices=BEAST_KINDS, db_index=True)
    description = models.TextField(max_length=4000, blank=True, default="")
    has_profile = models.BooleanField(default=True)
    gains_xp = models.BooleanField(default=False)
    rating_bonus = models.PositiveSmallIntegerField(null=True, blank=True)
    available_in_shop = models.BooleanField(default=False)
    armour_save = models.SmallIntegerField(null=True, blank=True)
    large = models.BooleanField(default=False)
    caster = models.CharField(
        max_length=20,
        default="No",
        choices=(
            ("No", "No"),
            ("Wizard", "Wizard"),
            ("Priest", "Priest"),
        ),
    )

    skills: models.ManyToManyField = models.ManyToManyField(
        "skills.Skill",
        through="BestiaryEntrySkill",
        related_name="bestiary_entries",
        blank=True,
    )
    specials: models.ManyToManyField = models.ManyToManyField(
        "special.Special",
        through="BestiaryEntrySpecial",
        related_name="bestiary_entries",
        blank=True,
    )
    spells: models.ManyToManyField = models.ManyToManyField(
        "spells.Spell",
        through="BestiaryEntrySpell",
        related_name="bestiary_entries",
        blank=True,
    )
    items: models.ManyToManyField = models.ManyToManyField(
        "items.Item",
        through="BestiaryEntryItem",
        related_name="bestiary_entries",
        blank=True,
    )

    class Meta:
        db_table = "bestiary_entry"
        ordering = ["kind", "name"]
        verbose_name_plural = "bestiary entries"
        constraints = [
            *stat_constraints("bestiary_entry"),
            *version_constraints("bestiary_entry"),
            models.CheckConstraint(check=models.Q(kind__in=[MOUNT, PET, CREATURE]), name="bestiary_entry_kind"),
            # one entry per name in the book and in a campaign, as seed_bestiary upserts (BUG-17, IMP-83)
            models.UniqueConstraint(
                fields=["campaign", "name"], name="bestiary_entry_unique_name", nulls_distinct=False
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.kind})"


class BestiaryEntrySkill(models.Model):
    bestiary_entry = models.ForeignKey(
        BestiaryEntry,
        related_name="bestiary_entry_skills",
        on_delete=models.CASCADE,
    )
    skill = models.ForeignKey(
        "skills.Skill",
        related_name="bestiary_entry_skills",
        on_delete=models.RESTRICT,  # an entry in use can't be deleted (BUG-16)
    )

    class Meta:
        db_table = "bestiary_entry_skill"

    def __str__(self):
        return f"{self.bestiary_entry_id}:{self.skill_id}"


class BestiaryEntrySpecial(models.Model):
    bestiary_entry = models.ForeignKey(
        BestiaryEntry,
        related_name="bestiary_entry_specials",
        on_delete=models.CASCADE,
    )
    special = models.ForeignKey(
        "special.Special",
        related_name="bestiary_entry_specials",
        on_delete=models.RESTRICT,  # an entry in use can't be deleted (BUG-16)
    )

    class Meta:
        db_table = "bestiary_entry_special"

    def __str__(self):
        return f"{self.bestiary_entry_id}:{self.special_id}"


class BestiaryEntrySpell(models.Model):
    bestiary_entry = models.ForeignKey(
        BestiaryEntry,
        related_name="bestiary_entry_spells",
        on_delete=models.CASCADE,
    )
    spell = models.ForeignKey(
        "spells.Spell",
        related_name="bestiary_entry_spells",
        on_delete=models.RESTRICT,  # an entry in use can't be deleted (BUG-16)
    )

    class Meta:
        db_table = "bestiary_entry_spell"

    def __str__(self):
        return f"{self.bestiary_entry_id}:{self.spell_id}"


class BestiaryEntryItem(models.Model):
    bestiary_entry = models.ForeignKey(
        BestiaryEntry,
        related_name="bestiary_entry_items",
        on_delete=models.CASCADE,
    )
    item = models.ForeignKey(
        "items.Item",
        related_name="bestiary_entry_items",
        on_delete=models.RESTRICT,  # an entry in use can't be deleted (BUG-16)
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "bestiary_entry_item"
        constraints = [
            models.UniqueConstraint(
                fields=["bestiary_entry", "item"],
                name="unique_bestiary_entry_item",
            )
        ]

    def __str__(self):
        return f"{self.bestiary_entry_id}:{self.item_id} x{self.quantity}"


class WarbandBestiaryFavourite(models.Model):
    warband = models.ForeignKey(
        "warbands.Warband",
        related_name="bestiary_favourites",
        on_delete=models.CASCADE,
    )
    bestiary_entry = models.ForeignKey(
        BestiaryEntry,
        related_name="warband_favourites",
        on_delete=models.CASCADE,
    )

    class Meta:
        db_table = "warband_bestiary_favourite"
        constraints = [
            models.UniqueConstraint(
                fields=["warband", "bestiary_entry"],
                name="unique_warband_bestiary_favourite",
            )
        ]

    def __str__(self):
        return f"{self.warband_id}:{self.bestiary_entry_id}"
