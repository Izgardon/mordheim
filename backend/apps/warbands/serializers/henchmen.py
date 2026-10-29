"""Henchmen group payloads: their fields and members (the shared parts are in apps/warbands/units/serializers.py)."""

import math
from typing import Any, cast

from rest_framework import serializers

from apps.warbands.models import Henchman, HenchmenGroup
from apps.warbands.services.ledger import MAX_TRADE_PRICE
from apps.warbands.units.companions import group_mount_warnings, mount_kinds, mount_payload, unit_name
from apps.warbands.units.kinds import HENCHMEN_GROUP
from apps.warbands.units.serializers import (
    COMPANION_FIELDS,
    MISSING_FIELDS,
    STAT_FIELDS,
    UnitDetailSerializer,
    UnitSummarySerializer,
    UnitWriteSerializer,
    get_prefetched_or_query,
)
from apps.warbands.units.services.hire_cost import henchman_hire_cost

WRITE_FIELDS = (
    "name",
    "unit_type",
    "race",
    "price",
    "xp",
    "max_size",
    "level_up",
    "deeds",
    "large",
    "half_rate",
    "no_level_ups",
    "dead",
    *STAT_FIELDS,
    "items",
    "skill_ids",
    "special_ids",
    "henchmen",
)


class HenchmanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Henchman
        fields = ("id", "name", "kills", "dead")


class HenchmanEntrySerializer(serializers.ModelSerializer):
    """One member entry in a group create or PATCH.

    Bad values are a 400 here instead of a database error (BUG-90), and ids come out as ints, so
    "12" names the same member as 12 (BUG-93). `cost` and `item_notes` are passed through as sent;
    the view parses them for the recruit trade.
    """

    id = serializers.IntegerField(required=False, allow_null=True)
    cost = serializers.JSONField(required=False, allow_null=True)
    item_notes = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Henchman
        fields = ("id", "name", "kills", "dead", "cost", "item_notes")
        extra_kwargs = {"name": {"required": False, "allow_blank": True, "trim_whitespace": False}}

    def validate_cost(self, value: Any) -> Any:
        """A numeric cost must fit the ledger's price column (BUG-96).

        Infinity, NaN and numbers too large for a trade are a 400 instead of a 500 after the member was
        created. Anything that isn't a number is passed through: the view falls back to the default cost.
        """
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError):
            return value
        if not math.isfinite(number) or number >= MAX_TRADE_PRICE + 1:
            raise serializers.ValidationError(f"Enter a cost of at most {MAX_TRADE_PRICE} gc.")
        return value


class HenchmenMembersMixin(serializers.Serializer):
    """The group's members as the view loaded them (the roster views prefetch living members only)."""

    henchmen = serializers.SerializerMethodField()
    hire_cost = serializers.SerializerMethodField()
    source_beast_id = serializers.IntegerField(read_only=True)  # the creature it was recruited from, or None
    beast_kind = serializers.SerializerMethodField()
    mounts = serializers.SerializerMethodField()
    mount_warnings = serializers.SerializerMethodField()

    def get_mounts(self, group: HenchmenGroup) -> list[dict[str, Any]]:
        """Each kind of mount the members ride, the first switched-on copy of each item in row order (`mount` is the
        first), so the page lists every kind's entries for a group on a Warhorse and a Pony. No query of its own."""
        rows = get_prefetched_or_query(group, "henchmen_group_items", "henchmen_group_items")
        return [mount_payload(row) for row in mount_kinds(rows)]

    def get_mount_warnings(self, group: HenchmenGroup) -> list[dict[str, Any]]:
        """While the group rides: its mounts against its living members and the kinds it rides, as the switch warns
        (every member of a group carries the same gear). Shown on the card, so a member recruited after the group
        mounted shows it too. No query of its own."""
        rows = get_prefetched_or_query(group, "henchmen_group_items", "henchmen_group_items")
        return group_mount_warnings(unit_name(group, HENCHMEN_GROUP.unknown_name), rows, _living(group))

    def get_beast_kind(self, group: HenchmenGroup) -> str | None:
        """The source beast's kind, read with the group's row (`UnitKindSpec.row_annotations`)."""
        if hasattr(group, "beast_kind"):
            return cast(str | None, group.beast_kind)
        beast = group.source_beast
        return beast.kind if beast is not None else None

    def get_henchmen(self, group: HenchmenGroup) -> Any:
        return HenchmanSerializer(get_prefetched_or_query(group, "henchmen", "henchmen"), many=True).data

    def get_hire_cost(self, group: HenchmenGroup) -> int:
        """What one more member costs (decision 7): what a recruit is charged when the save names no cost."""
        items = get_prefetched_or_query(group, "henchmen_group_items", "henchmen_group_items")
        return henchman_hire_cost(group.price, group.xp, [(row.item_id, row.cost) for row in items], _living(group))


def _living(group: HenchmenGroup) -> int:
    """The group's living members, from its loaded members (the roster views load only those)."""
    members = get_prefetched_or_query(group, "henchmen", "henchmen")
    return sum(1 for member in members if not member.dead and member.dismissed_at is None)


class HenchmenGroupSummarySerializer(HenchmenMembersMixin, UnitSummarySerializer):
    kind = HENCHMEN_GROUP

    class Meta:
        model = HenchmenGroup
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "price",
            "hire_cost",
            "xp",
            "max_size",
            "level_up",
            "large",
            "half_rate",
            "no_level_ups",
            "dead",
            "source_beast_id",
            "beast_kind",
            *MISSING_FIELDS,
            *STAT_FIELDS,
            *COMPANION_FIELDS,
            "mounts",
            "mount_warnings",
            "items",
            "skills",
            "specials",
            "henchmen",
        )


class HenchmenGroupDetailSerializer(HenchmenMembersMixin, UnitDetailSerializer):
    kind = HENCHMEN_GROUP

    class Meta:
        model = HenchmenGroup
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "race",
            "price",
            "hire_cost",
            "xp",
            "max_size",
            "level_up",
            "deeds",
            "large",
            "half_rate",
            "no_level_ups",
            "dead",
            "source_beast_id",
            "beast_kind",
            *MISSING_FIELDS,
            *STAT_FIELDS,
            *COMPANION_FIELDS,
            "mounts",
            "mount_warnings",
            "items",
            "skills",
            "specials",
            "henchmen",
            "updated_at",  # the version a roster Save sends back (409 when it changed)
        )


class HenchmenGroupCreateSerializer(UnitWriteSerializer):
    kind = HENCHMEN_GROUP

    henchmen = serializers.ListField(child=HenchmanEntrySerializer(), write_only=True, required=True)

    class Meta:
        model = HenchmenGroup
        fields = WRITE_FIELDS

    def validate_henchmen(self, value):
        if not value:
            raise serializers.ValidationError("At least one henchman is required.")
        return value


class HenchmenGroupUpdateSerializer(UnitWriteSerializer):
    kind = HENCHMEN_GROUP

    henchmen = serializers.ListField(child=HenchmanEntrySerializer(), write_only=True, required=False)

    class Meta:
        model = HenchmenGroup
        fields = (*WRITE_FIELDS, *MISSING_FIELDS)
