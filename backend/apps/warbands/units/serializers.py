"""Serializers shared by every unit kind.

The bases implement the loadout lists once, reading the kind's links from the registry. Each kind's
serializers (apps/warbands/serializers/<kind>.py) set `kind` and list their fields in Meta.fields, which
keeps today's payloads key for key, including the differences between kinds.
"""

from dataclasses import dataclass
from typing import Any, ClassVar

from rest_framework import serializers

from apps.warbands.models import RosterUnit

from .catalogue import (
    ItemDetailSerializer,
    ItemSummarySerializer,
    RaceSummarySerializer,
    SkillDetailSerializer,
    SkillSummarySerializer,
    SpecialDetailSerializer,
    SpecialSummarySerializer,
    SpellDetailSerializer,
    SpellSummarySerializer,
)
from .catalogue_scope import CampaignCatalogueScopeMixin
from .kinds import LinkSpec, UnitKindSpec

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
    "armour_save",
)


def get_prefetched_or_query(obj: Any, prefetch_key: str, queryset_attr: str) -> list[Any]:
    """A relation's rows from the prefetch cache when the view prefetched them, else from one query."""
    if hasattr(obj, "_prefetched_objects_cache") and prefetch_key in obj._prefetched_objects_cache:
        return list(obj._prefetched_objects_cache[prefetch_key])
    return list(getattr(obj, queryset_attr).all())


class UnitReadSerializer(serializers.ModelSerializer):
    """The fields every unit payload has. Subclasses set `kind` and pick their fields in Meta.fields."""

    kind: ClassVar[UnitKindSpec]
    catalogue_serializers: ClassVar[dict[str, type[serializers.ModelSerializer]]]  # link target -> serializer

    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)  # left out when there is no race
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()  # left out of Meta.fields by kinds without spells

    def _entries(self, unit: RosterUnit, link: LinkSpec) -> list[Any]:
        return get_prefetched_or_query(unit, link.relation, link.relation)

    def _catalogue(self, unit: RosterUnit, link: LinkSpec | None) -> list[Any]:
        if link is None:
            return []
        serializer = self.catalogue_serializers[link.target]
        rows = self._entries(unit, link)
        return [serializer(getattr(row, link.target)).data for row in rows if getattr(row, f"{link.target}_id")]

    def get_skills(self, unit: RosterUnit) -> list[Any]:
        return self._catalogue(unit, self.kind.skills)

    def get_specials(self, unit: RosterUnit) -> list[Any]:
        return self._catalogue(unit, self.kind.specials)

    def get_spells(self, unit: RosterUnit) -> list[Any]:
        return self._catalogue(unit, self.kind.spells)


class UnitSummarySerializer(UnitReadSerializer):
    """List rows: items as {id, name, type, cost}, other entries as {id, name}."""

    catalogue_serializers = {
        "skill": SkillSummarySerializer,
        "special": SpecialSummarySerializer,
        "spell": SpellSummarySerializer,
    }

    def get_items(self, unit: RosterUnit) -> list[Any]:
        return [ItemSummarySerializer(row).data for row in self._entries(unit, self.kind.items) if row.item_id]


class UnitDetailSerializer(UnitReadSerializer):
    """Detail payloads: the race's profile, items with properties and availabilities, entries with types."""

    catalogue_serializers = {
        "skill": SkillDetailSerializer,
        "special": SpecialDetailSerializer,
        "spell": SpellDetailSerializer,
    }

    race = RaceSummarySerializer(read_only=True)

    def get_items(self, unit: RosterUnit) -> list[Any]:
        items = []
        for row in self._entries(unit, self.kind.items):
            if not row.item_id:
                continue
            data = ItemDetailSerializer(row.item).data
            data["cost"] = getattr(row, "cost", None)
            items.append(data)
        return items


class UnitWriteSerializer(CampaignCatalogueScopeMixin, serializers.ModelSerializer):
    """Create and PATCH bodies: the unit's fields plus its loadout lists, each replacing the whole list."""

    kind: ClassVar[UnitKindSpec]

    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    items = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    skill_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    special_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    spell_ids = serializers.ListField(  # left out of Meta.fields by kinds without spells
        child=serializers.IntegerField(), write_only=True, required=False
    )


@dataclass(frozen=True)
class UnitSerializers:
    """One kind's serializers, looked up by kind key in `apps.warbands.serializers.UNIT_SERIALIZERS`."""

    summary: type[UnitSummarySerializer]  # list rows
    detail: type[UnitDetailSerializer]  # detail lists, single unit, write responses
    create: type[UnitWriteSerializer]
    update: type[UnitWriteSerializer]


class UnitLevelUpSerializer(serializers.Serializer):
    """POST .../level-up/: the advance arrives as `payload.advance` and the payload is logged as sent."""

    payload = serializers.DictField(required=False)  # a non-object payload is a 400, not a 500 (BUG-89)
