"""Serializers shared by every unit kind.

The bases implement the loadout lists once, reading the kind's links from the registry. Each kind's
serializers (apps/warbands/serializers/<kind>.py) set `kind` and list their fields in Meta.fields, which
keeps today's payloads key for key, including the differences between kinds.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, ClassVar

from rest_framework import serializers

from apps.core.catalogue.scope import CatalogueEntryField
from apps.items.models import Item
from apps.races.models import Race
from apps.warbands.models import RosterUnit
from apps.warbands.prefetches import entries_attr
from apps.warbands.services.ledger import MAX_TRADE_PRICE
from apps.warbands.services.prices import annotated_current, own_price, sale_price
from apps.warbands.utils.armour_save import parse_armour_save

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
from .companions import COMPANION_KINDS, beast_kind, companions, effective_stats, mount_payload, pet_payload
from .hooks import Recruit
from .kinds import HERO, LinkSpec, UnitKindSpec
from .services.create import apply_create
from .services.level_up import LevelUpRejected, valid_advance_id
from .services.update import apply_update

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
COMPANION_FIELDS = ("effective_stats", "mount", "pets")  # every read payload, after the stats


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
    mount = serializers.SerializerMethodField()  # the first mount switched on, or None (units/companions.py)
    pets = serializers.SerializerMethodField()
    effective_stats = serializers.SerializerMethodField()  # what the mount makes him show; None on foot

    def _entries(self, unit: RosterUnit, link: LinkSpec) -> list[Any]:
        return get_prefetched_or_query(unit, link.relation, link.relation)

    def _first_mount(self, unit: RosterUnit) -> Any:
        mounts = companions(self._entries(unit, self.kind.items)).mounts
        return mounts[0] if mounts else None

    def get_mount(self, unit: RosterUnit) -> dict[str, Any] | None:
        mount = self._first_mount(unit)
        return mount_payload(mount) if mount is not None else None

    def get_pets(self, unit: RosterUnit) -> list[dict[str, Any]]:
        return [pet_payload(row) for row in companions(self._entries(unit, self.kind.items)).pets]

    def get_effective_stats(self, unit: RosterUnit) -> dict[str, Any] | None:
        return effective_stats(unit, self._first_mount(unit))

    def _catalogue(self, unit: RosterUnit, link: LinkSpec | None) -> list[Any]:
        if link is None:
            return []
        serializer = self.catalogue_serializers[link.target]
        folded = getattr(unit, entries_attr(link.relation), None)
        if folded is not None:  # read with the unit's row (UnitKindSpec.with_loadout): the serializer's fields
            columns = serializer.Meta.fields
            return [{column: entry[column] for column in columns} for entry in folded]
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
        return detail_item_entries(self._entries(unit, self.kind.items))


def detail_item_entries(rows: Iterable[Any]) -> list[Any]:
    """A unit's copies as detail payloads list them: the item's detail, what this copy cost, and its suggested sale
    price (decision 3: half the current campaign price, or half this cost when there is none). The rows come from
    `item_links_prefetch` (the house rule read with them) and their items' availabilities are prefetched."""
    items = []
    for row in rows:
        if not row.item_id:
            continue
        data = ItemDetailSerializer(row.item).data
        data["row_id"], data["companion"], data["beast_kind"] = row.pk, row.companion, beast_kind(row.item)
        data["cost"] = getattr(row, "cost", None)
        data["current_price"] = annotated_current(row, own_price(row.item))  # what Buy again charges
        sale = sale_price(data["current_price"], data["cost"])
        data["suggested_sale_price"], data["sale_price_basis"] = sale.price, sale.basis
        items.append(data)
    return items


class UnitItemEntrySerializer(serializers.Serializer):
    """One `items` entry: the catalogue item's id and what this copy cost (BUG-104: malformed is a 400).

    Other keys the client sends with an entry (name, type, ...) are ignored, as before.
    """

    id = serializers.IntegerField()
    cost = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=MAX_TRADE_PRICE)
    companion = serializers.BooleanField(required=False)  # left out: the copy keeps its switch (loadout.py)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "id" not in attrs:  # a PATCH is partial all the way down, so `required` alone doesn't catch it
            raise serializers.ValidationError({"id": [self.fields["id"].error_messages["required"]]})
        return attrs


class ArmourSaveField(serializers.Field):
    """An armour save written as 5, "5" or "5+" (or empty for none), stored and answered as the integer 5."""

    def to_internal_value(self, data: Any) -> int | None:
        try:
            return parse_armour_save(data)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from None

    def to_representation(self, value: Any) -> Any:
        return value


