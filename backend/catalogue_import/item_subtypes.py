"""overrides.json "item_subtypes": a subtype one source spells its own way -> the one we show (William, 25 Nov 2026:
merge the near-duplicates). The Grade 3 PDFs' "Missile" weapons are our Ranged, Mutiny in Marienburg's "Drug/Poison"
our Poisons and Drugs and its "Vehicle/Watercraft" our Vehicles, so every item of one kind sits under one subtype."""

from typing import Any


def merge_subtypes(items: list[dict[str, Any]], merges: dict[str, str]) -> None:
    """Give each item whose subtype `merges` names the subtype it merges into. A merge into a name that is itself
    merged away would leave a duplicate, so it stops the build."""
    chained = sorted(set(merges) & set(merges.values()))
    if chained:
        raise ValueError(f"overrides.json item_subtypes: {', '.join(chained)} is merged away and merged into")
    for item in items:
        merged = merges.get(item.get("subtype") or "")
        if merged:
            item["subtype"] = merged
