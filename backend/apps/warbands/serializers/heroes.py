from rest_framework import serializers

from apps.items.models import Item, ItemPropertyLink
from apps.skills.models import Skill

from apps.warbands.models import Hero, HeroItem, HeroOther, HeroSpell
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


class HeroOtherSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroOther
        fields = ("id", "name")


class HeroOtherDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroOther
        fields = ("id", "name", "description")


class HeroSpellSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSpell
        fields = ("id", "name")


class HeroSpellDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSpell
        fields = ("id", "name", "dc", "description")


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
    other = HeroOtherSummarySerializer(source="other_entries", many=True, read_only=True)
    spells = HeroSpellSummarySerializer(many=True, read_only=True)

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
    other = HeroOtherSummarySerializer(source="other_entries", many=True, read_only=True)
    spells = HeroSpellDetailSerializer(many=True, read_only=True)

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
        )

    def create(self, validated_data):
        item_ids = validated_data.pop("item_ids", [])
        skill_ids = validated_data.pop("skill_ids", [])
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
        )

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("item_ids", None)
        skill_ids = validated_data.pop("skill_ids", None)
        hero = super().update(instance, validated_data)
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
        if hasattr(hero, "_prefetched_objects_cache"):
            hero._prefetched_objects_cache.pop("hero_items", None)
            hero._prefetched_objects_cache.pop("skills", None)
        return hero
