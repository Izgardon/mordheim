from django.db import models

from .shared import RosterUnit, stat_constraints
from .warband import Warband

HIRELING_KINDS = (("hired_sword", "Hired sword"), ("dramatis_persona", "Dramatis persona"))
INJURY_TABLES = (("henchman", "Henchman"), ("hero", "Hero"))  # a d6, or the campaign's hero death roll
STAYS = (("always", "Always"), ("one_battle", "One battle"))


class Hireling(RosterUnit):
    """A hired sword or a dramatis persona in a warband: a copy of what it was hired as (or typed by hand) that keeps
    no link to the catalogue. `injury_table` is the hired sword's henchman d6 or the dramatis persona's hero table,
    and a house rule may change it; `stays` and `payment_note` come from a dramatis persona."""

    warband = models.ForeignKey(Warband, related_name="hirelings", on_delete=models.CASCADE)
    race = models.ForeignKey(
        "races.Race",
        related_name="hirelings",
        on_delete=models.RESTRICT,  # a race in use can't be deleted (BUG-130)
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=20, choices=HIRELING_KINDS, default="hired_sword")
    hire_cost_expression = models.CharField(max_length=120, default="", blank=True)
    upkeep_price = models.PositiveIntegerField(default=0)
    upkeep_cost_expression = models.CharField(max_length=120, default="", blank=True)
    kills = models.PositiveIntegerField(default=0)
    caster = models.CharField(
        max_length=20,
        default="No",
        choices=(
            ("No", "No"),
            ("Wizard", "Wizard"),
            ("Priest", "Priest"),
        ),
    )
    available_skills = models.JSONField(default=dict, blank=True)
    no_level_ups = models.BooleanField(default=False)
    rating = models.PositiveIntegerField(default=0)
    blood_pacted = models.BooleanField(default=False)
    injury_table = models.CharField(max_length=20, choices=INJURY_TABLES, default="henchman")
    stays = models.CharField(max_length=20, choices=STAYS, default="always")
    payment_note = models.CharField(max_length=200, blank=True, default="")

    items: models.ManyToManyField = models.ManyToManyField(
        "items.Item",
        through="HirelingItem",
        related_name="hirelings",
        blank=True,
    )
    skills: models.ManyToManyField = models.ManyToManyField(
        "skills.Skill",
        through="HirelingSkill",
        related_name="hirelings",
        blank=True,
    )
    spells: models.ManyToManyField = models.ManyToManyField(
        "spells.Spell",
        through="HirelingSpell",
        related_name="hirelings",
        blank=True,
    )
    specials: models.ManyToManyField = models.ManyToManyField(
        "special.Special",
        through="HirelingSpecial",
        related_name="hirelings",
        blank=True,
    )

    class Meta:
        db_table = "hireling"
        constraints = stat_constraints("hireling")

    def __str__(self):
        return f"{self.name} ({self.warband_id})"


class HirelingItem(models.Model):
    hireling = models.ForeignKey(Hireling, related_name="hireling_items", on_delete=models.CASCADE)
    item = models.ForeignKey("items.Item", related_name="hireling_items", on_delete=models.RESTRICT)
    cost = models.PositiveIntegerField(null=True, blank=True)
    companion = models.BooleanField(default=False)  # a mount or pet switched on for it (units/companions.py)

    class Meta:
        db_table = "hireling_item"

    def __str__(self):
        return f"{self.hireling_id}:{self.item_id}"


class HirelingSkill(models.Model):
    hireling = models.ForeignKey(Hireling, related_name="hireling_skills", on_delete=models.CASCADE)
    skill = models.ForeignKey("skills.Skill", related_name="hireling_skills", on_delete=models.RESTRICT)

    class Meta:
        db_table = "hireling_skill"

    def __str__(self):
        return f"{self.hireling_id}:{self.skill_id}"


class HirelingSpecial(models.Model):
    hireling = models.ForeignKey(Hireling, related_name="hireling_specials", on_delete=models.CASCADE)
    special = models.ForeignKey("special.Special", related_name="hireling_specials", on_delete=models.RESTRICT)

    class Meta:
        db_table = "hireling_special"

    def __str__(self):
        return f"{self.hireling_id}:{self.special_id}"


class HirelingSpell(models.Model):
    hireling = models.ForeignKey(Hireling, related_name="hireling_spells", on_delete=models.CASCADE)
    spell = models.ForeignKey("spells.Spell", related_name="hireling_spells", on_delete=models.RESTRICT)

    class Meta:
        db_table = "hireling_spell"

    def __str__(self):
        return f"{self.hireling_id}:{self.spell_id}"
