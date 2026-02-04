from django.db import models

from .shared import StatBlock, stat_constraints
from .warband import Warband


class Hero(StatBlock):
    warband = models.ForeignKey(
        Warband, related_name="heroes", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120, default="")
    unit_type = models.CharField(max_length=80, db_column="type", default="")
    race = models.ForeignKey(
        "races.Race",
        related_name="heroes",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    price = models.PositiveIntegerField(default=0)
    xp = models.PositiveIntegerField(default=0)
    kills = models.PositiveIntegerField(default=0)
    level_up = models.PositiveSmallIntegerField(default=0)
    deeds = models.TextField(max_length=2000, null=True, blank=True)
    armour_save = models.CharField(max_length=20, null=True, blank=True)
    large = models.BooleanField(default=False)
    wizard = models.BooleanField(default=False)
    half_rate = models.BooleanField(default=False)
    dead = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    items = models.ManyToManyField(
        "items.Item",
        through="HeroItem",
        related_name="heroes",
        blank=True,
    )
    skills = models.ManyToManyField(
        "skills.Skill",
        through="HeroSkill",
        related_name="heroes",
        blank=True,
    )
    spells = models.ManyToManyField(
        "spells.Spell",
        through="HeroSpell",
        related_name="heroes",
        blank=True,
    )
    features = models.ManyToManyField(
        "features.Feature",
        through="HeroFeature",
        related_name="heroes",
        blank=True,
    )

    class Meta:
        db_table = "hero"
        constraints = stat_constraints("hero")

    def __str__(self):
        return f"{self.name} ({self.warband_id})"


class HeroItem(models.Model):
    hero = models.ForeignKey(
        Hero, related_name="hero_items", on_delete=models.CASCADE
    )
    item = models.ForeignKey(
        "items.Item", related_name="hero_items", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "hero_item"

    def __str__(self):
        return f"{self.hero_id}:{self.item_id}"


class HeroSkill(models.Model):
    hero = models.ForeignKey(
        Hero, related_name="hero_skills", on_delete=models.CASCADE
    )
    skill = models.ForeignKey(
        "skills.Skill", related_name="hero_skills", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "hero_skill"
        constraints = [
            models.UniqueConstraint(
                fields=["hero", "skill"], name="unique_hero_skill"
            )
        ]

    def __str__(self):
        return f"{self.hero_id}:{self.skill_id}"


class HeroFeature(models.Model):
    hero = models.ForeignKey(
        Hero, related_name="hero_features", on_delete=models.CASCADE
    )
    feature = models.ForeignKey(
        "features.Feature", related_name="hero_features", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "hero_feature"

    def __str__(self):
        return f"{self.hero_id}:{self.feature_id}"


class HeroSpell(models.Model):
    hero = models.ForeignKey(
        Hero, related_name="hero_spells", on_delete=models.CASCADE
    )
    spell = models.ForeignKey(
        "spells.Spell", related_name="hero_spells", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "hero_spell"
        constraints = [
            models.UniqueConstraint(
                fields=["hero", "spell"], name="unique_hero_spell"
            )
        ]

    def __str__(self):
        return f"{self.hero_id}:{self.spell_id}"

