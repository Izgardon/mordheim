"""What the template editor's saves send (the templates plan, phase 4), checked for data integrity only: a name, ids
that exist and that the campaign may link (the book's or its own, read as its current entries: core/catalogue/scope.py,
each list in one query), keys and variants in their shape. Game rules are never refused here; the editor warns about
them (services/checks.py). The template's own keys (its fighters, lists and variants) are checked by the services,
which hold the template."""

from typing import Any

from django.db.models import Q
from rest_framework import serializers

from apps.campaigns.models import CampaignType
from apps.core.catalogue.scope import CatalogueEntryField, refuse_unknown
from apps.special.categories import CATEGORY_CHOICES
from apps.special.kinds import KIND_CHOICES
from apps.special.models import Special
from apps.warbands.models import WarbandType
from apps.warbands.models.warband import MAX_RULE_TEXT

from .models import WarbandTemplate


def _campaign_types(ids: list[int], campaign_id: int) -> None:
    """The types are the book's or the campaign's own (one query)."""
    found = set(
        WarbandType.objects.filter(Q(campaign__isnull=True) | Q(campaign_id=campaign_id), pk__in=ids).values_list(
            "pk", flat=True
        )
    )
    missing = [pk for pk in ids if pk not in found]
    if missing:
        raise serializers.ValidationError({"types": [f'Invalid pk "{pk}" - object does not exist.' for pk in missing]})


class WhoField(serializers.JSONField):
    """Who may take a line or an upgrade, by fighter key: `{}` anyone, `{"heroes": true, "fighters": [...]}`, or
    `{"except": [...]}`."""

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise serializers.ValidationError("Send who as an object.")
        keys = serializers.ListField(child=serializers.SlugField(max_length=80))
        if "except" in data:
            named = keys.run_validation(data["except"])
            return {"except": named} if named else {}
        heroes = bool(data.get("heroes"))
        fighters = keys.run_validation(data.get("fighters") or [])
        return {**({"heroes": True} if heroes else {}), **({"fighters": fighters} if fighters else {})}


class SpecialRuleSerializer(serializers.Serializer):
    """A rule a fighter has or an upgrade gives: a special picked (`special_id`), or one written (`name`, with its
    `description`, Boons & Banes `kind` and `category`), which the save makes the template's own."""

    special_id = serializers.IntegerField(min_value=1, required=False)
    name = serializers.CharField(max_length=160, required=False)
    description = serializers.CharField(max_length=4000, allow_blank=True, required=False, default="")
    kind = serializers.ChoiceField(choices=KIND_CHOICES, required=False)
    category = serializers.ChoiceField(choices=CATEGORY_CHOICES, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "special_id" in attrs:
            return {"special_id": attrs["special_id"]}
        if not attrs.get("name"):
            raise serializers.ValidationError("Pick a rule, or give the new one a name.")
        return attrs


def current_specials(rules: list[dict[str, Any]], campaign_id: int) -> list[dict[str, Any]]:
    """The picked specials as the campaign's current entries (one query); another campaign's is an unknown id."""
    picked = [rule["special_id"] for rule in rules if "special_id" in rule]
    current = refuse_unknown(Special.objects.all(), picked, campaign_id) if picked else {}
    return [{"special_id": current[rule["special_id"]]} if "special_id" in rule else rule for rule in rules]


class CreateTemplateSerializer(serializers.Serializer):
    """`POST warband-templates/`: a name, the types it serves, and the template it copies (none: blank)."""

    name = serializers.CharField(max_length=160)
    copy_of = CatalogueEntryField(
        queryset=WarbandTemplate.objects.all(), required=False, allow_null=True, source="source"
    )
    type_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), default=list)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs["type_ids"] = list(dict.fromkeys(attrs["type_ids"]))
        _campaign_types(attrs["type_ids"], self.context["campaign_id"])
        return attrs


