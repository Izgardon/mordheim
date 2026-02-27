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


class HiredSwordProfile(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="hired_sword_profiles",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    bestiary_entry = models.OneToOneField(
        BestiaryEntry,
        related_name="hired_sword_profile",
        on_delete=models.CASCADE,
    )
    hire_cost = models.PositiveIntegerField(null=True, blank=True)
    hire_cost_expression = models.CharField(max_length=120, blank=True, default="")
    upkeep_cost = models.PositiveIntegerField(null=True, blank=True)
    upkeep_cost_expression = models.CharField(max_length=120, blank=True, default="")
    grade = models.CharField(max_length=20, blank=True, default="")
    available_skill_types = models.JSONField(default=dict, blank=True)
    available_special_skills = models.ManyToManyField(
        "skills.Skill",
        through="HiredSwordProfileAvailableSkill",
        related_name="available_in_hired_sword_profiles",
        blank=True,
    )
    restrictions = models.ManyToManyField(
        "restrictions.Restriction",
        through="HiredSwordProfileRestriction",
        related_name="hired_sword_profiles",
        blank=True,
    )

    class Meta:
        db_table = "hired_sword_profile"
        ordering = ["bestiary_entry__name"]

    def __str__(self):
        return f"Hired Sword Profile: {self.bestiary_entry.name}"


class HiredSwordProfileRestriction(models.Model):
    hired_sword_profile = models.ForeignKey(
        HiredSwordProfile,
        related_name="restriction_links",
        on_delete=models.CASCADE,
    )
    restriction = models.ForeignKey(
        "restrictions.Restriction",
        related_name="hired_sword_profile_links",
        on_delete=models.CASCADE,
    )
    additional_note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "hired_sword_profile_restriction"
        constraints = [
            models.UniqueConstraint(
                fields=["hired_sword_profile", "restriction", "additional_note"],
                name="unique_hired_sword_profile_restriction",
            )
        ]

    def __str__(self):
        return f"{self.hired_sword_profile_id}:{self.restriction_id}"


class HiredSwordProfileAvailableSkill(models.Model):
    hired_sword_profile = models.ForeignKey(
        HiredSwordProfile,
        related_name="hired_sword_profile_available_skills",
        on_delete=models.CASCADE,
    )
    skill = models.ForeignKey(
        "skills.Skill",
        related_name="hired_sword_profile_available_skills",
        on_delete=models.CASCADE,
    )

    class Meta:
        db_table = "hired_sword_profile_available_skill"
        constraints = [
            models.UniqueConstraint(
                fields=["hired_sword_profile", "skill"],
                name="unique_hired_sword_profile_available_skill",
            )
        ]

    def __str__(self):
        return f"{self.hired_sword_profile_id}:{self.skill_id}"
