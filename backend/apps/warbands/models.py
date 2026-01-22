from django.conf import settings
from django.db import models


class Warband(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign", related_name="warbands", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="warbands", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120)
    faction = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warband"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "user"], name="unique_campaign_warband"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.campaign_id}:{self.user_id})"


class Hero(models.Model):
    warband = models.ForeignKey(
        Warband, related_name="heroes", on_delete=models.CASCADE
    )
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
    name = models.CharField(max_length=120, null=True, blank=True)
    unit_type = models.CharField(max_length=80, null=True, blank=True)
    race = models.CharField(max_length=80, null=True, blank=True)
    stats = models.JSONField(null=True, blank=True)
    experience = models.IntegerField(null=True, blank=True)
    hire_cost = models.IntegerField(null=True, blank=True)
    available_skills = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "warband_hero"

    def __str__(self):
        return f"{self.name or 'Hero'} ({self.warband_id})"


class HeroItem(models.Model):
    hero = models.ForeignKey(
        Hero, related_name="hero_items", on_delete=models.CASCADE
    )
    item = models.ForeignKey(
        "items.Item", related_name="hero_items", on_delete=models.CASCADE
    )

    class Meta:
        db_table = "warband_hero_item"
        constraints = [
            models.UniqueConstraint(
                fields=["hero", "item"], name="unique_hero_item"
            )
        ]

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
        db_table = "warband_hero_skill"
        constraints = [
            models.UniqueConstraint(
                fields=["hero", "skill"], name="unique_hero_skill"
            )
        ]

    def __str__(self):
        return f"{self.hero_id}:{self.skill_id}"
