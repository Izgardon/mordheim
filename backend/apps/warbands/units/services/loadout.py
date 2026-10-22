"""A unit's loadout lists and trait specials, written the same way for every kind.

A create or PATCH that sends a list (`items`, `skill_ids`, `special_ids`, `spell_ids`) replaces that whole
list; unknown catalogue ids are skipped. The trait flags keep their specials in step: `large` with the
"Large" special for every kind, and `caster` with "Wizard" / "Priest" where the kind has casters.
"""

from collections.abc import Iterable, Mapping, MutableMapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from django.db.models import Q

from apps.items.models import Item
from apps.special.models import Special
from apps.warbands.models import RosterUnit

if TYPE_CHECKING:
    from apps.warbands.units.kinds import LinkSpec, UnitKindSpec

LARGE_SPECIAL_NAME = "Large"
CASTER_SPECIAL_MAP = {"Wizard": "Wizard", "Priest": "Priest"}  # caster value -> special name
TRAIT_SPECIAL_NAMES = [LARGE_SPECIAL_NAME, *CASTER_SPECIAL_MAP.values()]

LoadoutLists = MutableMapping[str, Any]  # write field -> the list sent, None when not sent


def get_trait_specials(campaign_id: int) -> dict[str, Special]:
    """The trait specials by name: the book's, or the campaign's version of one (BUG-103: every campaign's "Large"
    was read, and the last one won). One query; of several book specials of a name, the last in the catalogue's
    order wins, as before."""
    names = Q(campaign__isnull=True, name__in=TRAIT_SPECIAL_NAMES)
    versions = Q(campaign_id=campaign_id, replaces__campaign__isnull=True, replaces__name__in=TRAIT_SPECIAL_NAMES)
    rows = list(Special.objects.filter(names | versions))
    book = {row.name: row for row in rows if row.campaign_id is None}
    replaced = {row.replaces_id: row for row in rows if row.campaign_id is not None}
    return {name: replaced.get(row.id, row) for name, row in book.items()}


def linked_ids(links: Any, column: str) -> set[int]:
    """The catalogue ids one of a unit's join relations links to (e.g. `hero.hero_skills`, "skill_id"), in one query."""
    return {pk for pk in links.values_list(column, flat=True) if pk}


def pop_loadout_lists(kind: "UnitKindSpec", data: MutableMapping[str, Any]) -> LoadoutLists:
    """Take the kind's loadout lists out of a validated write."""
    return {link.write_field: data.pop(link.write_field, None) for link in kind.links()}


def build_item_rows(kind: "UnitKindSpec", unit: RosterUnit, items_data: list[dict[str, Any]]) -> list[Any]:
    """Join rows from a list of {id, cost} dicts; an item with one availability defaults to its cost."""
    item_ids = [entry["id"] for entry in items_data]
    items_by_id = {item.id: item for item in Item.objects.filter(id__in=item_ids).prefetch_related("availabilities")}
    rows = []
    for entry in items_data:
        item = items_by_id.get(entry["id"])
        if item is None:
            continue
        kwargs: dict[str, Any] = {kind.parent_field: unit, "item": item}
        cost = entry.get("cost")
        if cost is None:
            availabilities = list(item.availabilities.all())
            if len(availabilities) == 1:
                cost = availabilities[0].cost
        if cost is not None:
            kwargs["cost"] = cost
        rows.append(kind.items.model(**kwargs))
    return rows


def _catalogue_rows(kind: "UnitKindSpec", link: "LinkSpec", unit: RosterUnit, ids: Iterable[int]) -> list[Any]:
    ids = list(ids)
    entries = {entry.id: entry for entry in link.catalogue._default_manager.filter(id__in=ids)}
    return [link.model(**{kind.parent_field: unit, link.target: entries[pk]}) for pk in ids if pk in entries]


def replace_loadout(kind: "UnitKindSpec", unit: RosterUnit, lists: Mapping[str, Any], *, fresh: bool = False) -> None:
    """Replace every list the write sent; `fresh` skips the delete for a unit created in this write."""
    for link in kind.links():
        values = lists.get(link.write_field)
        if values is None:
            continue
        if not fresh:
            getattr(unit, link.relation).all().delete()
        if link is kind.items:
            rows = build_item_rows(kind, unit, values)
        else:
            rows = _catalogue_rows(kind, link, unit, values)
        link.model._default_manager.bulk_create(rows)


