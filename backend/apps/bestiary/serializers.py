from typing import Any

from rest_framework import serializers

from apps.core.catalogue.scope import CatalogueIdsField, EquipmentInputSerializer, current_equipment
from apps.items.serializers import ItemSerializer
from apps.skills.models import Skill
from apps.skills.serializers import SkillSerializer
from apps.special.models import Special
from apps.special.serializers import SpecialSerializer
from apps.spells.models import Spell
from apps.spells.serializers import SpellSerializer

from .models import BestiaryEntry, BestiaryEntryItem

BEAST_FIELDS = ("has_profile", "gains_xp", "rating_bonus", "available_in_shop")


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
    equipment = BestiaryEntryItemSerializer(source="bestiary_entry_items", many=True, read_only=True)

    class Meta:
        model = BestiaryEntry
        fields = (
            "id",
            "campaign_id",
            "name",
            "kind",
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
            *BEAST_FIELDS,
            "skills",
            "specials",
            "spells",
            "equipment",
        )


class BestiaryEntrySummarySerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = BestiaryEntry
        fields: tuple[str, ...] = (
            "id",
            "campaign_id",
            "name",
            "kind",
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
            *BEAST_FIELDS,
        )


class BestiaryEntryBriefSerializer(BestiaryEntrySummarySerializer):
    """A list row without its description, for `GET bestiary/?view=summary` (PERF-47): what pickers show."""

    class Meta(BestiaryEntrySummarySerializer.Meta):
        fields = tuple(name for name in BestiaryEntrySummarySerializer.Meta.fields if name != "description")


class BestiaryEntryWriteSerializer(serializers.ModelSerializer):
    """A campaign bestiary entry's create or edit, checked whole before anything is written (BUG-53). Linked ids are
    the book's or this campaign's (`context["campaign_id"]`, SEC-07); the campaign itself is never an input."""

    skill_ids = CatalogueIdsField(rows=Skill.objects.all(), required=False)
    special_ids = CatalogueIdsField(rows=Special.objects.all(), required=False)
    spell_ids = CatalogueIdsField(rows=Spell.objects.all(), required=False)
    item_entries = EquipmentInputSerializer(many=True, required=False)

    class Meta:
        model = BestiaryEntry
        validators: list = []  # a taken name is the name rule's 400 name_taken (CAT-TWEAK-02), backed by the constraint
        fields: tuple[str, ...] = (
            "name",
            "kind",
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
            *BEAST_FIELDS,
            "skill_ids",
            "special_ids",
            "spell_ids",
            "item_entries",
        )

    def validate_item_entries(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Each item once (an item listed twice: its first quantity), as the campaign's current item for it."""
        return current_equipment(rows, self.context["campaign_id"])
