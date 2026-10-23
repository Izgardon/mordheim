"""The differences between unit kinds that are behaviour rather than data (design 0.28 §4.3).

The shared create, update, dismiss and kill-history services call these hooks; `UnitHooks` adds nothing.
Heroes keep one living leader per warband (`LeaderHooks`); henchmen groups carry members, who are
recruited, charged and synced one by one (`HenchmenHooks`).
"""

from collections.abc import Mapping, Set
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, cast

from django.utils import timezone

from apps.logs.utils import log_warband_event
from apps.warbands.models import Henchman, HenchmenGroup, LedgerAction, RosterUnit, Warband, on_roster
from apps.warbands.services import ledger
from apps.warbands.utils.leaders import ensure_single_living_leader, lock_warband

from .services.hire_cost import henchman_hire_cost

if TYPE_CHECKING:
    from .kinds import UnitKindSpec

MemberEntries = list[dict[str, Any]]


@dataclass(frozen=True)
class Recruit:
    """A member a group PATCH added: the entry as sent, and what he costs if the entry names no cost."""

    entry: dict[str, Any]
    default_cost: int


class UnitHooks:
    def after_create(self, unit: RosterUnit, members: MemberEntries | None) -> None:
        """Runs in the create's transaction once the unit and its loadout exist."""

    def before_update(self, unit: RosterUnit, fields: Set[str]) -> None:
        """Runs before a PATCH saves `fields` (the scalar fields it sends)."""

    def after_update(self, unit: RosterUnit, fields: Set[str], members: MemberEntries | None) -> list[Recruit]:
        """Runs once the PATCH saved the unit's fields, before its loadout lists are replaced.

        Returns the members it recruited, to be charged.
        """
        return []

    def record_recruit(self, kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, sent: Any) -> None:
        """The new unit's log row and, when it cost anything, its recruit trade: "Grukk the Ogre Bodyguard", or just
        the name when the unit is named for its type (a hire keeping the default name)."""
        name, unit_type = unit.name or "Unknown", unit.unit_type or "Unknown"
        log_warband_event(warband.id, "personnel", kind.recruit.log_new, {"name": name, "type": unit_type})
        if unit.price and unit.price > 0:
            note = name if name == unit_type else f"{name} the {unit_type}"
            ledger.record(warband, kind.recruit.trade_action, -unit.price, note)

    def record_recruits(self, warband: Warband, unit: RosterUnit, recruits: list[Recruit]) -> None:
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

    def after_update(self, unit: RosterUnit, fields: Set[str], members: MemberEntries | None) -> list[Recruit]:
        if self._may_move_crown(fields):
            self._crown(unit)
        return []

    def before_dismiss(self, warband: Warband) -> None:
        lock_warband(warband.id)

    def after_dismiss(self, warband: Warband) -> None:
        ensure_single_living_leader(warband.id)


MEMBER_FIELDS = ("name", "kills", "dead")


@dataclass(frozen=True)
class MemberSync:
    new_entries: MemberEntries  # the entries that became new members
    living_before: int  # the group's living members before the sync


