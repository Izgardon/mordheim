"""One member's part of his group's loadout (henchmen loadouts, services/loadouts.py).

- **His share** is one copy of each row he carries (none he has a gap on). Dismissed, it goes to the stash at what each
  row cost, or leaves with him, as the player chooses; taken ("Take Skritt's kit"), it goes to the stash and he gets a
  gap for each row, which leaves him out of the next battle until he is re-equipped or dismissed.
- **A recruit** carries every row; the player may take a row's copy for him from the stash, or have him join without
  it (a gap). Either takes that row's cost off what he is charged.
- **A gap** is filled by buying one copy or taking one from the stash, or left ("Leave it": he goes without).

Everything runs in the caller's transaction with the warband locked first. Stash shortfalls are 400s.
"""

from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from apps.items.materials import named, priced
from apps.items.models import Item
from apps.warbands.models import Henchman, HenchmanItemGap, HenchmenGroup, HenchmenGroupItem, LedgerAction, Warband
from apps.warbands.services import economy_log, ledger
from apps.warbands.services.loadouts import carried_rows, gap_rows
from apps.warbands.services.prices import CampaignPrices
from apps.warbands.services.purchases import price_line
from apps.warbands.services.stash import ANY_COST, StashShortage, add_to_stash, remove_from_stash
from apps.warbands.services.unit_items import touch_unit
from apps.warbands.units.errors import RosterError
from apps.warbands.units.kinds import HENCHMEN_GROUP

GROUP = HENCHMEN_GROUP.key
FILL_ACTIONS = ("buy", "stash", "leave")


def member_name(member: Henchman) -> str:
    return member.name.strip() or "Unnamed Henchman"


def _group_end(group: HenchmenGroup) -> tuple[str, str | None]:
    return GROUP, economy_log.unit_name(GROUP, group)


def _to_stash(warband: Warband, group: HenchmenGroup, rows: Iterable[HenchmenGroupItem]) -> list[int]:
    """One copy of each row into the stash at the row's cost, each move logged; the item ids."""
    moved = []
    for row in rows:
        add_to_stash(warband.id, row.item_id, 1, row.cost, row.material)
        economy_log.log_move(warband, named(row.material, row.item.name), 1, _group_end(group), ("stash", None))
        moved.append(row.item_id)
    return moved


def share_to_stash(warband: Warband, group: HenchmenGroup, members: Iterable[Henchman]) -> list[int]:
    """Leaving members' shares go to the stash (each row they carried, one copy each, at its cost); the item ids moved.
    Two reads and a write per item and cost, however many members leave."""
    member_ids = [member.pk for member in members]
    if not member_ids:
        return []
    rows = list(HenchmenGroupItem.objects.filter(henchmen_group=group).select_related("item").order_by("id"))
    gaps = HenchmanItemGap.objects.filter(henchman_id__in=member_ids, group_item__henchmen_group=group)
    lacking = set(gaps.values_list("henchman_id", "group_item_id"))
    copies = Counter(
        (row.item_id, row.cost, row.material) for pk in member_ids for row in rows if (pk, row.pk) not in lacking
    )
    names = {(row.item_id, row.material): named(row.material, row.item.name) for row in rows}
    moved: Counter[tuple[int, str]] = Counter()
    for (item_id, cost, material), quantity in copies.items():
        add_to_stash(warband.id, item_id, quantity, cost, material)
        moved[(item_id, material)] += quantity
    for key, quantity in moved.items():
        economy_log.log_move(warband, names[key], quantity, _group_end(group), ("stash", None))
    return [item_id for item_id, _material in moved]


def take_kit(warband: Warband, group: HenchmenGroup, member: Henchman) -> list[int]:
    """ "Take Skritt's kit": one copy of each row he carries to the stash, at what it cost, and a gap for each (he sits
    out the next battle by default until re-equipped or dismissed); the item ids moved. 400 when he carries nothing."""
    rows = carried_rows(member)
    if not rows:
        message = f"{member_name(member)} carries nothing of the group's loadout."
        raise RosterError(message, "nothing_carried", {"member": [message]})
    moved = _to_stash(warband, group, rows)
    gap_rows(rows, [member.pk], HenchmanItemGap.KIT_TAKEN)
    touch_unit(GROUP, group)
    return moved


def _short(key: str, item: Item, held: int) -> RosterError:
    message = f"The stash holds {held} {item.name}." if held else f"The stash holds no {item.name}."
    return RosterError(message, "not_enough_in_stash", {key: [message]})


