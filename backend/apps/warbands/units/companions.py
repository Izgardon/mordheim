"""Companions: a mount or a pet switched on for the unit holding its Animal item (the bestiary rewrite step 4).

A companion is a state of one of the unit's item rows (`companion`), never a table of its own: only the unit holding
the item can switch it on, and moving, selling or trading the copy clears it (the copy that arrives is a new row). A
mount changes what the rider shows, never his stored stats: his Move is the mount's (when the mount has a profile)
and his armour save one better, or 6+ when he has none; his rating gains the mount's `rating_bonus`. A henchmen group
rides one mount per living member, and mounts as one: every member of a group carries the same gear, so the switch
on a group's mount acts on every copy of it (units/services/companions.py). Two mounts on one rider, a mounted group
whose mounts aren't one per living member or are of more than one kind, and more than two mounts in the warband
warn; nothing is refused.

A companion also brings its beast's skills, specials and spells (step 5), listed with it in the unit's payload and
never part of the unit's own lists.

Everything here reads rows already loaded with their item's beast and its entries (`with_beasts`), so payloads stay
at a fixed number of queries however many units and items there are.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Model, OuterRef, QuerySet, Value
from django.db.models.functions import Coalesce, JSONObject

from apps.bestiary.models import MOUNT, PET, BestiaryEntrySkill, BestiaryEntrySpecial, BestiaryEntrySpell
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


# A beast's entries as a companion lists them: the payload key, the pivot, its catalogue field and the columns the
# unit's own detail lists show.
ABILITIES: tuple[tuple[str, type[Model], str, tuple[str, ...]], ...] = (
    ("skills", BestiaryEntrySkill, "skill", ("id", "name", "type")),
    ("specials", BestiaryEntrySpecial, "special", ("id", "name", "type", "description")),
    ("spells", BestiaryEntrySpell, "spell", ("id", "name", "type", "dc", "description")),
)


def _ability_array(pivot: type[Model], target: str, columns: tuple[str, ...]) -> ArraySubquery:
    rows = pivot._default_manager.filter(bestiary_entry_id=OuterRef("item__bestiary_entry_id")).order_by("id")
    return ArraySubquery(rows.values(entry=JSONObject(**{column: f"{target}__{column}" for column in columns})))


def with_beasts(rows: QuerySet) -> QuerySet:
    """Item rows with each Animal item's beast joined and its skills, specials and spells read in the same query (an
    empty array for any other item), for `mount_payload` and `pet_payload`."""
    arrays = {f"beast_{key}": _ability_array(pivot, target, columns) for key, pivot, target, columns in ABILITIES}
    annotated: QuerySet = rows.select_related("item__bestiary_entry").annotate(**arrays)
    return annotated


def beast_abilities(row: Any) -> dict[str, list[dict[str, Any]]]:
    """The skills, specials and spells of the beast a companion's row is a copy of: read with the row (`with_beasts`),
    or from the bestiary's pivots for a row loaded without them (one query each)."""
    found: dict[str, list[dict[str, Any]]] = {}
    for key, pivot, target, columns in ABILITIES:
        entries = getattr(row, f"beast_{key}", None)
        if entries is None:
            links = pivot._default_manager.filter(bestiary_entry_id=row.item.bestiary_entry_id)
            links = links.select_related(target).order_by("id")
            entries = [{column: getattr(getattr(link, target), column) for column in columns} for link in links]
        found[key] = list(entries)
    return found


def mount_payload(row: Any) -> dict[str, Any]:
    """What a unit payload says of its mount: the item row (to switch it off), the beast's Move and rating bonus, its
    profile when it has one (`movement` is None without) and its skills, specials and spells."""
    beast = beast_of(row.item)
    return {
        "item_row_id": row.pk,
        "item_id": row.item_id,
        "name": row.item.name,
        "movement": beast.movement if beast.has_profile else None,
        "rating_bonus": beast.rating_bonus or 0,
        "has_profile": beast.has_profile,
        "stats": _profile(beast),
        **beast_abilities(row),
    }


