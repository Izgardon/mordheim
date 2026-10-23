"""The warband log and the treasury ledger: rows out, hand-entered rows in."""

import json
from typing import Any

from rest_framework import serializers

from apps.users.names import display_name
from apps.warbands.models import LedgerAction, WarbandLog, WarbandTrade
from apps.warbands.services.economy_log import CLIENT_LOG_ENTRIES, MAX_CLIENT_PAYLOAD
from apps.warbands.services.ledger import MAX_TRADE_PRICE
from apps.warbands.services.ledger_names import ParsedAction, parse_action


class WarbandLogSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WarbandLog
        fields = ("id", "warband_id", "parent_id", "feature", "entry_type", "payload", "created_at")


class WarbandLogCreateSerializer(serializers.Serializer):
    """POST logs/: only entries the server can't write itself (ECON-CQ-02): dice rolls (`CLIENT_LOG_ENTRIES`;
    purchases and rarity rolls are logged by the server since pass 2, phase 2). The payload is an object of at most
    `MAX_CLIENT_PAYLOAD` bytes of JSON."""

    feature = serializers.CharField(max_length=80)
    entry_type = serializers.CharField(max_length=80)
    payload = serializers.JSONField()

    def validate_payload(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Payload must be an object.")
        if not value:
            raise serializers.ValidationError("Payload is required.")
        if len(json.dumps(value)) > MAX_CLIENT_PAYLOAD:
            raise serializers.ValidationError(f"Payload is too large (at most {MAX_CLIENT_PAYLOAD} bytes).")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if (attrs["feature"], attrs["entry_type"]) not in CLIENT_LOG_ENTRIES:
            raise serializers.ValidationError(
                {"feature": ["The server writes this kind of log entry itself."]}, code="server_log_entry"
            )
        return attrs


class LedgerAuthorSerializer(serializers.Serializer):
    """Who entered a ledger row by hand (decision 6), by display name: "Player N" without one, never the email
    (SEC-13, AUTH-TWEAK-02)."""

    id = serializers.IntegerField()
    name = serializers.SerializerMethodField()

    def get_name(self, user: Any) -> str:
        return display_name(user)


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
            "corrects_id",
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
            "corrects_id",
            "children",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class WarbandTradeCreateSerializer(serializers.ModelSerializer):
    """POST trades/: a hand-entered row (decision 4).

    `action` is a vocabulary name in any case, or an older automatic name ("Bought", "Trade sent", ...) that maps
    onto it. `price` is the gold moved: signed for Trade and Adjustment (negative leaves the warband); 0 or more
    for every other action, which gives the sign; 0 for a Group header. A correction is an Adjustment whose
    description is the reason; `corrects_id` may name the row it corrects (decision 5). Validated data carries
    the vocabulary `action` and the signed `amount`.
    """

    action = serializers.CharField(max_length=120)
    price = serializers.IntegerField(required=False, default=0, min_value=-MAX_TRADE_PRICE, max_value=MAX_TRADE_PRICE)
    parent_id = serializers.IntegerField(required=False, allow_null=True)
    corrects_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = WarbandTrade
        fields = ("action", "description", "price", "notes", "parent_id", "corrects_id")

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
        if attrs.get("corrects_id") is not None and parsed.action is not LedgerAction.ADJUSTMENT:
            raise serializers.ValidationError({"corrects_id": ["Only an adjustment corrects another row."]})
        attrs["action"], attrs["amount"] = parsed.action, parsed.amount(price)
        return attrs


class WarbandTradeEditSerializer(serializers.Serializer):
    """PATCH trades/<id>/: a hand-entered row's description and notes, nothing else (decision 5)."""

    description = serializers.CharField(max_length=500, required=False)
    notes = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        fixed = sorted(set(self.initial_data) - set(self.fields))
        if fixed:
            message = "Only the description and notes can change; correct the gold with an adjustment."
            raise serializers.ValidationError({name: [message] for name in fixed})
        return attrs
