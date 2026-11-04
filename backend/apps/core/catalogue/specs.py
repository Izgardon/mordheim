"""The shape of a catalogue kind (kinds.py holds the registry): the spec a kind is given, the tables whose rows hold
or follow an entry (`Holder`, `Move`) and the entry of another kind that goes everywhere it goes (`Twin`)."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from django.db.models import Model, Q
from rest_framework.serializers import BaseSerializer

from apps.warbands.units.kinds import UnitKindKey

from .hooks import CatalogueHooks

Filter = Callable[[str], Q]  # a query parameter's stripped value -> the rows it keeps
UsageKey = Literal[  # usage.py's counts
    "units", "stashes", "bestiary_entries", "hired_swords", "dramatis_personae", "warband_templates"
]


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
class Twin:
    """An entry of another kind held once for each entry (`field`: its one-to-one key to the entry, CASCADE): written
    by the entry's writes, versioned and reverted with it (versions.py), archived, removed, restored and deleted with
    it (archive.py), and what holds it is the entry's usage (usage.py). A beast's Animal item."""

    kind: "CatalogueKindSpec"
    field: str

    def of(self, entry: Any) -> Any:
        """The entry's twin (`entry`: a row or its id), or None."""
        return self.kind.model._default_manager.filter(**{self.field: entry}).first()


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
    name_field: str = "name"  # what the name rule compares (names.py)
    order: tuple[str, ...] = ("name", "id")  # each part of a list (the campaign's rows, then the book's)
    reread: bool = False  # a write's answer is read again with the detail's prefetch (its links)
    lists: tuple[str, ...] = ()  # the lists a write changes (`catalogue.changed` kinds); default: `(key,)`
    children: tuple[str, ...] = ()  # rows an entry carries (CASCADE), parents first; what a version copies
    holders: tuple[Holder, ...] = ()
    followers: tuple[Move, ...] = ()
    twin: Twin | None = None
    hooks: CatalogueHooks = field(default_factory=CatalogueHooks)

    @property
    def changed_lists(self) -> tuple[str, ...]:
        return self.lists or (self.key,)
