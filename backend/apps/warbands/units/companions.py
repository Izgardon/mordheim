"""Companions: a mount or a pet switched on for the unit holding its Animal item (the bestiary rewrite step 4).

A companion is a state of one of the unit's item rows (`companion`), never a table of its own: only the unit holding
the item can switch it on, and moving, selling or trading the copy clears it (the copy that arrives is a new row). A
mount changes what the rider shows, never his stored stats: his Move is the mount's (when the mount has a profile)
and his armour save one better, or 6+ when he has none; his rating gains the mount's `rating_bonus`. A henchmen group
rides one mount per living member. Two mounts on one rider, a group whose mounts don't match its members and more
than two mounts in the warband warn; nothing is refused.

Everything here reads rows already loaded with their item's beast (`select_related("item__bestiary_entry")`), so
payloads stay at a fixed number of queries however many units and items there are.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Model, OuterRef, Value
from django.db.models.functions import Coalesce

from apps.bestiary.models import MOUNT, PET
from apps.warbands.models.shared import STAT_FIELDS
from apps.warbands.utils.armour_save import BEST_ARMOUR_SAVE, WORST_ARMOUR_SAVE

COMPANION_KINDS = (MOUNT, PET)
MAX_WARBAND_MOUNTS = 2  # a Mordheim warband; the campaign settings will own it (grading and settings plan)
Warning = dict[str, Any]


def beast_of(item: Any) -> Any:
    """The beast whose Animal item `item` is, or None (read from the item's loaded row: no query when joined)."""
    return item.bestiary_entry if getattr(item, "bestiary_entry_id", None) else None


def beast_kind(item: Any) -> str | None:
    """ "mount", "pet" or "creature" for an Animal item; None for any other item."""
    beast = beast_of(item)
    return beast.kind if beast is not None else None


@dataclass
class Companions:
    """A unit's switched-on mounts and pets, its item rows in id order."""

    mounts: list[Any] = field(default_factory=list)
    pets: list[Any] = field(default_factory=list)


def companions(rows: Iterable[Any]) -> Companions:
    found = Companions()
    for row in rows:
        kind = beast_kind(row.item) if row.companion and row.item_id else None
        if kind == MOUNT:
            found.mounts.append(row)
        elif kind == PET:
            found.pets.append(row)
    return found


def _profile(beast: Any) -> dict[str, Any] | None:
    if not beast.has_profile:
        return None
    return {**{name: getattr(beast, name) for name in STAT_FIELDS}, "armour_save": beast.armour_save}


def mount_payload(row: Any) -> dict[str, Any]:
    """What a unit payload says of its mount: the item row (to switch it off), the beast's Move and rating bonus, and
    its profile when it has one (`movement` is None without)."""
    beast = beast_of(row.item)
    return {
        "item_row_id": row.pk,
        "item_id": row.item_id,
        "name": row.item.name,
        "movement": beast.movement if beast.has_profile else None,
        "rating_bonus": beast.rating_bonus or 0,
        "has_profile": beast.has_profile,
        "stats": _profile(beast),
    }


def pet_payload(row: Any) -> dict[str, Any]:
    beast = beast_of(row.item)
    return {
        "item_row_id": row.pk,
        "item_id": row.item_id,
        "name": row.item.name,
        "has_profile": beast.has_profile,
        "stats": _profile(beast),
    }


def mounted_save(save: int | None) -> int:
    """A rider's armour save: one better than his own (never past the best save), or 6+ when he has none."""
    return WORST_ARMOUR_SAVE if save is None else max(save - 1, BEST_ARMOUR_SAVE)


def effective_stats(unit: Any, mount: Any | None) -> dict[str, Any] | None:
    """What a mounted unit shows (None on foot): the mount's Move when it has a profile (his own otherwise) and the
    mounted armour save. Shown beside the unit's stats, never written to them."""
    if mount is None:
        return None
    beast = beast_of(mount.item)
    movement = beast.movement if beast.has_profile else unit.movement
    return {"movement": movement, "armour_save": mounted_save(unit.armour_save)}


def mount_rating_bonus(bonuses: Sequence[int | None] | None, riders: int) -> int:
    """What the unit's mounts add to the warband rating: each rider's first mount (a hero or hired sword is one rider;
    a group, one per living member), in item row order."""
    return sum(bonus or 0 for bonus in (bonuses or [])[: max(riders, 0)])


def mount_bonuses(rows: Iterable[Any]) -> list[int]:
    """The rating bonus of each switched-on mount among loaded item rows, in row order."""
    return [beast_of(row.item).rating_bonus or 0 for row in companions(rows).mounts]


def mount_bonuses_array(join_model: type[Model], parent_field: str) -> ArraySubquery:
    """`mount_bonuses` read with each unit's row (the summary's rating): one array per unit, no query of its own."""
    rows = join_model._default_manager.filter(
        **{parent_field: OuterRef("pk"), "companion": True, "item__bestiary_entry__kind": MOUNT}
    )
    return ArraySubquery(rows.order_by("id").values(bonus=Coalesce("item__bestiary_entry__rating_bonus", Value(0))))


def _count(number: int, noun: str) -> str:
    return f"{number} {noun}" if number == 1 else f"{number} {noun}s"


def companion_warnings(name: str, rows: Iterable[Any], riders: int | None, warband_mounts: int) -> list[Warning]:
    """Warnings for a unit's companions (`riders`: a group's living members; None for a hero or hired sword) and the
    warband's switched-on mounts. Warn, never block."""
    mounts = len(companions(rows).mounts)
    warnings: list[Warning] = []
    if riders is None and mounts > 1:
        message = f"{name} has {mounts} mounts switched on; a rider rides one."
        warnings.append({"code": "two_mounts", "message": message, "mounts": mounts})
    if riders is not None and mounts and mounts != riders:
        message = f"{name} has {_count(mounts, 'mount')} for {_count(riders, 'living member')}: one mount per member."
        warnings.append({"code": "group_mounts", "message": message, "mounts": mounts, "members": riders})
    if warband_mounts > MAX_WARBAND_MOUNTS:
        message = f"The warband has {warband_mounts} mounts; a Mordheim warband has at most {MAX_WARBAND_MOUNTS}."
        warnings.append({"code": "warband_mounts", "message": message, "mounts": warband_mounts})
    return warnings


def companion_fields(unit: Any, rows: Iterable[Any]) -> dict[str, Any]:
    """A unit's `mount`, `pets` and `effective_stats` as its payload shows them, from its loaded item rows."""
    found = companions(rows)
    mount = found.mounts[0] if found.mounts else None
    return {
        "mount": mount_payload(mount) if mount is not None else None,
        "pets": [pet_payload(row) for row in found.pets],
        "effective_stats": effective_stats(unit, mount),
    }