class UnitWriteSerializer(CampaignCatalogueScopeMixin, serializers.ModelSerializer):
    """Create and PATCH bodies: the unit's fields plus its loadout lists, each replacing the whole list.

    Saving runs the shared services (units/services/create.py, update.py) with the kind's rules.
    """

    kind: ClassVar[UnitKindSpec]
    recruits: tuple[Recruit, ...] = ()  # set by update(): the henchmen it added, to be charged

    race = CatalogueEntryField(queryset=Race.objects.all(), allow_null=True, required=False)  # its version, if any
    armour_save = ArmourSaveField(required=False, allow_null=True)  # decision 11, BUG-87
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    items = serializers.ListField(child=UnitItemEntrySerializer(), write_only=True, required=False)
    skill_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    special_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    spell_ids = serializers.ListField(  # left out of Meta.fields by kinds without spells
        child=serializers.IntegerField(), write_only=True, required=False
    )

    def validate_items(self, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """An entry switched on as a companion must be a mount or a pet (one query, only when one is)."""
        flagged = {entry["id"] for entry in entries if entry.get("companion")}
        if flagged:
            kinds = Item.objects.filter(id__in=flagged).values_list("id", "bestiary_entry__kind")
            wrong = sorted(pk for pk, kind in kinds if kind not in COMPANION_KINDS)
            if wrong:
                listed = ", ".join(str(pk) for pk in wrong)
                raise serializers.ValidationError(f"Only a mount or a pet can be a companion (item {listed}).")
        return entries

    def create(self, validated_data: dict[str, Any]) -> RosterUnit:
        return apply_create(self.kind, validated_data)

    def update(self, instance: RosterUnit, validated_data: dict[str, Any]) -> RosterUnit:
        self.recruits = tuple(apply_update(self.kind, instance, validated_data, self._campaign_id()))
        return instance


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


class HenchmanPromoteSerializer(serializers.Serializer):
    """POST .../henchmen-groups/<id>/promote/ (Lad's Got Talent, decision 9).

    `advance` is the hero advance the re-roll gave, as the level-up endpoint takes it ({"id": "WS",
    "label": ...}) or just its code ("WS"); `roll1` / `roll2` are logged with it, as the level-up dialog
    sends them. `dismiss_hero_id` names a hero to dismiss to make room at the hero cap.
    """

    henchman_id = serializers.IntegerField()
    advance = serializers.JSONField()
    dismiss_hero_id = serializers.IntegerField(required=False, allow_null=True)
    roll1 = serializers.DictField(required=False)
    roll2 = serializers.DictField(required=False)

    def validate_advance(self, value: Any) -> dict[str, Any]:
        advance = {"id": value} if isinstance(value, str) else value
        try:
            valid_advance_id(HERO, {"advance": advance})
        except LevelUpRejected as rejected:
            raise serializers.ValidationError(rejected.detail) from None
        return dict(advance)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs["rolls"] = {name: attrs.pop(name) for name in ("roll1", "roll2") if name in attrs}
        return attrs


class UnitBatchSerializer(serializers.Serializer):
    """POST .../<kind>/batch/ (decision 1): the body's shape; each entry is validated by the kind's serializers.

    The fields are built in get_fields() because `create` and `update` are also Serializer method names.
    """

    def get_fields(self) -> dict[str, serializers.Field]:
        return {
            "create": serializers.ListField(child=serializers.DictField(), required=False, default=list),
            "update": serializers.ListField(child=serializers.DictField(), required=False, default=list),  # with "id"
            "dismiss": serializers.ListField(child=serializers.IntegerField(), required=False, default=list),
            # pass 2, decision 1 and BUG-108: copies bought or taken from the stash for the batch's units
            "purchases": serializers.ListField(child=serializers.DictField(), required=False, default=list),
            "stash_takes": serializers.ListField(child=serializers.DictField(), required=False, default=list),
        }


class CompanionSwitchSerializer(serializers.Serializer):
    """POST .../<unit>/items/<item row id>/companion/: switch the copy on (true) or off (false) as his mount or pet."""

    on = serializers.BooleanField()


class HireSerializer(serializers.Serializer):
    """POST .../hirelings/hire/: the catalogue entry to hire (`source` names its list), and an optional name (the
    entry's by default). The fields are built in get_fields() because `source` is also a Field attribute."""

    def get_fields(self) -> dict[str, serializers.Field]:
        return {
            "source": serializers.ChoiceField(choices=("hired_sword", "dramatis_persona")),
            "id": serializers.IntegerField(min_value=1),
            "name": serializers.CharField(max_length=120, allow_blank=True, required=False),
        }
