import argparse
import json
import re
from pathlib import Path

import pdfplumber

ITEM_PATTERN = re.compile(
    r"(?P<name>.+?)\s+(?P<cost>\d[\d\s+Dx/]*\s*gc(?:/\d[\d\s+Dx/]*\s*gc)?)\s+(?P<availability>Common|Special|Rare\s*\d+|Rare)\b"
)


def _normalize_cell(value):
    if value is None:
        return ""
    return " ".join(str(value).split())


def _is_heading(line):
    cleaned = line.strip()
    if not cleaned:
        return False
    if any(char.isdigit() for char in cleaned):
        return False
    return cleaned.upper() == cleaned


def _normalize_heading(line):
    cleaned = _normalize_cell(line)
    return cleaned.title()


def _group_words_into_lines(words, y_tolerance=3):
    lines = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not lines or abs(word["top"] - lines[-1]["top"]) > y_tolerance:
            lines.append({"top": word["top"], "words": [word]})
        else:
            lines[-1]["words"].append(word)
    return lines


def _lines_by_column(page, mid_x=None, y_tolerance=3):
    mid_x = mid_x or page.width / 2
    words = page.extract_words(x_tolerance=2, y_tolerance=3, use_text_flow=True)
    grouped = _group_words_into_lines(words, y_tolerance=y_tolerance)

    left_lines = []
    right_lines = []

    for line in grouped:
        left_words = [word for word in line["words"] if word["x0"] < mid_x]
        right_words = [word for word in line["words"] if word["x0"] >= mid_x]

        if left_words:
            left_text = " ".join(word["text"] for word in sorted(left_words, key=lambda item: item["x0"]))
            left_lines.append(_normalize_cell(left_text))
        if right_words:
            right_text = " ".join(word["text"] for word in sorted(right_words, key=lambda item: item["x0"]))
            right_lines.append(_normalize_cell(right_text))

    return left_lines, right_lines


def _extract_items_from_lines(lines):
    items = []
    current_type = ""
    in_table = False
    buffer = ""
    pending_index = None

    for line in lines:
        cleaned = _normalize_cell(line)
        if not cleaned:
            continue

        if "Item Cost Availability" in cleaned:
            in_table = True
            buffer = ""
            continue

        if _is_heading(cleaned):
            current_type = _normalize_heading(cleaned)
            continue

        if not in_table:
            continue

        buffer = f"{buffer} {cleaned}".strip() if buffer else cleaned

        if buffer.count("(") > buffer.count(")"):
            continue

        matches = list(ITEM_PATTERN.finditer(buffer))
        if not matches:
            if pending_index is not None:
                items[pending_index]["name"] = f"{items[pending_index]['name']} {cleaned}".strip()
                if items[pending_index]["name"].count("(") <= items[pending_index]["name"].count(")"):
                    pending_index = None
            continue

        for match in matches:
            name = match.group("name").strip(" ,;")
            cost = match.group("cost").strip()
            availability = match.group("availability").strip()
            if not current_type:
                continue
            items.append(
                {
                    "name": name,
                    "type": current_type,
                    "cost": cost,
                    "availability": availability,
                }
            )
            if name.count("(") > name.count(")"):
                pending_index = len(items) - 1

        buffer = buffer[matches[-1].end():].strip()
        if pending_index is not None and buffer and not ITEM_PATTERN.search(buffer):
            items[pending_index]["name"] = f"{items[pending_index]['name']} {buffer}".strip()
            if items[pending_index]["name"].count("(") <= items[pending_index]["name"].count(")"):
                pending_index = None
            buffer = ""

    return items


def _extract_items_from_page(page):
    left_lines, right_lines = _lines_by_column(page)
    left_items = _extract_items_from_lines(left_lines)
    right_items = _extract_items_from_lines(right_lines)
    return left_items + right_items


def _parse_pages(value):
    pages = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        pages.append(int(part))
    return pages


def main():
    parser = argparse.ArgumentParser(description="Extract items tables from PDF pages.")
    parser.add_argument("pdf_path", help="Path to the PDF file.")
    parser.add_argument("--page", type=int, default=1, help="1-based page index to parse.")
    parser.add_argument(
        "--pages",
        help="Comma-separated list of 1-based pages to parse (overrides --page).",
    )
    parser.add_argument("--out", dest="out_path", help="Optional output JSON path.")

    args = parser.parse_args()
    pdf_path = Path(args.pdf_path)

    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    page_list = _parse_pages(args.pages) if args.pages else [args.page]
    entries = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number in page_list:
            page_index = max(page_number - 1, 0)
            if page_index >= len(pdf.pages):
                raise SystemExit(f"Page {page_number} not available in {pdf_path}")
            page = pdf.pages[page_index]
            entries.extend(_extract_items_from_page(page))

    if args.out_path:
        out_path = Path(args.out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(entries, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    summary = {
        "pages": page_list,
        "entries": len(entries),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
