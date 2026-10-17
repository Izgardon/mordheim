"""Hired sword payloads: the fields each one lists (the shared parts are in apps/warbands/units/serializers.py).

`armour_save` is listed twice (once more through STAT_FIELDS), as before; it keeps its first position.
"""

from apps.warbands.models import HiredSword
from apps.warbands.units.kinds import HIRED_SWORD
from apps.warbands.units.serializers import (
    STAT_FIELDS,
    UnitDetailSerializer,
    UnitSummarySerializer,
    UnitWriteSerializer,
)
from apps.warbands.units.services.loadout import (
    apply_create_traits,
    finish_update_traits,
    pop_loadout_lists,
    prepare_update_traits,
    replace_loadout,
)
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups

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
        model = HiredSword
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
        model = HiredSword
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
        )


class HiredSwordCreateSerializer(UnitWriteSerializer):
    kind = HIRED_SWORD

    class Meta:
        model = HiredSword
        fields = WRITE_FIELDS

    def create(self, validated_data):
        lists = pop_loadout_lists(HIRED_SWORD, validated_data)
        apply_create_traits(HIRED_SWORD, validated_data, lists)

        # Seeded XP on first persist should not generate queued level-ups.
        validated_data["level_up"] = 0

        hired_sword = HiredSword.objects.create(**validated_data)
        replace_loadout(HIRED_SWORD, hired_sword, lists, fresh=True)
        return hired_sword


class HiredSwordUpdateSerializer(UnitWriteSerializer):
    kind = HIRED_SWORD

    class Meta:
        model = HiredSword
        fields = WRITE_FIELDS

    def update(self, instance, validated_data):
        lists = pop_loadout_lists(HIRED_SWORD, validated_data)
        trait_update = prepare_update_traits(HIRED_SWORD, validated_data, lists)

        previous_xp = instance.xp
        next_xp = validated_data.get("xp", instance.xp)
        should_increment_level = "xp" in validated_data and "level_up" not in validated_data

        hired_sword = super().update(instance, validated_data)

        if should_increment_level and not hired_sword.no_level_ups:
            settings = getattr(instance.warband.campaign, "settings", None)
            thresholds = settings.hired_sword_level_thresholds if settings else None
            new_level_ups = count_new_henchmen_level_ups(previous_xp, next_xp, thresholds)
            if new_level_ups:
                hired_sword.level_up = (hired_sword.level_up or 0) + new_level_ups
                hired_sword.save(update_fields=["level_up"])

        replace_loadout(HIRED_SWORD, hired_sword, lists)
        finish_update_traits(HIRED_SWORD, hired_sword, trait_update, lists)
        return hired_sword
