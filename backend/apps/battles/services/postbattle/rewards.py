"""What a postbattle adds to the warband besides its units: exploration shards, upkeep, finds and their gold.

Upkeep (negative) and the battle reward (positive) are written together through the ledger
(`ledger.record_entries`: one INSERT, one balance UPDATE on the warband row finalise already holds); finds join the
stash at their own cost (services/stash.py; BUG-117: nothing is re-priced).
An upkeep's resources (the fees and skill lists step) are paid from the warband's counters, the one each line names or
else the one of its name, never below 0 (apps/warbands/units/services/fee_payments.py), and noted on the Upkeep row.
"""

from collections import defaultdict
from dataclasses import dataclass, field, replace

from django.db.models import F, Min

from apps.core.catalogue.current import resolve
from apps.items.models import Item
from apps.warbands.models import LedgerAction, WarbandResource
from apps.warbands.services import ledger
from apps.warbands.services.stash import add_costs
from apps.warbands.units.services.fee_payments import Payment, ResourceLine, locked_counters, pay, sent_lines

from ...validation.coerce import coerce_int
from ...validation.unit_keys import parse_unit_key
from ..exploration import exploration_amount
from .context import FinaliseContext


@dataclass
class Exploration:
    amount: int
    resource_name: str | None


@dataclass
class Finds:
    gold_crowns: int = 0
    items: list[dict] = field(default_factory=list)  # each found item as logged: id, name, type and cost
    warnings: list[dict] = field(default_factory=list)  # an upkeep resource paid short, or by no counter


def apply_exploration(context: FinaliseContext, exploration: dict) -> Exploration:
    """Add the shards found (the server's chart, or the override: decision 9) to the chosen resource."""
    resource_id = exploration.get("resource_id")
    amount = exploration_amount(exploration)
    if resource_id is None or amount <= 0:
        return Exploration(amount, None)
    resources = WarbandResource.objects.filter(id=resource_id, warband_id=context.warband.id)
    if not resources.update(amount=F("amount") + amount):
        raise ValueError("Selected exploration resource is invalid")
    return Exploration(amount, context.resource_name)


@dataclass
class Upkeep:
    """What the draft's upkeep charges: the Upkeep row (None when it charges nothing) and what paying its resources
    warned about."""

    entry: ledger.Entry | None
    warnings: list[dict]


def _owed(context: FinaliseContext, upkeep: dict) -> list[tuple[str, int, list[ResourceLine]]]:
    """Each hired sword still on the roster after this battle, with the gold and resources the draft gives him; one
    missing games owes none for the battle he missed."""
    owed = []
    for unit_key, entry in upkeep.get("entries", {}).items():
        hireling = context.hirelings.get(parse_unit_key(unit_key)["unit_id"])
        if hireling is None or hireling.dead or hireling.dismissed_at is not None:  # left the roster
            continue
        if hireling.missing_games:  # read before finalise counts this battle off
            continue
        name = (entry.get("unit_name") or hireling.name or unit_key)[:120]
        cost = entry.get("cost")
        gold = 0 if cost is None else coerce_int(cost, field_name="postbattle upkeep cost", minimum=0, maximum=999999)
        lines = [replace(line, who=name) for line in sent_lines(entry.get("resources") or [])]
        if cost is not None or lines:
            owed.append((name, gold, lines))
    return owed


def upkeep_charge(context: FinaliseContext, upkeep: dict) -> Upkeep:
    """The Upkeep row: each hired sword's gold, and his resources paid from the warband's counters (locked and written
    once, only when some are owed), each noted on its line."""
    if not upkeep.get("pay_upkeep", True):
        return Upkeep(None, [])
    owed = _owed(context, upkeep)
    lines = [line for _name, _gold, resource_lines in owed for line in resource_lines]
    payment = pay(lines, locked_counters(context.warband.id)) if lines else Payment()
    notes, start = [], 0
    for name, gold, resource_lines in owed:
        paid = Payment(payment.paid[start : start + len(resource_lines)]).note
        start += len(resource_lines)
        notes.append(f"{name}: {gold} gc" + (f"; {paid}" if paid else ""))
    total = sum(gold for _name, gold, _lines in owed)
    if total <= 0 and not lines:
        return Upkeep(None, payment.warnings)
    entry = ledger.Entry(context.warband, LedgerAction.UPKEEP, -total, "Post-battle upkeep", notes="\n".join(notes))
    return Upkeep(entry, payment.warnings)


def _found_items(context: FinaliseContext, item_ids: list[int]) -> tuple[list[dict], dict[int, list[int | None]]]:
    """Each found item at its cheapest catalogue cost (one query), and the costs per item for the stash. A found
    item is the campaign's current one: its version of a book item, or after a Revert the book item (CAT-TWEAK-03)."""
    rows = Item.objects.annotate(cheapest=Min("availabilities__cost"))
    available = resolve(rows, "items", item_ids, context.battle.campaign_id)
    logged: list[dict] = []
    costs: defaultdict[int, list[int | None]] = defaultdict(list)
    for item_id in item_ids:
        item = available.get(item_id)
        if not item:
            raise ValueError("One or more found items are no longer available")
        cheapest = getattr(item, "cheapest", None)
        if cheapest is None:
            raise ValueError("One or more found items no longer have an available cost")
        cost = int(cheapest)
        costs[item.id].append(cost)
        logged.append({"item_id": item.id, "name": item.name, "type": item.type, "cost": cost})
    return logged, costs


def apply_upkeep_and_finds(context: FinaliseContext, upkeep: dict, finds: dict) -> Finds:
    """Charge upkeep, add the found items to the stash and the gold found as the battle reward."""
    gold = coerce_int(finds.get("gold_crowns", 0), field_name="postbattle finds gold_crowns", minimum=0, maximum=999999)
    item_ids = [
        coerce_int(entry.get("item_id"), field_name="postbattle finds item_id", minimum=1)
        for entry in finds.get("items", [])
    ]
    logged, costs = _found_items(context, item_ids) if item_ids else ([], {})
    charged = upkeep_charge(context, upkeep)  # its resources first: finalise already holds the warband's row
    entries = [charged.entry]
    if gold > 0:
        notes = f"Postbattle finds from {context.battle.scenario}"[:2000]
        entries.append(ledger.Entry(context.warband, LedgerAction.REWARD, gold, "Battle reward", notes=notes))
    ledger.record_entries([entry for entry in entries if entry is not None])
    for item_id, item_costs in costs.items():
        add_costs(context.warband.id, item_id, item_costs)
    return Finds(gold_crowns=gold, items=logged, warnings=charged.warnings)
