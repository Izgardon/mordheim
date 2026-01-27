import argparse
import json
import re
from pathlib import Path


def _to_ascii(value: str) -> str:
    return value.encode("ascii", "ignore").decode("ascii")


def _clean_line(line: str) -> str:
    return _to_ascii(line.rstrip())


def _parse_grade(source_line: str) -> str:
    match = re.search(r"\((1[a-c])\)", source_line, re.IGNORECASE)
    if match:
        return match.group(1).lower()
    if "core" in source_line.lower():
        return "1a"
    return "1a"


def _parse_rarity(availability_line: str) -> int:
    if not availability_line:
        return 2
    lower = availability_line.lower()
    if "common" in lower:
        return 2
    match = re.search(r"rare\s*(\d+)", lower)
    if match:
        return int(match.group(1))
    match = re.search(r"(\d+)", lower)
    if match:
        return int(match.group(1))
    return 2


def _parse_unique_to(availability_line: str) -> str:
    if not availability_line:
        return ""
    match = re.search(r"\(([^)]+)\)", availability_line)
    if not match:
        return ""
    return match.group(1).strip()


def _parse_cost(cost_line: str) -> tuple[int, str | None]:
    if not cost_line:
        return 0, None
    raw = cost_line.split(":", 1)[-1].strip()
    raw = raw.replace("gc", "").strip()
    lower = raw.lower()
    if "free" in lower:
        nums = re.findall(r"\d+", raw)
        cost_value = int(nums[-1]) if nums else 0
        return cost_value, "1st free"
    nums = re.findall(r"\d+", raw)
    cost_value = int(nums[0]) if nums else 0
    variable = None
    if len(nums) > 1 or re.search(r"[dDxX/+-]", raw) or "per" in lower:
        if nums and raw.lstrip().startswith(nums[0]):
            remainder = raw.lstrip()[len(nums[0]) :].strip()
            variable = remainder or raw.strip()
        else:
            variable = raw.strip()
    return cost_value, variable


def _collect_description(lines: list[str], start_index: int) -> str:
    desc_lines: list[str] = []
    for line in lines[start_index:]:
        stripped = line.strip()
        if not stripped:
            if desc_lines and desc_lines[-1] != "":
                desc_lines.append("")
            continue
        lower = stripped.lower()
        if lower.startswith(("range:", "strength:", "special rules")):
            break
        if lower in {"katana", "conflicting names", "reach"}:
            break
        if lower.startswith(("cost:", "availability:")):
            continue
        desc_lines.append(stripped)
    if not desc_lines:
        return ""
    paragraphs = []
    current = []
    for line in desc_lines:
        if line == "":
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        current.append(line)
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs).strip()


def _parse_properties(lines: list[str], start_index: int) -> list[dict]:
    properties = []
    current = None
    for line in lines[start_index:]:
        stripped = line.strip()
        if not stripped:
            if current and current["description"]:
                current["description"] += "\n"
            continue
        if stripped.lower() in {"katana", "conflicting names", "reach"}:
            break
        match = re.match(r"^([A-Za-z][^:]+):\s*(.*)$", stripped)
        if match:
            if current:
                current["description"] = current["description"].strip()
                properties.append(current)
            current = {"name": match.group(1).strip(), "description": match.group(2).strip()}
            continue
        if current:
            if current["description"]:
                current["description"] += "\n" + stripped
            else:
                current["description"] = stripped
    if current:
        current["description"] = current["description"].strip()
        properties.append(current)
    return properties


def parse_items(text: str) -> list[dict]:
    lines = [_clean_line(line) for line in text.splitlines()]
    cost_indices = [i for i, line in enumerate(lines) if line.strip().lower().startswith("cost:")]
    items: list[dict] = []
    item_meta = []

    for cost_i in cost_indices:
        j = cost_i - 1
        while j >= 0 and not lines[j].strip():
            j -= 1
        source_idx = j
        source_line = lines[j].strip() if j >= 0 else ""

        k = j - 1
        while k >= 0 and not lines[k].strip():
            k -= 1
        name_idx = k
        name_line = lines[k].strip() if k >= 0 else ""

        if not name_line or name_line.lower() in {"close-combat weapons"}:
            continue

        item_meta.append(
            {
                "cost_idx": cost_i,
                "name_idx": name_idx,
                "source_line": source_line,
                "name_line": name_line,
            }
        )

    for idx, meta in enumerate(item_meta):
        cost_i = meta["cost_idx"]
        end = item_meta[idx + 1]["name_idx"] if idx + 1 < len(item_meta) else len(lines)
        block = lines[cost_i:end]
        source_line = meta["source_line"]
        name_line = meta["name_line"]

        availability_line = ""
        range_line = ""
        strength_line = ""
        special_index = None

        for index, line in enumerate(block):
            stripped = line.strip()
            lower = stripped.lower()
            if lower.startswith("availability:"):
                availability_line = stripped
            if lower.startswith("range:"):
                range_line = stripped
            if lower.startswith("strength:"):
                strength_line = stripped
            if lower.startswith("special rules"):
                special_index = index + 1

        description = _collect_description(block, 1)
        properties = _parse_properties(block, special_index) if special_index is not None else []

        cost_value, variable = _parse_cost(block[0])
        rarity = _parse_rarity(availability_line)
        unique_to = _parse_unique_to(availability_line)
        grade = _parse_grade(source_line)

        def _value_after(label: str, line: str) -> str:
            if not line.lower().startswith(label):
                return ""
            return line.split(":", 1)[-1].strip()

        items.append(
            {
                "name": name_line,
                "type": "Weapon",
                "subtype": "Melee",
                "grade": grade,
                "cost": cost_value,
                "rarity": rarity,
                "unique_to": unique_to,
                "variable": variable,
                "description": description,
                "strength": _value_after("strength", strength_line) or None,
                "range": _value_after("range", range_line) or None,
                "properties": properties,
            }
        )

    return items


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Path to a raw close-combat text file.")
    parser.add_argument(
        "--output",
        default="apps/items/data/standard-weapons.json",
        help="Output JSON path (relative to backend/).",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    text = input_path.read_text(encoding="utf-8", errors="ignore")
    items = parse_items(text)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(items, indent=2), encoding="utf-8")
    print(f"Wrote {len(items)} items to {output_path}")


if __name__ == "__main__":
    main()
