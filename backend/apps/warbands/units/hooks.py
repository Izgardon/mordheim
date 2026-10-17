"""The differences between unit kinds that are behaviour rather than data (design 0.28 §4.3).

The shared create, update, dismiss and kill-history services call these hooks; `UnitHooks` adds nothing.
Heroes keep one living leader per warband (`LeaderHooks`); henchmen groups carry members, who are
recruited, charged and synced one by one (`HenchmenHooks`).
"""

from collections.abc import Mapping, Set
from decimal import Decimal
from typing import TYPE_CHECKING, Any, cast

from apps.logs.utils import log_warband_event
from apps.warbands.models import Henchman, HenchmenGroup, RosterUnit, Warband
from apps.warbands.utils.leaders import ensure_single_living_leader, lock_warband
from apps.warbands.utils.trades import TradeHelper

if TYPE_CHECKING:
    from .kinds import UnitKindSpec

MemberEntries = list[dict[str, Any]]


class UnitHooks:
    def after_create(self, unit: RosterUnit, members: MemberEntries | None) -> None:
        """Runs in the create's transaction once the unit and its loadout exist."""

    def before_update(self, unit: RosterUnit, fields: Set[str]) -> None:
        """Runs before a PATCH saves `fields` (the scalar fields it sends)."""

    def after_update(self, unit: RosterUnit, fields: Set[str], members: MemberEntries | None) -> MemberEntries:
        """Runs after the PATCH's writes; returns the member entries it recruited, to be charged."""
        return []

    def record_recruit(self, kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, sent: Any) -> None:
        """The new unit's log row and, when it cost anything, its recruit trade."""
        name, unit_type = unit.name or "Unknown", unit.unit_type or "Unknown"
        log_warband_event(warband.id, "personnel", kind.recruit.log_new, {"name": name, "type": unit_type})
        if unit.price and unit.price > 0:
            TradeHelper.create_trade(
                warband=warband,
                action=kind.recruit.trade_action,
                description=f"{name} the {unit_type}",
                price=unit.price,
                notes="",
            )

    def record_recruits(self, warband: Warband, unit: RosterUnit, entries: MemberEntries) -> None:
        """Charges and logs the members a PATCH recruited (only henchmen groups have members)."""

    def before_dismiss(self, warband: Warband) -> None:
        pass

    def after_dismiss(self, warband: Warband) -> None:
        pass

    def kill_tally(self, kind: "UnitKindSpec", unit: Any) -> tuple[str, list[int], int]:
        """(killer type in kill events, killer ids, total kills) for the unit's kill history."""
        return kind.key, [unit.id], unit.kills or 0


class LeaderHooks(UnitHooks):
    """Heroes: exactly one living leader whenever the warband has living heroes.

    Writes that can move the crown lock the warband before they touch a hero (BUG-63); a PATCH can only
    move it when it sends `is_leader` or `dead`.
    """

    def _may_move_crown(self, fields: Set[str]) -> bool:
        return "is_leader" in fields or "dead" in fields

    def _crown(self, hero: Any) -> None:
        ensure_single_living_leader(
            hero.warband_id, preferred_leader_id=hero.id if hero.is_leader and not hero.dead else None
        )

    def after_create(self, unit: RosterUnit, members: MemberEntries | None) -> None:
        self._crown(unit)

    def before_update(self, unit: RosterUnit, fields: Set[str]) -> None:
        if self._may_move_crown(fields):
            lock_warband(unit.warband_id)

    def after_update(self, unit: RosterUnit, fields: Set[str], members: MemberEntries | None) -> MemberEntries:
        if self._may_move_crown(fields):
            self._crown(unit)
        return []

    def before_dismiss(self, warband: Warband) -> None:
        lock_warband(warband.id)

    def after_dismiss(self, warband: Warband) -> None:
        ensure_single_living_leader(warband.id)


MEMBER_FIELDS = ("name", "kills", "dead")


def sync_members(group: HenchmenGroup, entries: MemberEntries) -> MemberEntries:
    """Apply a PATCH's member list to `group`; returns the entries that became new members.

    An entry naming a living member updates only the fields it carries (BUG-94); an entry without a
    known id is a new member. Living members left out of the list are removed. Dead members are
    records (BUG-04): this path never edits, duplicates (BUG-92) or deletes them, however the caller
    loaded the group, so an entry naming one is ignored. A fixed number of writes, however many
    members the group has (PERF-28).
    """
    members: dict[int | None, Henchman] = {member.id: member for member in Henchman.objects.filter(group=group)}
    sent: dict[int, set[str]] = {}  # living member id -> the fields its entries carry
    changed_ids: set[int] = set()
    new_entries = []
    for entry in entries:
        member = members.get(entry.get("id"))
        if member is None:
            new_entries.append(entry)
            continue
        if member.dead:
            continue
        fields = sent.setdefault(member.id, set())
        for name in MEMBER_FIELDS:
            if name in entry:
                fields.add(name)
                if getattr(member, name) != entry[name]:
                    setattr(member, name, entry[name])
                    changed_ids.add(member.id)

    removed_ids = {member.id for member in members.values() if not member.dead and member.id not in sent}
    if removed_ids:
        Henchman.objects.filter(group=group, id__in=removed_ids, dead=False).delete()
    # One UPDATE per distinct set of sent fields (the roster form always sends the same ones), writing
    # only the fields the entries carried.
    by_fields: dict[tuple[str, ...], list[Henchman]] = {}
    for member_id in changed_ids:
        by_fields.setdefault(tuple(sorted(sent[member_id])), []).append(members[member_id])
    for field_names, rows in by_fields.items():
        Henchman.objects.bulk_update(rows, list(field_names))
    if new_entries:
        Henchman.objects.bulk_create(
            [
                Henchman(
                    group=group,
                    name=entry.get("name", ""),
                    kills=entry.get("kills", 0),
                    dead=entry.get("dead", False),
                )
                for entry in new_entries
            ]
        )
    return new_entries


