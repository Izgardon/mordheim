"""Hero payloads: the fields each one lists (the shared parts are in apps/warbands/units/serializers.py)."""

from rest_framework import serializers

from apps.warbands.models import Hero
from apps.warbands.units.kinds import HERO
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
    "race",
    "price",
    "xp",
    "kills",
    "level_up",
    "deeds",
    "notes",
    "is_leader",
    "large",
    "caster",
    "half_rate",
    "trading_action",
    "dead",
    "available_skills",
    "available_spell_types",
    *STAT_FIELDS,
    "items",
)


class HeroSummarySerializer(UnitSummarySerializer):
    kind = HERO

    class Meta:
        model = Hero
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "price",
            "xp",
            "level_up",
            *PICK_FIELDS,
            "is_leader",
            "large",
            "caster",
            "half_rate",
            "trading_action",
            "available_skills",
            "available_spell_types",
            "fighter_key",
            *MISSING_FIELDS,
            *STAT_FIELDS,
            *COMPANION_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HeroDetailSerializer(UnitDetailSerializer):
    kind = HERO

    class Meta:
        model = Hero
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "race",
            "price",
            "xp",
            "kills",
            "level_up",
            *PICK_FIELDS,
            "deeds",
            "notes",
            "is_leader",
            "large",
            "caster",
            "half_rate",
            "trading_action",
            "dead",
            "available_skills",
            "available_spell_types",
            "fighter_key",
            *MISSING_FIELDS,
            *STAT_FIELDS,
            *COMPANION_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
            "updated_at",  # the version a roster Save sends back (409 when it changed)
        )


class HeroCreateSerializer(UnitWriteSerializer):
    kind = HERO

    class Meta:
        model = Hero
        fields = (*WRITE_FIELDS, "fighter_key", "skill_ids", "special_ids", "spell_ids")


class HeroUpdateSerializer(UnitWriteSerializer):
    kind = HERO

    # Sent by the frontend's item purchases and discarded (keep until it stops sending them).
    item_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_action = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_price = serializers.FloatField(write_only=True, required=False)

    class Meta:
        model = Hero
        fields = (
            *WRITE_FIELDS,
            *MISSING_FIELDS,
            *PICK_FIELDS,
            *XP_CHANGE_FIELDS,
            "item_reason",
            "item_action",
            "item_price",
            "skill_ids",
            "special_ids",
            "spell_ids",
        )
