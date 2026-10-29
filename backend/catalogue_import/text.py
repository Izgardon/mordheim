"""Turns mordheimer's MDX/HTML snippets into plain text, lifting any table out as rows."""

import html
import re
from typing import TypedDict


class Table(TypedDict):
    columns: list[str]
    rows: list[list[str]]


TABLE_MARKER = "{{table:%d}}"

_SUP = re.compile(r"<sup\b[^>]*>.*?</sup>", re.S | re.I)
_TABLE = re.compile(r"<table\b[^>]*>(.*?)</table>", re.S | re.I)
_ROW = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.S | re.I)
_CELL = re.compile(r"<(th|td)\b[^>]*>(.*?)</\1>", re.S | re.I)
_ADMONITION_HEADING = re.compile(r"<div class=\"admonition-heading\">.*?</div>", re.S | re.I)
_LINE_BREAK = re.compile(r"<br\s*/?>", re.I)
_BLOCK = re.compile(r"</?(p|div|hr|h[1-6]|ul|ol)\b[^>]*>", re.I)
_LIST_ITEM = re.compile(r"<li\b[^>]*>", re.I)
_TAG = re.compile(r"</?[A-Za-z][^>]*>")


def _tidy(text: str) -> str:
    text = html.unescape(text).replace(" ", " ").replace("\r", "")
    lines = [" ".join(line.split()) for line in text.split("\n")]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def clean_inline(snippet: str | None) -> str:
    """Plain text from a snippet: Tooltip wrappers, FAQ/errata markers and other tags go, breaks stay."""
    if not snippet:
        return ""
    text = _SUP.sub("", snippet)
    text = _ADMONITION_HEADING.sub("", text)
    text = _LINE_BREAK.sub("\n", text)
    text = _LIST_ITEM.sub("\n- ", text)
    text = _BLOCK.sub("\n\n", text)
    text = _TAG.sub("", text)
    return _tidy(text)


def _parse_table(body: str) -> Table:
    columns: list[str] = []
    rows: list[list[str]] = []
    for row_html in _ROW.findall(body):
        cells = _CELL.findall(row_html)
        values = [clean_inline(content) for _kind, content in cells]
        if not columns and cells and all(kind.lower() == "th" for kind, _content in cells):
            columns = values
        elif values:
            rows.append(values)
    return {"columns": columns, "rows": rows}


def clean_text(snippet: str | None) -> tuple[str, list[Table]]:
    """Plain text plus the tables it held. Each table leaves a ``{{table:N}}`` marker where it stood."""
    if not snippet:
        return "", []
    tables: list[Table] = []

    def lift(match: re.Match[str]) -> str:
        tables.append(_parse_table(match.group(1)))
        return "\n\n" + TABLE_MARKER % len(tables) + "\n\n"

    text = _TABLE.sub(lift, _SUP.sub("", snippet))
    return clean_inline(text), tables


def same_text(left: str, right: str) -> bool:
    """Equal once spacing and case are ignored, so only a real rewording counts as different."""
    return " ".join(left.lower().split()) == " ".join(right.lower().split())
