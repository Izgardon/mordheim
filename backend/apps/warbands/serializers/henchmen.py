"""Henchmen group payloads: their fields and members (the shared parts are in apps/warbands/units/serializers.py)."""

import math
from typing import Any

from rest_framework import serializers

from apps.warbands.models import Henchman, HenchmenGroup
from apps.warbands.units.kinds import HENCHMEN_GROUP
from apps.warbands.units.serializers import (
    STAT_FIELDS,
    UnitDetailSerializer,
    UnitSummarySerializer,
    UnitWriteSerializer,
    get_prefetched_or_query,
)
from apps.warbands.units.services.loadout import (
    apply_create_traits,
    finish_update_traits,
    pop_loadout_lists,
    prepare_update_traits,
    replace_loadout,
)
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups
from apps.warbands.utils.trades import MAX_TRADE_PRICE

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

    def get_henchmen(self, group: HenchmenGroup) -> Any:
        return HenchmanSerializer(get_prefetched_or_query(group, "henchmen", "henchmen"), many=True).data


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
            "xp",
            "max_size",
            "level_up",
            "large",
            "half_rate",
            "no_level_ups",
            "dead",
            *STAT_FIELDS,
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
            "skills",
            "specials",
            "henchmen",
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

    def create(self, validated_data):
        lists = pop_loadout_lists(HENCHMEN_GROUP, validated_data)
        henchmen_data = validated_data.pop("henchmen", [])
        apply_create_traits(HENCHMEN_GROUP, validated_data, lists)

        # Seeded XP on first persist should not generate queued level-ups.
        validated_data["level_up"] = 0

        group = HenchmenGroup.objects.create(**validated_data)
        replace_loadout(HENCHMEN_GROUP, group, lists, fresh=True)

        Henchman.objects.bulk_create([Henchman(group=group, name=entry.get("name", "")) for entry in henchmen_data])

        return group


MEMBER_FIELDS = ("name", "kills", "dead")


def _sync_members(group: HenchmenGroup, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Apply a PATCH's member list to `group`; returns the entries that became new members.

    An entry naming a living member updates only the fields it carries (BUG-94); an entry without a
    known id is a new member. Living members left out of the list are removed. Dead members are
    records (BUG-04): this path never edits, duplicates (BUG-92) or deletes them, however the caller
    loaded the group, so an entry naming one is ignored. A fixed number of writes, however many
    members the group has (PERF-28).
    """
    members: dict[int | None, Henchman] = {member.id: member for member in Henchman.objects.filter(group=group)}
    sent: dict[int, set[str]] = {}  # living member id -> the fields its entries carry
    changed_ids: set[int] = set()
    new_entries = []
    for entry in entries:
        member = members.get(entry.get("id"))
        if member is None:
            new_entries.append(entry)
            continue
        if member.dead:
            continue
        fields = sent.setdefault(member.id, set())
        for name in MEMBER_FIELDS:
            if name in entry:
                fields.add(name)
                if getattr(member, name) != entry[name]:
                    setattr(member, name, entry[name])
                    changed_ids.add(member.id)

    removed_ids = {member.id for member in members.values() if not member.dead and member.id not in sent}
    if removed_ids:
        Henchman.objects.filter(group=group, id__in=removed_ids, dead=False).delete()
    # One UPDATE per distinct set of sent fields (the roster form always sends the same ones), writing
    # only the fields the entries carried.
    by_fields: dict[tuple[str, ...], list[Henchman]] = {}
    for member_id in changed_ids:
        by_fields.setdefault(tuple(sorted(sent[member_id])), []).append(members[member_id])
    for field_names, rows in by_fields.items():
        Henchman.objects.bulk_update(rows, list(field_names))
    if new_entries:
        Henchman.objects.bulk_create(
            [
                Henchman(
                    group=group,
                    name=entry.get("name", ""),
                    kills=entry.get("kills", 0),
                    dead=entry.get("dead", False),
                )
                for entry in new_entries
            ]
        )
    return new_entries


class HenchmenGroupUpdateSerializer(UnitWriteSerializer):
    kind = HENCHMEN_GROUP
    recruited_entries: list[dict[str, Any]]  # set by update(): member entries that became new members

    henchmen = serializers.ListField(child=HenchmanEntrySerializer(), write_only=True, required=False)

    class Meta:
        model = HenchmenGroup
        fields = WRITE_FIELDS

    def update(self, instance, validated_data):
        lists = pop_loadout_lists(HENCHMEN_GROUP, validated_data)
        henchmen_data = validated_data.pop("henchmen", None)
        trait_update = prepare_update_traits(HENCHMEN_GROUP, validated_data, lists)

        previous_xp = instance.xp
        next_xp = validated_data.get("xp", instance.xp)
        should_increment_level = "xp" in validated_data and "level_up" not in validated_data

        group = super().update(instance, validated_data)

        if should_increment_level and not group.no_level_ups:
            settings = getattr(instance.warband.campaign, "settings", None)
            thresholds = settings.henchmen_level_thresholds if settings else None
            new_level_ups = count_new_henchmen_level_ups(previous_xp, next_xp, thresholds)
            if new_level_ups:
                group.level_up = (group.level_up or 0) + new_level_ups
                group.save(update_fields=["level_up"])

        replace_loadout(HENCHMEN_GROUP, group, lists)
        finish_update_traits(HENCHMEN_GROUP, group, trait_update, lists)

        # The view charges and logs these recruits.
        self.recruited_entries = _sync_members(group, henchmen_data) if henchmen_data is not None else []

        return group
