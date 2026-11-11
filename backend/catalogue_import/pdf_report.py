"""The import report's PDF warbands section (`pdf_warbands.py` loads the files): each page's type, aliases, stubs,
shared item rules, price rows and flags, for William's vetting."""

from typing import Any

from catalogue_import.pdf_warbands import TYPE


def _cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def render_pdf(pages: dict[str, dict[str, Any]], stubs: list[dict[str, Any]]) -> str:
    """The import report's PDF warbands section: each page's type, aliases, stubs and flags, for William's vetting."""
    lines = [
        "## PDF warbands",
        "",
        f"{len(pages)} warbands read from their PDFs (`sources/pdf-warbands/`), built as templates beside the snapshot's.",
        "",
        "| Page | Type | Fighters | Aliases | Stubs | Flags |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for slug, page in pages.items():
        counts = [len(page["fighters"]), len(page.get("aliases") or []), len(page.get("stubs") or [])]
        lines.append(f"| {slug} | {page[TYPE]} | {' | '.join(map(str, counts))} | {len(page.get('flags') or [])} |")
    prices = {
        (item["name"], warband["type"]): row
        for item in stubs
        for row in item["availabilities"]
        for warband in row["warbands"]
    }
    for page in pages.values():
        lines += ["", f"### {page['name']}", ""]
        for row in page.get("aliases") or []:
            lines.append(f'- Alias (p{row["page"]}): "{_cell(row["pdf"])}" is our {_cell(row["ours"])}.')
        for stub in page.get("stubs") or []:
            price = prices[(stub["name"], page[TYPE])]
            rarity = f"Rare {price['rarity']}" if price["rarity"] else "Common"
            times = f"x{price['dice_multiplier']}" if price["dice_multiplier"] else ""
            dice = f"+{price['dice']}D6{times}" if price["dice"] else ""
            cost = price["cost_note"] if price["cost"] is None else f"{price['cost']}{dice} gc"
            lines.append(f"- Stub: {stub['name']}, {cost}, {rarity}; its rules are on p{stub['rulesPage']}.")
        for row in page.get("itemRules") or []:
            lines.append(f"- Shared item rule (p{row['page']}): {_cell(row['name'])}.")
        for row in page.get("priceRows") or []:
            rarity = f"Rare {row['rarity']}" if row.get("rarity") else "Common"
            note = f", {_cell(row['note'])}" if row.get("note") else ""
            who = ", ".join(row.get("types") or [page[TYPE]])
            lines.append(f"- Price row (p{row['page']}): our {_cell(row['name'])} for {who}, {rarity}{note}.")
        for flag in page.get("flags") or []:
            lines.append(f"- Flag (p{flag['page']}): {_cell(flag['what'])}")
    return "\n".join(lines) + "\n"
