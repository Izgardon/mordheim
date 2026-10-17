"""Hero payloads: the fields each one lists (the shared parts are in apps/warbands/units/serializers.py)."""

from rest_framework import serializers

from apps.warbands.models import Hero
from apps.warbands.units.kinds import HERO
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
from apps.warbands.utils.hero_level import count_new_level_ups
from apps.warbands.utils.leaders import ensure_single_living_leader, lock_warband

WRITE_FIELDS = (
    "name",
    "unit_type",
    "race",
    "price",
    "xp",
    "kills",
    "level_up",
    "deeds",
    "is_leader",
    "large",
    "caster",
    "half_rate",
    "trading_action",
    "dead",
    "available_skills",
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
            "is_leader",
            "large",
            "caster",
            "half_rate",
            "trading_action",
            "available_skills",
            *STAT_FIELDS,
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
            "deeds",
            "is_leader",
            "large",
            "caster",
            "half_rate",
            "trading_action",
            "dead",
            "available_skills",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HeroCreateSerializer(UnitWriteSerializer):
    kind = HERO

    class Meta:
        model = Hero
        fields = (*WRITE_FIELDS, "skill_ids", "special_ids", "spell_ids")

    def create(self, validated_data):
        lists = pop_loadout_lists(HERO, validated_data)
        apply_create_traits(HERO, validated_data, lists)
        if "level_up" not in validated_data:
            validated_data["level_up"] = 0
        hero = Hero.objects.create(**validated_data)
        replace_loadout(HERO, hero, lists, fresh=True)
        ensure_single_living_leader(
            hero.warband_id,
            preferred_leader_id=hero.id if hero.is_leader and not hero.dead else None,
        )
        hero.refresh_from_db()
        return hero


class HeroUpdateSerializer(UnitWriteSerializer):
    kind = HERO

    # Sent by the frontend's item purchases and discarded (keep until it stops sending them).
    item_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_action = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_price = serializers.FloatField(write_only=True, required=False)

    class Meta:
        model = Hero
        fields = (*WRITE_FIELDS, "item_reason", "item_action", "item_price", "skill_ids", "special_ids", "spell_ids")

    def update(self, instance, validated_data):
        validated_data.pop("item_reason", None)
        validated_data.pop("item_action", None)
        validated_data.pop("item_price", None)
        lists = pop_loadout_lists(HERO, validated_data)
        trait_update = prepare_update_traits(HERO, validated_data, lists)
        previous_xp = instance.xp
        next_xp = validated_data.get("xp", instance.xp)
        should_increment_level = "xp" in validated_data and "level_up" not in validated_data
        # Only a write that names is_leader or dead can move the crown (BUG-63).
        leadership_changes = "is_leader" in validated_data or "dead" in validated_data
        if leadership_changes:
            lock_warband(instance.warband_id)
        hero = super().update(instance, validated_data)
        if should_increment_level:
            settings = getattr(instance.warband.campaign, "settings", None)
            thresholds = settings.hero_level_thresholds if settings else None
            new_level_ups = count_new_level_ups(previous_xp, next_xp, thresholds)
            if new_level_ups:
                hero.level_up = (hero.level_up or 0) + new_level_ups
                hero.save(update_fields=["level_up"])
        replace_loadout(HERO, hero, lists)
        finish_update_traits(HERO, hero, trait_update, lists)
        if leadership_changes:
            ensure_single_living_leader(
                hero.warband_id,
                preferred_leader_id=hero.id if hero.is_leader and not hero.dead else None,
            )
        return hero
