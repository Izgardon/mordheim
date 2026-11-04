"""mordheimer's New Warband Format snapshot (`sources/testwarbands-2026-10-31/`, 31 Oct 2026): its warband pages, its
spell lists and the test pages' URLs, read for the warband templates and the items they bring in."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SNAPSHOT = Path(__file__).resolve().parent / "sources" / "testwarbands-2026-10-31"


@dataclass
class Snapshot:
    pages: dict[str, dict[str, Any]]  # page slug -> the page's warband, in slug order
    magic: dict[str, Any]
    manifest: dict[str, str]  # page slug -> its test page's URL


def _read(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_snapshot(root: Path = SNAPSHOT) -> Snapshot:
    pages = {path.stem: _read(path) for path in sorted((root / "warbands").glob("*.json"))}
    manifest = {row["slug"]: row["page"] for row in _read(root / "manifest.json")["warbandPages"]}
    return Snapshot(pages, _read(root / "magic.json"), manifest)
