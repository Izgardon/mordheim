"""Corrected markup (blocks.py's, read against the page images) into a setting's scenarios source file.

    python3 -I tools/pdf-scenarios/to_json.py <markup> <out.json>

The markup holds one scenario per `# ` line, its fields on `@key value` lines (slug, name, number, players, summary,
source; `@base <slug>` and `@title` make it a variation of a scenario we hold), then its opening lines, then each
`## heading` and its paragraphs (blank lines between). A paragraph starting `Profile` is a profile table, and one of `| a | b |` lines a table (the first its columns). A file's
first lines may set `@@source` and `@@document`, the defaults for every scenario in it. `@page` lines are dropped.
"""

import json
import re
import sys

STATS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"]
STAT = r"[\dD–\-*+/]{1,4}"


def pipe_table(paragraph: str) -> dict | None:
    """Lines '| a | b |', the first the columns."""
    lines = [line.strip() for line in paragraph.splitlines()]
    if not lines or not all(line.startswith("|") for line in lines):
        return None
    cells = [[cell.strip() for cell in line.strip("|").split("|")] for line in lines]
    return {"columns": cells[0], "rows": cells[1:]}


def profile_table(paragraph: str) -> dict | None:
    """'Profile M WS BS S T W I A Ld Name 4 3 3 3 3 1 3 1 7 ...' as {columns, rows}."""
    flat = " ".join(paragraph.split())
    match = re.match(r"^Profile\s+M\s+WS\s+BS\s+S\s+T\s+W\s+I\s+A\s+Ld\s+(.*)$", flat)
    if not match:
        return None
    rows = re.findall(rf"(.+?)\s+({STAT}(?:\s+{STAT}){{8}})(?=\s|$)", match.group(1))
    if not rows:
        return None
    return {"columns": ["Profile", *STATS], "rows": [[name.strip(), *stats.split()] for name, stats in rows]}


def parse(markup: str) -> dict:
    defaults: dict[str, str] = {}
    scenarios: list[dict] = []
    current: dict | None = None
    section: dict | None = None
    paragraphs: list[str] = []

    def flush() -> None:
        nonlocal paragraphs
        text = "\n".join(paragraphs).strip()
        paragraphs = []
        if current is None or not text:
            return
        for block in re.split(r"\n\s*\n", text):
            block = block.strip()
            if not block:
                continue
            target = section if section is not None else current
            table = (pipe_table(block) or profile_table(block)) if section is not None else None
            if table is not None:
                section["tables"].append(table)
                block = f"{{{{table:{len(section['tables'])}}}}}"
            key = "text" if section is not None or "base" in current else "intro"
            target[key] = f"{target.get(key, '')}\n\n{block}".strip()

    for line in markup.splitlines():
        if line.startswith("@page"):
            continue
        if line.startswith("@@"):
            key, _, value = line[2:].partition(" ")
            defaults[key] = value.strip()
        elif line.startswith("# "):
            flush()
            section = None
            current = {"source": defaults.get("source", ""), "intro": "", "sections": []}
            scenarios.append(current)
        elif line.startswith("@") and current is not None and section is None and not paragraphs:
            key, _, value = line[1:].partition(" ")
            current[key] = value.strip()
        elif line.startswith("## "):
            flush()
            section = {"title": line[3:].strip(), "text": "", "tables": []}
            current["sections"].append(section)  # type: ignore[index]
        else:
            paragraphs.append(line)
    flush()
    for entry in scenarios:
        if "base" in entry:
            entry.pop("sections")
            entry.pop("intro", None)
    return {"document": defaults.get("document", ""), "scenarios": scenarios}


if __name__ == "__main__":
    data = parse(open(sys.argv[1], encoding="utf-8").read())
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        json.dump(data, out, indent=1, ensure_ascii=False)
        out.write("\n")
    print(len(data["scenarios"]), "scenarios")
