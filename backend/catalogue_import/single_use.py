"""overrides.json "single_use_items": the items a battle uses up (William, 26 Nov 2026: "Yes go with that one-use list
but none of the not sure items").

mordheimer doesn't say which items are used up, so the items rebuild left only the Swivel Gun's shots marked (they
come from the warband templates: warband_items.py). Each name here is marked `single_use`, which lets a unit use it in
battle and takes one copy off him when his battle finishes (apps/battles/services/postbattle/items.py). A name that is
no item of ours stops the build.
"""

from typing import Any


def set_single_use(items: list[dict[str, Any]], names: list[str]) -> None:
    by_name: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        by_name.setdefault(item["name"], []).append(item)
    missing = sorted(set(names) - set(by_name))
    if missing:
        raise ValueError(f"overrides.json single_use_items: no item {', '.join(missing)}")
    for name in names:
        for item in by_name[name]:  # every variant of it
            item["single_use"] = True
