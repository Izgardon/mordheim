from django.db import models

from .shared import StatBlock, stat_constraints
from .warband import Warband


class HenchmenGroup(StatBlock):
    warband = models.ForeignKey(
        Warband, related_name="henchmen_groups", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120, default="")
    unit_type = models.CharField(max_length=80, db_column="type", default="")
    race = models.ForeignKey(
        "races.Race",
        related_name="henchmen_groups",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    price = models.PositiveIntegerField(default=0)
    xp = models.PositiveIntegerField(default=0)
    max_size = models.PositiveIntegerField(default=5)
    level_up = models.PositiveSmallIntegerField(default=0)
    level_up_history = models.JSONField(default=list, blank=True)
    deeds = models.TextField(max_length=2000, null=True, blank=True)
    armour_save = models.CharField(max_length=20, null=True, blank=True)
    large = models.BooleanField(default=False)
    half_rate = models.BooleanField(default=False)
    dead = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    items = models.ManyToManyField(
        "items.Item",
        through="HenchmenGroupItem",
        related_name="henchmen_groups",
        blank=True,
    )
    skills = models.ManyToManyField(
        "skills.Skill",
        through="HenchmenGroupSkill",
        related_name="henchmen_groups",
        blank=True,
    )
    specials = models.ManyToManyField(
        "special.Special",
        through="HenchmenGroupSpecial",
        related_name="henchmen_groups",
        blank=True,
    )

    class Meta:
        db_table = "henchmen_group"
        constraints = stat_constraints("henchmen_group")

    def __str__(self):
        return f"{self.name} ({self.warband_id})"


class Henchman(models.Model):
    group = models.ForeignKey(
        HenchmenGroup, related_name="henchmen", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120)
    kills = models.PositiveIntegerField(default=0)
    dead = models.BooleanField(default=False)

    class Meta:
        db_table = "henchman"

    def __str__(self):
        return f"{self.name} ({self.group_id})"


class HenchmenGroupItem(models.Model):
    henchmen_group = models.ForeignKey(
        HenchmenGroup, related_name="henchmen_group_items", on_delete=models.CASCADE
    )
    item = models.ForeignKey(
        "items.Item", related_name="henchmen_group_items", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "henchmen_group_item"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.item_id}"


class HenchmenGroupSkill(models.Model):
    henchmen_group = models.ForeignKey(
        HenchmenGroup, related_name="henchmen_group_skills", on_delete=models.CASCADE
    )
    skill = models.ForeignKey(
        "skills.Skill", related_name="henchmen_group_skills", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "henchmen_group_skill"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.skill_id}"


class HenchmenGroupSpecial(models.Model):
    henchmen_group = models.ForeignKey(
        HenchmenGroup, related_name="henchmen_group_specials", on_delete=models.CASCADE
    )
    special = models.ForeignKey(
        "special.Special", related_name="henchmen_group_specials", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "henchmen_group_special"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.special_id}"
