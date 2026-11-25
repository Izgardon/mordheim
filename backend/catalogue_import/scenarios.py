"""Mordheim's scenarios (William, 24 Nov 2026): mordheimer's 70 scenario pages (`sources/scenarios-2026-11-24/`)
into `out/scenarios.json`, which `seed_scenarios` reads.

Each page is one scenario: its title ("3. Wyrdstone Hunt"), its source lines (the source, and the notes as its
one-line summary), its opening lines, then its sections in order, each heading named the standard way where it is
one of the standard ones (Terrain, Warbands, Set-up, Starting the game, Special rules, Ending the game, Experience,
Wyrdstone) and in sentence case otherwise. A page's sub-headings (`h3`, the Caravan's Wagons, Kidnapped's Freeing the
sacrificial victim) are sections too, in their place; smaller ones stay lines in their section's text. A scenario is
for two players unless the site tags it Multiplayer or Chaos on the Streets; tagged 1v1 as well, or written for both
(`EITHER`), it is for either (William, 25 Nov 2026). Archive Pestilen's copies of Town Cryer's pages are left out
(`DROP`: "Remove duplicates"). The book's number is kept where the
book numbers it: the rulebook's nine and Chaos on the Streets' seven ("Play Scenario 4: The Wizard's Mansion").

The index page's two 2D6 tables are which scenarios a setting adds, and how often each is drawn: a result's chance
is its weight (2 or 12 is 1, 3 or 11 is 2, up to 7's 6), a span adds its numbers ("5-6" is 9), and the lower-rated
player's choice adds nothing. Both tables are Mordheim 1a's, the setting every campaign has.
"""

import re
from collections import Counter
from pathlib import Path
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.scenario_html import Block, blocks, parse, source_lines
from catalogue_import.sources import SOURCES

SNAPSHOT = SOURCES / "scenarios-2026-11-24"
STANDARD = {  # a heading as the pages write it (folded) -> its standard name
    "terrain": "Terrain",
    "warbands": "Warbands",
    "warband": "Warbands",
    "the warbands": "Warbands",
    "set-up": "Set-up",
    "setup": "Set-up",
    "set up": "Set-up",
    "warband set up": "Set-up",
    "starting the game": "Starting the game",
    "starting the battle": "Starting the game",
    "special rules": "Special rules",
    "ending the game": "Ending the game",
    "experience": "Experience",
    "wyrdstone": "Wyrdstone",
}
HEADINGS = {  # a heading whose sentence case would lose a name
    "the wand of phyrros": "The Wand of Phyrros",
    "geefer & the guards": "Geefer & the guards",
    "geefer lugbottom": "Geefer Lugbottom",
}
SOURCE_ORDER = ("mordheim-rulebook", "town-cryer", "fanatic-magazine", "fanatic-online", "other", "archive-pestilen")
NAMES = {  # two Archive Pestilen pages both title "Ambush", beside Chaos on the Streets' "Ambush!"
    "ambush-archive-pestilen": "Ambush (Archive Pestilen)",
    "ambush-2-archive-pestilen": "Ambush 2 (Archive Pestilen)",
}
MULTIPLAYER_TAGS = frozenset({"Multiplayer", "Chaos on the Streets"})
EITHER = frozenset({"lost-prince-tc5"})  # "works perfectly well for two players" (William: yes, both)
DROP = frozenset(  # Archive Pestilen's copies of Town Cryer #7's and #9's scenarios (William, 25 Nov 2026)
    {"scourge-and-purge-archive-pestilen", "the-forbidden-square", "scripts-of-sigmar"}
)
TABLES = {"scenario-table": "Mordheim 1a", "cots-table": "Mordheim 1a"}  # the index's tables -> the setting
TWO_D6 = {total: 6 - abs(total - 7) for total in range(2, 13)}  # each 2D6 total's chance in 36ths


def heading(raw: str) -> str:
    """A section's title: the standard name, else sentence case keeping a name's capitals."""
    folded = " ".join(raw.replace("&amp;", "&").split()).strip(" .:").lower()
    if folded in STANDARD:
        return STANDARD[folded]
    if folded in HEADINGS:
        return HEADINGS[folded]
    text = " ".join(raw.split()).strip(" :")
    if text.isupper() or text == text.lower():
        text = text.lower()
    return text[:1].upper() + text[1:]


def _paragraphs(parts: list[str]) -> str:
    return "\n\n".join(part for part in parts if part)


class _Section:
    def __init__(self, title: str) -> None:
        self.title = title
        self.parts: list[str] = []
        self.tables: list[dict[str, Any]] = []

    def add(self, block: Block) -> None:
        if block.kind == "table":
            assert block.table is not None
            self.tables.append(block.table)
            self.parts.append(f"{{{{table:{len(self.tables)}}}}}")
        else:
            self.parts.append(block.text)

    def entry(self) -> dict[str, Any]:
        return {"title": self.title, "text": _paragraphs(self.parts), "tables": self.tables}


def read_page(markup: str, label: str) -> dict[str, Any]:
    """A page's title, its source lines, its opening lines and its sections."""
    title, lines, intro = "", {}, []
    sections: list[_Section] = []
    for block in blocks(parse(markup)):
        if block.kind == "title":
            title = title or block.text
        elif block.kind == "heading":
            sections.append(_Section(heading(block.text)))
        elif sections:
            sections[-1].add(Block("text", heading(block.text)) if block.kind == "subheading" else block)
        elif (found := source_lines(block)) is not None:
            lines.update(found)
        elif block.kind == "table":
            raise ValueError(f"{label}: a table before the first heading")
        else:
            intro.append(block.text)
    if not title or not sections:
        raise ValueError(f"{label}: no title or no sections")
    # a heading over its own sub-headings alone (Kidnapped's Special rules) stays, blank, as the book heads them
    return {"title": title, "lines": lines, "intro": _paragraphs(intro), "sections": [s.entry() for s in sections]}


