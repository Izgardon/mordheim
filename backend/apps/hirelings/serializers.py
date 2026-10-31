"""Hired sword and dramatis persona payloads and writes; the catalogue's rows and details add the badge fields
(apps/core/catalogue/rows.py).

A list row is the entry with its race and who may hire it; a detail adds the skills, specials, spells and equipment
(each item with its quantity). Both kinds have the same payload, and a dramatis persona adds `stays` and
`payment_note`. The hire fee and upkeep are structured fees (fees.py), each resource line with the names that pay it. A
write is checked whole before anything is written (BUG-53): every linked id is the book's or the
campaign's (`context["campaign_id"]`, SEC-07) and lands on the campaign's current entry for it (CAT-TWEAK-03).
"""

from typing import Any

from rest_framework import serializers

from apps.core.catalogue.scope import (
    CatalogueEntryField,
    CatalogueIdsField,
    EquipmentInputSerializer,
    current_equipment,
)
from apps.items.serializers import MAX_COST, ItemSerializer
from apps.races.models import Race
from apps.skills.models import Skill
from apps.skills.serializers import SkillSerializer
from apps.special.models import Special
from apps.special.serializers import SpecialSerializer
from apps.spells.models import Spell
from apps.spells.serializers import SpellSerializer
from apps.warbands.access_lines import (
    AccessLineInputSerializer,
    AccessLineSerializer,
    refuse_unknown_lines,
    unique_lines,
)
from apps.warbands.utils.armour_save import BEST_ARMOUR_SAVE, WORST_ARMOUR_SAVE

from .fees import FeeField
from .models import MAX_KIT_QUANTITY, DramatisPersona, HiredSword

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
)
COST_FIELDS = (
    "hire_fee",
    "upkeep_fee",
    "rating",
    "available_skill_types",
    "grade",
    "for_everyone",
    "hire_note",
)
PROFILE = ("name", "description", *STAT_FIELDS, "armour_save", "large", "caster")
ROW_FIELDS = ("id", "campaign_id", "setting_id", *PROFILE, "race_id", "race_name", "race_label", *COST_FIELDS)
PERSONA_FIELDS = ("stays", "payment_note")
KIT_FIELDS = ("skills", "specials", "spells", "equipment")
WRITE_FIELDS = (
    *PROFILE,
    "race_id",
    "race_label",
    *COST_FIELDS,
    "skill_ids",
    "special_ids",
    "spell_ids",
    "item_entries",
    "warbands",
)


class EquipmentSerializer(serializers.Serializer):
    item = ItemSerializer(read_only=True)
    quantity = serializers.IntegerField(read_only=True)


class HirelingProfileSerializer(serializers.ModelSerializer):
    """A list row: the entry, its race (the catalogue's, and the source's label) and who may hire it (`for_everyone`,
    `warbands`)."""

    campaign_id = serializers.IntegerField(read_only=True)
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)  # null: Mordheim (in_play.py)
    race_id = serializers.IntegerField(read_only=True, allow_null=True)
    race_name = serializers.SerializerMethodField()
    hire_fee = FeeField(read_only=True)  # each resource line with what pays it (fees.py)
    upkeep_fee = FeeField(read_only=True)
    warbands = AccessLineSerializer(source="warband_links", many=True, read_only=True)

    def get_race_name(self, profile: Any) -> str | None:
        return profile.race.name if profile.race_id else None


class HirelingDetailSerializer(HirelingProfileSerializer):
    """The detail: a row with what the entry knows and carries (its links, in the order they were written)."""

    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()
    equipment = EquipmentSerializer(source="item_links", many=True, read_only=True)

    def get_skills(self, profile: Any) -> list[Any]:
        return [SkillSerializer(link.skill).data for link in profile.skill_links.all()]

    def get_specials(self, profile: Any) -> list[Any]:
        return [SpecialSerializer(link.special).data for link in profile.special_links.all()]

    def get_spells(self, profile: Any) -> list[Any]:
        return [SpellSerializer(link.spell).data for link in profile.spell_links.all()]


class HiredSwordSerializer(HirelingProfileSerializer):
    class Meta:
        model = HiredSword
        fields = (*ROW_FIELDS, "warbands")


class HiredSwordDetailSerializer(HirelingDetailSerializer):
    class Meta:
        model = HiredSword
        fields = (*ROW_FIELDS, "warbands", *KIT_FIELDS)


class DramatisPersonaSerializer(HirelingProfileSerializer):
    class Meta:
        model = DramatisPersona
        fields = (*ROW_FIELDS, *PERSONA_FIELDS, "warbands")


class DramatisPersonaDetailSerializer(HirelingDetailSerializer):
    class Meta:
        model = DramatisPersona
        fields = (*ROW_FIELDS, *PERSONA_FIELDS, "warbands", *KIT_FIELDS)


def _cost() -> serializers.IntegerField:
    return serializers.IntegerField(min_value=0, max_value=MAX_COST, allow_null=True, required=False)


class HirelingProfileWriteSerializer(serializers.ModelSerializer):
    """A create or an edit of a campaign's hired sword or dramatis persona. A list it sends (skills, specials, spells,
    equipment, who may hire) replaces that list; a list it leaves out stays. The armour save and the kit's quantities
    are bounded as a warband's copies are, since hiring copies them onto one."""

    armour_save = serializers.IntegerField(
        min_value=BEST_ARMOUR_SAVE, max_value=WORST_ARMOUR_SAVE, allow_null=True, required=False
    )
    race_id = CatalogueEntryField(source="race", queryset=Race.objects.all(), allow_null=True, required=False)
    hire_fee = FeeField(required=False)
    upkeep_fee = FeeField(required=False)
    rating = _cost()
    available_skill_types = serializers.ListField(child=serializers.CharField(max_length=80), required=False)
    skill_ids = CatalogueIdsField(rows=Skill.objects.all(), required=False)
    special_ids = CatalogueIdsField(rows=Special.objects.all(), required=False)
    spell_ids = CatalogueIdsField(rows=Spell.objects.all(), required=False)
    item_entries = EquipmentInputSerializer(many=True, required=False)
    warbands = AccessLineInputSerializer(many=True, required=False)

    def validate_item_entries(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Each item once (an item listed twice: its first quantity), as the campaign's current item for it, and at
        most MAX_KIT_QUANTITY of it: hiring writes a row per copy."""
        if any(row["quantity"] > MAX_KIT_QUANTITY for row in rows):
            raise serializers.ValidationError(f"A kit carries at most {MAX_KIT_QUANTITY} of an item.")
        return current_equipment(rows, self.context["campaign_id"])

    def validate_warbands(self, lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refuse_unknown_lines(lines, self.context["campaign_id"])  # the book's or the campaign's types (SEC-07)
        return unique_lines(lines)


class HiredSwordWriteSerializer(HirelingProfileWriteSerializer):
    class Meta:
        model = HiredSword
        validators: list = []  # a taken name is the name rule's 400 name_taken (CAT-TWEAK-02), backed by the constraint
        fields = WRITE_FIELDS


class DramatisPersonaWriteSerializer(HirelingProfileWriteSerializer):
    class Meta:
        model = DramatisPersona
        validators: list = []
        fields = (*WRITE_FIELDS, *PERSONA_FIELDS)
