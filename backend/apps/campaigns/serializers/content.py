"""House rules, campaign rules, encampments and chat messages."""

from rest_framework import serializers

from apps.users.names import display_name

from ..access import CAMPAIGN_RULES
from ..effects import EFFECT_KEYS
from ..models import (
    CAMPAIGN_RULE_KINDS,
    CHART_DICE,
    MAX_CAMPAIGN_RULE_TEXT,
    CampaignEncampment,
    CampaignHouseRule,
    CampaignMembership,
    CampaignMessage,
    CampaignRule,
)
from .charts import MAX_ROWS, CampaignChartRowSerializer


class CampaignHouseRuleSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CampaignHouseRule
        fields = ("id", "campaign_id", "title", "description", "effect_key", "created_at", "updated_at")


class CampaignHouseRuleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignHouseRule
        fields = ("title", "description", "effect_key")

    def validate_effect_key(self, value):
        """One of the known effects, or nothing (a rule that is only text; IMP-69)."""
        if value and value not in EFFECT_KEYS:
            raise serializers.ValidationError(f"Unknown effect: {value}.")
        return value


class RuleTableSerializer(serializers.Serializer):
    """A rule's own table: the chart's fields, without the place and heading a standalone chart carries."""

    dice = serializers.ChoiceField(choices=CHART_DICE, allow_blank=True, required=False, default="")
    description = serializers.CharField(max_length=2000, allow_blank=True, required=False, default="")
    note = serializers.CharField(max_length=2000, allow_blank=True, required=False, default="")
    rows = CampaignChartRowSerializer(many=True)

    def validate_rows(self, value: list[dict]) -> list[dict]:
        if not value:
            raise serializers.ValidationError("A table needs at least one result.")
        if len(value) > MAX_ROWS:
            raise serializers.ValidationError(f"A table holds at most {MAX_ROWS} results.")
        return value


class CampaignRuleSerializer(serializers.ModelSerializer):
    """A campaign rule (models.CampaignRule): read, and written by POST campaign-rules/ and PATCH
    campaign-rules/<id>/ (a PATCH may send any of the fields); its place changes only through PUT
    campaign-rules/order/. `kind` tells a campaign rule from a battle rule and `umbrella` is the heading it shares
    with the rules it belongs with (William, 19 Nov 2026)."""

    campaign_id = serializers.IntegerField(read_only=True)
    kind = serializers.ChoiceField(choices=CAMPAIGN_RULE_KINDS, required=False)
    title = serializers.CharField(max_length=160, trim_whitespace=True)
    body = serializers.CharField(
        max_length=MAX_CAMPAIGN_RULE_TEXT, allow_blank=True, required=False, trim_whitespace=True
    )
    umbrella = serializers.CharField(max_length=120, allow_blank=True, required=False, trim_whitespace=True)
    chart = RuleTableSerializer(required=False, allow_null=True)

    class Meta:
        model = CampaignRule
        fields = ("id", "campaign_id", "kind", "title", "body", "umbrella", "order", "chart")
        read_only_fields = ("order",)

    def to_representation(self, instance):
        """The rule with its own table, from the rows already read (no query)."""
        data = super().to_representation(instance)
        table = next(iter(instance.charts.all()), None)
        data["chart"] = (
            None
            if table is None
            else {
                "dice": table.dice,
                "description": table.description,
                "note": table.note,
                "rows": [
                    {"id": row.id, "result": row.result, "name": row.name, "text": row.text} for row in table.rows.all()
                ],
            }
        )
        return data


class CampaignRuleOrderSerializer(serializers.Serializer):
    """PUT campaign-rules/order/: every rule's id, in its new order."""

    ids = serializers.ListField(child=serializers.IntegerField(), max_length=500)


class CampaignEncampmentSerializer(serializers.ModelSerializer):
    """An encampment, with `owner_left` (its owner has left the campaign: shown "(left)") and what the reader may do
    with it (`capabilities.edit`: edit, reassign, remove); `context["access"]` is the reader's CampaignAccess."""

    campaign_id = serializers.IntegerField(read_only=True)
    owner_id = serializers.IntegerField(source="owner.id", read_only=True, allow_null=True)
    owner_name = serializers.SerializerMethodField()
    owner_left = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()

    class Meta:
        model = CampaignEncampment
        fields = ("id", "campaign_id", "name", "owner_id", "owner_name", "owner_left", "description", "capabilities")

    def get_owner_name(self, obj):
        if not obj.owner_id:
            return None
        return display_name(obj.owner)

    def get_owner_left(self, obj):
        return bool(obj.owner_id) and not getattr(obj, "owner_is_member", True)  # annotated (services/encampments)

    def get_capabilities(self, obj):
        access = self.context["access"]
        return {"edit": not access.archived and CAMPAIGN_RULES["edit_encampment"](access, obj)}


class CampaignEncampmentWriteSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = CampaignEncampment
        fields = ("name", "owner_id", "description")

    def validate_name(self, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required.")
        return cleaned

    def validate_owner_id(self, value):
        if value is None:
            return None
        campaign_id = self.context.get("campaign_id")
        if (
            campaign_id is None
            or not CampaignMembership.objects.filter(campaign_id=campaign_id, user_id=value).exists()
        ):
            raise serializers.ValidationError("Owner must be a member of the campaign.")
        return value


class RemovablePostSerializer(serializers.ModelSerializer):
    """A chat message: once removed (decision 8) its body is gone and `removed_by` says by whom,
    "author" or "admin" (an owner or admin, or a remover whose account is gone)."""

    user_id = serializers.IntegerField(source="user.id", read_only=True, allow_null=True)
    body = serializers.SerializerMethodField()
    removed_by = serializers.SerializerMethodField()

    def get_body(self, obj):
        return "" if obj.removed_at else obj.body

    def get_removed_by(self, obj):
        if not obj.removed_at:
            return None
        return "author" if obj.removed_by_id is not None and obj.removed_by_id == obj.user_id else "admin"


class CampaignMessageSerializer(RemovablePostSerializer):
    class Meta:
        model = CampaignMessage
        fields = ("id", "campaign_id", "user_id", "username", "body", "created_at", "removed_at", "removed_by")
