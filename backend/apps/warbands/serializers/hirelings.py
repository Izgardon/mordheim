"""Hireling payloads (hired swords and dramatis personae): the fields each one lists (the shared parts are in
apps/warbands/units/serializers.py).

The hire fee and upkeep are structured fees (apps/hirelings/fees.py), each resource line with the names that pay it.
`armour_save` is listed twice (once more through STAT_FIELDS), as before; it keeps its first position.
"""

from rest_framework import serializers

from apps.hirelings.fees import FeeField
from apps.warbands.models import Hireling
from apps.warbands.units.create_serializer import UnitCreateSerializer
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
from apps.warbands.units.services.blood_pacts import can_pact, pact_bonus

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
    "notes",
    "armour_save",
    "large",
    "caster",
    "available_skills",
    "available_spell_types",
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


class BloodPactMixin:
    """What the blood pact fields answer (the server owns the rule, units/services/blood_pacts.py): whether he could
    still swear one, and what he adds to the post-game's 2D6. Both read his own row, so neither costs a query. Each
    payload declares the fields itself, as DRF collects them from serializer classes only."""

    def get_blood_pact_bonus(self, hireling: Hireling) -> int:
        return pact_bonus(hireling)

    def get_can_blood_pact(self, hireling: Hireling) -> bool:
        return can_pact(hireling)


BLOOD_PACT_FIELDS = ("blood_pact_bonus", "can_blood_pact")


class HirelingSummarySerializer(BloodPactMixin, UnitSummarySerializer):
    kind = HIRELING
    hire_fee = FeeField(read_only=True)
    upkeep_fee = FeeField(read_only=True)
    blood_pact_bonus = serializers.SerializerMethodField()
    can_blood_pact = serializers.SerializerMethodField()

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
            "available_spell_types",
            "half_rate",
            "no_level_ups",
            "blood_pacted",
            *BLOOD_PACT_FIELDS,
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


class HirelingDetailSerializer(BloodPactMixin, UnitDetailSerializer):
    kind = HIRELING
    hire_fee = FeeField(read_only=True)
    upkeep_fee = FeeField(read_only=True)
    blood_pact_bonus = serializers.SerializerMethodField()
    can_blood_pact = serializers.SerializerMethodField()

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
            "notes",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "available_spell_types",
            "half_rate",
            "no_level_ups",
            "blood_pacted",
            *BLOOD_PACT_FIELDS,
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


class HirelingCreateSerializer(UnitCreateSerializer):
    kind = HIRELING
    hire_fee = FeeField(required=False)
    upkeep_fee = FeeField(required=False)

    class Meta:
        model = Hireling
        fields = (*WRITE_FIELDS, "pending_spells")  # a hire's spells to pick (units/services/hire.py)


class HirelingUpdateSerializer(UnitWriteSerializer):
    kind = HIRELING
    hire_fee = FeeField(required=False)
    upkeep_fee = FeeField(required=False)

    class Meta:
        model = Hireling
        fields = (*WRITE_FIELDS, *MISSING_FIELDS, *PICK_FIELDS, *XP_CHANGE_FIELDS)
