"""What a copy's custom content is, and how two entries are compared (the workshop plan, version 2: "Imports carry
custom content").

The custom content a copy uses is every entry of the source campaign's own (its own entries and its versions of book
entries) that the copied rows link (`entry_links`), and what those need in turn: a beast's own item (its twin) and the
entries its profile lists, a skill's groups among the campaign's own (those holding it, and those a unit's or a
fighter's skill access names), and those groups' skills. Hired swords and dramatis personae are not among it: a
hireling copies his profile when he is hired, so nothing on a roster or a list links one. Each step is one query
whatever the number of rows.

Two entries match when they have the same name and the same effect (CLAUDE.md, "Skills and items match ours by name
and effect"): every field of their own but the catalogue's bookkeeping (campaign, setting, version, archive, who wrote
it), and every child row they carry (an item's prices, who may buy them and its rules; a group's skills and who learns
from it; a beast's skills, specials, spells and kit), a link to another entry compared by that entry's name.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Model, Q
from django.db.models.fields.related import ForeignObjectRel
from django.db.models.functions import Lower, Trim

from apps.bestiary.models import BestiaryEntry
from apps.core.catalogue import merge
from apps.core.catalogue.kinds import BESTIARY, ITEMS, RACES, SKILL_GROUPS, SKILLS, SPECIALS, SPELLS
from apps.core.catalogue.specs import CatalogueKindSpec
from apps.core.catalogue.versions import _model_at
from apps.items.models import Item
from apps.skills.models import Skill, SkillGroup, SkillGroupSkill

from .relink import entry_links

# the kinds a copy carries, each before the kinds that link it (a beast's kit is items; its own item comes with it)
CARRIED: tuple[CatalogueKindSpec, ...] = (RACES, SPECIALS, SPELLS, SKILLS, SKILL_GROUPS, ITEMS, BESTIARY)
# the catalogue's bookkeeping, never part of an entry's effect
BOOKKEEPING = frozenset(
    {
        "id",
        "replaces",
        "archived_at",
        "archived_by",
        "updated_at",
        "updated_by",
        "campaign",
        "campaign_type",
        "slug",
        "generated_effect_key",
        "bestiary_entry",
    }
)
Rows = Mapping[type[Model], Iterable[Model]]


@dataclass
class Wanted:
    """The source campaign's entries a copy uses, read whole, by model; and the skill groups units name."""

    rows: dict[type[Model], dict[int, Model]] = field(default_factory=dict)

    def of(self, kind: CatalogueKindSpec) -> list[Any]:
        return sorted(self.rows.get(kind.model, {}).values(), key=lambda row: row.pk)


def _linked(rows: Rows) -> dict[type[Model], set[int]]:
    """Every entry id the rows link, by entry model (no query)."""
    found: dict[type[Model], set[int]] = {}
    for model, listed in rows.items():
        links = entry_links(model)
        for row in listed:
            for attname, target, _ in links:
                value = getattr(row, attname)
                if value is not None:
                    found.setdefault(target, set()).add(int(value))
    return found


def access_names(rows: Rows) -> set[str]:
    """The skill groups the rows' skill access names: a unit's `available_skills`, a fighter's `skill_types`."""
    names: set[str] = set()
    for listed in rows.values():
        for row in listed:
            held = getattr(row, "available_skills", None) or getattr(row, "skill_types", None) or ()
            names.update(str(name) for name in held)
    return names


def wanted(source_campaign_id: int, rows: Rows, known: Mapping[type[Model], Mapping[int, int]]) -> Wanted:
    """The source campaign's entries the rows use, with what they need (a fixed number of queries); `known`: entries
    already carried (a list's own rules), left out."""
    ids = _linked(rows)
    own = {"campaign_id": source_campaign_id}
    beasts = ids.setdefault(BestiaryEntry, set())
    if ids.get(Item):  # a beast's own item brings its beast
        twins = Item.objects.filter(pk__in=ids[Item], bestiary_entry__isnull=False, **own)
        beasts |= set(twins.values_list("bestiary_entry_id", flat=True))
    if beasts:
        _add_links(ids, BESTIARY, BestiaryEntry.objects.filter(pk__in=beasts, **own).values_list("pk", flat=True))
    names = access_names(rows)
    skills = ids.get(Skill, set())
    if skills or names:
        held = Q(skill_links__skill_id__in=skills) | Q(name__in=names)
        groups = set(SkillGroup.objects.filter(held, replaces__isnull=True, **own).values_list("pk", flat=True))
        ids.setdefault(SkillGroup, set()).update(groups)
        if groups:
            in_groups = SkillGroupSkill.objects.filter(group_id__in=groups).values_list("skill_id", flat=True)
            ids.setdefault(Skill, set()).update(in_groups)
    found = Wanted()
    for kind in CARRIED:
        wanted_ids = ids.get(kind.model, set()) - set(known.get(kind.model, {}))
        if not wanted_ids and not (kind is ITEMS and beasts):
            continue
        query = Q(pk__in=wanted_ids)
        if kind is ITEMS and beasts:
            query |= Q(bestiary_entry_id__in=beasts)  # the beasts' own items, which go with them
        rows_read = kind.model._default_manager.filter(query, **own)
        found.rows[kind.model] = {row.pk: row for row in rows_read}
    return found


