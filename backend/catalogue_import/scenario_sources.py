"""The campaign PDFs' scenarios (William, 25 Nov 2026), from `sources/scenarios-2026-11-25/pdf/<setting>.json`: each
file one setting's document, its scenarios already in the scenario shape (read from the PDF and corrected against
its pages; `tools/pdf-scenarios/` made the first draft), their headings named as the pages' are (`heading`).

An entry with a `base` is a variation the book prints of a scenario we hold (Sartosa's "In the Drink!" for Street
Fight, Mousillon's Hell Hath No Fury for Skirmish): it reads as that scenario, its opening lines and sections, with
the book's changes as a first section under the variation's title, so a player who draws it reads one whole
scenario. A book that only renames one of ours with no change ("Treasure Hunt (as Wyrdstone Hunt)") is no variation:
its table links ours.
"""

from pathlib import Path
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.scenarios import SETTING_SNAPSHOT, heading

PDF_FOLDER = SETTING_SNAPSHOT / "pdf"
FIELDS = ("slug", "name", "number", "source", "players", "summary", "intro", "sections")
PLAYERS = frozenset({"1v1", "multiplayer", "either"})


def _check(entry: dict[str, Any], label: str) -> None:
    if not entry.get("slug") or not entry.get("name") or entry.get("players", "base") not in PLAYERS | {"base"}:
        raise ValueError(f"scenarios: {label}: each scenario needs a slug, a name and players")
    if "base" in entry:
        if not entry.get("title") or not entry.get("text"):
            raise ValueError(f"scenarios: {label}: the variation {entry['slug']} needs its title and text")
    elif not entry.get("sections") or not all(section.get("title") for section in entry["sections"]):
        raise ValueError(f"scenarios: {label}: {entry['slug']} needs its sections, each titled")


def read_pdf_sources(folder: Path = PDF_FOLDER) -> list[dict[str, Any]]:
    """Every file's scenarios and variations, each with its folder (the setting's) and the document it is from."""
    found = []
    for path in sorted(folder.glob("*.json")):
        data = load_json(path)
        for entry in data["scenarios"]:
            _check(entry, path.name)
            found.append({**entry, "folder": path.stem, "document": data["document"]})
    return found


def variation(entry: dict[str, Any], base: dict[str, Any]) -> dict[str, Any]:
    """A variation as one whole scenario: the book's changes first, then the scenario it varies."""
    changes = {"title": entry["title"], "text": entry["text"], "tables": entry.get("tables", [])}
    return {
        "slug": entry["slug"],
        "name": entry["name"],
        "number": entry.get("number", ""),
        "source": entry["source"],
        "players": entry.get("players", base["players"]),
        "summary": entry.get("summary") or f"{base['name']} with {entry['source']}'s changes.",
        "intro": base["intro"],
        "sections": [changes, *base["sections"]],
        "base": base["slug"],
        "folder": entry["folder"],
    }


def pdf_scenarios(entries: list[dict[str, Any]], held: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """The PDFs' scenarios in the import's shape, a variation read onto the scenario it varies."""
    found = []
    for entry in entries:
        if "base" in entry:
            if entry["base"] not in held:
                raise ValueError(f"scenarios: {entry['slug']} varies {entry['base']}, which no scenario is")
            found.append(variation(entry, held[entry["base"]]))
        else:
            sections = [{**section, "title": heading(section["title"])} for section in entry["sections"]]
            fields = {key: entry.get(key, "") for key in FIELDS}
            found.append({**fields, "sections": sections, "folder": entry["folder"]})
    return found
