from rest_framework import serializers

from apps.items.serializers import ItemSerializer
from apps.skills.serializers import SkillSerializer
from apps.special.serializers import SpecialSerializer
from apps.spells.serializers import SpellSerializer

from .models import BestiaryEntry, BestiaryEntryItem


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
