"""Paying a fee's resources (the fees and skill lists step): each line of a hire fee or an upkeep ("1 Wyrdstone",
"5 Campaign points") is paid from one of the warband's counters: the one the player picked, or else its default
resource for Wyrdstone and the one whose name matches for the rest (`apps/hirelings/fees.py: match_counter`). A
counter never goes below 0, so a short one pays what it holds. A shortage, or a line no counter pays, is a warning,
never a refusal (a guide, not a gatekeeper); a line the player chose not to pay is noted, not warned about. What was
paid goes in the note of the ledger row it goes with.

Callers hold the warband's row (the gold's lock comes first, as everywhere); `locked_counters` then locks its
counters in one query and `pay` writes their new amounts in one UPDATE, whatever the number of lines.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Case, IntegerField, Value, When

from apps.hirelings.fees import match_counter
from apps.warbands.models import WarbandResource


@dataclass(frozen=True)
class ResourceLine:
    """One resource to pay: `counter_id` is the counter the player picked (None: don't pay it); `picked` False lets
    the counter of a matching name pay it."""

    resource: str
    amount: int
    counter_id: int | None = None
    picked: bool = False
    who: str = ""  # the hire or hired sword it pays for, named in its warnings


@dataclass(frozen=True)
class Paid:
    resource: str
    wanted: int
    taken: int
    counter: str | None  # the counter's name; None: nothing paid it


@dataclass
class Payment:
    paid: list[Paid] = field(default_factory=list)
    warnings: list[dict[str, Any]] = field(default_factory=list)

    @property
    def note(self) -> str:
        """What was paid, for the ledger: "Paid 1 Wyrdstone (from Wyrdstone shards). Not paid: 5 Campaign points."."""
        paid, unpaid = [], []
        for line in self.paid:
            if line.counter is None or not line.taken:
                unpaid.append(f"{line.wanted} {line.resource}")
                continue
            source = "" if line.counter.lower() == line.resource.lower() else f" from {line.counter}"
            short = "" if line.taken == line.wanted else f" of {line.wanted}"
            paid.append(f"{line.taken}{short} {line.resource}{source}")
        parts = [f"Paid {', '.join(paid)}." if paid else "", f"Not paid: {', '.join(unpaid)}." if unpaid else ""]
        return " ".join(part for part in parts if part)


def fee_lines(fee: Mapping[str, Any] | None) -> list[ResourceLine]:
    """A fee's own resource lines, each to be paid by the counter of its name."""
    return [ResourceLine(line["resource"], int(line["amount"])) for line in (fee or {}).get("resources") or []]


def sent_lines(lines: Iterable[dict[str, Any]]) -> list[ResourceLine]:
    """Lines as a request or a draft sends them: `resource_id` names the counter (null: don't pay it); a line
    without it is paid by the counter of its name."""
    return [
        ResourceLine(line["resource"], int(line["amount"]), line.get("resource_id"), "resource_id" in line)
        for line in lines
    ]


def locked_counters(warband_id: int) -> list[WarbandResource]:
    """The warband's counters, locked until the caller's transaction ends: one query."""
    return list(WarbandResource.objects.select_for_update().filter(warband_id=warband_id).order_by("id"))


def _counter(line: ResourceLine, counters: Sequence[WarbandResource]) -> WarbandResource | None:
    if line.picked:
        return next((counter for counter in counters if counter.id == line.counter_id), None)
    matched: WarbandResource | None = match_counter(line.resource, counters)
    return matched


def _unpaid(line: ResourceLine, what: str) -> dict[str, Any]:
    message = f"{line.amount} {line.resource} {what}: not paid."
    return {"code": "resource_unpaid", "message": message, "resource": line.resource}


def pay(lines: Sequence[ResourceLine], counters: Sequence[WarbandResource]) -> Payment:
    """Take each line from its counter, at most what the counter still holds, and write the counters that changed
    (one UPDATE). Each line's `who` names the hire or the hired sword in its warnings."""
    payment = Payment()
    left = {counter.id: counter.amount for counter in counters}
    for line in lines:
        prefix = f"{line.who}: " if line.who else ""
        counter = _counter(line, counters)
        if counter is None:
            payment.paid.append(Paid(line.resource, line.amount, 0, None))
            if line.amount and line.picked and line.counter_id is not None:
                payment.warnings.append(_unpaid(line, f"{prefix}is paid from a resource this warband doesn't have"))
            elif line.amount and not line.picked:
                payment.warnings.append(_unpaid(line, f"{prefix}has no resource of that name to pay it"))
            continue
        taken = min(line.amount, left[counter.id])
        left[counter.id] -= taken
        payment.paid.append(Paid(line.resource, line.amount, taken, counter.name))
        if taken < line.amount:
            message = f"{prefix}{counter.name} held {taken}: {taken} of {line.amount} {line.resource} paid."
            payment.warnings.append({"code": "resource_short", "message": message, "resource": line.resource})
    changed = {counter.id: left[counter.id] for counter in counters if left[counter.id] != counter.amount}
    if changed:
        amounts = Case(
            *(When(id=pk, then=Value(amount)) for pk, amount in changed.items()), output_field=IntegerField()
        )
        WarbandResource.objects.filter(id__in=changed).update(amount=amounts)
    return payment