def _sync_special_list(special_ids: list[int], special_id: int, should_have: bool) -> None:
    if should_have:
        if special_id not in special_ids:
            special_ids.append(special_id)
        return
    while special_id in special_ids:
        special_ids.remove(special_id)


def _sync_special_db(specials: Any, special_id: int, should_have: bool) -> None:
    """Add or remove one trait special through a unit's own join relation (e.g. `hero.hero_specials`)."""
    if should_have:
        if not specials.filter(special_id=special_id).exists():
            specials.create(special_id=special_id)
    else:
        specials.filter(special_id=special_id).delete()


def _trait_specials_for(data: Mapping[str, Any], special_ids: list[int] | None, campaign_id: int) -> dict[str, Special]:
    """A write that names none of large, caster or special_ids leaves the traits alone: no query needed."""
    if special_ids is None and "large" not in data and "caster" not in data:
        return {}
    return get_trait_specials(campaign_id)


def apply_create_traits(
    kind: "UnitKindSpec", data: MutableMapping[str, Any], lists: LoadoutLists, campaign_id: int
) -> None:
    """Make a new unit's `large` flag and its trait specials agree before it is created."""
    sent_ids = lists.get(kind.specials.write_field)
    traits = _trait_specials_for(data, sent_ids, campaign_id)
    special_ids = sent_ids if sent_ids is not None else []
    large_sp = traits.get(LARGE_SPECIAL_NAME)
    if large_sp:
        desired_large = data.get("large", None)
        if desired_large is None:
            desired_large = large_sp.id in special_ids
            if desired_large:
                data["large"] = True
        _sync_special_list(special_ids, large_sp.id, desired_large)
    if kind.caster_traits:
        caster_value = data.get("caster", "No")
        for caster_type, special_name in CASTER_SPECIAL_MAP.items():
            caster_sp = traits.get(special_name)
            if caster_sp:
                _sync_special_list(special_ids, caster_sp.id, caster_value == caster_type)
    lists[kind.specials.write_field] = special_ids


@dataclass
class TraitUpdate:
    """What a PATCH asks of the trait specials, worked out before the unit is saved."""

    traits: dict[str, Special] = field(default_factory=dict)
    desired_large: bool | None = None
    desired_caster: str | None = None


def prepare_update_traits(
    kind: "UnitKindSpec", data: MutableMapping[str, Any], lists: LoadoutLists, campaign_id: int
) -> TraitUpdate:
    """Sync the trait specials into a sent `special_ids` list, or `large` from it, before the save."""
    special_ids = lists.get(kind.specials.write_field)
    update = TraitUpdate(
        traits=_trait_specials_for(data, special_ids, campaign_id), desired_large=data.get("large", None)
    )
    large_sp = update.traits.get(LARGE_SPECIAL_NAME)
    if large_sp:
        if special_ids is not None:
            if update.desired_large is None:
                update.desired_large = large_sp.id in special_ids
                data["large"] = update.desired_large
            else:
                _sync_special_list(special_ids, large_sp.id, update.desired_large)
        elif update.desired_large is not None:
            update.desired_large = bool(update.desired_large)
    if kind.caster_traits:
        update.desired_caster = data.get("caster", None)
    if special_ids is not None and update.desired_caster is not None:
        for caster_type, special_name in CASTER_SPECIAL_MAP.items():
            caster_sp = update.traits.get(special_name)
            if caster_sp:
                _sync_special_list(special_ids, caster_sp.id, update.desired_caster == caster_type)
    return update


def finish_update_traits(kind: "UnitKindSpec", unit: RosterUnit, update: TraitUpdate, lists: LoadoutLists) -> None:
    """Without a `special_ids` list, add or remove the trait specials the new flags call for."""
    large_sp = update.traits.get(LARGE_SPECIAL_NAME)
    if lists.get(kind.specials.write_field) is None:
        specials = getattr(unit, kind.specials.relation)
        if large_sp and update.desired_large is not None:
            _sync_special_db(specials, large_sp.id, update.desired_large)
        if update.desired_caster is not None:
            for caster_type, special_name in CASTER_SPECIAL_MAP.items():
                caster_sp = update.traits.get(special_name)
                if caster_sp:
                    _sync_special_db(specials, caster_sp.id, update.desired_caster == caster_type)
    if large_sp and update.desired_large is not None and unit.large != update.desired_large:
        unit.large = update.desired_large
        unit.save(update_fields=["large"])
