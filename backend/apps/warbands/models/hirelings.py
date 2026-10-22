from django.db import models

from .shared import RosterUnit, stat_constraints
from .warband import Warband


class Hireling(RosterUnit):
    warband = models.ForeignKey(Warband, related_name="hirelings", on_delete=models.CASCADE)
    race = models.ForeignKey(
        "races.Race",
        related_name="hirelings",
        on_delete=models.RESTRICT,  # a race in use can't be deleted (BUG-130)
        null=True,
        blank=True,
    )
    hire_cost_expression = models.CharField(max_length=100, default="", blank=True)
    upkeep_price = models.PositiveIntegerField(default=0)
    upkeep_cost_expression = models.CharField(max_length=100, default="", blank=True)
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
