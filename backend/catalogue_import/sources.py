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
SKILL_DATA = BACKEND / "apps" / "skills" / "data"
HIRELING_DATA = BACKEND / "apps" / "hirelings" / "data"
SKILL_FILES = ("cavalcade-skills.json",)  # skill rules mordheimer's skills list lacks (new_skill_groups `source`)


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
    # our seeded catalogue, which out/setting-assignments.json gives a setting (grading phase 1); our dramatis personae
    # are mordheimer's, made into seed rows by the build (personae.py, out/dramatis-personae.json)
    our_skills: list[dict[str, Any]] = field(default_factory=list)
    our_hired_swords: list[dict[str, Any]] = field(default_factory=list)
    our_personae: list[dict[str, Any]] = field(default_factory=list)
    skill_files: dict[str, list[dict[str, Any]]] = field(default_factory=dict)  # SKILL_FILES, by file name


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
        our_skills=_values(load_json(SKILL_DATA / "skills.json")),
        our_hired_swords=_values(load_json(HIRELING_DATA / "hired-swords.json")),
        skill_files={name: _values(load_json(src / name)) for name in SKILL_FILES},
    )
