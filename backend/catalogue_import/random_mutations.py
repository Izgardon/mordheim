"""The random mutation table (William, 5 Nov 2026): mordheimer's Power in the Stones table, first printed in Town Cryer
#15 (`sources/random-mutations.json`: each D66 result's roll and its name as the table prints it), into
`out/random-mutations.json`, which postbattle's D100 Mutation rolls on (apps/battles/services/random_mutations.py).

Each result gives one shared special (`apps/special/data/shared-specials.json`), matched by what it does, not its
name: a result that does what a special we have does is that special, the table's name its alias (Acid Spray is Spit
Acid, Eyestalks is Hideous, Moronic is Stupidity; William, 5 Nov 2026: Beaked is Tchar's Beak, Fangs and Burning Body
Arkhar's and Tchar's), and keeps its family and its price, in Mordheim 1a as every special the table gives; one that
does what none does is a special of its own, worded from the table, kept apart (`apart_from`) from a family's of its
name or like it whose effect differs (Plague Bearer and Plague Carrier). A result that names no shared special stops
the build."""

from typing import Any

from catalogue_import.common import load_json
from catalogue_import.shared_specials import SharedSpecials, key
from catalogue_import.sources import SOURCES

RANDOM_SOURCE = SOURCES / "random-mutations.json"
D66 = [tens * 10 + units for tens in range(1, 7) for units in range(1, 7)]


def build_random_mutations(shared: SharedSpecials, source: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Each result in roll order with the special it gives (its name and type)."""
    table = source if source is not None else load_json(RANDOM_SOURCE)
    results = table["results"]
    rolls = [row["roll"] for row in results]
    if rolls != D66:
        raise ValueError(f"random-mutations.json: the rolls aren't 11-66 once each in order: {rolls}")
    rows = []
    for row in results:
        entry = shared.names.get(key(row["name"]))
        if entry is None:
            raise ValueError(f"random-mutations.json: {row['roll']} {row['name']} names no shared special")
        rows.append(
            {
                "roll": row["roll"],
                "name": row["name"],
                "special": {"name": entry["name"], "type": entry["type"]},
            }
        )
    return rows


def render_random(rows: list[dict[str, Any]], shared: SharedSpecials) -> str:
    """The report's Random mutation table section: each result, the special it gives, its family, price and setting,
    and the specials kept apart from a family's."""
    entries = {entry["name"]: entry for entry in shared.entries}
    lines = [
        "## Random mutation table",
        "",
        "`sources/random-mutations.json` (mordheimer's Power in the Stones, Town Cryer #15) as"
        " `out/random-mutations.json`: what each D66 result gives when the D100 serious injury result 100, Mutation,"
        " rolls on it. A result matched to a special by what it does names it.",
        "",
        "| D66 | Result | Special | Type | Cost | Setting |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        special = row["special"]["name"]
        entry = entries[special]
        cost = shared.cost_of(entry)
        gives = special if key(special) != key(row["name"]) else "the same"
        lines.append(
            f"| {row['roll']} | {row['name']} | {gives} | {entry['type']}"
            f" | {'' if cost is None else cost} | {entry.get('setting') or ''} |"
        )
    apart = [entry for entry in shared.entries if entry.get("apart_from")]
    lines += ["", "Kept apart from a family's, the effect differing:", ""]
    lines += [f"- {entry['name']} and {entry['apart_from']}: {entry['why']}" for entry in apart]
    return "\n".join(lines) + "\n"
