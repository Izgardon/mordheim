from django.db import models

from .shared import StatBlock, stat_constraints
from .warband import Warband


class HiredSword(StatBlock):
    warband = models.ForeignKey(
        Warband, related_name="hired_swords", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120, default="")
    unit_type = models.CharField(max_length=80, db_column="type", default="")
    race = models.ForeignKey(
        "races.Race",
        related_name="hired_swords",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    xp = models.PositiveIntegerField(default=0)
    deeds = models.TextField(max_length=2000, null=True, blank=True)
    armour_save = models.CharField(max_length=20, null=True, blank=True)
    large = models.BooleanField(default=False)
    half_rate = models.BooleanField(default=False)
    rating = models.PositiveIntegerField(default=0)
    blood_pacted = models.BooleanField(default=False)
    dead = models.BooleanField(default=False)

    items = models.ManyToManyField(
        "items.Item",
        through="HiredSwordItem",
        related_name="hired_swords",
        blank=True,
    )
    skills = models.ManyToManyField(
        "skills.Skill",
        through="HiredSwordSkill",
        related_name="hired_swords",
        blank=True,
    )

    class Meta:
        db_table = "hired_sword"
        constraints = stat_constraints("hired_sword")

    def __str__(self):
        return f"{self.name} ({self.warband_id})"


class HiredSwordItem(models.Model):
    hired_sword = models.ForeignKey(
        HiredSword, related_name="hired_sword_items", on_delete=models.CASCADE
    )
    item = models.ForeignKey(
        "items.Item", related_name="hired_sword_items", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "hired_sword_item"
        constraints = [
            models.UniqueConstraint(
                fields=["hired_sword", "item"], name="unique_hired_sword_item"
            )
        ]

    def __str__(self):
        return f"{self.hired_sword_id}:{self.item_id}"


class HiredSwordSkill(models.Model):
    hired_sword = models.ForeignKey(
        HiredSword, related_name="hired_sword_skills", on_delete=models.CASCADE
    )
    skill = models.ForeignKey(
        "skills.Skill", related_name="hired_sword_skills", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "hired_sword_skill"
        constraints = [
            models.UniqueConstraint(
                fields=["hired_sword", "skill"], name="unique_hired_sword_skill"
            )
        ]

    def __str__(self):
        return f"{self.hired_sword_id}:{self.skill_id}"


class HiredSwordOther(models.Model):
    hired_sword = models.ForeignKey(
        HiredSword, related_name="other_entries", on_delete=models.CASCADE
    )
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=500)

    class Meta:
        db_table = "hired_sword_other"

    def __str__(self):
        return f"{self.hired_sword_id}:{self.title}"
