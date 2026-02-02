from rest_framework import serializers

from apps.items.models import Item, ItemPropertyLink
from apps.others.models import Other
from apps.skills.models import Skill
from apps.spells.models import Spell

from apps.warbands.models import Hero, HeroItem
from apps.warbands.utils.hero_level import count_new_level_ups
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


class ItemSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ("id", "name", "cost")


class ItemDetailSerializer(serializers.ModelSerializer):
    properties = serializers.SerializerMethodField()
    save = serializers.CharField(source="save_value", allow_null=True, required=False)

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
            "cost",
            "rarity",
            "unique_to",
            "variable",
            "single_use",
            "strength",
            "range",
            "save",
            "statblock",
            "properties",
        )


class SkillSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name")


class SkillDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name", "type")


class OtherSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Other
        fields = ("id", "name")


class OtherDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Other
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
    items = serializers.SerializerMethodField()
    skills = SkillSummarySerializer(many=True, read_only=True)
    other = OtherSummarySerializer(source="others", many=True, read_only=True)
    spells = SpellSummarySerializer(many=True, read_only=True)

    def get_items(self, obj):
        hero_items = get_prefetched_or_query(obj, "hero_items", "hero_items")
        return [ItemSummarySerializer(entry.item).data for entry in hero_items if entry.item_id]

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
            "half_rate",
            *STAT_FIELDS,
            "items",
            "skills",
            "other",
            "spells",
        )


class HeroDetailSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    race = RaceSummarySerializer(read_only=True)
    items = serializers.SerializerMethodField()
    skills = SkillDetailSerializer(many=True, read_only=True)
    other = OtherDetailSerializer(source="others", many=True, read_only=True)
    spells = SpellDetailSerializer(many=True, read_only=True)

    def get_items(self, obj):
        hero_items = get_prefetched_or_query(obj, "hero_items", "hero_items")
        return [ItemDetailSerializer(entry.item).data for entry in hero_items if entry.item_id]

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
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "other",
            "spells",
        )


class HeroCreateSerializer(serializers.ModelSerializer):
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    other_ids = serializers.ListField(
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
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
            "other_ids",
            "spell_ids",
        )

    def create(self, validated_data):
        item_ids = validated_data.pop("item_ids", [])
        skill_ids = validated_data.pop("skill_ids", [])
        other_ids = validated_data.pop("other_ids", [])
        spell_ids = validated_data.pop("spell_ids", [])
        if "level_up" not in validated_data:
            validated_data["level_up"] = 0
        hero = Hero.objects.create(**validated_data)
        if item_ids:
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HeroItem.objects.bulk_create(
                [
                    HeroItem(hero=hero, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids:
            hero.skills.set(Skill.objects.filter(id__in=skill_ids))
        if other_ids:
            hero.others.set(Other.objects.filter(id__in=other_ids))
        if spell_ids:
            hero.spells.set(Spell.objects.filter(id__in=spell_ids))
        return hero


class HeroUpdateSerializer(serializers.ModelSerializer):
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    other_ids = serializers.ListField(
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
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
            "other_ids",
            "spell_ids",
        )

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("item_ids", None)
        skill_ids = validated_data.pop("skill_ids", None)
        other_ids = validated_data.pop("other_ids", None)
        spell_ids = validated_data.pop("spell_ids", None)
        previous_xp = instance.xp
        next_xp = validated_data.get("xp", instance.xp)
        should_increment_level = "xp" in validated_data and "level_up" not in validated_data
        hero = super().update(instance, validated_data)
        if should_increment_level:
            new_level_ups = count_new_level_ups(previous_xp, next_xp)
            if new_level_ups:
                hero.level_up = (hero.level_up or 0) + new_level_ups
                hero.save(update_fields=["level_up"])
        if item_ids is not None:
            hero.hero_items.all().delete()
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HeroItem.objects.bulk_create(
                [
                    HeroItem(hero=hero, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids is not None:
            hero.skills.set(Skill.objects.filter(id__in=skill_ids))
        if other_ids is not None:
            hero.others.set(Other.objects.filter(id__in=other_ids))
        if spell_ids is not None:
            hero.spells.set(Spell.objects.filter(id__in=spell_ids))
        if hasattr(hero, "_prefetched_objects_cache"):
            hero._prefetched_objects_cache.pop("hero_items", None)
            hero._prefetched_objects_cache.pop("skills", None)
            hero._prefetched_objects_cache.pop("others", None)
            hero._prefetched_objects_cache.pop("spells", None)
        return hero


class HeroLevelUpLogSerializer(serializers.Serializer):
    payload = serializers.JSONField(required=False)
