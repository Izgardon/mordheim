"""The catalogue kinds registry (design 0.29 for the catalogue, IMP-79): each kind as data.

Items, skills, spells, specials, races, bestiary entries and hired swords, plus the read-only restrictions and the
add-only item properties. A spec names the kind's model and serializers, how its list is filtered, the child rows
an entry carries (what a version copies), the tables whose rows hold an entry (`holders`: what a delete can't take
with it, what `usage/` counts, and what a version's first edit moves onto it and Revert moves back) and the rows
that follow an entry without holding it (`followers`: a warband's bestiary favourites, an item's animal). A hired
sword is its bestiary entry for all of that (`entry_via`). Differences that are behaviour are hooks (hooks.py), as
pass 1 did for units (`warbands/units/kinds.py`).
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from django.db.models import Model, Q
from rest_framework.serializers import BaseSerializer

from apps.bestiary.models import (
    BestiaryEntry,
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
    HiredSwordProfile,
    WarbandBestiaryFavourite,
)
from apps.bestiary.serializers import (
    BestiaryEntrySerializer,
    BestiaryEntrySummarySerializer,
    BestiaryEntryWriteSerializer,
    HiredSwordProfileDetailSerializer,
    HiredSwordProfileSummarySerializer,
    HiredSwordWriteSerializer,
)
from apps.items.models import Item, ItemProperty
from apps.items.serializers import ItemPropertySerializer, ItemSerializer, ItemWriteSerializer
from apps.races.models import Race
from apps.races.serializers import RaceCreateSerializer, RaceSerializer
from apps.restrictions.models import Restriction
from apps.restrictions.serializers import RestrictionSerializer
from apps.skills.models import Skill
from apps.skills.serializers import SkillCreateSerializer, SkillSerializer
from apps.special.models import Special
from apps.special.serializers import SpecialCreateSerializer, SpecialSerializer
from apps.spells.models import Spell
from apps.spells.serializers import SpellCreateSerializer, SpellSerializer
from apps.warbands.models import WarbandItem
from apps.warbands.units.kinds import KINDS as UNIT_KINDS
from apps.warbands.units.kinds import UnitKindKey

from .hooks import BestiaryHooks, CatalogueHooks, HiredSwordHooks, ItemHooks, ItemPropertyHooks, RaceHooks

Filter = Callable[[str], Q]  # a query parameter's stripped value -> the rows it keeps


@dataclass(frozen=True)
class Move:
    """Rows that point at an entry and move with it when a campaign's copies are remapped (remap.py)."""

    model: type[Model]
    field: str  # the foreign key to the entry, e.g. "item"
    campaign: str  # the path from a row to its campaign's id, e.g. "hero__warband__campaign_id"
    unique: tuple[str, ...] = ()  # the rest of a unique key with `field`: a moved row meeting one merges into it
    adds: str | None = None  # on a merge, this column is added to the row met (a stash row's quantity)


@dataclass(frozen=True)
class Holder(Move):
    """A table whose rows hold an entry, with RESTRICT: a unit's copy (or a unit of a race), a stash row, a bestiary
    entry's link."""

    counts_as: Literal["units", "stashes", "bestiary_entries"] = "units"  # the usage key it adds to
    holder_id: str = "pk"  # the attribute naming who holds it: the unit, the warband (a stash), the bestiary entry
    warband: str | None = None  # the path to the holder's warband id; None for a bestiary entry's link
    unit_kind: UnitKindKey | None = None  # for units: their kind


