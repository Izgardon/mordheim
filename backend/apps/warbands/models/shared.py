from typing import TYPE_CHECKING

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

if TYPE_CHECKING:
    from .warband import Warband

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


class RosterUnit(StatBlock):
    """The fields every roster unit shares: heroes, henchmen groups and hired swords (one table per kind).

    The `warband` and `race` foreign keys and the loadout links stay on each kind's model because their
    related names differ; kind-only fields stay there too. See apps/warbands/units/kinds.py.
    """

    name = models.CharField(max_length=120, default="")
    unit_type = models.CharField(max_length=80, db_column="type", default="")
    price = models.PositiveIntegerField(default=0)
    xp = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    level_up = models.PositiveSmallIntegerField(default=0)
    level_up_history = models.JSONField(default=list, blank=True)
    deeds = models.TextField(max_length=2000, null=True, blank=True)
    armour_save = models.SmallIntegerField(null=True, blank=True)
    large = models.BooleanField(default=False)
    half_rate = models.BooleanField(default=False)
    dead = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    if TYPE_CHECKING:  # declared by each kind's model
        warband: Warband
        warband_id: int
        race_id: int | None

    class Meta:
        abstract = True
