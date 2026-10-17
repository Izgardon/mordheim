from rest_framework import serializers

from apps.warbands.models import HiredSword
from apps.warbands.units.kinds import HIRED_SWORD
from apps.warbands.units.services.loadout import (
    apply_create_traits,
    finish_update_traits,
    pop_loadout_lists,
    prepare_update_traits,
    replace_loadout,
)
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups

from .catalogue_scope import CampaignCatalogueScopeMixin
from .heroes import (
    STAT_FIELDS,
    ItemDetailSerializer,
    ItemSummarySerializer,
    RaceSummarySerializer,
    SkillDetailSerializer,
    SkillSummarySerializer,
    SpecialDetailSerializer,
    SpecialSummarySerializer,
    SpellDetailSerializer,
    SpellSummarySerializer,
)
from .utils import get_prefetched_or_query


class HiredSwordSummarySerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_items", "hired_sword_items")
        return [ItemSummarySerializer(entry).data for entry in links if entry.item_id]

    def get_skills(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_skills", "hired_sword_skills")
        return [SkillSummarySerializer(entry.skill).data for entry in links if entry.skill_id]

    def get_specials(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_specials", "hired_sword_specials")
        return [SpecialSummarySerializer(entry.special).data for entry in links if entry.special_id]

    def get_spells(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_spells", "hired_sword_spells")
        return [SpellSummarySerializer(entry.spell).data for entry in links if entry.spell_id]

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


class HiredSwordDetailSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    race = RaceSummarySerializer(read_only=True)
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_items", "hired_sword_items")
        items = []
        for entry in links:
            if not entry.item_id:
                continue
            data = ItemDetailSerializer(entry.item).data
            data["cost"] = getattr(entry, "cost", None)
            items.append(data)
        return items

    def get_skills(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_skills", "hired_sword_skills")
        return [SkillDetailSerializer(entry.skill).data for entry in links if entry.skill_id]

    def get_specials(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_specials", "hired_sword_specials")
        return [SpecialDetailSerializer(entry.special).data for entry in links if entry.special_id]

    def get_spells(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_spells", "hired_sword_spells")
        return [SpellDetailSerializer(entry.spell).data for entry in links if entry.spell_id]

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


class HiredSwordCreateSerializer(CampaignCatalogueScopeMixin, serializers.ModelSerializer):
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    items = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    special_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    spell_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = HiredSword
        fields = (
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

    def create(self, validated_data):
        lists = pop_loadout_lists(HIRED_SWORD, validated_data)
        apply_create_traits(HIRED_SWORD, validated_data, lists)

        # Seeded XP on first persist should not generate queued level-ups.
        validated_data["level_up"] = 0

        hired_sword = HiredSword.objects.create(**validated_data)
        replace_loadout(HIRED_SWORD, hired_sword, lists, fresh=True)
        return hired_sword


class HiredSwordUpdateSerializer(CampaignCatalogueScopeMixin, serializers.ModelSerializer):
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    items = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    special_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    spell_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = HiredSword
        fields = (
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


class HiredSwordLevelUpLogSerializer(serializers.Serializer):
    payload = serializers.DictField(required=False)  # a non-object payload is a 400, not a 500 (BUG-89)
