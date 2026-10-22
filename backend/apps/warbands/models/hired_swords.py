from django.db import models

from .shared import RosterUnit, stat_constraints
from .warband import Warband


class HiredSword(RosterUnit):
    warband = models.ForeignKey(Warband, related_name="hired_swords", on_delete=models.CASCADE)
    race = models.ForeignKey(
        "races.Race",
        related_name="hired_swords",
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
        through="HiredSwordItem",
        related_name="hired_swords",
        blank=True,
    )
    skills: models.ManyToManyField = models.ManyToManyField(
        "skills.Skill",
        through="HiredSwordSkill",
        related_name="hired_swords",
        blank=True,
    )
    spells: models.ManyToManyField = models.ManyToManyField(
        "spells.Spell",
        through="HiredSwordSpell",
        related_name="hired_swords",
        blank=True,
    )
    specials: models.ManyToManyField = models.ManyToManyField(
        "special.Special",
        through="HiredSwordSpecial",
        related_name="hired_swords",
        blank=True,
    )

    class Meta:
        db_table = "hired_sword"
        constraints = stat_constraints("hired_sword")

    def __str__(self):
        return f"{self.name} ({self.warband_id})"


class HiredSwordItem(models.Model):
    hired_sword = models.ForeignKey(HiredSword, related_name="hired_sword_items", on_delete=models.CASCADE)
    item = models.ForeignKey("items.Item", related_name="hired_sword_items", on_delete=models.RESTRICT)
    cost = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "hired_sword_item"

    def __str__(self):
        return f"{self.hired_sword_id}:{self.item_id}"


class HiredSwordSkill(models.Model):
    hired_sword = models.ForeignKey(HiredSword, related_name="hired_sword_skills", on_delete=models.CASCADE)
    skill = models.ForeignKey("skills.Skill", related_name="hired_sword_skills", on_delete=models.RESTRICT)

    class Meta:
        db_table = "hired_sword_skill"

    def __str__(self):
        return f"{self.hired_sword_id}:{self.skill_id}"


class HiredSwordSpecial(models.Model):
    hired_sword = models.ForeignKey(HiredSword, related_name="hired_sword_specials", on_delete=models.CASCADE)
    special = models.ForeignKey("special.Special", related_name="hired_sword_specials", on_delete=models.RESTRICT)

    class Meta:
        db_table = "hired_sword_special"

    def __str__(self):
        return f"{self.hired_sword_id}:{self.special_id}"


class HiredSwordSpell(models.Model):
    hired_sword = models.ForeignKey(HiredSword, related_name="hired_sword_spells", on_delete=models.CASCADE)
    spell = models.ForeignKey("spells.Spell", related_name="hired_sword_spells", on_delete=models.RESTRICT)

    class Meta:
        db_table = "hired_sword_spell"

    def __str__(self):
        return f"{self.hired_sword_id}:{self.spell_id}"
