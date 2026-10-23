"""A mount whose rider was taken out of action may die after the battle (the bestiary rewrite step 5).

The suggestion: each selected rider of the participant's battle roster (a hero, a hired sword, or a henchmen group's
member riding one of its mounts) who went out of action on his mount (not dismounted: services/dismount.py) rolls a
D6 for it. It dies on a 1 or 2, or only on a 1 when he has Barding (a group's copies go to its first riders, one each)
or, for a horse-type mount (`is_equine`), a Farrier (a hired sword's special rule) is on the warband's battle roster.
Barding keeps its own rule: it saves whatever wears it, as the shop sells it for a warhorse only. The roll and its result are the
player's (`postbattle_json.mount_survival`), never automatic: at finalise a dead mount's copy leaves its rider, his
ridden copy first, with a `mounts_lost` log row for each copy removed; a mount that survives stays. Only a mount the
server put at risk can die, and a rider who died here keeps his with his items (a henchman's share takes his ridden
copy first: services/items_lost.py).
"""

from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from django.db.models import Model

from apps.core.catalogue.current import resolve
from apps.items.models import Item
from apps.warbands.models import HenchmenGroupItem, HeroItem, HirelingItem

from ...models import BattleParticipant
from ...validation.unit_keys import parse_unit_key
from ..locks import locked
from ..roster_units import roster_entry
from ..selection import selected_unit_keys
from .context import FinaliseContext

DIES_ON, SAVED_DIES_ON = 2, 1  # a 1-2 kills the mount; a 1 with Barding or a Farrier
ROWS: dict[str, tuple[type[Model], str]] = {  # a rider's kind -> where his copies are, and their owner's column
    "hero": (HeroItem, "hero_id"),
    "hireling": (HirelingItem, "hireling_id"),
    "henchman": (HenchmenGroupItem, "henchmen_group_id"),
}
# The Farrier shoes "equine beasts" (his rule names a Horse, Mule, Warhorse, Elven Steed or Chaos Centaur): a mount
# whose name says so. That covers the bestiary's Riding/Draft Horse, Warhorse, Mule, Elven Steed, Chaos Steed and
# Nightmare (and a custom beast named so), not a Cold One, a boar, a wolf, a spider, a Rhinox, a Temple Dog or a Camel.
EQUINE_WORDS = ("horse", "steed", "mule", "pony", "nightmare")


def is_equine(mount_name: str) -> bool:
    """Whether a Farrier's shoes save the mount called `mount_name` (a horse-type beast)."""
    name = mount_name.lower()
    return any(word in name for word in EQUINE_WORDS)


def _barding(unit: dict[str, Any]) -> int:
    """The copies of Barding a roster entry carries (a group's members list the group's items)."""
    items = unit.get("items", [])
    return sum(int(item.get("count") or 1) for item in items if "barding" in str(item.get("name", "")).lower())


def _riders(roster: dict[str, Any]) -> Iterator[tuple[dict[str, Any], bool]]:
    """Each unit of the roster and whether it has Barding for its mount: a hero or hired sword who carries one, a
    group's members one copy each, in the order they ride its mounts."""
    for unit in [*roster.get("heroes", []), *roster.get("hirelings", [])]:
        yield unit, _barding(unit) > 0
    for group in roster.get("henchmenGroups", []):
        members = group.get("members", [])
        copies = _barding(members[0]) if members else 0
        for rider, member in enumerate(members):
            yield member, rider < copies


def _has_farrier(roster: dict[str, Any]) -> bool:
    specials = (special for sword in roster.get("hirelings", []) for special in sword.get("specials", []))
    return any(str(special.get("name", "")).strip().lower() == "farrier" for special in specials)


def mount_survival(participant: BattleParticipant, selected: set[str], information: dict[str, dict]) -> dict:
    """Each selected rider taken out of action on his mount: his name, the mount's and what it dies on (`saved_by`
    says why only a 1, when it does)."""
    roster = participant.roster_json or {}
    farrier = _has_farrier(roster)
    entries: dict[str, dict[str, Any]] = {}
    for unit, barded in _riders(roster):
        key, mount, info = unit.get("key"), unit.get("mount"), information.get(unit.get("key") or "", {})
        if key not in selected or not mount or not info.get("out_of_action") or info.get("dismounted"):
            continue
        shod = farrier and is_equine(str(mount.get("name") or ""))
        saved_by = [reason for reason, saves in (("barding", barded), ("farrier", shod)) if saves]
        entry = {"unit_name": unit.get("displayName"), "mount": mount.get("name")}
        entry["dies_on"] = SAVED_DIES_ON if saved_by else DIES_ON
        if saved_by:  # left out otherwise: the broadcast fits Pusher's 10 KB (item 8)
            entry["saved_by"] = saved_by
        entries[key] = entry
    return entries