@dataclass(frozen=True)
class Kit:
    """What a recruit's entry asks of the loadout: rows from the stash, rows he goes without."""

    from_stash: list[int]
    without: list[int]

    @classmethod
    def of(cls, entry: Mapping[str, Any], rows: Mapping[int, HenchmenGroupItem]) -> "Kit":
        stash = [pk for pk in dict.fromkeys(entry.get("from_stash") or []) if pk in rows]
        without = [pk for pk in dict.fromkeys(entry.get("without") or []) if pk in rows and pk not in stash]
        return cls(stash, without)


def equip_recruits(
    warband: Warband, group: HenchmenGroup, recruits: Sequence[tuple[Mapping[str, Any], Henchman]]
) -> dict[int, int]:
    """Each recruit's kit: the rows taken from the stash for him (one copy each, newest first) and the gaps for those
    he joins without. Returns member id -> the row costs he isn't charged."""
    rows = {row.pk: row for row in HenchmenGroupItem.objects.filter(henchmen_group=group).select_related("item")}
    saved: dict[int, int] = {}
    gaps: list[HenchmanItemGap] = []
    for index, (entry, member) in enumerate(recruits):
        kit = Kit.of(entry, rows)
        for pk in kit.from_stash:
            row = rows[pk]
            try:  # a copy made of what the row is made of (weapon materials)
                remove_from_stash(warband.id, row.item_id, 1, ANY_COST, row.material)
            except StashShortage as shortage:
                raise _short(f"henchmen.{index}.from_stash", row.item, shortage.held) from None
            economy_log.log_move(warband, named(row.material, row.item.name), 1, ("stash", None), _group_end(group))
        gaps += [HenchmanItemGap(henchman=member, group_item=rows[pk]) for pk in kit.without]
        saved[member.pk] = sum(int(rows[pk].cost or 0) for pk in [*kit.from_stash, *kit.without])
    HenchmanItemGap.objects.bulk_create(gaps)
    return saved


def fill_gap(warband: Warband, group: HenchmenGroup, gap: HenchmanItemGap, body: Mapping[str, Any]) -> None:
    """Buy one copy for the member (the price sent, else the price row and roll sent, else the current campaign
    price, else what the row cost: a "Buy" row), take one from the stash (of the cost sent, else the newest), or leave
    it (he goes without; the gap stays, marked left)."""
    row, member = gap.group_item, gap.henchman
    if body["action"] == "leave":
        HenchmanItemGap.objects.filter(pk=gap.pk).update(left=True)
        return
    name = named(row.material, row.item.name)
    if body["action"] == "buy":
        data = {**body, "quantity": 1, "is_buying": True, "material": row.material}
        price = price_line(warband, row.item, data) if _priced(body) else _current_or_row(warband, row)
        description = f"{name} for {member_name(member)}"
        ledger.record(warband, LedgerAction.BUY, -int(price or 0), description)
        payload = {"hero": economy_log.unit_name(GROUP, group), "item": name, "price": int(price or 0)}
        economy_log.write(warband, "loadout", "henchmen_item", payload)
    else:
        cost = body["cost"] if "cost" in body else ANY_COST
        try:
            remove_from_stash(warband.id, row.item_id, 1, cost, row.material)
        except StashShortage as shortage:
            raise _short("action", row.item, shortage.held) from None
        economy_log.log_move(warband, name, 1, ("stash", None), _group_end(group))
    HenchmanItemGap.objects.filter(pk=gap.pk).delete()
    touch_unit(GROUP, group)


def _priced(body: Mapping[str, Any]) -> bool:
    return body.get("price") is not None or body.get("availability_id") is not None


def _current_or_row(warband: Warband, row: HenchmenGroupItem) -> int | None:
    """What one more copy of the row costs: the campaign's current price through the row's material, else what the
    row cost."""
    current = priced(row.material, CampaignPrices(warband.campaign_id).current(row.item))
    return current if current is not None else row.cost


def on_roster_gap(gaps: Any, group: HenchmenGroup, gap_id: int) -> HenchmanItemGap | None:
    """The gap `gap_id` if it is a living member's of `group` (on a row of its loadout), else None."""
    found: HenchmanItemGap | None = gaps.filter(
        pk=gap_id, group_item__henchmen_group=group, henchman__dead=False, henchman__dismissed_at__isnull=True
    ).first()
    return found
