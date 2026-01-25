from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

STAT_VALIDATORS = [MinValueValidator(0), MaxValueValidator(10)]


class Race(models.Model):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        related_name="races",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    movement = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    weapon_skill = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    ballistic_skill = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    strength = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    toughness = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    wounds = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    initiative = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    attacks = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)
    leadership = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS)

    class Meta:
        db_table = "race"
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(movement__gte=0, movement__lte=10),
                name="race_movement_range",
            ),
            models.CheckConstraint(
                check=models.Q(weapon_skill__gte=0, weapon_skill__lte=10),
                name="race_weapon_skill_range",
            ),
            models.CheckConstraint(
                check=models.Q(ballistic_skill__gte=0, ballistic_skill__lte=10),
                name="race_ballistic_skill_range",
            ),
            models.CheckConstraint(
                check=models.Q(strength__gte=0, strength__lte=10),
                name="race_strength_range",
            ),
            models.CheckConstraint(
                check=models.Q(toughness__gte=0, toughness__lte=10),
                name="race_toughness_range",
            ),
            models.CheckConstraint(
                check=models.Q(wounds__gte=0, wounds__lte=10),
                name="race_wounds_range",
            ),
            models.CheckConstraint(
                check=models.Q(initiative__gte=0, initiative__lte=10),
                name="race_initiative_range",
            ),
            models.CheckConstraint(
                check=models.Q(attacks__gte=0, attacks__lte=10),
                name="race_attacks_range",
            ),
            models.CheckConstraint(
                check=models.Q(leadership__gte=0, leadership__lte=10),
                name="race_leadership_range",
            ),
        ]

    def __str__(self):
        return self.name
