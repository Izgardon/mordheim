from rest_framework import serializers

from apps.items.serializers import ItemSerializer
from apps.restrictions.models import Restriction
from apps.skills.serializers import SkillSerializer
from apps.special.serializers import SpecialSerializer
from apps.spells.serializers import SpellSerializer

from .models import BestiaryEntry, BestiaryEntryItem, HiredSwordProfile, HiredSwordProfileRestriction


class BestiaryEntryItemSerializer(serializers.ModelSerializer):
    item = ItemSerializer(read_only=True)

    class Meta:
        model = BestiaryEntryItem
        fields = ("item", "quantity")


class BestiaryEntrySerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)
    specials = SpecialSerializer(many=True, read_only=True)
    spells = SpellSerializer(many=True, read_only=True)
    equipment = BestiaryEntryItemSerializer(
        source="bestiary_entry_items", many=True, read_only=True
    )

    class Meta:
        model = BestiaryEntry
        fields = (
            "id",
            "campaign_id",
            "name",
            "type",
            "description",
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
            "large",
            "caster",
            "skills",
            "specials",
            "spells",
            "equipment",
        )


class BestiaryEntrySummarySerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = BestiaryEntry
        fields = (
            "id",
            "campaign_id",
            "name",
            "type",
            "description",
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
            "large",
            "caster",
        )


class BestiaryEntryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BestiaryEntry
        fields = (
            "campaign",
            "name",
            "type",
            "description",
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
            "large",
            "caster",
        )


class _HiredSwordRestrictionInlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restriction
        fields = ("id", "type", "restriction")


class HiredSwordProfileRestrictionSerializer(serializers.ModelSerializer):
    restriction = _HiredSwordRestrictionInlineSerializer(read_only=True)

    class Meta:
        model = HiredSwordProfileRestriction
        fields = ("restriction", "additional_note")


class HiredSwordProfileSummarySerializer(serializers.ModelSerializer):
    bestiary_entry = BestiaryEntrySummarySerializer(read_only=True)
    restrictions = HiredSwordProfileRestrictionSerializer(
        source="restriction_links", many=True, read_only=True
    )
    available_special_skills = SkillSerializer(many=True, read_only=True)

    class Meta:
        model = HiredSwordProfile
        fields = (
            "id",
            "campaign_id",
            "grade",
            "hire_cost",
            "hire_cost_expression",
            "upkeep_cost",
            "upkeep_cost_expression",
            "available_skill_types",
            "available_special_skills",
            "restrictions",
            "bestiary_entry",
        )


class HiredSwordProfileDetailSerializer(serializers.ModelSerializer):
    bestiary_entry = BestiaryEntrySerializer(read_only=True)
    restrictions = HiredSwordProfileRestrictionSerializer(
        source="restriction_links", many=True, read_only=True
    )
    available_special_skills = SkillSerializer(many=True, read_only=True)

    class Meta:
        model = HiredSwordProfile
        fields = (
            "id",
            "campaign_id",
            "grade",
            "hire_cost",
            "hire_cost_expression",
            "upkeep_cost",
            "upkeep_cost_expression",
            "available_skill_types",
            "available_special_skills",
            "restrictions",
            "bestiary_entry",
        )
