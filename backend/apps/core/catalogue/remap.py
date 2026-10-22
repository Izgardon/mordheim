"""Moving a campaign's copies from one catalogue entry to another (IMP-67's one remap path, for every kind).

A version's first edit moves the campaign's copies onto the version, Revert moves them back, and a house rule's
sync and revert do the same for its clones. Every row the kind's registry names moves: the holders (units' copies,
stash rows, bestiary links, units of a race) and the followers (bestiary favourites, the campaign's animals),
within the one campaign; other campaigns and the book's own links stay. Each copy keeps its stored cost: what the
warband paid, which sales and values read (BUG-51). Each table is one UPDATE whatever the number of copies; a
table with a unique key (a stash row per item and cost, one link per bestiary entry and item, one favourite per
warband and entry) reads the rows it moves and the rows they may meet, then merges: a stash row's copies join the
row of their cost, a duplicate link or favourite goes.
"""

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from django.db.models import Case, Value, When

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec, Move

IdMap = Mapping[int, int]  # an entry's id -> the id its copies move to


def remap(kind: "CatalogueKindSpec", campaign_id: int, id_map: IdMap, *, fresh: bool = False) -> None:
    """Point the campaign's rows that hold or follow each entry of `id_map` at its target. `fresh`: the targets are
    new entries no row points at yet, so nothing can meet and every table is one UPDATE."""
    id_map = {old: new for old, new in id_map.items() if old != new}
    if not id_map:
        return
    for move in (*kind.holders, *kind.followers):
        if fresh or not move.unique:
            _update(move, campaign_id, id_map)
        else:
            _merge(move, campaign_id, id_map)


def _rows(move: "Move", campaign_id: int, ids: Any) -> Any:
    return move.model._default_manager.filter(**{f"{move.field}_id__in": ids, move.campaign: campaign_id})


def _update(move: "Move", campaign_id: int, id_map: IdMap) -> None:
    column = f"{move.field}_id"
    if len(id_map) == 1:
        [(old, new)] = id_map.items()
        target: Any = Value(new)
    else:
        target = Case(*(When(**{column: old}, then=Value(new)) for old, new in id_map.items()))
    _rows(move, campaign_id, list(id_map)).update(**{column: target})


def _merge(move: "Move", campaign_id: int, id_map: IdMap) -> None:
    """Move rows of a table with a unique key: a row meeting one already at its target merges into it."""
    column = f"{move.field}_id"
    moving = list(_rows(move, campaign_id, list(id_map)).order_by("pk"))
    if not moving:
        return
    owners = {getattr(row, move.unique[0]) for row in moving}
    met = {
        (getattr(row, column), *(getattr(row, part) for part in move.unique)): row
        for row in move.model._default_manager.filter(
            **{f"{column}__in": set(id_map.values()), f"{move.unique[0]}__in": owners}
        )
    }
    moved, merged, dropped = [], {}, []
    for row in moving:
        key = (id_map[getattr(row, column)], *(getattr(row, part) for part in move.unique))
        into = met.get(key)
        if into is None:
            setattr(row, column, key[0])
            met[key] = row
            moved.append(row)
            continue
        dropped.append(row.pk)
        if move.adds:
            setattr(into, move.adds, getattr(into, move.adds) + getattr(row, move.adds))
            merged[into.pk] = into
    manager = move.model._default_manager
    if dropped:
        manager.filter(pk__in=dropped).delete()
    if moved:
        manager.bulk_update(moved, [column, *([move.adds] if move.adds else [])])
    moved_ids = {row.pk for row in moved}
    stayed = [row for pk, row in merged.items() if pk not in moved_ids]
    if stayed and move.adds:
        manager.bulk_update(stayed, [move.adds])