def _parse_henchman_cost(value: Any) -> int | None:
    if value is None:
        return None
    try:
        numeric = int(float(value))
    except (TypeError, ValueError):
        return None
    return max(numeric, 0)


def _default_hire_cost(group: HenchmenGroup) -> int | Decimal:
    """Price + every group item + 2 x XP: the cost of a member a PATCH adds without one (BUG-66, BUG-85)."""
    base_cost = group.price or 0
    xp_cost = (group.xp or 0) * 2
    items_cost = sum((link.cost or 0) for link in group.henchmen_group_items.all())
    return base_cost + items_cost + xp_cost


def _recruit_headers(warband: Warband, group_name: str, count: int, trade_text: str) -> tuple[Any, Any]:
    """With more than one recruit, the trade and log rows the recruits are grouped under."""
    if count <= 1:
        return None, None
    trade_header = TradeHelper.create_group_header(warband=warband, description=trade_text)
    log_header = log_warband_event(
        warband.id, "personnel", "new_henchmen_group_batch", {"name": group_name, "count": count}
    )
    return trade_header, log_header


class HenchmenHooks(UnitHooks):
    """Henchmen groups: members are created, synced, charged and logged one by one."""

    def after_create(self, unit: RosterUnit, members: MemberEntries | None) -> None:
        group = cast(HenchmenGroup, unit)
        Henchman.objects.bulk_create([Henchman(group=group, name=entry.get("name", "")) for entry in members or []])

    def after_update(self, unit: RosterUnit, fields: Set[str], members: MemberEntries | None) -> MemberEntries:
        return sync_members(cast(HenchmenGroup, unit), members) if members is not None else []

    def record_recruit(self, kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, sent: Any) -> None:
        """The group's log row, then one log row and one trade at the group price per member."""
        group = cast(HenchmenGroup, unit)
        log_new = {"name": group.name or "Unknown", "type": group.unit_type or "Unknown"}
        log_warband_event(warband.id, "personnel", kind.recruit.log_new, log_new)
        group_name = group.name or group.unit_type or "Unknown Group"
        members = list(group.henchmen.all())
        trade_header, log_header = _recruit_headers(
            warband, group_name, len(members), f"Recruited {len(members)} {group_name}"
        )
        for member in members:
            log_warband_event(
                warband.id,
                "personnel",
                "new_henchman",
                {"name": member.name or "Unnamed Henchman", "group": group_name},
                parent_id=log_header.id if log_header else None,
            )
        if group.price and group.price > 0:
            item_notes = str(sent.get("item_notes") or "")
            for member in members:
                TradeHelper.create_trade(
                    warband=warband,
                    action=kind.recruit.trade_action,
                    description=f"{member.name or 'Unnamed Henchman'} into {group_name}",
                    price=group.price,
                    notes=item_notes,
                    parent=trade_header,
                )

    def record_recruits(self, warband: Warband, unit: RosterUnit, entries: MemberEntries) -> None:
        """One log row and one trade per member a PATCH added, at the entry's cost or the default cost.

        An entry naming any existing member, dead ones too, is never a recruit (BUG-92); ids are matched
        as ints (BUG-93).
        """
        group = cast(HenchmenGroup, unit)
        group_name = group.name or group.unit_type or "Unknown Group"
        default_cost = _default_hire_cost(group)
        trade_header, log_header = _recruit_headers(
            warband, group_name, len(entries), f"Recruited {len(entries)} into {group_name}"
        )
        for entry in entries:
            henchman_name = entry.get("name") or "Unnamed Henchman"
            entry_cost = _parse_henchman_cost(entry.get("cost"))
            log_warband_event(
                warband.id,
                "personnel",
                "new_henchman",
                {"name": henchman_name, "group": group_name},
                parent_id=log_header.id if log_header else None,
            )
            TradeHelper.create_trade(
                warband=warband,
                action="Recruited",
                description=f"{henchman_name} into {group_name}",
                price=entry_cost if entry_cost is not None else default_cost,
                notes=str(entry.get("item_notes") or ""),
                parent=trade_header,
            )

    def kill_tally(self, kind: "UnitKindSpec", unit: Any) -> tuple[str, list[int], int]:
        """Kills are credited to members, dead ones included."""
        members: Mapping[int, int] = dict(Henchman.objects.filter(group=unit).values_list("id", "kills"))
        return "henchman", list(members), sum(int(kills or 0) for kills in members.values())
