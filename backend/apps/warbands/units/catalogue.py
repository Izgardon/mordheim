"""Catalogue entries as unit payloads show them: items, skills, specials, spells and the race."""

from rest_framework import serializers

from apps.items.models import Item, ItemPropertyLink
from apps.items.serializers import ItemAvailabilitySerializer
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell


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
