"""Loads the snapshots in ``sources/`` and the repo's own item data. Nothing outside the repo is read."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from catalogue_import.common import Json, load_json

PACKAGE = Path(__file__).resolve().parent
BACKEND = PACKAGE.parent
SOURCES = PACKAGE / "sources"
OUT = PACKAGE / "out"
ITEM_DATA = BACKEND / "apps" / "items" / "data"


@dataclass
class Sources:
    items: list[dict[str, Any]]
    skills: list[dict[str, Any]]
    hired_swords: list[dict[str, Any]]
    personae: list[dict[str, Any]]
    warbands: list[dict[str, Any]]
    mim_items: list[dict[str, Any]]
    properties: dict[int, dict[str, Any]]
    seed_names: list[str]
    overrides: dict[str, Any] = field(default_factory=dict)


def _values(data: Json) -> list[dict[str, Any]]:
    """mordheimer ships some lists as objects keyed by slug; their order is the file's."""
    rows = data if isinstance(data, list) else list(data.values())
    return [row for row in rows if isinstance(row, dict)]


def load_sources(package: Path = PACKAGE, item_data: Path = ITEM_DATA) -> Sources:
    src = package / "sources"
    properties = {int(row["id"]): row for row in load_json(item_data / "item-properties.json")}
    return Sources(
        items=_values(load_json(src / "mordheimer-items.json")),
        skills=_values(load_json(src / "mordheimer-skills.json")),
        hired_swords=_values(load_json(src / "mordheimer-hired-swords.json")),
        personae=_values(load_json(src / "mordheimer-dramatis-personae.json")),
        warbands=_values(load_json(src / "warbands-merged.json")),
        mim_items=_values(load_json(item_data / "mim-items.json")),
        properties=properties,
        seed_names=[row["name"] for row in _values(load_json(item_data / "standard-items.json"))],
        overrides=load_json(package / "overrides.json"),
    )
