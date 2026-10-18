"""What a postbattle adds to the warband besides its units: exploration shards, upkeep, finds and their gold.

Gold changes go through the ledger (`ledger.record`: upkeep negative, the battle reward positive) and finds join
the stash at their own cost (services/stash.py; BUG-117: nothing is re-priced).
"""

from collections import defaultdict
from dataclasses import dataclass, field

from django.db.models import Q

from apps.items.models import Item
from apps.warbands.models import HiredSword, LedgerAction, Warband, WarbandResource, on_roster
from apps.warbands.services import ledger
from apps.warbands.services.stash import add_costs

from ...models import Battle
from ...validation.coerce import coerce_int
from ...validation.unit_keys import parse_unit_key
from ..exploration import exploration_amount


@dataclass
class Exploration:
    amount: int
    resource_name: str | None


@dataclass
class Finds:
    gold_crowns: int = 0
    items: list[dict] = field(default_factory=list)  # each found item as logged: id, name, type and cost


def apply_exploration(warband: Warband, exploration: dict) -> Exploration:
    """Add the shards found (the server's chart, or the override: decision 9) to the chosen resource."""
    resource_id = exploration.get("resource_id")
    amount = exploration_amount(exploration)
    if resource_id is None or amount <= 0:
        return Exploration(amount, None)
    resource = WarbandResource.objects.select_for_update().filter(id=resource_id, warband_id=warband.id).first()
    if not resource:
        raise ValueError("Selected exploration resource is invalid")
    resource.amount += amount
    resource.save(update_fields=["amount"])
    return Exploration(amount, resource.name)


def apply_upkeep(warband: Warband, upkeep: dict) -> None:
    """Charge each hired sword still on the roster his upkeep, as one Upkeep row."""
    if not upkeep.get("pay_upkeep", True):
        return
    entries = upkeep.get("entries", {})
    ids = [parse_unit_key(unit_key)["unit_id"] for unit_key in entries]
    swords = HiredSword.objects.select_for_update().filter(id__in=[i for i in ids if i is not None], warband=warband)
    active = {sword.id: sword for sword in on_roster(swords)}
    total, lines = 0, []
    for unit_key, entry in entries.items():
        parsed_unit = parse_unit_key(unit_key)
        hired_sword = active.get(parsed_unit["unit_id"]) if parsed_unit["unit_type"] == "hired_sword" else None
        if not hired_sword or entry.get("cost") is None:
            continue
        cost = coerce_int(entry.get("cost"), field_name="postbattle upkeep cost", minimum=0, maximum=999999)
        total += cost
        lines.append(f"{(entry.get('unit_name') or hired_sword.name or unit_key)[:120]}: {cost} gc")
    if total > 0:
        ledger.record(warband, LedgerAction.UPKEEP, -total, "Post-battle upkeep", notes="\n".join(lines))


def _find_cost(item: Item) -> int | None:
    costs = [availability.cost for availability in item.availabilities.all() if availability.cost is not None]
    return int(min(costs)) if costs else None


def apply_finds(warband: Warband, battle: Battle, finds: dict) -> Finds:
    """Add found items to the stash at their cheapest catalogue cost, and the gold found as a Reward row."""
    gold = coerce_int(finds.get("gold_crowns", 0), field_name="postbattle finds gold_crowns", minimum=0, maximum=999999)
    result = Finds(gold_crowns=gold)
    item_ids = [
        coerce_int(entry.get("item_id"), field_name="postbattle finds item_id", minimum=1)
        for entry in finds.get("items", [])
    ]
    if item_ids:
        available = {
            item.id: item
            for item in Item.objects.filter(id__in=item_ids)
            .filter(Q(campaign_id__isnull=True) | Q(campaign_id=battle.campaign_id))
            .prefetch_related("availabilities")
        }
        costs: defaultdict[int, list[int | None]] = defaultdict(list)
        for item_id in item_ids:
            item = available.get(item_id)
            if not item:
                raise ValueError("One or more found items are no longer available")
            cost = _find_cost(item)
            if cost is None:
                raise ValueError("One or more found items no longer have an available cost")
            costs[item.id].append(cost)
            result.items.append({"item_id": item.id, "name": item.name, "type": item.type, "cost": cost})
        for item_id, item_costs in costs.items():
            add_costs(warband.id, item_id, item_costs)
    if gold > 0:
        notes = f"Postbattle finds from {battle.scenario}"[:2000]
        ledger.record(warband, LedgerAction.REWARD, gold, "Battle reward", notes=notes)
    return result
