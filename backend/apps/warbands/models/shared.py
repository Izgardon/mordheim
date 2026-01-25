from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

STAT_FIELDS = [
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
]

STAT_VALIDATORS = [MinValueValidator(0), MaxValueValidator(10)]


def stat_constraints(prefix):
    return [
        models.CheckConstraint(
            check=models.Q(**{f"{field}__gte": 0, f"{field}__lte": 10}),
            name=f"{prefix}_{field}_range",
        )
        for field in STAT_FIELDS
    ]


class StatBlock(models.Model):
    movement = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    weapon_skill = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    ballistic_skill = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    strength = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    toughness = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    wounds = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    initiative = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    attacks = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)
    leadership = models.PositiveSmallIntegerField(validators=STAT_VALIDATORS, default=0)

    class Meta:
        abstract = True
