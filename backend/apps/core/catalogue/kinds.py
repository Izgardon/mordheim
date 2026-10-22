"""The catalogue kinds registry (design 0.29 for the catalogue, IMP-79): each kind as data.

Items, skills, spells, specials, races, bestiary entries, hired swords and dramatis personae, plus the read-only
restrictions and the add-only item properties. A spec names the kind's model and serializers, how its list is
filtered, the child rows an entry carries (what a version copies), the tables whose rows hold an entry (`holders`:
what a delete can't take with it, what `usage/` counts, and what a version's first edit moves onto it and Revert
moves back) and the rows that follow an entry without holding it (`followers`: a warband's bestiary favourites, an
item's animal). Differences that are behaviour are hooks (hooks.py), as pass 1 did for units
(`warbands/units/kinds.py`).
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
    WarbandBestiaryFavourite,
)
from apps.bestiary.serializers import BestiaryEntryWriteSerializer
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.hirelings.serializers import DramatisPersonaWriteSerializer, HiredSwordWriteSerializer
from apps.items.models import Item, ItemProperty
from apps.items.serializers import ItemPropertySerializer, ItemWriteSerializer
from apps.races.models import Race
from apps.races.serializers import RaceCreateSerializer
from apps.restrictions.models import Restriction
from apps.restrictions.serializers import RestrictionSerializer
from apps.skills.models import Skill
from apps.skills.serializers import SkillCreateSerializer
from apps.special.models import Special
from apps.special.serializers import SpecialCreateSerializer
from apps.spells.models import Spell
from apps.spells.serializers import SpellCreateSerializer
from apps.warbands.models import WarbandItem
from apps.warbands.units.kinds import KINDS as UNIT_KINDS
from apps.warbands.units.kinds import UnitKindKey

from .hooks import BestiaryHooks, CatalogueHooks, HirelingProfileHooks, ItemHooks, ItemPropertyHooks, RaceHooks
from .rows import (
    BestiaryEntryDetailRowSerializer,
    BestiaryEntryRowSerializer,
    DramatisPersonaDetailRowSerializer,
    DramatisPersonaRowSerializer,
    HiredSwordDetailRowSerializer,
    HiredSwordRowSerializer,
    ItemRowSerializer,
    RaceRowSerializer,
    SkillRowSerializer,
    SpecialRowSerializer,
    SpellRowSerializer,
)

Filter = Callable[[str], Q]  # a query parameter's stripped value -> the rows it keeps
UsageKey = Literal["units", "stashes", "bestiary_entries", "hired_swords", "dramatis_personae"]  # usage.py's counts


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
    entry's, hired sword's or dramatis persona's link (or one of their races)."""

    counts_as: UsageKey = "units"  # the usage key it adds to
    holder_id: str = "pk"  # the attribute naming who holds it: the unit, the warband (a stash), the catalogue entry
    warband: str | None = None  # the path to the holder's warband id; None for a catalogue entry's link
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
    lists: tuple[str, ...] = ()  # the lists a write changes (`catalogue.changed` kinds); default: `(key,)`
    children: tuple[str, ...] = ()  # rows an entry carries (CASCADE), parents first; what a version copies
    holders: tuple[Holder, ...] = ()
    followers: tuple[Move, ...] = ()
    hooks: CatalogueHooks = field(default_factory=CatalogueHooks)

    @property
    def changed_lists(self) -> tuple[str, ...]:
        return self.lists or (self.key,)


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


HIRELING_CATALOGUES: tuple[tuple[type[Model], UsageKey], ...] = (
    (HiredSword, "hired_swords"),
    (DramatisPersona, "dramatis_personae"),
)


def _listed_by_hirelings(links: str, target: str) -> tuple[Holder, ...]:
    """The hired swords' and dramatis personae's links of one kind (`links`: "skill_links") holding `target`; a kit
    lists an item once (its quantity says how many), so a moved item link meeting one merges into it."""
    holders = []
    for model, counts_as in HIRELING_CATALOGUES:
        relation = model._meta.get_field(links)
        owner = relation.field.name  # type: ignore[union-attr]
        holders.append(
            Holder(
                model=relation.related_model,  # type: ignore[arg-type]
                field=target,
                campaign=f"{owner}__campaign_id",
                unique=(f"{owner}_id",) if target == "item" else (),
                counts_as=counts_as,
                holder_id=f"{owner}_id",
            )
        )
    return tuple(holders)


