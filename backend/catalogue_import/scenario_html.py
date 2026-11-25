"""mordheimer's scenario pages as blocks of text (scenarios.py reads them): a small tree of the page's markdown, then
each block in reading order: the title, the lines naming its source, paragraphs, lists, tables and headings.

Only the standard library's parser reads the snapshot (no downloaded code runs). Text keeps the book's words: a
paragraph's line breaks from the PDF become spaces, a `<br>` a new line, a list item a line of its own starting "•"
(or its number), and a table the item rules' shape (`{columns, rows}`), its place marked `{{table:N}}`. The site's
"info" boxes are left out (each says only that the scenario is multiplayer, which its icon shows); every other box
reads as text under its heading: the book's (a letter, the original experience) and the site's corrections
("Possible typo", "Possible error"), which carry rules (William, 25 Nov 2026: "the scenario description has important
information in it").
"""

import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any

VOID = frozenset({"br", "img", "hr", "input", "meta", "link", "wbr"})
SITE_NOTES = frozenset({"info"})
PLAIN_BOXES = frozenset({"note", "narrative content"})  # a box whose heading says nothing of its own
SECTION_HEADINGS = frozenset({"h1", "h2", "h3"})
INLINE_HEADINGS = frozenset({"h4", "h5", "h6"})
BREAK = "\x00"  # a <br> while whitespace is collapsed


@dataclass
class Node:
    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    children: list["Node | str"] = field(default_factory=list)

    @property
    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())

    def elements(self) -> list["Node"]:
        return [child for child in self.children if isinstance(child, Node)]


class _TreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {name: value or "" for name, value in attrs})
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        for depth in range(len(self.stack) - 1, 0, -1):
            if self.stack[depth].tag == tag:
                del self.stack[depth:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)


def parse(markup: str) -> Node:
    builder = _TreeBuilder()
    builder.feed(markup)
    builder.close()
    return builder.root


def _raw(node: Node | str) -> str:
    if isinstance(node, str):
        return node
    if node.tag == "br":
        return BREAK
    if node.tag == "a" and "hash-link" in node.classes:
        return ""  # the heading's anchor
    return "".join(_raw(child) for child in node.children)


def inline(node: Node | str) -> str:
    """The node's text on one line, a `<br>` a new line, its whitespace collapsed."""
    text = " ".join(_raw(node).replace("​", "").split())
    return "\n".join(line.strip() for line in text.split(BREAK)).strip()


@dataclass
class Block:
    """One block in reading order. `kind`: title, heading (a section's), subheading (a line in a section), text,
    table."""

    kind: str
    text: str = ""
    table: dict[str, Any] | None = None
    first: Node | None = None  # a paragraph's first element (the source lines open with a <strong> label)


def _list_lines(node: Node, depth: int = 0) -> list[str]:
    lines = []
    for number, item in enumerate((child for child in node.elements() if child.tag == "li"), start=1):
        own = Node("span", children=[child for child in item.children if not _is_list(child)])
        mark = f"{number}." if node.tag == "ol" else "•"
        lines.append(f"{'  ' * depth}{mark} {inline(own)}")
        for nested in item.elements():
            if nested.tag in ("ul", "ol"):
                lines.extend(_list_lines(nested, depth + 1))
    return lines


def _is_list(child: Node | str) -> bool:
    return isinstance(child, Node) and child.tag in ("ul", "ol")


def _table(node: Node) -> dict[str, Any]:
    head = next((child for child in node.elements() if child.tag == "thead"), None)
    body = next((child for child in node.elements() if child.tag == "tbody"), node)
    columns = [inline(cell) for row in (head.elements() if head else []) for cell in row.elements()]
    rows = [[inline(cell) for cell in row.elements()] for row in body.elements() if row.tag == "tr"]
    return {"columns": columns, "rows": rows}


def _box(node: Node) -> list[Block]:
    """An admonition: the site's "info" box is left out, any other is its heading and its content."""
    parts = node.elements()
    heading = next((part for part in parts if any(c.startswith("admonitionHeading") for c in part.classes)), None)
    content = next((part for part in parts if any(c.startswith("admonitionContent") for c in part.classes)), None)
    title = inline(heading) if heading else ""
    if title.lower() in SITE_NOTES:
        return []
    found = [] if title.lower() in PLAIN_BOXES or not title else [Block("subheading", title)]
    return found + (blocks(content) if content else [])


def blocks(node: Node) -> list[Block]:
    """The node's children as blocks, in reading order."""
    found: list[Block] = []
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                found.append(Block("text", inline(child)))
            continue
        tag = child.tag
        if tag == "header":
            found.extend(Block("title", inline(h1)) for h1 in child.elements() if h1.tag == "h1")
        elif tag in SECTION_HEADINGS:
            found.append(Block("heading", inline(child)))
        elif tag in INLINE_HEADINGS:
            found.append(Block("subheading", inline(child)))
        elif tag == "p":
            text = inline(child)
            if text:
                found.append(Block("text", text, first=next(iter(child.elements()), None)))
        elif tag in ("ul", "ol"):
            found.append(Block("text", "\n".join(_list_lines(child))))
        elif tag == "table":
            found.append(Block("table", table=_table(child)))
        elif tag == "div" and "theme-admonition" in child.classes:
            found.extend(_box(child))
        elif tag in ("div", "blockquote", "section", "details", "span", "em", "strong"):
            found.extend(blocks(child))
    return found


SOURCE_LABEL = re.compile(r"^(Source|Setting|Author|Notes|Broheim notes):\s*", re.I)


def source_lines(block: Block) -> dict[str, str] | None:
    """A paragraph of `Label: value` lines (the page's source, setting, author and notes), or None."""
    if block.kind != "text" or block.first is None or block.first.tag != "strong":
        return None
    if not SOURCE_LABEL.match(block.text):
        return None
    found: dict[str, str] = {}
    for line in re.split(r"\n|(?=\b(?:Source|Setting|Author|Notes|Broheim notes):)", block.text):
        match = SOURCE_LABEL.match(line.strip())
        if match:
            label = match.group(1).lower().replace("broheim notes", "notes")
            found[label] = line.strip()[match.end() :].removesuffix("PDF").strip()
    return found
