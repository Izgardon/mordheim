"""The warband log and the treasury ledger: rows out, hand-entered rows in."""

from typing import Any

from rest_framework import serializers

from apps.warbands.models import LedgerAction, WarbandLog, WarbandTrade
from apps.warbands.services.ledger import MAX_TRADE_PRICE
from apps.warbands.services.ledger_names import ParsedAction, parse_action


class WarbandLogSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WarbandLog
        fields = ("id", "warband_id", "parent_id", "feature", "entry_type", "payload", "created_at")


class WarbandLogCreateSerializer(serializers.Serializer):
    feature = serializers.CharField(max_length=80, required=False, allow_blank=True)
    entry_type = serializers.CharField(max_length=80, required=False, allow_blank=True)
    payload = serializers.JSONField(required=False)

    def validate_feature(self, value):
        return str(value).strip()

    def validate_entry_type(self, value):
        return str(value).strip()

    def validate_payload(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Payload must be an object.")
        return value


class LedgerAuthorSerializer(serializers.Serializer):
    """Who entered a ledger row by hand (decision 6)."""

    id = serializers.IntegerField()
    name = serializers.CharField(source="first_name")


class WarbandTradeChildSerializer(serializers.ModelSerializer):
    created_by = LedgerAuthorSerializer(read_only=True, allow_null=True)

    class Meta:
        model = WarbandTrade
        fields = (
            "id",
            "action",
            "description",
            "price",
            "notes",
            "created_by",
            "created_at",
        )


class WarbandTradeSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    created_by = LedgerAuthorSerializer(read_only=True, allow_null=True)
    children = WarbandTradeChildSerializer(many=True, read_only=True)

    class Meta:
        model = WarbandTrade
        fields = (
            "id",
            "warband_id",
            "parent_id",
            "action",
            "description",
            "price",
            "notes",
            "created_by",
            "children",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class WarbandTradeCreateSerializer(serializers.ModelSerializer):
    """POST trades/: a hand-entered row (decision 4).

    `action` is a vocabulary name in any case, or an older automatic name ("Bought", "Trade sent", ...) that maps
    onto it. `price` is the gold moved: signed for Trade and Adjustment (negative leaves the warband); 0 or more
    for every other action, which gives the sign; 0 for a Group header. Validated data carries the vocabulary
    `action` and the signed `amount`.
    """

    action = serializers.CharField(max_length=120)
    price = serializers.IntegerField(required=False, default=0, min_value=-MAX_TRADE_PRICE, max_value=MAX_TRADE_PRICE)
    parent_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = WarbandTrade
        fields = ("action", "description", "price", "notes", "parent_id")

    def validate_action(self, value: str) -> ParsedAction:
        parsed = parse_action(value)
        if parsed is None:
            raise serializers.ValidationError(f"Unknown action. Use one of: {', '.join(LedgerAction.values)}.")
        return parsed

    def validate_description(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Description is required")
        return cleaned

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        parsed: ParsedAction = attrs["action"]
        price = attrs["price"]
        if parsed.action is LedgerAction.GROUP and price:
            raise serializers.ValidationError({"price": ["A group header moves no gold."]})
        if price < 0 and (parsed.sign is not None or not parsed.action.is_signed):
            raise serializers.ValidationError({"price": ["Gold coins cannot be negative"]})
        attrs["action"], attrs["amount"] = parsed.action, parsed.amount(price)
        return attrs
