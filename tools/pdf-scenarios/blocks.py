"""A campaign PDF's pages as reading-order markup, for writing a setting's scenarios source file by hand.

    python3 -I tools/pdf-scenarios/blocks.py <pdf> <first page> <last page> [--columns 1|2]

Reads the PDF with pdfplumber (installed system-wide in a cloud session). Each row of words is split at wide gaps;
a piece crossing the page's middle is full width and separates bands, and inside a band the left column is read
before the right. A heading font (a display face whose glyphs sit in the private-use area, as Mutiny in Marienburg's
Schoensperger does) is decoded and printed as `## heading` (`# title` for a large one). Lines that look like a
profile table keep their line breaks; other lines join into paragraphs, hyphenated words rejoined. The page's
footer (number, initials) is dropped. Prints markup to stdout:

    @page 52
    # Scenario 2: Black Market Lagoon
    ## terrain
    A paragraph ...

Nothing here is imported: the markup is read and corrected against the page images, then written into
`backend/catalogue_import/sources/scenarios-2026-11-25/pdf/<setting>.json` with `to_json.py`.
"""

import re
import sys
from statistics import median

import pdfplumber

GAP = 12  # points between two words that split a row into pieces
FOOTER = 45  # points at the page's foot holding its number and the authors' initials
STAT = re.compile(r"^(Profile\b|[^\d]*(\s+[\d–\-*+]{1,3}){7,})")


def decoded(text: str) -> str:
    """A display face's private-use glyphs (U+F0xx) as the characters they draw."""
    return "".join(chr(ord(c) - 0xF000) if 0xF000 <= ord(c) <= 0xF0FF else c for c in text)


def is_display(word: dict) -> bool:
    return any(0xF000 <= ord(c) <= 0xF0FF for c in word["text"]) or "OldEnglish" in word["fontname"]


def rows(words: list[dict]) -> list[list[dict]]:
    found: list[list[dict]] = []
    for word in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if found and abs(found[-1][0]["top"] - word["top"]) <= 2.5:
            found[-1].append(word)
        else:
            found.append([word])
    return [sorted(row, key=lambda w: w["x0"]) for row in found]


def pieces(row: list[dict]) -> list[list[dict]]:
    split: list[list[dict]] = [[row[0]]]
    for word in row[1:]:
        if word["x0"] - split[-1][-1]["x1"] > GAP:
            split.append([word])
        else:
            split[-1].append(word)
    return split


def ordered(page, columns: int) -> list[list[dict]]:
    """The page's lines (each a list of words) in reading order."""
    middle = page.width / 2
    words = [w for w in page.extract_words(extra_attrs=["fontname", "size"]) if w["top"] < page.height - FOOTER]
    bands: list[list[tuple[int, list[dict]]]] = [[]]
    out: list[list[dict]] = []
    for row in rows(words):
        for piece in pieces(row) if columns == 2 else [row]:
            crosses = piece[0]["x0"] < middle - 5 and piece[-1]["x1"] > middle + 5
            if columns == 2 and crosses:
                bands.append([(-1, piece)])
                bands.append([])
            else:
                bands[-1].append((0 if piece[0]["x0"] < middle else 1, piece))
    for band in bands:
        for column in (-1, 0, 1):
            out.extend(piece for side, piece in band if side == column)
    return out


def text_of(line: list[dict]) -> str:
    return " ".join(decoded(w["text"]) for w in line).replace("", " ").strip()


def markup(path: str, first: int, last: int, columns: int) -> str:
    lines_out: list[str] = []
    with pdfplumber.open(path) as pdf:
        sizes = [w["size"] for p in pdf.pages[first - 1 : last] for w in p.extract_words(extra_attrs=["size"])]
        body = median(sizes) if sizes else 9
        for number in range(first, last + 1):
            lines_out.append(f"\n@page {number}")
            paragraph: list[str] = []
            previous = None
            for line in ordered(pdf.pages[number - 1], columns):
                text = text_of(line)
                if not text:
                    continue
                if all(is_display(w) for w in line) or line[0]["size"] > body * 1.35:
                    lines_out.extend(_flush(paragraph))
                    paragraph = []
                    mark = "#" if line[0]["size"] > body * 1.7 else "##"
                    lines_out.append(f"{mark} {text}")
                    previous = None
                    continue
                gap = line[0]["top"] - previous[0]["bottom"] if previous else 0
                if previous is not None and (gap > line[0]["size"] * 0.6 or gap < -20):
                    lines_out.extend(_flush(paragraph))
                    paragraph = []
                paragraph.append(text)
                previous = line
            lines_out.extend(_flush(paragraph))
    return "\n".join(lines_out) + "\n"


def _flush(paragraph: list[str]) -> list[str]:
    if not paragraph:
        return []
    joined = ""
    for line in paragraph:
        if not joined:
            joined = line
        elif STAT.match(line) or STAT.match(joined.split("\n")[-1]):
            joined += "\n" + line
        elif joined.endswith("-") and line[:1].islower():
            joined = joined[:-1] + line
        else:
            joined += " " + line
    return ["", joined]


if __name__ == "__main__":
    args = sys.argv[1:]
    cols = 2
    if "--columns" in args:
        at = args.index("--columns")
        cols = int(args[at + 1])
        del args[at : at + 2]
    sys.stdout.write(markup(args[0], int(args[1]), int(args[2]), cols))
