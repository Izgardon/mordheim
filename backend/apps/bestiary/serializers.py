from collections.abc import Mapping
from typing import Any

from rest_framework import serializers

from apps.core.catalogue.scope import CatalogueIdsField, refuse_unknown
from apps.items.models import Item
from apps.items.serializers import MAX_COST, ItemSerializer
from apps.restrictions.models import Restriction
from apps.restrictions.serializers import (
    RestrictionNoteSerializer,
    refuse_unknown_restrictions,
    unique_restriction_notes,
)
from apps.skills.models import Skill
from apps.skills.serializers import SkillSerializer
from apps.special.models import Special
from apps.special.serializers import SpecialSerializer
from apps.spells.models import Spell
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
    equipment = BestiaryEntryItemSerializer(source="bestiary_entry_items", many=True, read_only=True)

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
        fields: tuple[str, ...] = (
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


class BestiaryEntryBriefSerializer(BestiaryEntrySummarySerializer):
    """A list row without its description, for `GET bestiary/?view=summary` (PERF-47): what pickers show."""

    class Meta(BestiaryEntrySummarySerializer.Meta):
        fields = tuple(name for name in BestiaryEntrySummarySerializer.Meta.fields if name != "description")


class EquipmentInputSerializer(serializers.Serializer):
    """One item an entry carries: `{"item_id", "quantity"}`, or a bare item id (one of it)."""

    item_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_COST, default=1)

    def to_internal_value(self, data: Any) -> Any:
        return super().to_internal_value(data if isinstance(data, Mapping) else {"item_id": data})

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return {"quantity": 1, **attrs}  # in a PATCH too, where DRF skips defaults


class BestiaryEntryWriteSerializer(serializers.ModelSerializer):
    """A campaign bestiary entry's create or edit, checked whole before anything is written (BUG-53). Linked ids are
    the book's or this campaign's (`context["campaign_id"]`, SEC-07); the campaign itself is never an input."""

    skill_ids = CatalogueIdsField(rows=Skill.objects.all(), required=False)
    special_ids = CatalogueIdsField(rows=Special.objects.all(), required=False)
    spell_ids = CatalogueIdsField(rows=Spell.objects.all(), required=False)
    item_entries = EquipmentInputSerializer(many=True, required=False)

    class Meta:
        model = BestiaryEntry
        validators: list = []  # a duplicate name is the database constraint's 400 duplicate_entry (BUG-17)
        fields: tuple[str, ...] = (
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
            "skill_ids",
            "special_ids",
            "spell_ids",
            "item_entries",
        )

    def validate_item_entries(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        first = {row["item_id"]: row for row in reversed(rows)}  # an item listed twice: its first quantity
        unique = [first[item_id] for item_id in dict.fromkeys(row["item_id"] for row in rows)]
        refuse_unknown(Item.objects.all(), first, self.context["campaign_id"])
        return unique


class HiredSwordWriteSerializer(BestiaryEntryWriteSerializer):
    """A hired sword's create or edit: its entry, as above, and its profile (costs, grade, race, restrictions)."""

    hire_cost = serializers.IntegerField(min_value=0, max_value=MAX_COST, allow_null=True, required=False)
    hire_cost_expression = serializers.CharField(max_length=120, allow_blank=True, allow_null=True, required=False)
    upkeep_cost = serializers.IntegerField(min_value=0, max_value=MAX_COST, allow_null=True, required=False)
    upkeep_cost_expression = serializers.CharField(max_length=120, allow_blank=True, allow_null=True, required=False)
    rating = serializers.IntegerField(min_value=0, max_value=MAX_COST, allow_null=True, required=False)
    grade = serializers.CharField(max_length=20, allow_blank=True, required=False)
    race = serializers.CharField(max_length=60, allow_blank=True, required=False)
    available_skill_types = serializers.ListField(child=serializers.CharField(max_length=80), required=False)
    restriction_ids = RestrictionNoteSerializer(many=True, required=False)

    class Meta(BestiaryEntryWriteSerializer.Meta):
        fields = (
            *BestiaryEntryWriteSerializer.Meta.fields,
            "hire_cost",
            "hire_cost_expression",
            "upkeep_cost",
            "upkeep_cost_expression",
            "rating",
            "grade",
            "race",
            "available_skill_types",
            "restriction_ids",
        )
        extra_kwargs = {"type": {"required": False}}  # a new hired sword's entry is a "Hired Sword"

    def validate_hire_cost_expression(self, value: str | None) -> str:
        return value or ""

    def validate_upkeep_cost_expression(self, value: str | None) -> str:
        return value or ""

    def validate_restriction_ids(self, notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refuse_unknown_restrictions(notes, self.context["campaign_id"])
        return unique_restriction_notes(notes)


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
    restrictions = HiredSwordProfileRestrictionSerializer(source="restriction_links", many=True, read_only=True)

    class Meta:
        model = HiredSwordProfile
        fields = (
            "id",
            "campaign_id",
            "campaign_type_id",  # CAT-NEW-04: always null today
            "grade",
            "race",
            "hire_cost",
            "hire_cost_expression",
            "upkeep_cost",
            "upkeep_cost_expression",
            "rating",
            "available_skill_types",
            "restrictions",
            "bestiary_entry",
        )


class HiredSwordProfileDetailSerializer(serializers.ModelSerializer):
    bestiary_entry = BestiaryEntrySerializer(read_only=True)
    restrictions = HiredSwordProfileRestrictionSerializer(source="restriction_links", many=True, read_only=True)

    class Meta:
        model = HiredSwordProfile
        fields = (
            "id",
            "campaign_id",
            "campaign_type_id",  # CAT-NEW-04: always null today
            "grade",
            "race",
            "hire_cost",
            "hire_cost_expression",
            "upkeep_cost",
            "upkeep_cost_expression",
            "rating",
            "available_skill_types",
            "restrictions",
            "bestiary_entry",
        )
