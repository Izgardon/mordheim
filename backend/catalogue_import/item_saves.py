"""overrides.json "item_saves": what equipping an item does to its wearer's armour save, and the subtype it shows under.

William, 18 Nov 2026: "Armour items should be viewed as +1 (light), +2 (heavy) etc but if a piece of armoud is equipped
already then ignore subsequent. taking it away should just minus that value up to 6+. Helmets do nothing. Things like
shields and mounting a mount when equipped should plus their value and take away when unequipped, no checks needed on
these its up to user to be normal."

A `bonus` is the save the item prints read as steps from no save, which is 7+: a 6+ item is 1, a 5+ item 2, a 4+ item
3. Its `slot` says whether it competes: only one `body` item counts at a time, while a `shield`, a `mount` and an
`extra` always add and always subtract. A save a condition qualifies ("5+ on foot, 6+ mounted") takes no bonus and
carries `why` instead, because one number can't hold the condition: the item's rules text does the work. A mount's
bonus comes from its kind, not from here (apps/bestiary/animal_items.py).
"""

from typing import Any

SLOTS = ("body", "shield", "mount", "extra")


def set_saves(items: list[dict[str, Any]], decisions: dict[str, Any]) -> None:
    """Write each decision onto the item of that name: its `subtype`, and its `save_bonus` and `save_slot` where it
    has a bonus. A name that is no item of ours, a bonus without a slot or a slot we don't have stops the build."""
    by_name = {item["name"]: item for item in items}
    missing = sorted(set(decisions) - set(by_name))
    if missing:
        raise ValueError(f"overrides.json item_saves: no item {', '.join(missing)}")
    for name, decision in decisions.items():
        item = by_name[name]
        if decision.get("subtype"):
            item["subtype"] = decision["subtype"]
        bonus, slot = decision.get("bonus"), decision.get("slot", "")
        if bonus is None:
            if not decision.get("why"):
                raise ValueError(f"overrides.json item_saves {name!r}: no bonus, so say why in `why`")
            continue
        if slot not in SLOTS:
            raise ValueError(f"overrides.json item_saves {name!r}: slot is {slot!r}, not one of {', '.join(SLOTS)}")
        item["save_bonus"], item["save_slot"] = int(bonus), slot