@dataclass(frozen=True)
class CatalogueKindSpec:
    key: str  # "skills": the list's cache key and the `catalogue.changed` event's kind
    noun: str  # "skill": messages
    model: type[Model]
    url_kwarg: str  # the detail route's id, e.g. "skill_id"
    row_serializer: type[BaseSerializer[Any]]  # a list row
    entry_serializer: type[BaseSerializer[Any]]  # the detail, and a write's answer
    write_serializer: type[BaseSerializer[Any]] | None = None  # None: nothing writes the kind through the API
    named: bool = False  # a create's name may not be taken in the campaign or the book (names.py)
    versioned: bool = False  # book entries get campaign versions, archive and removal (versions.py, archive.py)
    filters: Mapping[str, Filter] = field(default_factory=dict)  # list query parameter -> filter, before the merge
    excluded_types: tuple[str, ...] = ()  # types no list shows (the level-up placeholders)
    name_field: str = "name"  # what the name rule compares (names.py; the restrictions' list merge)
    order: tuple[str, ...] = ("name", "id")  # each part of a list (the campaign's rows, then the book's)
    reread: bool = False  # a write's answer is read again with the detail's prefetch (its links)
    entry_via: str = ""  # the relation from a row to the entry it is (a hired sword's profile: "bestiary_entry")
    table_key: str = ""  # the kind owning the entry's table (removals, reverted versions); default: `key`
    children: tuple[str, ...] = ()  # rows an entry carries (CASCADE), parents first; what a version copies
    holders: tuple[Holder, ...] = ()
    followers: tuple[Move, ...] = ()
    hooks: CatalogueHooks = field(default_factory=CatalogueHooks)

    @property
    def entry_key(self) -> str:
        return self.table_key or self.key

    @property
    def entry_model(self) -> type[Model]:
        """The table that carries `replaces`, `archived_at` and the badges: the model, or a hired sword's entry."""
        if not self.entry_via:
            return self.model
        related: type[Model] = self.model._meta.get_field(self.entry_via).related_model  # type: ignore[assignment]
        return related

    def entry_path(self, column: str) -> str:
        """`column` of the entry, from the kind's row: "archived_at", or "bestiary_entry__archived_at"."""
        return f"{self.entry_via}__{column}" if self.entry_via else column

    def entry_ref(self) -> str:
        """The row's entry id: "pk", or "bestiary_entry_id"."""
        return f"{self.entry_via}_id" if self.entry_via else "pk"


def _copies(link: str, *others: Holder) -> tuple[Holder, ...]:
    """The units' copies of an entry (each unit kind's `link` list: items, skills, specials or spells), and `others`."""
    copies = [
        Holder(
            model=spec.model,
            field=spec.target,
            campaign=f"{unit.parent_field}__warband__campaign_id",
            holder_id=f"{unit.parent_field}_id",
            warband=f"{unit.parent_field}__warband_id",
            unit_kind=unit.key,
        )
        for unit in UNIT_KINDS.values()
        if (spec := getattr(unit, link)) is not None
    ]
    return (*copies, *others)


def _linked_by(model: type[Model], target: str, unique: tuple[str, ...] = ()) -> Holder:
    return Holder(
        model=model,
        field=target,
        campaign="bestiary_entry__campaign_id",
        unique=unique,
        counts_as="bestiary_entries",
        holder_id="bestiary_entry_id",
    )


STASH = Holder(
    model=WarbandItem,
    field="item",
    campaign="warband__campaign_id",
    unique=("warband_id", "cost"),  # one stash row per item and cost (BUG-117): copies join the row of their cost
    adds="quantity",
    counts_as="stashes",
    holder_id="warband_id",
    warband="warband_id",
)
NAME_AND_TYPE: Mapping[str, Filter] = {
    "type": lambda value: Q(type__iexact=value),
    "search": lambda value: Q(name__icontains=value),
}
PLACEHOLDERS = ("Pending",)  # the "New Skill" a level-up adds, resolved later (units/services/level_up.py)

