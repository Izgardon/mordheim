"""Henchmen group payloads: their fields and members (the shared parts are in apps/warbands/units/serializers.py)."""

import math
from typing import Any, cast

from rest_framework import serializers

from apps.warbands.models import Henchman, HenchmenGroup, RosterUnit, on_roster
from apps.warbands.prefetches import gap_entries, members_with_gaps
from apps.warbands.services.ledger import MAX_TRADE_PRICE
from apps.warbands.services.loadouts import lacking_by_row, loadout_totals
from apps.warbands.units.companions import group_mount_warnings, mount_kinds, mount_payload, unit_name
from apps.warbands.units.kinds import HENCHMEN_GROUP
from apps.warbands.units.serializers import (
    COMPANION_FIELDS,
    MISSING_FIELDS,
    STAT_FIELDS,
    XP_CHANGE_FIELDS,
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
    "promotable",
    "dead",
    *STAT_FIELDS,
    "items",
    "skill_ids",
    "special_ids",
    "henchmen",
)


class HenchmanSerializer(serializers.ModelSerializer):
    """A member, with the loadout rows he lacks (`gaps`: id, row_id, item_id, reason, left; services/loadouts.py)."""

    gaps = serializers.SerializerMethodField()

    class Meta:
        model = Henchman
        fields = ("id", "name", "kills", "dead", "gaps")

    def get_gaps(self, member: Henchman) -> list[dict[str, Any]]:
        """Read with his row (`gap_entries`), else in one query."""
        entries = getattr(member, "gap_entries", None)
        if entries is None:
            entries = Henchman.objects.filter(pk=member.pk).annotate(gaps=gap_entries()).values_list("gaps", flat=True)
            entries = entries.first()
        return list(entries or [])


class HenchmanEntrySerializer(serializers.ModelSerializer):
    """One member entry in a group create or PATCH.

    Bad values are a 400 here instead of a database error (BUG-90), and ids come out as ints, so
    "12" names the same member as 12 (BUG-93). `cost` and `item_notes` are passed through as sent;
    the view parses them for the recruit trade.
    """

    id = serializers.IntegerField(required=False, allow_null=True)
    cost = serializers.JSONField(required=False, allow_null=True)
    item_notes = serializers.JSONField(required=False, allow_null=True)
    # henchmen loadouts: a living member sent with `dismiss` leaves, his share to the stash or with him; a new member
    # takes these loadout rows' copies from the stash, or joins without these (each off his cost)
    dismiss = serializers.ChoiceField(choices=("stash", "leaves"), required=False)
    from_stash = serializers.ListField(child=serializers.IntegerField(), required=False)
    without = serializers.ListField(child=serializers.IntegerField(), required=False)

    class Meta:
        model = Henchman
        fields = ("id", "name", "kills", "dead", "cost", "item_notes", "dismiss", "from_stash", "without")
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
    """The group's members as the view loaded them (the roster views prefetch living members only, with their gaps),
    and its loadout: each item row is what every member carries (services/loadouts.py)."""

    henchmen = serializers.SerializerMethodField()
    hire_cost = serializers.SerializerMethodField()
    loadout_each = serializers.SerializerMethodField()
    loadout_total = serializers.SerializerMethodField()
    source_beast_id = serializers.IntegerField(read_only=True)  # the creature it was recruited from, or None
    beast_kind = serializers.SerializerMethodField()
    mounts = serializers.SerializerMethodField()
    mount_warnings = serializers.SerializerMethodField()

    def _rows(self, group: HenchmenGroup) -> list[Any]:
        return get_prefetched_or_query(group, "henchmen_group_items", "henchmen_group_items")

    def _members(self, group: HenchmenGroup) -> list[Henchman]:
        """The loaded members (with their gaps), else the living ones read with their gaps in one query."""
        cache: dict[str, Any] = getattr(group, "_prefetched_objects_cache", {})
        if "henchmen" not in cache:
            cache["henchmen"] = list(members_with_gaps(on_roster(Henchman.objects.filter(group=group))))
            setattr(group, "_prefetched_objects_cache", cache)  # noqa: B010 - Django's own cache attribute
        return list(cache["henchmen"])

    def _living(self, group: HenchmenGroup) -> list[Henchman]:
        return [member for member in self._members(group) if not member.dead and member.dismissed_at is None]

    def get_items(self, unit: RosterUnit) -> list[Any]:
        """The loadout rows, each with `carriers`: the living members who carry it (less those with a gap on it)."""
        items: list[dict[str, Any]] = super().get_items(unit)  # type: ignore[misc]
        living = self._living(cast(HenchmenGroup, unit))
        lacking = lacking_by_row(living)
        for entry in items:
            entry["carriers"] = max(len(living) - lacking.get(entry["row_id"], 0), 0)
        return items

    def get_mounts(self, group: HenchmenGroup) -> list[dict[str, Any]]:
        """Each kind of mount the members ride, the first switched-on row of each item (`mount` is the first), so the
        page lists every kind's entries for a group on a Warhorse and a Pony. No query of its own."""
        return [mount_payload(row) for row in mount_kinds(self._rows(group))]

    def get_mount_warnings(self, group: HenchmenGroup) -> list[dict[str, Any]]:
        """While the group rides more than one kind of mount (every member carries the same gear). No query."""
        return group_mount_warnings(unit_name(group, HENCHMEN_GROUP.unknown_name), self._rows(group))

    def get_beast_kind(self, group: HenchmenGroup) -> str | None:
        """The source beast's kind, read with the group's row (`UnitKindSpec.row_annotations`)."""
        if hasattr(group, "beast_kind"):
            return cast(str | None, group.beast_kind)
        beast = group.source_beast
        return beast.kind if beast is not None else None

    def get_henchmen(self, group: HenchmenGroup) -> Any:
        return HenchmanSerializer(self._members(group), many=True).data

    def get_hire_cost(self, group: HenchmenGroup) -> int:
        """What one more member costs (decision 7, with the loadout): what a recruit is charged when the save names no
        cost."""
        return henchman_hire_cost(group.price, group.xp, [row.cost for row in self._rows(group)])

    def get_loadout_each(self, group: HenchmenGroup) -> int:
        """What one member's loadout cost: "Loadout 45 gc each"."""
        return loadout_totals(self._rows(group), self._living(group))[0]

    def get_loadout_total(self, group: HenchmenGroup) -> int:
        """What the group's copies cost: the members times the loadout, less the gaps ("· 180 gc")."""
        return loadout_totals(self._rows(group), self._living(group))[1]


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
            "loadout_each",
            "loadout_total",
            "xp",
            "max_size",
            "level_up",
            "large",
            "half_rate",
            "no_level_ups",
            "promotable",
            "fighter_key",
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
            "loadout_each",
            "loadout_total",
            "xp",
            "max_size",
            "level_up",
            "deeds",
            "large",
            "half_rate",
            "no_level_ups",
            "promotable",
            "fighter_key",
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
        fields = (*WRITE_FIELDS, "fighter_key")

    def validate_henchmen(self, value):
        if not value:
            raise serializers.ValidationError("At least one henchman is required.")
        return value


class HenchmenGroupUpdateSerializer(UnitWriteSerializer):
    kind = HENCHMEN_GROUP

    henchmen = serializers.ListField(child=HenchmanEntrySerializer(), write_only=True, required=False)

    class Meta:
        model = HenchmenGroup
        fields = (*WRITE_FIELDS, *MISSING_FIELDS, *XP_CHANGE_FIELDS)
