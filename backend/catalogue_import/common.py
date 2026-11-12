"""Small helpers shared by every build step: names, slugs, grades and JSON files."""

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

Json = Any

GRADES = ("1a", "1b", "1c", "2a", "2b", "3")
GRADE_RANK = {grade: rank for rank, grade in enumerate(GRADES, start=1)}


def norm_name(name: str) -> str:
    """Case-, hyphen- and spacing-insensitive form of a name: "Two-handed" and "Two Handed" match."""
    text = name.replace(" ", " ").replace("-", " ").replace("_", " ").lower()
    return " ".join(text.split())


def loose_key(name: str) -> str:
    """Letters and digits only, for spotting the same name spelt differently ("Wolfcloak", "Wolf Cloak")."""
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", name).lower())


def slugify(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii").lower()
    text = text.replace("&", " and ").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def normalise_grade(grade: object) -> str | None:
    """A grade code, with mordheimer's "core" as 1a. Anything else is None."""
    if not isinstance(grade, str):
        return None
    code = grade.strip().lower()
    if code == "core":
        return "1a"
    return code if code in GRADE_RANK else None


def majority(values: list[str], rank: dict[str, int] | None = None) -> str | None:
    """The most common value; a tie goes to the lowest rank (or the first seen when no rank is given)."""
    if not values:
        return None
    counts = Counter(values)
    order = {value: index for index, value in reversed(list(enumerate(values)))}

    def key(value: str) -> tuple[int, int]:
        return (-counts[value], rank[value] if rank else order[value])

    return min(counts, key=key)


def unique(values: list[str]) -> list[str]:
    """The values in first-seen order, without repeats."""
    return list(dict.fromkeys(values))


def load_json(path: Path) -> Json:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(data: Json) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def as_list(value: object) -> list[str]:
    """mordheimer writes a one-warband list as a bare string; "all" and missing values give an empty list."""
    if isinstance(value, str):
        return [] if value == "all" else [value]
    if isinstance(value, list):
        return [entry for entry in value if isinstance(entry, str)]
    return []
