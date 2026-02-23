"""
Shared parsing logic for converting free-text unique_to strings into
structured Restriction records.
"""

import re

# Known corrections for parsed restriction text. Maps the raw parsed name to
# a (restriction, additional_note) tuple. Use None for additional_note to keep
# whatever was already parsed.
_RESTRICTION_CORRECTIONS = {
    "Battle Monks": ("Battle Monks of Cathay", None),
    "Bretonnian Warhorses": ("Bretonnia", None),
    "Dark Elves Beastmaster": ("Dark Elves", "Beastmaster"),
    "Dragon Monks": ("Battle Monks of Cathay", "Dragon Monks"),
    "Forest": ("Forest Goblins", None),
    "Grave Guards": ("Undead", "Grave Guard"),
    "Hobgoblins": ("Chaos Dwarfs", "Hobgoblins"),
    "Kislevite Heroes": ("Kislev", "Heroes"),
    "Marauders": ("Marauders of Chaos", None),
    "Marauders of Chaos Heroes with the Chosen of Chaos skill": (
        "Marauders of Chaos",
        "Heroes with the Chosen of Chaos skill",
    ),
    "Marauders with Chosen of Chaos skill": (
        "Marauders of Chaos",
        "Heroes with the Chosen of Chaos skill",
    ),
    "Necromancer": ("Undead", "Necromancers"),
    "Necromancers": ("Undead", "Necromancers"),
    "Norse": ("Norse Explorers", None),
    "Outlaws of Stirwood Forest Heroes": ("Outlaws of Stirwood Forest", "Heroes"),
    "Pirate Gunners": ("Pirates", "Gunners"),
    "Pirate Heroes": ("Pirates", "Heroes"),
    "Possessed warbands": ("Possessed", None),
    "Tomb Guardians Liche Priest": ("Tomb Guardians", "Liche Priest"),
    "Tomb Guardians Tomb Lord": ("Tomb Guardians", "Tomb Lord"),
    "Tomb Guardians Tomb lord": ("Tomb Guardians", "Tomb Lord"),
    "Vampires": ("Undead", "Vampires"),
    "Warrior-Priests": ("Warrior Priests", None),
}


def parse_unique_to(text):
    """Parse a unique_to string into a list of restriction dicts.

    Each dict has keys: type, restriction, additional_note.

    Examples:
        "Goblins only"
            -> [{"type": "Warband", "restriction": "Goblins", "additional_note": ""}]
        "Khemri Setting"
            -> [{"type": "Setting", "restriction": "Khemri Setting", "additional_note": ""}]
        "Shadow Warriors - Shadow Weavers"
            -> [{"type": "Warband", "restriction": "Shadow Warriors",
                 "additional_note": "Shadow Weavers"}]
        "Dark Elves, Lizardmen, Norse and Marauders only"
            -> 4 separate Warband restrictions
        "Pirates only, one per model"
            -> [{"type": "Warband", "restriction": "Pirates",
                 "additional_note": "one per model"}]
    """
    text = text.strip()
    if not text:
        return []

    # Settings are kept as-is (whole string is the restriction)
    if "Setting" in text:
        return [{"type": "Setting", "restriction": text, "additional_note": ""}]

    # Detect trailing notes after comma where the text after comma is lowercase.
    # e.g., "Pirates only, one per model" or "Pirate Gunners only, max one per warband"
    # But NOT Oxford commas like ", and Merchant Caravans"
    additional_note = ""
    comma_note_match = _find_trailing_note(text)
    if comma_note_match:
        additional_note = comma_note_match["note"]
        text = comma_note_match["before"]

    # Strip trailing "only" from the whole string before splitting
    text = re.sub(r"\s+only\s*$", "", text)

    # Split on commas (respecting parens), then on " and " for the last segment
    parts = _split_outside_parens(text, ",")
    parts = [p.strip() for p in parts if p.strip()]

    # Strip leading "and " from any part (handles Oxford comma: ", and X")
    parts = [re.sub(r"^and\s+", "", p).strip() for p in parts]
    parts = [p for p in parts if p]

    # Split last part on " and " — but only if it doesn't contain " - "
    # (dashes indicate the " and " may be part of an additional note)
    if parts:
        last = parts[-1]
        if " - " not in last:
            and_parts = re.split(r"\s+and\s+", last)
            parts = parts[:-1] + [p.strip() for p in and_parts if p.strip()]

    results = []
    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Strip "only" from individual parts
        part = re.sub(r"\s+only\s*$", "", part).strip()

        restriction_text = part
        part_note = additional_note

        # Handle dash-separated additional notes: "Kislev - Heroes only"
        dash_match = re.match(r"^(.+?)\s+-\s+(.+)$", part)
        if dash_match:
            restriction_text = dash_match.group(1).strip()
            part_note = dash_match.group(2).strip()
            part_note = re.sub(r"\s+only\s*$", "", part_note).strip()

        if not restriction_text:
            continue

        # Apply known corrections
        correction = _RESTRICTION_CORRECTIONS.get(restriction_text)
        if correction:
            restriction_text = correction[0]
            if correction[1] is not None:
                # Combine correction note with any existing trailing note
                if part_note and correction[1]:
                    part_note = f"{correction[1]}, {part_note}"
                elif correction[1]:
                    part_note = correction[1]

        results.append(
            {
                "type": "Warband",
                "restriction": restriction_text,
                "additional_note": part_note,
            }
        )

    return results


def _find_trailing_note(text):
    """Find a trailing lowercase note after a comma, respecting parentheses.

    Returns {"before": ..., "note": ...} or None.
    Skips Oxford commas (", and ...").
    """
    depth = 0
    last_comma_at = None
    for i, ch in enumerate(text):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch == "," and depth == 0:
            last_comma_at = i

    if last_comma_at is None:
        return None

    after = text[last_comma_at + 1 :].strip()

    # Skip Oxford commas: ", and X"
    if after.lower().startswith("and "):
        return None

    # Only treat as a note if it starts with a lowercase letter
    if after and after[0].islower():
        return {"before": text[:last_comma_at].strip(), "note": after}

    return None


def _split_outside_parens(text, delimiter):
    """Split text on a delimiter, but only outside parentheses."""
    parts = []
    current = []
    depth = 0
    for ch in text:
        if ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth = max(0, depth - 1)
            current.append(ch)
        elif ch == delimiter and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
    parts.append("".join(current))
    return parts
