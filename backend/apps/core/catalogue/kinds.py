"""The catalogue kinds registry (design 0.29 for the catalogue, IMP-79): each kind as data.

Items, skills, spells, specials, races, bestiary entries and hired swords, plus the read-only restrictions and the
add-only item properties. A spec names the kind's model and serializers, how its list is filtered and merged, the
child rows an entry carries (what a copy of it copies, PR C) and the tables whose rows hold it (`holders`: what a
delete can't take with it, read by the 409 `in_use` counts, and what PR C's copy-on-write moves onto a version).
Differences that are behaviour are hooks (hooks.py), as pass 1 did for units (`warbands/units/kinds.py`).
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
class Holder:
    """A table whose rows hold an entry, with RESTRICT: a unit's copy (or a unit of a race), a stash row, a bestiary
    entry's link."""

    model: type[Model]
    field: str  # the foreign key to the entry, e.g. "item"
    counts_as: Literal["units", "stashes", "bestiary_entries"]  # the 409 usage key it adds to
    holder_id: str  # the attribute naming who holds it: the unit, the warband (a stash), the bestiary entry
    unit_kind: UnitKindKey | None = None  # for units: their kind, to find their warbands


@dataclass(frozen=True)
class CatalogueKindSpec:
    key: str  # "skills": the list's cache key
    noun: str  # "skill": the 409 in_use message
    model: type[Model]
    url_kwarg: str  # the detail route's id, e.g. "skill_id"
    row_serializer: type[BaseSerializer[Any]]  # a list row
    entry_serializer: type[BaseSerializer[Any]]  # the detail, and a write's answer
    write_serializer: type[BaseSerializer[Any]] | None = None  # None: nothing writes the kind through the API
    duplicate: str | None = None  # "a skill with this name and type" (400 duplicate_entry); None: no name constraint
    filters: Mapping[str, Filter] = field(default_factory=dict)  # list query parameter -> filter, before the merge
    excluded_types: tuple[str, ...] = ()  # types no list shows (the level-up placeholders)
    name_field: str = "name"  # what today's name rule compares (merge.py)
    order: tuple[str, ...] = ("name", "id")  # each part of a list (the campaign's rows, then the book's)
    reread: bool = False  # a write's answer is read again with the detail's prefetch (its links)
    children: tuple[str, ...] = ()  # rows an entry carries (CASCADE), e.g. an item's availabilities
    holders: tuple[Holder, ...] = ()
    hooks: CatalogueHooks = field(default_factory=CatalogueHooks)


def _copies(link: str, *others: Holder) -> tuple[Holder, ...]:
    """The units' copies of an entry (each unit kind's `link` list: items, skills, specials or spells), and `others`."""
    copies = [
        Holder(spec.model, spec.target, "units", f"{unit.parent_field}_id", unit.key)
        for unit in UNIT_KINDS.values()
        if (spec := getattr(unit, link)) is not None
    ]
    return (*copies, *others)


def _linked_by(model: type[Model], target: str) -> Holder:
    return Holder(model, target, "bestiary_entries", "bestiary_entry_id")


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
    duplicate="an item with this name and type",
    filters=NAME_AND_TYPE,
    reread=True,
    children=("availabilities", "availabilities__restriction_links", "property_links"),
    holders=_copies(
        "items", Holder(WarbandItem, "item", "stashes", "warband_id"), _linked_by(BestiaryEntryItem, "item")
    ),
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
    duplicate="a skill with this name and type",
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
    duplicate="a spell with this name and type",
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
    duplicate="a special with this name and type",
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
    duplicate="a race with this name",
    filters={"search": NAME_AND_TYPE["search"]},
    holders=tuple(Holder(unit.model, "race", "units", "pk", unit.key) for unit in UNIT_KINDS.values()),
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
    duplicate="a bestiary entry or hired sword with this name",  # they share the names
    filters=NAME_AND_TYPE,
    reread=True,
    children=("bestiary_entry_skills", "bestiary_entry_specials", "bestiary_entry_spells", "bestiary_entry_items"),
    hooks=BestiaryHooks(),  # units copy what they take from an entry: nothing holds one
)
HIRED_SWORDS = CatalogueKindSpec(
    key="hired_swords",
    noun="hired sword",
    model=HiredSwordProfile,
    url_kwarg="profile_id",
    row_serializer=HiredSwordProfileSummarySerializer,
    entry_serializer=HiredSwordProfileDetailSerializer,
    write_serializer=HiredSwordWriteSerializer,
    duplicate=BESTIARY.duplicate,
    filters={"search": lambda value: Q(bestiary_entry__name__icontains=value)},
    name_field="bestiary_entry__name",
    order=("bestiary_entry__name",),
    reread=True,
    children=("restriction_links",),  # and its bestiary entry, with that entry's children
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
HOLDERS: Mapping[type[Model], Holder] = {
    holder.model: holder for kind in CATALOGUE_KINDS.values() for holder in kind.holders
}