@dataclass
class _Loss:
    unit_type: str
    owner_id: int  # the hero, hired sword or group whose copies carry the mount
    item_id: int
    log: dict[str, Any]


def _owner(context: FinaliseContext, members: dict, unit_type: str, unit_id: int) -> int | None:
    """Whose copies carry the rider's mount: his own, or his group's for a henchman; None for a rider gone since,
    or one who died here, whose items go with him (a henchman's share takes his ridden copy first)."""
    if unit_type == "henchman":
        member = members.get(unit_id)
        return None if member is None or member.dead else member.group_id
    rider = context.hero(unit_id) if unit_type == "hero" else context.hirelings.get(unit_id)
    return None if rider is None or rider.dismissed_at is not None or rider.dead else unit_id


def _losses(context: FinaliseContext, chosen: dict[str, dict]) -> list[_Loss]:
    roster = context.participant.roster_json or {}
    members = {member.id: member for member in context.henchmen}
    losses = []
    for unit_key, entry in chosen.items():
        parsed, unit = parse_unit_key(unit_key), roster_entry(roster, unit_key)
        mount = (unit or {}).get("mount")
        if not mount or parsed["unit_type"] not in ROWS:
            continue
        owner_id = _owner(context, members, parsed["unit_type"], parsed["unit_id"])
        if owner_id is None:
            continue
        log = {"unit_name": (unit or {}).get("displayName"), "mount": mount.get("name"), "roll": entry["roll"]}
        losses.append(_Loss(parsed["unit_type"], owner_id, mount["itemId"], log))
    return losses


def _rows_to_delete(
    context: FinaliseContext, unit_type: str, losses: list[_Loss], current: dict
) -> list[tuple[_Loss, int]]:
    """One copy per loss that still has one, the owner's ridden copies first, read and locked in one query for the
    kind."""
    model, owner_column = ROWS[unit_type]
    wanted = {loss.item_id for loss in losses} | {item.id for item in current.values()}
    rows = model._default_manager.filter(**{f"{owner_column}__in": {loss.owner_id for loss in losses}})
    rows = rows.filter(item_id__in=wanted, **{f"{owner_column.removesuffix('_id')}__warband_id": context.warband.id})
    spare: defaultdict[tuple[int, int], list[int]] = defaultdict(list)
    for row_id, owner_id, item_id in locked(rows.order_by("-companion", "id")).values_list(
        "id", owner_column, "item_id"
    ):
        spare[(owner_id, item_id)].append(row_id)
    chosen = []
    for loss in losses:
        item = current.get(loss.item_id)  # the campaign's version of it, edited or reverted mid-battle
        candidates = [loss.item_id, *([item.id] if item is not None else [])]
        copies = next((spare[(loss.owner_id, pk)] for pk in candidates if spare.get((loss.owner_id, pk))), None)
        if copies:
            chosen.append((loss, copies.pop(0)))
    return chosen


def lose_mounts(context: FinaliseContext, draft: dict, unit_information: dict[str, dict]) -> list[dict[str, Any]]:
    """Remove each mount the draft says died from its rider, only one the server put at risk (`mount_survival`);
    returns the log's entries, for the copies removed. Constant in units: the current items in one query, then a read
    and a delete per kind of rider."""
    dead = {key: entry for key, entry in draft.get("mount_survival", {}).items() if entry["dead"]}
    if not dead:  # no read of the battle roster for a draft without a mount lost
        return []
    at_risk = mount_survival(context.participant, selected_unit_keys(context.participant), unit_information)
    chosen = {key: entry for key, entry in dead.items() if key in at_risk}
    losses = _losses(context, chosen) if chosen else []
    if not losses:
        return []
    items = Item.objects.only("id", "campaign_id", "replaces_id")
    current = resolve(items, "items", {loss.item_id for loss in losses}, context.battle.campaign_id)
    by_kind: defaultdict[str, list[_Loss]] = defaultdict(list)
    for loss in losses:
        by_kind[loss.unit_type].append(loss)
    removed: list[tuple[_Loss, int]] = []
    for unit_type, kind_losses in by_kind.items():
        found = _rows_to_delete(context, unit_type, kind_losses, current)
        ROWS[unit_type][0]._default_manager.filter(id__in=[row_id for _, row_id in found]).delete()
        removed += found
    return [loss.log for loss in losses if any(loss is gone for gone, _ in removed)]
