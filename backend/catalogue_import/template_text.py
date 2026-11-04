"""Rule text for warband templates, cleaned (William: rule text only for now): the page's hard line wraps joined,
breaks as paragraphs, links as plain text with the URL kept (an anchor on the page itself as its text only), errata
and FAQ markers (✏️, ❓) dropped, and a table as lines of cells."""

import re

from catalogue_import.text import Table, clean_text

MORDHEIMER = "https://mordheimer.net"
_MARKER_TOOLTIP = re.compile(r"<Tooltip\b[^>]*>\s*[❓✏️️\s]*</Tooltip>", re.I)
_SUP = re.compile(r"</?sup\b[^>]*>", re.I)
_LINK = re.compile(r"<a\b[^>]*\bhref=[\"']?([^\"' >]+)[\"']?[^>]*>(.*?)</a>", re.S | re.I)
_MARKERS = re.compile(r"[❓✏️️]")
_WRAP = re.compile(r"(?<!\n)\n(?!\n)")  # a single line break: the source's hard wrap inside a paragraph


def _link(match: re.Match[str]) -> str:
    href, text = match.group(1), match.group(2)
    if href.startswith("/"):
        return f"{text} ({MORDHEIMER}{href})"
    if href.startswith("http"):
        return f"{text} ({href})"
    return text  # "#amazon-rituals": a place on mordheimer's own page


def _table_lines(table: Table) -> str:
    rows = [table["columns"], *table["rows"]] if table["columns"] else table["rows"]
    return "\n".join(" | ".join(str(cell) for cell in row) for row in rows if row)


def clean_rule(snippet: str | None) -> str:
    """A rule's text as plain paragraphs."""
    if not snippet:
        return ""
    text = snippet.replace("\r", "")
    text = _MARKER_TOOLTIP.sub("", text)
    text = _SUP.sub("", text)
    text = _LINK.sub(_link, text)
    text = _WRAP.sub(" ", text)
    cleaned, tables = clean_text(text)
    for number, table in enumerate(tables, start=1):
        cleaned = cleaned.replace(f"{{{{table:{number}}}}}", _table_lines(table))
    cleaned = _MARKERS.sub("", cleaned)
    lines = [" ".join(line.split()) for line in cleaned.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def clean_title(snippet: str | None) -> str:
    """A rule's name: plain text, without the colon some names end with ("Natives:")."""
    return clean_rule(snippet).rstrip(":").strip()