TITLE = re.compile(r"^(?:(\d+)\.\s+)?(.+)$")


def _scenario(row: dict[str, Any], page: dict[str, Any]) -> dict[str, Any]:
    number, name = TITLE.match(page["title"]).groups()  # type: ignore[union-attr]
    return {
        "slug": row["slug"],
        "name": NAMES.get(row["slug"], name.strip()),
        "number": number if row["folder"] == "mordheim-rulebook" else "",
        "source": page["lines"].get("source", ""),
        "players": _players(row),
        "summary": page["lines"].get("notes", ""),
        "intro": page["intro"],
        "sections": page["sections"],
        "url": row["url"],
        "tags": row["tags"],
        "folder": row["folder"],
    }


def _players(row: dict[str, Any]) -> str:
    tags = set(row["tags"])
    if row["slug"] in EITHER or ("1v1" in tags and MULTIPLAYER_TAGS & tags):
        return "either"
    return "multiplayer" if MULTIPLAYER_TAGS & tags else "1v1"


def _distinct_names(scenarios: list[dict[str, Any]]) -> None:
    """Two pages of one name: the one from the earlier source keeps it, the others say their source."""
    counts = Counter(entry["name"].lower() for entry in scenarios)
    for name in [name for name, count in counts.items() if count > 1]:
        same = sorted(
            (entry for entry in scenarios if entry["name"].lower() == name),
            key=lambda entry: SOURCE_ORDER.index(entry["folder"]),
        )
        for entry in same[1:]:
            entry["name"] = f"{entry['name']} ({re.sub(r' #\d+$', '', entry['source'])})"
    clashes = [name for name, count in Counter(entry["name"].lower() for entry in scenarios).items() if count > 1]
    if clashes:
        raise ValueError(f"scenarios: names still shared: {', '.join(clashes)}")


def _rolls_weight(rolls: str) -> int:
    low, _, high = rolls.partition("-")
    return sum(TWO_D6[total] for total in range(int(low), int(high or low) + 1))


ROW = re.compile(r"<tr><td[^>]*>([\d-]+)</td><td[^>]*>(.*?)</td></tr>", re.S)
LINK = re.compile(r'href="/docs/campaigns/scenarios/[^/"]+/([^"]+)"[^>]*>(?:Scenario (\d+): )?')


def setting_tables(markup: str, slugs: set[str]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Each table's setting and its scenarios with their rolls and weights; and each slug's number in its table."""
    tables, numbers = [], {}
    for table_id, setting in TABLES.items():
        start = markup.index(f'id="{table_id}"')
        body = markup[start : markup.index("</table>", start)]
        rows = []
        for rolls, result in ROW.findall(body):
            link = LINK.search(result)
            if link is None:
                continue  # the lower-rated player chooses: no scenario, no weight
            slug, number = link.group(1), link.group(2) or re.search(r"Scenario (\d+):", result).group(1)  # type: ignore[union-attr]
            if slug not in slugs:
                raise ValueError(f"scenarios: the {table_id} names {slug}, which no page is")
            rows.append({"slug": slug, "rolls": rolls, "weight": _rolls_weight(rolls)})
            numbers[slug] = number
        tables.append({"setting": setting, "table": table_id, "scenarios": rows})
    return tables, numbers


def build_scenarios(snapshot: Path = SNAPSHOT) -> dict[str, Any]:
    manifest = load_json(snapshot / "manifest.json")
    scenarios = []
    for row in manifest:
        if row["slug"] in DROP:
            continue
        markup = (snapshot / "pages" / row["folder"] / f"{row['slug']}.html").read_text(encoding="utf-8")
        scenarios.append(_scenario(row, read_page(markup, row["slug"])))
    _distinct_names(scenarios)
    index = (snapshot / "index.html").read_text(encoding="utf-8")
    tables, numbers = setting_tables(index, {entry["slug"] for entry in scenarios})
    for entry in scenarios:
        entry["number"] = entry["number"] or numbers.get(entry["slug"], "")
    scenarios.sort(key=lambda entry: (SOURCE_ORDER.index(entry["folder"]), entry["name"].lower()))
    return {
        "scenarios": [{key: value for key, value in entry.items() if key != "folder"} for entry in scenarios],
        "settings": tables,
    }


def render_scenarios(data: dict[str, Any]) -> str:
    """The report's Scenarios section: each scenario, its players and its sections, and the settings' weights."""
    rows = data["scenarios"]
    lines = [
        "## Scenarios",
        "",
        f"`sources/scenarios-2026-11-24/` (mordheimer's {len(rows)} scenario pages) as `out/scenarios.json`.",
        "",
        "| Scenario | No. | Source | Players | Sections |",
        "| --- | --- | --- | --- | --- |",
    ]
    for entry in rows:
        titles = ", ".join(section["title"] for section in entry["sections"])
        lines.append(f"| {entry['name']} | {entry['number']} | {entry['source']} | {entry['players']} | {titles} |")
    either = [entry["name"] for entry in rows if entry["players"] == "either"]
    lines += ["", f"For either (tagged both, or written for both): {', '.join(either)}.", ""]
    lines += [f"Left out as copies: {', '.join(sorted(DROP))}.", ""]
    for table in data["settings"]:
        weights = ", ".join(f"{row['slug']} {row['weight']} ({row['rolls']})" for row in table["scenarios"])
        lines.append(f"- {table['setting']} ({table['table']}): {weights}")
    return "\n".join(lines) + "\n"