ITEMS = CatalogueKindSpec(
    key="items",
    noun="item",
    model=Item,
    url_kwarg="item_id",
    row_serializer=ItemSerializer,
    entry_serializer=ItemSerializer,
    write_serializer=ItemWriteSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    reread=True,
    children=("availabilities", "availabilities__restriction_links", "property_links"),
    holders=_copies("items", STASH, _linked_by(BestiaryEntryItem, "item", unique=("bestiary_entry_id",))),
    hooks=ItemHooks(),
)
SKILLS = CatalogueKindSpec(
    key="skills",
    noun="skill",
    model=Skill,
    url_kwarg="skill_id",
    row_serializer=SkillSerializer,
    entry_serializer=SkillSerializer,
    write_serializer=SkillCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    excluded_types=PLACEHOLDERS,
    holders=_copies("skills", _linked_by(BestiaryEntrySkill, "skill")),
)
SPELLS = CatalogueKindSpec(
    key="spells",
    noun="spell",
    model=Spell,
    url_kwarg="spell_id",
    row_serializer=SpellSerializer,
    entry_serializer=SpellSerializer,
    write_serializer=SpellCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    excluded_types=PLACEHOLDERS,
    holders=_copies("spells", _linked_by(BestiaryEntrySpell, "spell")),
)
SPECIALS = CatalogueKindSpec(
    key="specials",
    noun="special",
    model=Special,
    url_kwarg="special_id",
    row_serializer=SpecialSerializer,
    entry_serializer=SpecialSerializer,
    write_serializer=SpecialCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    excluded_types=PLACEHOLDERS,
    holders=_copies("specials", _linked_by(BestiaryEntrySpecial, "special")),
)
RACES = CatalogueKindSpec(
    key="races",
    noun="race",
    model=Race,
    url_kwarg="race_id",
    row_serializer=RaceSerializer,
    entry_serializer=RaceSerializer,
    write_serializer=RaceCreateSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    holders=tuple(
        Holder(
            model=unit.model, field="race", campaign="warband__campaign_id", warband="warband_id", unit_kind=unit.key
        )
        for unit in UNIT_KINDS.values()
    ),
    hooks=RaceHooks(),
)
BESTIARY = CatalogueKindSpec(
    key="bestiary",
    noun="bestiary entry",
    model=BestiaryEntry,
    url_kwarg="entry_id",
    row_serializer=BestiaryEntrySummarySerializer,
    entry_serializer=BestiaryEntrySerializer,
    write_serializer=BestiaryEntryWriteSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    reread=True,
    children=(
        "bestiary_entry_skills",
        "bestiary_entry_specials",
        "bestiary_entry_spells",
        "bestiary_entry_items",
        "hired_sword_profile",  # a hired sword's entry carries its profile
        "hired_sword_profile__restriction_links",
    ),
    followers=(  # units copy what they take from an entry: nothing holds one
        Move(
            model=WarbandBestiaryFavourite,
            field="bestiary_entry",
            campaign="warband__campaign_id",
            unique=("warband_id",),
        ),
        Move(model=Item, field="bestiary_entry", campaign="campaign_id"),  # the campaign's animals
    ),
    hooks=BestiaryHooks(),
)
HIRED_SWORDS = CatalogueKindSpec(
    key="hired_swords",
    noun="hired sword",
    model=HiredSwordProfile,
    url_kwarg="profile_id",
    row_serializer=HiredSwordProfileSummarySerializer,
    entry_serializer=HiredSwordProfileDetailSerializer,
    write_serializer=HiredSwordWriteSerializer,
    named=True,
    versioned=True,
    filters={"search": lambda value: Q(bestiary_entry__name__icontains=value)},
    name_field="bestiary_entry__name",
    order=("bestiary_entry__name",),
    reread=True,
    entry_via="bestiary_entry",  # a hired sword's version, archive and removal are its entry's (with its profile)
    table_key="bestiary",
    hooks=HiredSwordHooks(),
)
RESTRICTIONS = CatalogueKindSpec(  # read-only: the seeders write the book's rows (SEC-06)
    key="restrictions",
    noun="restriction",
    model=Restriction,
    url_kwarg="",
    row_serializer=RestrictionSerializer,
    entry_serializer=RestrictionSerializer,
    filters={"search": lambda value: Q(restriction__icontains=value), "type": NAME_AND_TYPE["type"]},
    name_field="restriction",
    order=("type", "restriction"),
)
ITEM_PROPERTIES = CatalogueKindSpec(  # added, never edited or deleted
    key="item_properties",
    noun="item property",
    model=ItemProperty,
    url_kwarg="property_id",
    row_serializer=ItemPropertySerializer,
    entry_serializer=ItemPropertySerializer,
    write_serializer=ItemPropertySerializer,
    filters={
        "type": lambda value: Q(type__iexact=value) | Q(type__isnull=True) | Q(type__exact=""),  # untyped ones too
        "search": NAME_AND_TYPE["search"],
    },
    order=("name",),
    hooks=ItemPropertyHooks(),
)

CATALOGUE_KINDS: Mapping[str, CatalogueKindSpec] = {
    kind.key: kind for kind in (ITEMS, SKILLS, SPELLS, SPECIALS, RACES, BESTIARY, HIRED_SWORDS)
}
LIST_KINDS: Mapping[str, CatalogueKindSpec] = {
    **CATALOGUE_KINDS,
    "restrictions": RESTRICTIONS,
    "item_properties": ITEM_PROPERTIES,
}
ENTRY_KINDS: Mapping[str, CatalogueKindSpec] = {  # the kinds owning an entry table, by `entry_key`
    kind.key: kind for kind in CATALOGUE_KINDS.values() if not kind.entry_via
}


def entry_kind(kind: CatalogueKindSpec) -> CatalogueKindSpec:
    """The kind owning the table of `kind`'s entries: itself, or the bestiary for a hired sword."""
    return ENTRY_KINDS[kind.entry_key]
