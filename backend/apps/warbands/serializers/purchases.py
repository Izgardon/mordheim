"""Purchases and rarity rolls: request bodies (POST purchases/, rarity-rolls/, and a batch's `purchases`)."""

from typing import Any

from rest_framework import serializers

from apps.warbands.services.ledger import MAX_TRADE_PRICE

TARGET_TYPES = ("stash", "hero", "hired_sword", "henchmen_group")


class RarityRollSerializer(serializers.Serializer):
    """The roll that found a rare item: who searched, what they rolled (with any modifier) and whether it worked."""

    hero_id = serializers.IntegerField()
    roll = serializers.IntegerField(min_value=0, max_value=1000)
    modifier = serializers.IntegerField(required=False, default=0, min_value=-100, max_value=100)
    rarity = serializers.CharField(required=False, allow_blank=True, max_length=40)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=200)
    success = serializers.BooleanField()


class PurchaseLineSerializer(serializers.Serializer):
    """What is bought (or given, `is_buying: false`) and for how much: `price` per copy, or `availability_id`'s
    cost, or with neither the item's current campaign price."""

    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(required=False, default=1, min_value=1, max_value=100)
    price = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=MAX_TRADE_PRICE)
    availability_id = serializers.IntegerField(required=False, allow_null=True)
    is_buying = serializers.BooleanField(required=False, default=True)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
    rarity_roll = RarityRollSerializer(required=False, allow_null=True)


class PurchaseSerializer(PurchaseLineSerializer):
    """POST purchases/: a line plus where the copies go (the stash, or a unit on the roster)."""

    target_type = serializers.ChoiceField(choices=TARGET_TYPES)
    target_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["target_type"] == "stash":
            attrs["target_id"] = None
        elif attrs.get("target_id") is None:
            raise serializers.ValidationError({"target_id": ["target_id is required for a unit."]})
        return attrs


class RarityRollRequestSerializer(RarityRollSerializer):
    """POST rarity-rolls/: a roll that ended without a purchase; it still spends the searcher's trading action."""

    item_id = serializers.IntegerField()
