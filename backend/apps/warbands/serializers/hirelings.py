"""Hireling payloads (hired swords and dramatis personae): the fields each one lists (the shared parts are in
apps/warbands/units/serializers.py).

The hire fee and upkeep are structured fees (apps/hirelings/fees.py), each resource line with the names that pay it.
`armour_save` is listed twice (once more through STAT_FIELDS), as before; it keeps its first position.
"""

from apps.hirelings.fees import FeeField
from apps.warbands.models import Hireling
from apps.warbands.units.kinds import HIRELING
from apps.warbands.units.serializers import (
    COMPANION_FIELDS,
    MISSING_FIELDS,
    PICK_FIELDS,
    STAT_FIELDS,
    XP_CHANGE_FIELDS,
    UnitDetailSerializer,
    UnitSummarySerializer,
    UnitWriteSerializer,
)

WRITE_FIELDS = (
    "name",
    "unit_type",
    "kind",
    "race",
    "price",
    "hire_fee",
    "upkeep_fee",
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
    "injury_table",
    "stays",
    "payment_note",
    "dead",
    *STAT_FIELDS,
    "items",
    "skill_ids",
    "special_ids",
    "spell_ids",
)


class HirelingSummarySerializer(UnitSummarySerializer):
    kind = HIRELING
    hire_fee = FeeField(read_only=True)
    upkeep_fee = FeeField(read_only=True)

    class Meta:
        model = Hireling
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "kind",
            "race_id",
            "race_name",
            "price",
            "hire_fee",
            "upkeep_fee",
            "rating",
            "xp",
            "level_up",
            *PICK_FIELDS,
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "no_level_ups",
            "blood_pacted",
            "injury_table",
            "stays",
            "payment_note",
            "dead",
            *MISSING_FIELDS,
            *STAT_FIELDS,
            *COMPANION_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HirelingDetailSerializer(UnitDetailSerializer):
    kind = HIRELING
    hire_fee = FeeField(read_only=True)
    upkeep_fee = FeeField(read_only=True)

    class Meta:
        model = Hireling
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "kind",
            "race_id",
            "race_name",
            "race",
            "price",
            "hire_fee",
            "upkeep_fee",
            "rating",
            "xp",
            "kills",
            "level_up",
            *PICK_FIELDS,
            "deeds",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "no_level_ups",
            "blood_pacted",
            "injury_table",
            "stays",
            "payment_note",
            "dead",
            *MISSING_FIELDS,
            *STAT_FIELDS,
            *COMPANION_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
            "updated_at",  # the version a roster Save sends back (409 when it changed)
        )


class HirelingCreateSerializer(UnitWriteSerializer):
    kind = HIRELING
    hire_fee = FeeField(required=False)
    upkeep_fee = FeeField(required=False)

    class Meta:
        model = Hireling
        fields = WRITE_FIELDS


class HirelingUpdateSerializer(UnitWriteSerializer):
    kind = HIRELING
    hire_fee = FeeField(required=False)
    upkeep_fee = FeeField(required=False)

    class Meta:
        model = Hireling
        fields = (*WRITE_FIELDS, *MISSING_FIELDS, *PICK_FIELDS, *XP_CHANGE_FIELDS)
