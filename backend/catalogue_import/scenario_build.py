"""Every scenario we hold, and which each setting adds, into `out/scenarios.json` (`{scenarios, settings, none}`),
which `seed_scenarios` reads; and the import report's Scenarios section.

The scenarios are mordheimer's pages (both snapshots: `scenarios.py`) and the campaign PDFs' (`scenario_sources.py`),
named once each (`distinct_names`: the earlier source keeps a shared name, the later says its source). The settings
are Mordheim 1a's two tables from the index page, then every other setting's from `settings.json`
(`scenario_settings.py`); `none` lists the settings that add none of their own, with why.
"""

from pathlib import Path
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.scenario_settings import SETTINGS_FILE, build_settings
from catalogue_import.scenario_sources import PDF_FOLDER, pdf_scenarios, read_pdf_sources
from catalogue_import.scenarios import (
    DROP,
    SETTING_SNAPSHOT,
    SNAPSHOT,
    SOURCE_ORDER,
    distinct_names,
    read_pages,
    setting_tables,
)

PRIVATE = ("folder", "document")  # the build's own, never written


def build_scenarios(
    snapshot: Path = SNAPSHOT,
    more: Path = SETTING_SNAPSHOT,
    pdf: Path = PDF_FOLDER,
    settings_file: Path = SETTINGS_FILE,
) -> dict[str, Any]:
    taken: set[str] = set()
    pages = read_pages(snapshot, taken) + read_pages(more, taken)
    entries = read_pdf_sources(pdf)
    own = pdf_scenarios([entry for entry in entries if "base" not in entry], {})
    held = {entry["slug"]: entry for entry in pages + own}
    if len(held) != len(pages) + len(own):
        raise ValueError("scenarios: a PDF scenario's slug is a page's")
    varied = pdf_scenarios([entry for entry in entries if "base" in entry], held)
    scenarios = [
        {**entry, "url": entry.get("url", ""), "tags": entry.get("tags", [])} for entry in pages + own + varied
    ]
    distinct_names(scenarios)
    index = (snapshot / "index.html").read_text(encoding="utf-8")
    slugs = {entry["slug"] for entry in scenarios}
    tables, numbers = setting_tables(index, slugs)
    for entry in scenarios:
        entry["number"] = entry["number"] or numbers.get(entry["slug"], "")
    others, none = build_settings(slugs, settings_file)
    scenarios.sort(key=lambda entry: (SOURCE_ORDER.index(entry["folder"]), entry["name"].lower()))
    return {
        "scenarios": [{key: value for key, value in entry.items() if key not in PRIVATE} for entry in scenarios],
        "settings": tables + others,
        "none": none,
    }


def _scenario_rows(rows: list[dict[str, Any]]) -> list[str]:
    lines = ["| Scenario | No. | Source | Players | Sections |", "| --- | --- | --- | --- | --- |"]
    for entry in rows:
        titles = ", ".join(section["title"] for section in entry["sections"])
        lines.append(f"| {entry['name']} | {entry['number']} | {entry['source']} | {entry['players']} | {titles} |")
    return lines


def _setting_lines(data: dict[str, Any], known: set[str]) -> list[str]:
    """Each setting's scenarios: added (new to the import, the first setting to name it) or linked (held already)."""
    names = {entry["slug"]: entry["name"] for entry in data["scenarios"]}
    seen = set(known)
    lines = ["### What each setting adds", ""]
    for table in data["settings"]:
        lines += [f"#### {table['setting']} ({table['table']})", ""]
        if table.get("from"):
            lines += [f"From {table['from']}.", ""]
        for row in table["scenarios"]:
            kind = "linked" if row["slug"] in seen else "added"
            seen.add(row["slug"])
            lines.append(f"- {names[row['slug']]}: {row['weight']} ({row['rolls']}; {kind})")
        for row in table.get("missing", []):
            where = f"{row['table']} {row['rolls']}: " if row.get("table") else ""
            lines.append(f"- Left out: {where}{row['name']}{'. ' + row['why'] if row.get('why') else ''}")
        lines.append("")
    unlinked = sorted(names[slug] for slug in names.keys() - seen)
    lines += [f"Held, in no setting (a manager adds one by hand): {', '.join(unlinked)}.", ""]
    lines += ["#### Settings that add none of their own", ""]
    lines += [f"- {row['setting']}: {row['why']}" for row in data["none"]]
    return [*lines, ""]


def render_scenarios(data: dict[str, Any]) -> str:
    """The report's Scenarios section: each scenario, its players and sections, and what each setting adds."""
    rows = data["scenarios"]
    either = [entry["name"] for entry in rows if entry["players"] == "either"]
    varied = [f"{entry['name']} ({entry['base']})" for entry in rows if entry.get("base")]
    lines = [
        "## Scenarios",
        "",
        f"mordheimer's scenario pages (`sources/scenarios-2026-11-24/`, `sources/scenarios-2026-11-25/`) and the "
        f"campaign PDFs' (`sources/scenarios-2026-11-25/pdf/`): {len(rows)} scenarios in `out/scenarios.json`.",
        "",
        *_scenario_rows(rows),
        "",
        f"For either (tagged both, or written for both): {', '.join(either)}.",
        "",
        f"A book's variation of a scenario we hold, read as that scenario with its changes: {', '.join(varied)}.",
        "",
        f"Left out as copies: {', '.join(sorted(DROP))}.",
        "",
        *_setting_lines(data, {row["slug"] for row in load_json(SNAPSHOT / "manifest.json")} - DROP),
    ]
    return "\n".join(lines)
