"""Catalogue entries as unit payloads show them: items, skills, specials, spells and the race."""

from typing import Any

from rest_framework import serializers
from rest_framework.fields import Field

from apps.items.models import Item
from apps.items.serializers import ItemAvailabilitySerializer, ItemRuleLinkSerializer, with_save
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

from .companions import beast_kind


class ItemSummarySerializer(serializers.Serializer):
    """Serializes a join row (HeroItem / HenchmenGroupItem / etc.) as an item summary."""

    id = serializers.IntegerField(source="item.id")
    name = serializers.CharField(source="item.name")
    type = serializers.CharField(source="item.type")
    cost = serializers.SerializerMethodField()
    row_id = serializers.IntegerField(source="pk")  # this copy: what the companion switch names
    companion = serializers.BooleanField()
    beast_kind = serializers.SerializerMethodField()  # mount, pet or creature for an Animal item

    def get_cost(self, obj):
        return getattr(obj, "cost", None)

    def get_beast_kind(self, obj: Any) -> str | None:
        return beast_kind(obj.item)


class ItemDetailSerializer(serializers.ModelSerializer):
    rules = ItemRuleLinkSerializer(source="rule_links", many=True, read_only=True)
    availabilities = ItemAvailabilitySerializer(many=True, read_only=True)

    def get_fields(self) -> dict[str, Field]:
        return with_save(super().get_fields())  # "save" after "range" (IMP-85)

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
            "name",
            "variant",
            "type",
            "subtype",
            "single_use",
            "strength",
            "range",
            "statblock",
            "rules",
            "availabilities",
        )


class SkillSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name")


class SkillDetailSerializer(serializers.ModelSerializer):
    # its rule text, which the unit's skill box opens to (a special's and a spell's carry theirs); read with the unit's
    # row like the rest (prefetches.py: ENTRY_COLUMNS), so no query more
    class Meta:
        model = Skill
        fields = ("id", "name", "description")


class SpecialSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("id", "name", "kind", "category")


class SpecialDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("id", "name", "type", "kind", "category", "description")


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