def sync_members(group: HenchmenGroup, entries: MemberEntries) -> MemberSync:
    """Apply a PATCH's member list to `group`: the entries that became new members, and the living count before.

    An entry naming a living member updates only the fields it carries (BUG-94); an entry without a
    known id is a new member. Living members left out of the list are dismissed: kept as records with
    their kills (decision 4). Dead and dismissed members are records (BUG-04): this path never edits,
    duplicates (BUG-92) or deletes them, however the caller loaded the group, so an entry naming one is
    ignored. A fixed number of writes, however many members the group has (PERF-28).
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
        if member.dead or member.dismissed_at is not None:
            continue
        fields = sent.setdefault(member.id, set())
        for name in MEMBER_FIELDS:
            if name in entry:
                fields.add(name)
                if getattr(member, name) != entry[name]:
                    setattr(member, name, entry[name])
                    changed_ids.add(member.id)

    removed_ids = {
        member.id
        for member in members.values()
        if not member.dead and member.dismissed_at is None and member.id not in sent
    }
    if removed_ids:
        on_roster(Henchman.objects.filter(group=group, id__in=removed_ids)).update(dismissed_at=timezone.now())
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
    living_before = sum(1 for member in members.values() if not member.dead and member.dismissed_at is None)
    return MemberSync(new_entries, living_before)


def _parse_henchman_cost(value: Any) -> int | None:
    if value is None:
        return None
    try:
        numeric = int(float(value))
    except (TypeError, ValueError):
        return None
    return max(numeric, 0)


def _hire_cost_before_loadout(group: HenchmenGroup, living_members: int) -> int:
    """Decision 7's cost of one more member, from the items the group carried before this PATCH replaced them.

    The PATCH's own item list may already hold the recruits' copies, and items bought in the same save are
    paid for by their own purchases, so only the earlier items are shared out. Price and XP are as saved.
    """
    rows = group.henchmen_group_items.order_by("id").values_list("item_id", "cost")
    return henchman_hire_cost(group.price, group.xp, rows, living_members)


def _recruit_headers(warband: Warband, group_name: str, count: int, trade_text: str) -> tuple[Any, Any]:
    """With more than one recruit, the trade and log rows the recruits are grouped under."""
    if count <= 1:
        return None, None
    trade_header = ledger.group_header(warband, trade_text)
    log_header = log_warband_event(
        warband.id, "personnel", "new_henchmen_group_batch", {"name": group_name, "count": count}
    )
    return trade_header, log_header


class HenchmenHooks(UnitHooks):
    """Henchmen groups: members are created, synced, charged and logged one by one."""

    def after_create(self, unit: RosterUnit, members: MemberEntries | None) -> None:
        group = cast(HenchmenGroup, unit)
        Henchman.objects.bulk_create([Henchman(group=group, name=entry.get("name", "")) for entry in members or []])

    def after_update(self, unit: RosterUnit, fields: Set[str], members: MemberEntries | None) -> list[Recruit]:
        if members is None:
            return []
        group = cast(HenchmenGroup, unit)
        synced = sync_members(group, members)
        if not synced.new_entries:
            return []
        default_cost = _hire_cost_before_loadout(group, synced.living_before)
        return [Recruit(entry, default_cost) for entry in synced.new_entries]

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
            charges = [
                ledger.Entry(
                    warband,
                    kind.recruit.trade_action,
                    -group.price,
                    f"{member.name or 'Unnamed Henchman'} into {group_name}",
                    item_notes,
                    trade_header,
                )
                for member in members
            ]
            ledger.record_entries(charges)

    def record_recruits(self, warband: Warband, unit: RosterUnit, recruits: list[Recruit]) -> None:
        """One log row and one trade per member a PATCH added, at the entry's cost or decision 7's cost.

        An entry naming any existing member, dead or dismissed ones too, is never a recruit (BUG-92); ids
        are matched as ints (BUG-93).
        """
        group = cast(HenchmenGroup, unit)
        group_name = group.name or group.unit_type or "Unknown Group"
        trade_header, log_header = _recruit_headers(
            warband, group_name, len(recruits), f"Recruited {len(recruits)} into {group_name}"
        )
        charges = []
        for recruit in recruits:
            entry, default_cost = recruit.entry, recruit.default_cost
            henchman_name = entry.get("name") or "Unnamed Henchman"
            entry_cost = _parse_henchman_cost(entry.get("cost"))
            log_warband_event(
                warband.id,
                "personnel",
                "new_henchman",
                {"name": henchman_name, "group": group_name},
                parent_id=log_header.id if log_header else None,
            )
            cost = entry_cost if entry_cost is not None else default_cost
            notes = str(entry.get("item_notes") or "")
            charges.append(
                ledger.Entry(
                    warband, LedgerAction.RECRUIT, -abs(cost), f"{henchman_name} into {group_name}", notes, trade_header
                )
            )
        ledger.record_entries(charges)

    def kill_tally(self, kind: "UnitKindSpec", unit: Any) -> tuple[str, list[int], int]:
        """Kills are credited to members, dead and dismissed ones included."""
        members: Mapping[int, int] = dict(Henchman.objects.filter(group=unit).values_list("id", "kills"))
        return "henchman", list(members), sum(int(kills or 0) for kills in members.values())