HIRELING_RACES = tuple(
    Holder(model=model, field="race", campaign="campaign_id", counts_as=counts_as)
    for model, counts_as in HIRELING_CATALOGUES
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
    row_serializer=ItemRowSerializer,
    entry_serializer=ItemRowSerializer,
    write_serializer=ItemWriteSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    reread=True,
    children=("availabilities", "availabilities__restriction_links", "property_links"),
    holders=_copies(
        "items",
        STASH,
        _linked_by(BestiaryEntryItem, "item", unique=("bestiary_entry_id",)),
        *_listed_by_hirelings("item_links", "item"),
    ),
    hooks=ItemHooks(),
)
SKILLS = CatalogueKindSpec(
    key="skills",
    noun="skill",
    model=Skill,
    url_kwarg="skill_id",
    row_serializer=SkillRowSerializer,
    entry_serializer=SkillRowSerializer,
    write_serializer=SkillCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    excluded_types=PLACEHOLDERS,
    holders=_copies("skills", _linked_by(BestiaryEntrySkill, "skill"), *_listed_by_hirelings("skill_links", "skill")),
)
SPELLS = CatalogueKindSpec(
    key="spells",
    noun="spell",
    model=Spell,
    url_kwarg="spell_id",
    row_serializer=SpellRowSerializer,
    entry_serializer=SpellRowSerializer,
    write_serializer=SpellCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    excluded_types=PLACEHOLDERS,
    holders=_copies("spells", _linked_by(BestiaryEntrySpell, "spell"), *_listed_by_hirelings("spell_links", "spell")),
)
SPECIALS = CatalogueKindSpec(
    key="specials",
    noun="special",
    model=Special,
    url_kwarg="special_id",
    row_serializer=SpecialRowSerializer,
    entry_serializer=SpecialRowSerializer,
    write_serializer=SpecialCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    excluded_types=PLACEHOLDERS,
    holders=_copies(
        "specials", _linked_by(BestiaryEntrySpecial, "special"), *_listed_by_hirelings("special_links", "special")
    ),
)
RACES = CatalogueKindSpec(
    key="races",
    noun="race",
    model=Race,
    url_kwarg="race_id",
    row_serializer=RaceRowSerializer,
    entry_serializer=RaceRowSerializer,
    write_serializer=RaceCreateSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    holders=(
        *(
            Holder(
                model=unit.model,
                field="race",
                campaign="warband__campaign_id",
                warband="warband_id",
                unit_kind=unit.key,
            )
            for unit in UNIT_KINDS.values()
        ),
        *HIRELING_RACES,
    ),
    hooks=RaceHooks(),
)
BESTIARY = CatalogueKindSpec(
    key="bestiary",
    noun="bestiary entry",
    model=BestiaryEntry,
    url_kwarg="entry_id",
    row_serializer=BestiaryEntryRowSerializer,
    entry_serializer=BestiaryEntryDetailRowSerializer,
    write_serializer=BestiaryEntryWriteSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    reread=True,
    lists=("bestiary", "items"),  # an entry may be the animal an item shows
    children=(
        "bestiary_entry_skills",
        "bestiary_entry_specials",
        "bestiary_entry_spells",
        "bestiary_entry_items",
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
HIRELING_LINKS = ("skill_links", "special_links", "spell_links", "item_links", "restriction_links")
HIRED_SWORDS = CatalogueKindSpec(
    key="hired_swords",
    noun="hired sword",
    model=HiredSword,
    url_kwarg="hired_sword_id",
    row_serializer=HiredSwordRowSerializer,
    entry_serializer=HiredSwordDetailRowSerializer,
    write_serializer=HiredSwordWriteSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    reread=True,
    children=HIRELING_LINKS,  # hirelings copy what they take from one on hire: nothing holds it
    hooks=HirelingProfileHooks(HiredSword),
)
DRAMATIS_PERSONAE = CatalogueKindSpec(
    key="dramatis_personae",
    noun="dramatis persona",
    model=DramatisPersona,
    url_kwarg="dramatis_persona_id",
    row_serializer=DramatisPersonaRowSerializer,
    entry_serializer=DramatisPersonaDetailRowSerializer,
    write_serializer=DramatisPersonaWriteSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    reread=True,
    children=HIRELING_LINKS,
    hooks=HirelingProfileHooks(DramatisPersona),
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
    kind.key: kind for kind in (ITEMS, SKILLS, SPELLS, SPECIALS, RACES, BESTIARY, HIRED_SWORDS, DRAMATIS_PERSONAE)
}
LIST_KINDS: Mapping[str, CatalogueKindSpec] = {
    **CATALOGUE_KINDS,
    "restrictions": RESTRICTIONS,
    "item_properties": ITEM_PROPERTIES,
}
