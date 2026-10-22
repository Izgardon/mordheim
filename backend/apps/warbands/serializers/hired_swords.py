"""Hired sword payloads: the fields each one lists (the shared parts are in apps/warbands/units/serializers.py).

`armour_save` is listed twice (once more through STAT_FIELDS), as before; it keeps its first position.
"""

from apps.warbands.models import Hireling
from apps.warbands.units.kinds import HIRED_SWORD
from apps.warbands.units.serializers import (
    STAT_FIELDS,
    UnitDetailSerializer,
    UnitSummarySerializer,
    UnitWriteSerializer,
)

WRITE_FIELDS = (
    "name",
    "unit_type",
    "race",
    "price",
    "hire_cost_expression",
    "upkeep_price",
    "upkeep_cost_expression",
    "rating",
    "xp",
    "kills",
    "level_up",
    "deeds",
    "armour_save",
    "large",
    "caster",
    "available_skills",
    "half_rate",
    "no_level_ups",
    "blood_pacted",
    "dead",
    *STAT_FIELDS,
    "items",
    "skill_ids",
    "special_ids",
    "spell_ids",
)


class HiredSwordSummarySerializer(UnitSummarySerializer):
    kind = HIRED_SWORD

    class Meta:
        model = Hireling
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "price",
            "hire_cost_expression",
            "upkeep_price",
            "upkeep_cost_expression",
            "rating",
            "xp",
            "level_up",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "no_level_ups",
            "blood_pacted",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HiredSwordDetailSerializer(UnitDetailSerializer):
    kind = HIRED_SWORD

    class Meta:
        model = Hireling
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "race",
            "price",
            "hire_cost_expression",
            "upkeep_price",
            "upkeep_cost_expression",
            "rating",
            "xp",
            "kills",
            "level_up",
            "deeds",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "no_level_ups",
            "blood_pacted",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
            "updated_at",  # the version a roster Save sends back (409 when it changed)
        )


class HiredSwordCreateSerializer(UnitWriteSerializer):
    kind = HIRED_SWORD

    class Meta:
        model = Hireling
        fields = WRITE_FIELDS


class HiredSwordUpdateSerializer(UnitWriteSerializer):
    kind = HIRED_SWORD

    class Meta:
        model = Hireling
        fields = WRITE_FIELDS
