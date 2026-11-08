"""What the editor's Fighters and Lists saves send (the templates plan, phase 4): a whole fighter, or a whole equipment
list with its lines. Data integrity only, as editor_serializers.py: the counts in order, a profile as players write it
("1(2)", "D6", "-": utils/stats.py), the race, items, specials and skills the campaign may link (each list in one
query)."""

from typing import Any

from rest_framework import serializers

from apps.core.catalogue.scope import CatalogueEntryField, CatalogueIdsField, refuse_unknown
from apps.items.models import Item
from apps.races.models import Race
from apps.skills.models import Skill
from apps.warbands.models.shared import STAT_FIELDS
from apps.warbands.utils.stats import Stat, StatField

from .editor_serializers import SpecialRuleSerializer, WhoField, current_specials
from .models import CASTERS, FIGHTER_KINDS


class SpellTypeSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    note = serializers.CharField(max_length=200, allow_blank=True, default="")


class FighterSerializer(serializers.Serializer):
    """`POST warband-templates/<id>/fighters/` (with `kind`) and `PUT .../fighters/<key>/`: the whole fighter."""

    kind = serializers.ChoiceField(choices=FIGHTER_KINDS, required=False)
    name = serializers.CharField(max_length=160)
    plural = serializers.CharField(max_length=160, allow_blank=True, default="")
    race_id = CatalogueEntryField(queryset=Race.objects.all(), allow_null=True, source="race")
    cost = serializers.IntegerField(min_value=0, max_value=100_000)
    starting_xp = serializers.IntegerField(min_value=0, max_value=999, default=0)
    min_count = serializers.IntegerField(min_value=0, max_value=99, default=0)
    max_count = serializers.IntegerField(min_value=0, max_value=99, allow_null=True)
    group_min = serializers.IntegerField(min_value=0, max_value=99, allow_null=True, default=None)
    group_max = serializers.IntegerField(min_value=0, max_value=99, allow_null=True, default=None)
    movement = StatField()
    weapon_skill = StatField()
    ballistic_skill = StatField()
    strength = StatField()
    toughness = StatField()
    wounds = StatField()
    initiative = StatField()
    attacks = StatField()
    leadership = StatField()
    skill_types = serializers.ListField(child=serializers.CharField(max_length=120), default=list)
    spell_types = SpellTypeSerializer(many=True, default=list)
    caster = serializers.ChoiceField(choices=CASTERS, default="No")
    is_leader = serializers.BooleanField(default=False)
    large = serializers.BooleanField(default=False)
    gains_xp = serializers.BooleanField(default=True)
    promotable = serializers.BooleanField(default=True)
    fixed_kit = serializers.CharField(max_length=1000, allow_blank=True, default="")
    lists = serializers.ListField(child=serializers.SlugField(max_length=80), default=list)
    rules = SpecialRuleSerializer(many=True, default=list)
    skill_ids = CatalogueIdsField(rows=Skill.objects.all(), default=list)  # the skills he starts with, in order

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        for low, high in (("min_count", "max_count"), ("group_min", "group_max")):
            if attrs.get(low) is not None and attrs.get(high) is not None and attrs[low] > attrs[high]:
                raise serializers.ValidationError({high: ["The most can't be fewer than the least."]})
        written: dict[str, str] = {}
        for field in STAT_FIELDS:
            stat: Stat = attrs[field]
            attrs[field] = stat.number
            if stat.written is not None:
                written[field] = stat.written
        attrs["written_stats"] = written
        attrs["skill_types"] = list(dict.fromkeys(name.strip() for name in attrs["skill_types"] if name.strip()))
        attrs["spell_types"] = [dict(row) for row in attrs["spell_types"]]
        attrs["rules"] = current_specials(attrs["rules"], self.context["campaign_id"])
        return attrs


class LineSerializer(serializers.Serializer):
    """A list line: an item at its list price (none: see the cost note), its brace price, the first free, the list's
    own name for it, who may take it, the most in a warband, a note and the variant it is for."""

    id = serializers.IntegerField(required=False)
    item_id = serializers.IntegerField(min_value=1)
    shown_as = serializers.CharField(max_length=160, allow_blank=True, default="")
    cost = serializers.IntegerField(min_value=0, max_value=100_000, allow_null=True)
    cost_note = serializers.CharField(max_length=120, allow_blank=True, default="")
    first_free = serializers.BooleanField(default=False)
    brace_cost = serializers.IntegerField(min_value=0, max_value=100_000, allow_null=True, default=None)
    who = WhoField(default=dict)
    warband_max = serializers.IntegerField(min_value=1, max_value=99, allow_null=True, default=None)
    note = serializers.CharField(max_length=300, allow_blank=True, default="")
    variant = serializers.CharField(max_length=40, allow_blank=True, default="")


class EquipmentListSerializer(serializers.Serializer):
    """`POST warband-templates/<id>/lists/` and `PUT .../lists/<key>/`: the list, who buys from it and its lines."""

    name = serializers.CharField(max_length=160)
    note = serializers.CharField(max_length=500, allow_blank=True, default="")
    fighters = serializers.ListField(child=serializers.SlugField(max_length=80), default=list)
    lines = LineSerializer(many=True, default=list)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        ids = [line["item_id"] for line in attrs["lines"]]
        try:
            current = refuse_unknown(Item.objects.all(), ids, self.context["campaign_id"]) if ids else {}
        except serializers.ValidationError as error:
            raise serializers.ValidationError({"lines": error.detail}) from None
        attrs["lines"] = [{**line, "item_id": current[line["item_id"]]} for line in attrs["lines"]]
        return attrs
