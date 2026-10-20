from django.db import models

from .shared import RosterUnit, stat_constraints
from .warband import Warband


class HenchmenGroup(RosterUnit):
    warband = models.ForeignKey(Warband, related_name="henchmen_groups", on_delete=models.CASCADE)
    race = models.ForeignKey(
        "races.Race",
        related_name="henchmen_groups",
        on_delete=models.RESTRICT,  # a race in use can't be deleted (BUG-130)
        null=True,
        blank=True,
    )
    max_size = models.PositiveIntegerField(default=5)
    no_level_ups = models.BooleanField(default=False)

    items: models.ManyToManyField = models.ManyToManyField(
        "items.Item",
        through="HenchmenGroupItem",
        related_name="henchmen_groups",
        blank=True,
    )
    skills: models.ManyToManyField = models.ManyToManyField(
        "skills.Skill",
        through="HenchmenGroupSkill",
        related_name="henchmen_groups",
        blank=True,
    )
    specials: models.ManyToManyField = models.ManyToManyField(
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
    group = models.ForeignKey(HenchmenGroup, related_name="henchmen", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    kills = models.PositiveIntegerField(default=0)
    dead = models.BooleanField(default=False)
    dismissed_at = models.DateTimeField(null=True, blank=True)  # left out of a group save: kept as a record

    class Meta:
        db_table = "henchman"

    def __str__(self):
        return f"{self.name} ({self.group_id})"


class HenchmenGroupItem(models.Model):
    henchmen_group = models.ForeignKey(HenchmenGroup, related_name="henchmen_group_items", on_delete=models.CASCADE)
    item = models.ForeignKey("items.Item", related_name="henchmen_group_items", on_delete=models.RESTRICT)
    cost = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "henchmen_group_item"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.item_id}"


class HenchmenGroupSkill(models.Model):
    henchmen_group = models.ForeignKey(HenchmenGroup, related_name="henchmen_group_skills", on_delete=models.CASCADE)
    skill = models.ForeignKey("skills.Skill", related_name="henchmen_group_skills", on_delete=models.RESTRICT)

    class Meta:
        db_table = "henchmen_group_skill"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.skill_id}"


class HenchmenGroupSpecial(models.Model):
    henchmen_group = models.ForeignKey(HenchmenGroup, related_name="henchmen_group_specials", on_delete=models.CASCADE)
    special = models.ForeignKey("special.Special", related_name="henchmen_group_specials", on_delete=models.RESTRICT)

    class Meta:
        db_table = "henchmen_group_special"

    def __str__(self):
        return f"{self.henchmen_group_id}:{self.special_id}"
