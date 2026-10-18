"""What a postbattle adds to the warband besides its units: exploration shards, upkeep, finds and their gold.

Upkeep (negative) and the battle reward (positive) are written together through the ledger
(`ledger.record_entries`: one INSERT, one balance UPDATE on the warband row finalise already holds); finds join the
stash at their own cost (services/stash.py; BUG-117: nothing is re-priced).
"""

from collections import defaultdict
from dataclasses import dataclass, field

from django.db.models import F, Min, Q

from apps.items.models import Item
from apps.warbands.models import LedgerAction, WarbandResource
from apps.warbands.services import ledger
from apps.warbands.services.stash import add_costs

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


def upkeep_entry(context: FinaliseContext, upkeep: dict) -> ledger.Entry | None:
    """The Upkeep row: each hired sword still on the roster after this battle, at the cost the draft gives him."""
    if not upkeep.get("pay_upkeep", True):
        return None
    total, lines = 0, []
    for unit_key, entry in upkeep.get("entries", {}).items():
        hired_sword = context.hired_swords.get(parse_unit_key(unit_key)["unit_id"])
        if hired_sword is None or hired_sword.dead or hired_sword.dismissed_at is not None:  # left the roster
            continue
        if entry.get("cost") is None:
            continue
        cost = coerce_int(entry.get("cost"), field_name="postbattle upkeep cost", minimum=0, maximum=999999)
        total += cost
        lines.append(f"{(entry.get('unit_name') or hired_sword.name or unit_key)[:120]}: {cost} gc")
    if total <= 0:
        return None
    return ledger.Entry(context.warband, LedgerAction.UPKEEP, -total, "Post-battle upkeep", notes="\n".join(lines))


def _found_items(context: FinaliseContext, item_ids: list[int]) -> tuple[list[dict], dict[int, list[int | None]]]:
    """Each found item at its cheapest catalogue cost (one query), and the costs per item for the stash."""
    campaign = Q(campaign_id__isnull=True) | Q(campaign_id=context.battle.campaign_id)
    available = {
        item.id: item
        for item in Item.objects.filter(id__in=item_ids).filter(campaign).annotate(cheapest=Min("availabilities__cost"))
    }
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
    entries = [upkeep_entry(context, upkeep)]
    if gold > 0:
        notes = f"Postbattle finds from {context.battle.scenario}"[:2000]
        entries.append(ledger.Entry(context.warband, LedgerAction.REWARD, gold, "Battle reward", notes=notes))
    ledger.record_entries([entry for entry in entries if entry is not None])
    for item_id, item_costs in costs.items():
        add_costs(context.warband.id, item_id, item_costs)
    return Finds(gold_crowns=gold, items=logged)
