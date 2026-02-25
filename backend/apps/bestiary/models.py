from django.db import models

from apps.warbands.models.shared import StatBlock, stat_constraints


class BestiaryEntry(StatBlock):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="bestiary_entries",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    type = models.CharField(max_length=80, db_index=True)
    description = models.TextField(max_length=4000, blank=True, default="")
    armour_save = models.CharField(max_length=20, blank=True, default="")
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

    skills = models.ManyToManyField(
        "skills.Skill",
        through="BestiaryEntrySkill",
        related_name="bestiary_entries",
        blank=True,
    )
    specials = models.ManyToManyField(
        "special.Special",
        through="BestiaryEntrySpecial",
        related_name="bestiary_entries",
        blank=True,
    )
    spells = models.ManyToManyField(
        "spells.Spell",
        through="BestiaryEntrySpell",
        related_name="bestiary_entries",
        blank=True,
    )
    items = models.ManyToManyField(
        "items.Item",
        through="BestiaryEntryItem",
        related_name="bestiary_entries",
        blank=True,
    )

    class Meta:
        db_table = "bestiary_entry"
        ordering = ["type", "name"]
        verbose_name_plural = "bestiary entries"
        constraints = stat_constraints("bestiary_entry")

    def __str__(self):
        return f"{self.name} ({self.type})"


class BestiaryEntrySkill(models.Model):
    bestiary_entry = models.ForeignKey(
        BestiaryEntry,
        related_name="bestiary_entry_skills",
        on_delete=models.CASCADE,
    )
    skill = models.ForeignKey(
        "skills.Skill",
        related_name="bestiary_entry_skills",
        on_delete=models.CASCADE,
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
        on_delete=models.CASCADE,
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
        on_delete=models.CASCADE,
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
        on_delete=models.CASCADE,
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
