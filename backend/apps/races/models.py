from django.db import models


class Race(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="races",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    movement = models.CharField(max_length=10)
    weapon_skill = models.CharField(max_length=10)
    ballistic_skill = models.CharField(max_length=10)
    strength = models.CharField(max_length=10)
    toughness = models.CharField(max_length=10)
    wounds = models.CharField(max_length=10)
    initiative = models.CharField(max_length=10)
    attacks = models.CharField(max_length=10)
    leadership = models.CharField(max_length=10)

    class Meta:
        db_table = "race"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "name"], name="unique_campaign_race"
            ),
            models.UniqueConstraint(
                fields=["name"],
                condition=models.Q(campaign__isnull=True),
                name="unique_global_race_name",
            ),
        ]

    def __str__(self):
        return self.name