def _add_links(ids: dict[type[Model], set[int]], kind: CatalogueKindSpec, parents: Iterable[int]) -> None:
    """The entries the kind's child rows link for these parents (one query a child table)."""
    wanted_parents = list(parents)
    if not wanted_parents:
        return
    for path in kind.children:
        relation = _relation(kind, path)
        model: Any = relation.related_model
        links = [(attname, target) for attname, target, _ in entry_links(model) if attname != relation.field.attname]
        if not links:
            continue
        values = model._default_manager.filter(**{f"{relation.field.attname}__in": wanted_parents})
        for row in values.values_list(*(attname for attname, _ in links)):
            for (_, target), value in zip(links, row, strict=True):
                if value is not None:
                    ids.setdefault(target, set()).add(int(value))


def _relation(kind: CatalogueKindSpec, path: str) -> ForeignObjectRel:
    parent, _, name = path.rpartition("__")
    relation = _model_at(kind.model, parent)._meta.get_field(name)
    assert isinstance(relation, ForeignObjectRel)
    return relation


def folded(name: Any) -> str:
    return str(name or "").strip().lower()


def candidates(kind: CatalogueKindSpec, target_id: int, names: Iterable[str]) -> list[Model]:
    """The target's entries of the kind by these names (trimmed, any case): its own, archived ones too, and the book's
    it hasn't replaced (one query). A beast's own item is never one: it goes with its beast."""
    rows = merge.campaign_list(kind, kind.model._default_manager.all(), target_id, archived=True)
    rows = rows.annotate(folded=Lower(Trim("name"))).filter(folded__in={folded(name) for name in names})
    if kind is ITEMS:
        rows = rows.filter(bestiary_entry__isnull=True)
    return list(rows.order_by("campaign_id", "pk"))


def _value_fields(model: type[Model], skip: str | None = None) -> list[str]:
    """What a row is compared by: its own fields but the bookkeeping, a link by its target's name."""
    fields = []
    for found in model._meta.concrete_fields:
        if found.primary_key or found.name in BOOKKEEPING or found.attname == skip:
            continue
        related: Any = getattr(found, "related_model", None)
        has_name = related is not None and any(other.name == "name" for other in related._meta.concrete_fields)
        fields.append(f"{found.name}__name" if has_name else found.attname)
    return fields


def fingerprints(kind: CatalogueKindSpec, entries: list[Model]) -> dict[int, tuple[Any, ...]]:
    """Each entry's effect, comparable between campaigns (one query a child table)."""
    if not entries:
        return {}
    own = _value_fields(kind.model)
    prints: dict[int, list[Any]] = {
        entry.pk: [tuple((name, _plain(getattr(entry, name))) for name in own if "__" not in name)] for entry in entries
    }
    nested: dict[str, dict[int, list[Any]]] = {}  # path -> its row id -> the fingerprints of its own children
    for path in sorted(kind.children, key=lambda found: -found.count("__")):  # the deepest first
        relation = _relation(kind, path)
        link = relation.field.attname
        model: Any = relation.related_model
        fields = _value_fields(model, skip=link)
        parent_path = path.rpartition("__")[0]
        under = _ids_under(kind, parent_path, set(prints)) if parent_path else set(prints)
        rows = model._default_manager.filter(**{f"{link}__in": under})
        for row in rows.values("pk", link, *fields):
            children = sorted(nested.get(path, {}).get(row["pk"], []), key=repr)
            mark = (path, tuple(_plain(row[name]) for name in fields), tuple(children))
            if parent_path:
                nested.setdefault(parent_path, {}).setdefault(row[link], []).append(mark)
            else:
                prints[row[link]].append(mark)
    return {pk: tuple(sorted(marks, key=repr)) for pk, marks in prints.items()}


def _ids_under(kind: CatalogueKindSpec, path: str, entries: set[int]) -> Any:
    """The ids of the child rows at `path` under the entries, as a subquery."""
    relation = _relation(kind, path)
    model: Any = relation.related_model
    return model._default_manager.filter(**{f"{relation.field.attname}__in": entries}).values("pk")


def _plain(value: Any) -> Any:
    """A value as compared: strings trimmed, collections as their sorted repr."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (dict, list)):
        return repr(value)
    return value
