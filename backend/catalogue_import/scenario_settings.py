"""Which scenarios each setting beyond Mordheim 1a adds, and how often each is drawn (William, 25 Nov 2026), from
`sources/scenarios-2026-11-25/settings.json`: each setting's own scenario tables as its book prints them.

A result's weight is its chance in 36ths, whatever its dice: a 2D6 total 2 or 12 is 1 up to 7's 6, a D6 face is 6,
a 3D6 total its ways of falling over 6 ("doesn't need to be exact"); a span adds its numbers, and a result that rolls
again between two scenarios ("5: roll a D6, 1-4 Wyrdstone Hunt, 5-6 Gunpowder Plot") gives each its `share`. A
scenario on two of a setting's tables (Empire in Flames' two-player and multiplayer ones) adds both, as a draw
from either table would find it. A setting with no table (the Nemesis Crown's territory suggestions) weighs each
of its scenarios 1. A scenario of the setting's own that no table rolls (Border Town Burning's specials, unlocked by
an objective; Empire in Flames' Beastmen scenarios, for a game with a Beastmen warband) is listed at 0, pickable and
never drawn. A row naming a scenario we don't hold is kept as `missing` for the report, never guessed.
"""

from fractions import Fraction
from itertools import product
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.scenarios import SETTING_SNAPSHOT

SETTINGS_FILE = SETTING_SNAPSHOT / "settings.json"
WAYS = {  # each total's chance in 36ths
    "2D6": {total: Fraction(6 - abs(total - 7)) for total in range(2, 13)},
    "D6": {face: Fraction(6) for face in range(1, 7)},
    "3D6": {
        total: Fraction(sum(1 for dice in product(range(1, 7), repeat=3) if sum(dice) == total), 6)
        for total in range(3, 19)
    },
}


def roll_weight(dice: str, rolls: str) -> Fraction:
    low, _, high = rolls.partition("-")
    chances = WAYS[dice]
    return sum((chances[total] for total in range(int(low), int(high or low) + 1)), Fraction(0))


def _number(weight: Fraction) -> int | float:
    return int(weight) if weight.denominator == 1 else round(float(weight), 2)


def setting_weights(setting: dict[str, Any], slugs: set[str]) -> dict[str, Any]:
    """One setting's scenarios with their weights and where each came from, and the rows we hold nothing for."""
    weights: dict[str, Fraction] = {}
    rolled: dict[str, list[str]] = {}
    missing = []
    for table in setting.get("tables", []):
        for row in table["rows"]:
            if "slug" not in row:
                missing.append({"table": table["table"], "rolls": row["rolls"], "name": row["name"]})
                continue
            if row["slug"] not in slugs:
                raise ValueError(f"scenarios: {setting['setting']}'s {table['table']} names {row['slug']}, none is")
            weight = roll_weight(table["dice"], row["rolls"]) * Fraction(row.get("share", "1"))
            weights[row["slug"]] = weights.get(row["slug"], Fraction(0)) + weight
            rolled.setdefault(row["slug"], []).append(f"{table['table']} {row['rolls']}")
    for slug in setting.get("each", []):
        weights.setdefault(slug, Fraction(1))
        rolled.setdefault(slug, []).append("no table: 1")
    for row in setting.get("listed", []):
        if row["slug"] in weights:
            raise ValueError(f"scenarios: {setting['setting']} lists {row['slug']} at 0 and rolls it too")
        weights[row["slug"]] = Fraction(0)
        rolled[row["slug"]] = [f"listed at 0: {row['why']}"]
    unknown = sorted(set(weights) - slugs)
    if unknown:
        raise ValueError(f"scenarios: {setting['setting']} names {', '.join(unknown)}, which no scenario is")
    return {
        "setting": setting["setting"],
        "table": "; ".join(table["table"] for table in setting.get("tables", [])) or "no table",
        "scenarios": [
            {"slug": slug, "rolls": "; ".join(rolled[slug]), "weight": _number(weight)}
            for slug, weight in weights.items()
        ],
        "missing": missing + setting.get("missing", []),
        "from": setting["from"],
    }


def build_settings(slugs: set[str], path: Any = SETTINGS_FILE) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Every setting's scenarios at their weights, and the settings that hold none of their own (with why)."""
    data = load_json(path)
    return [setting_weights(setting, slugs) for setting in data["settings"]], data["none"]
