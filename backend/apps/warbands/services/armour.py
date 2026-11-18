"""What equipping and unequipping an item does to a unit's stored armour save (William, 18 Nov 2026).

His words: "Armour items should be viewed as +1 (light), +2 (heavy) etc but if a piece of armoud is equipped already
then ignore subsequent. taking it away should just minus that value up to 6+. Helmets do nothing. Things like shields
and mounting a mount when equipped should plus their value and take away when unequipped, no checks needed on these
its up to user to be normal. All these changes should happen from the current set value not what you think the value
should be."

So nothing here works out what a save ought to be: it moves the number the unit holds by the steps the copies that
arrived or left are worth (`Item.save_bonus`, read from the save the item prints with no save as 7+). The save stays
a plain field the player can type over afterwards, and nothing is ever refused.

`Item.save_slot` says whether an item competes. A `body` item counts one at a time, and the oldest row the unit
carries is the one counting: a second adds nothing, and when the one counting leaves, the next oldest takes its place
in the same move (light then heavy leaves 6+, and taking the light off then gives 5+). A `shield` and an `extra`
always apply, with no checks at all. A `mount` applies only while it is switched on as the unit's, so its steps come
and go with the switch (units/services/companions.py); they are its beast's own, so a Cold One is worth two
(apps/bestiary/animal_items.py). A henchmen group is one unit with one save: its loadout row
applies once to the group, and a member's gap on it changes nothing.

Callers write inside their own transaction, under the warband's lock (every roster write takes it), so reading the
unit's save and moving it is safe here.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from django.db.models import Case, F, SmallIntegerField, Value, When

from apps.items.models import SAVE_BODY, SAVE_MOUNT
from apps.warbands.models import RosterUnit
from apps.warbands.utils.armour_save import move_armour_save

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec

Row = tuple[int, bool]  # an item row: its id and whether it was switched on as a companion


@dataclass(frozen=True)
class Save:
    """What an item does to the save of the unit carrying it: its steps and the slot they sit in ("" for neither)."""

    bonus: int | None
    slot: str

    @classmethod
    def of(cls, item: Any) -> "Save":
        return cls(item.save_bonus, item.save_slot)

    @property
    def moves(self) -> bool:
        return bool(self.bonus) and bool(self.slot)


def equipped(kind: "UnitKindSpec", unit: RosterUnit, save: Save, copies: int = 1, *, companion: bool = False) -> None:
    """Move the unit's save for `copies` of an item arriving, **before** the rows are written (the body slot reads
    what he carries already). `companion`: they arrive switched on, which is what a mount's step waits for."""
    _move(kind, unit, _arrival(kind, unit, save, copies, companion))


def unequipped(kind: "UnitKindSpec", unit: RosterUnit, save: Save, rows: Sequence[Row]) -> None:
    """Move the unit's save for the rows that left, **after** they are gone (the body slot reads what he still
    carries, so the next body item takes over in the same move)."""
    _move(kind, unit, _departure(kind, unit, save, rows))


def mount_switched(kind: "UnitKindSpec", unit: RosterUnit, save: Save, on: bool) -> None:
    """Move the unit's save for its mount switched on or off: riding it is what its step is for."""
    if not save.moves or save.slot != SAVE_MOUNT:
        return
    bonus = save.bonus or 0
    _move(kind, unit, bonus if on else -bonus)


def mounts_lost(kind: "UnitKindSpec", save: Save, rows: Mapping[int, Sequence[Row]]) -> None:
    """The mounts of several riders dying at once (postbattle): each rider's save moves back by what his ridden rows
    were worth, in one read and one write however many riders there are (`rows` by unit id). The mount slot needs no
    reading of what a unit carries, so the whole move is this arithmetic."""
    if not save.moves or save.slot != SAVE_MOUNT or not rows:
        return
    moves = []
    for unit in kind.objects.filter(pk__in=list(rows)).only("id", "armour_save"):
        moved = move_armour_save(unit.armour_save, _departure(kind, unit, save, rows[unit.pk]))
        if moved != unit.armour_save:
            moves.append(When(pk=unit.pk, then=Value(moved, output_field=SmallIntegerField())))
    if moves:
        kind.objects.filter(pk__in=list(rows)).update(armour_save=Case(*moves, default=F("armour_save")))


def _arrival(kind: "UnitKindSpec", unit: RosterUnit, save: Save, copies: int, companion: bool) -> int:
    if not save.moves or copies <= 0:
        return 0
    bonus = save.bonus or 0
    if save.slot == SAVE_MOUNT:
        return bonus * copies if companion else 0
    if save.slot == SAVE_BODY:  # one body item counts at a time: a second adds nothing
        return 0 if _body_rows(kind, unit) else bonus
    return bonus * copies


def _departure(kind: "UnitKindSpec", unit: RosterUnit, save: Save, rows: Sequence[Row]) -> int:
    if not save.moves or not rows:
        return 0
    bonus = save.bonus or 0
    if save.slot == SAVE_MOUNT:
        return -bonus * sum(1 for _row_id, ridden in rows if ridden)
    if save.slot != SAVE_BODY:
        return -bonus * len(rows)
    left = _body_rows(kind, unit)  # what he still carries, oldest first
    if left and left[0][0] < min(row_id for row_id, _ridden in rows):
        return 0  # an older body item was the one counting, and still is
    return -bonus + (left[0][1] if left else 0)  # the next oldest takes over in the same move


def _body_rows(kind: "UnitKindSpec", unit: RosterUnit) -> list[tuple[int, int]]:
    """The unit's rows of body armour, oldest first, as (row id, its item's steps): one query, for a body item only."""
    links: Any = kind.items.model._default_manager
    rows = links.filter(**{kind.parent_field: unit, "item__save_slot": SAVE_BODY})
    return [(row_id, bonus or 0) for row_id, bonus in rows.order_by("id").values_list("id", "item__save_bonus")]


def _move(kind: "UnitKindSpec", unit: RosterUnit, steps: int) -> None:
    """Move the unit's stored save `steps` better (negative: worse), on the row and on `unit`."""
    save = move_armour_save(unit.armour_save, steps)
    if save == unit.armour_save:
        return
    kind.objects.filter(pk=unit.pk).update(armour_save=save)
    unit.armour_save = save
