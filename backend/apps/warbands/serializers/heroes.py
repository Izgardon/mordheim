from rest_framework import serializers

from apps.items.models import Item, ItemPropertyLink
from apps.items.serializers import ItemAvailabilitySerializer
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import Hero
from apps.warbands.units.kinds import HERO
from apps.warbands.units.services.loadout import (
    apply_create_traits,
    finish_update_traits,
    pop_loadout_lists,
    prepare_update_traits,
    replace_loadout,
)
from apps.warbands.utils.hero_level import count_new_level_ups
from apps.warbands.utils.leaders import ensure_single_living_leader, lock_warband

from .catalogue_scope import CampaignCatalogueScopeMixin
from .utils import get_prefetched_or_query

STAT_FIELDS = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
    "armour_save",
)


class ItemPropertySummarySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="property.id")
    name = serializers.CharField(source="property.name")

    class Meta:
        model = ItemPropertyLink
        fields = ("id", "name")


class ItemSummarySerializer(serializers.Serializer):
    """Serializes a join row (HeroItem / HenchmenGroupItem / etc.) as an item summary."""

    id = serializers.IntegerField(source="item.id")
    name = serializers.CharField(source="item.name")
    type = serializers.CharField(source="item.type")
    cost = serializers.SerializerMethodField()

    def get_cost(self, obj):
        return getattr(obj, "cost", None)


class ItemDetailSerializer(serializers.ModelSerializer):
    properties = serializers.SerializerMethodField()
    save = serializers.CharField(source="save_value", allow_null=True, required=False)  # type: ignore[assignment]
    availabilities = ItemAvailabilitySerializer(many=True, read_only=True)

    def get_properties(self, obj):
        links = getattr(obj, "property_links", None)
        if links is None:
            return []
        return ItemPropertySummarySerializer(links.all(), many=True).data

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
            "name",
            "type",
            "subtype",
            "single_use",
            "strength",
            "range",
            "save",
            "statblock",
            "properties",
            "availabilities",
        )


class SkillSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name")


class SkillDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name", "type")


class SpecialSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("id", "name")


class SpecialDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("id", "name", "type", "description")


class SpellSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Spell
        fields = ("id", "name")


class SpellDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spell
        fields = ("id", "name", "type", "dc", "description")


class RaceSummarySerializer(serializers.Serializer):
    name = serializers.CharField()
    movement = serializers.IntegerField()
    weapon_skill = serializers.IntegerField()
    ballistic_skill = serializers.IntegerField()
    strength = serializers.IntegerField()
    toughness = serializers.IntegerField()
    wounds = serializers.IntegerField()
    initiative = serializers.IntegerField()
    attacks = serializers.IntegerField()
    leadership = serializers.IntegerField()


class HeroSummarySerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()

    def get_items(self, obj):
        hero_items = get_prefetched_or_query(obj, "hero_items", "hero_items")
        return [ItemSummarySerializer(entry).data for entry in hero_items if entry.item_id]

    def get_skills(self, obj):
        hero_skills = get_prefetched_or_query(obj, "hero_skills", "hero_skills")
        return [SkillSummarySerializer(entry.skill).data for entry in hero_skills if entry.skill_id]

    def get_specials(self, obj):
        hero_specials = get_prefetched_or_query(obj, "hero_specials", "hero_specials")
        return [SpecialSummarySerializer(entry.special).data for entry in hero_specials if entry.special_id]

    def get_spells(self, obj):
        hero_spells = get_prefetched_or_query(obj, "hero_spells", "hero_spells")
        return [SpellSummarySerializer(entry.spell).data for entry in hero_spells if entry.spell_id]

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


class HeroDetailSerializer(serializers.ModelSerializer):
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
        hero_items = get_prefetched_or_query(obj, "hero_items", "hero_items")
        items = []
        for entry in hero_items:
            if not entry.item_id:
                continue
            data = ItemDetailSerializer(entry.item).data
            data["cost"] = getattr(entry, "cost", None)
            items.append(data)
        return items

    def get_skills(self, obj):
        hero_skills = get_prefetched_or_query(obj, "hero_skills", "hero_skills")
        return [SkillDetailSerializer(entry.skill).data for entry in hero_skills if entry.skill_id]

    def get_specials(self, obj):
        hero_specials = get_prefetched_or_query(obj, "hero_specials", "hero_specials")
        return [SpecialDetailSerializer(entry.special).data for entry in hero_specials if entry.special_id]

    def get_spells(self, obj):
        hero_spells = get_prefetched_or_query(obj, "hero_spells", "hero_spells")
        return [SpellDetailSerializer(entry.spell).data for entry in hero_spells if entry.spell_id]

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


class HeroCreateSerializer(CampaignCatalogueScopeMixin, serializers.ModelSerializer):
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
        model = Hero
        fields = (
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
            "skill_ids",
            "special_ids",
            "spell_ids",
        )

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


class HeroUpdateSerializer(CampaignCatalogueScopeMixin, serializers.ModelSerializer):
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    items = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )
    item_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_action = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_price = serializers.FloatField(write_only=True, required=False)
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
        model = Hero
        fields = (
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
            "item_reason",
            "item_action",
            "item_price",
            "skill_ids",
            "special_ids",
            "spell_ids",
        )

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


class HeroLevelUpLogSerializer(serializers.Serializer):
    payload = serializers.DictField(required=False)  # a non-object payload is a 400, not a 500 (BUG-89)