def pet_payload(row: Any) -> dict[str, Any]:
    beast = beast_of(row.item)
    return {
        "item_row_id": row.pk,
        "item_id": row.item_id,
        "name": row.item.name,
        "has_profile": beast.has_profile,
        "stats": _profile(beast),
        **beast_abilities(row),
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


def unit_name(unit: Any, unknown: str) -> str:
    """A unit as its warnings name it: its name, else its type, else its kind's `unknown` name."""
    return str(unit.name or unit.unit_type or unknown)


def companion_warnings(name: str, rows: Iterable[Any], riders: int | None, warband_mounts: int) -> list[Warning]:
    """Warnings for a unit's companions and the warband's switched-on mounts. Warn, never block."""
    return unit_companion_warnings(name, rows, riders) + warband_mount_warnings(warband_mounts)


def unit_companion_warnings(name: str, rows: Iterable[Any], riders: int | None) -> list[Warning]:
    """Two mounts on a hero or hired sword (`riders` None), or a mounted group's warnings (`riders` living members)."""
    if riders is not None:
        return group_mount_warnings(name, rows, riders)
    mounts = len(companions(rows).mounts)
    if mounts <= 1:
        return []
    message = f"{name} has {mounts} mounts switched on; a rider rides one."
    return [{"code": "two_mounts", "message": message, "mounts": mounts}]


SAME_GEAR = "Every member of a group carries the same gear"


def _a(name: str) -> str:
    return f"{'an' if name[:1].lower() in 'aeiou' else 'a'} {name}"


def _listed(names: list[str]) -> str:
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} and {names[-1]}"


def group_mount_warnings(name: str, rows: Iterable[Any], riders: int) -> list[Warning]:
    """A mounted group's warnings, from its item rows and its `riders` living members (warn, never block). Every member
    of a group carries the same gear, so a group takes the field when each living member rides one mount, all of one
    kind: its switched-on mounts against its members (`group_mounts`, fewer or left over) and the kinds it rides
    (`group_mount_kinds`). A group on foot has none."""
    mounts = companions(rows).mounts
    if not mounts:
        return []
    count, kinds = len(mounts), [row.item.name for row in mount_kinds(mounts)]
    warnings: list[Warning] = []
    if count != riders:
        if count < riders:
            needs = _a(kinds[0]) if len(kinds) == 1 else "a mount"
            until = f"until each of its {riders} members has {needs} (it has {count})"
            message = f"{SAME_GEAR}, so {name} can't take the field {until}."
        else:
            spare = f"({_count(count, 'mount')} for {_count(riders, 'living member')})"
            message = f"Every member of a group rides one mount, so {name} has {count - riders} left over {spare}."
        warnings.append({"code": "group_mounts", "message": message, "mounts": count, "members": riders})
    if len(kinds) > 1:
        message = f"{SAME_GEAR}, so {name} can't take the field riding {len(kinds)} kinds of mount ({_listed(kinds)})."
        warnings.append({"code": "group_mount_kinds", "message": message, "kinds": kinds})
    return warnings


def warband_mount_warnings(warband_mounts: int) -> list[Warning]:
    """More than a Mordheim warband's mounts switched on across the roster."""
    if warband_mounts <= MAX_WARBAND_MOUNTS:
        return []
    message = f"The warband has {warband_mounts} mounts; a Mordheim warband has at most {MAX_WARBAND_MOUNTS}."
    return [{"code": "warband_mounts", "message": message, "mounts": warband_mounts}]


def mount_kinds(rows: Iterable[Any]) -> list[Any]:
    """Each kind of mount switched on, the first copy of each item in row order (the first is `mount`): a group's
    `mounts`, so the page lists every kind's entries for a group on a Warhorse and a Pony."""
    first: dict[int, Any] = {}
    for row in companions(rows).mounts:
        first.setdefault(row.item_id, row)
    return list(first.values())


def companion_fields(unit: Any, rows: Iterable[Any]) -> dict[str, Any]:
    """A unit's `mount`, `pets` and `effective_stats` as its payload shows them, from its loaded item rows."""
    found = companions(rows)
    mount = found.mounts[0] if found.mounts else None
    return {
        "mount": mount_payload(mount) if mount is not None else None,
        "pets": [pet_payload(row) for row in found.pets],
        "effective_stats": effective_stats(unit, mount),
    }