class VariantSerializer(serializers.Serializer):
    """A variant and its own terms: Marienburg's 600 gc and +1 to find rare items, the Hung's 12 warriors."""

    key = serializers.SlugField(max_length=40)
    name = serializers.CharField(max_length=80)
    starting_gold = serializers.IntegerField(min_value=0, max_value=100_000, required=False, allow_null=True)
    max_models = serializers.IntegerField(min_value=1, max_value=999, required=False, allow_null=True)
    rare_bonus = serializers.IntegerField(min_value=-6, max_value=6, required=False, allow_null=True)
    rare_bonus_except = serializers.ListField(child=serializers.CharField(max_length=160), required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return {field: value for field, value in attrs.items() if value not in (None, [])}  # stored as the import's


class TypeLinkSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)
    variant = serializers.CharField(max_length=40, allow_blank=True, default="")


class BasicsSerializer(serializers.Serializer):
    """`PUT warband-templates/<id>/basics/`."""

    name = serializers.CharField(max_length=160)
    setting_id = serializers.PrimaryKeyRelatedField(
        queryset=CampaignType.objects.all(), allow_null=True, source="campaign_type"
    )
    starting_gold = serializers.IntegerField(min_value=0, max_value=100_000, allow_null=True)
    max_models = serializers.IntegerField(min_value=1, max_value=999, allow_null=True)
    variants = VariantSerializer(many=True)
    types = TypeLinkSerializer(many=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        keys = [entry["key"] for entry in attrs["variants"]]
        if len(set(keys)) < len(keys):
            raise serializers.ValidationError({"variants": ["Two variants share a key."]})
        type_ids = [row["id"] for row in attrs["types"]]
        if len(set(type_ids)) < len(type_ids):
            raise serializers.ValidationError({"types": ["A type is listed twice."]})
        if any(row["variant"] and row["variant"] not in keys for row in attrs["types"]):
            raise serializers.ValidationError({"types": ["A type presets a variant the template doesn't have."]})
        _campaign_types(type_ids, self.context["campaign_id"])
        return attrs


class TemplateRuleSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    title = serializers.CharField(max_length=160)
    description = serializers.CharField(max_length=MAX_RULE_TEXT, allow_blank=True, default="")
    variant = serializers.CharField(max_length=40, allow_blank=True, default="")
    warband_type_id = serializers.IntegerField(min_value=1, allow_null=True, default=None)


class RulesSerializer(serializers.Serializer):
    """`PUT warband-templates/<id>/rules/`: every rule, in order."""

    rules = TemplateRuleSerializer(many=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """A rule for one type names a type the campaign can pick; one the template doesn't serve warns (checks.py)."""
        type_ids = list({rule["warband_type_id"] for rule in attrs["rules"]} - {None})
        if type_ids:
            _campaign_types(type_ids, self.context["campaign_id"])
        return attrs


class UpgradeSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    group = serializers.CharField(max_length=120)
    rule = SpecialRuleSerializer()
    cost = serializers.IntegerField(min_value=0, allow_null=True)  # null: none in the book; 0: free
    cost_note = serializers.CharField(max_length=120, allow_blank=True, default="")
    note = serializers.CharField(max_length=300, allow_blank=True, default="")
    who = WhoField(default=dict)
    max_per_fighter = serializers.IntegerField(min_value=1, max_value=99, allow_null=True, default=None)
    later_double = serializers.BooleanField(default=False)
    at_recruit = serializers.BooleanField(default=False)


class UpgradesSerializer(serializers.Serializer):
    """`PUT warband-templates/<id>/upgrades/`: every upgrade, in order."""

    upgrades = UpgradeSerializer(many=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        rules = current_specials([row["rule"] for row in attrs["upgrades"]], self.context["campaign_id"])
        attrs["upgrades"] = [{**row, "rule": rule} for row, rule in zip(attrs["upgrades"], rules, strict=True)]
        return attrs
