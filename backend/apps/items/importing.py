"""The book's items from the catalogue import (the items rebuild): `out/items.json` and `out/item-rules.json`, read in
place (`core.seeding.IMPORT_OUT`).

seed_items upserts the shared rules by slug and every item but the animals by name and variant, each with its rules
and price rows; seed_bestiary gives each book beast's Animal item the import's entry of its name (`animal`), and a
beast the import lacks keeps its own shop prices (`legacy_rows`). Warband types and groups are found by slug and
settings by slug, so seed_settings and seed_warband_types run first; a slug the database lacks stops the run.
"""

import json
import re
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

from django.core.management.base import CommandError

from apps.campaigns.models import CampaignType
from apps.core.seeding import IMPORT_OUT, clean, parse_int
from apps.warbands.models import WarbandGroup, WarbandType

from .models import ANIMAL, Item, ItemRule
from .writes import replace_availabilities, replace_rules

MORDHEIM_PARTS = {"1a": "mordheim", "1b": "mordheim-1b", "1c": "mordheim-1c", "2a": "mordheim-2a", "2b": "mordheim-2a"}
DICE = re.compile(r"^\+?\s*\(?\s*(\d*)\s*D6\s*(?:[x×]\s*(\d+))?", re.I)
FIELDS = ("subtype", "flavour", "source", "link_url", "notes")


def read_out(name: str, out: Path = IMPORT_OUT) -> list[dict[str, Any]]:
    try:
        data = json.loads((out / name).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise CommandError(f"Unable to read the catalogue import's {name}: {exc}") from exc
    if not isinstance(data, list):
        raise CommandError(f"The catalogue import's {name} should hold a list.")
    return data


def mordheim_part(grade: str) -> str:
    """The Mordheim setting of a grade (3 is Grade 3's), as the import places content outside the named settings."""
    return "grade-3" if grade.startswith("3") else MORDHEIM_PARTS.get(grade, "mordheim")


def dice_of(text: str) -> tuple[int | None, int | None]:
    """An older variable cost ("+D6x10 gc", "+2D6") as (dice, multiplier); (None, None) when it names no dice."""
    match = DICE.match(text.strip())
    if not match:
        return None, None
    return int(match.group(1) or 1), int(match.group(2)) if match.group(2) else None


def legacy_rows(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Price rows from a beast's own shop data (a cost, rarity, "unique to" text and variable cost): open to everyone,
    the "unique to" text kept as the note (shown when buying, never checked), a variable cost naming no dice ("15
    warptokens") as the cost note."""
    converted: list[dict[str, Any]] = []
    for row in rows:
        variable = clean(row.get("variable_cost"))
        dice, multiplier = dice_of(variable)
        rarity = parse_int(row.get("rarity"), 2)
        converted.append(
            {
                "cost": parse_int(row.get("cost"), 0),
                "dice": dice,
                "dice_multiplier": multiplier,
                "cost_note": "" if dice else variable,
                "rarity": rarity if rarity > 2 else None,
                "for_everyone": True,
                "note": clean(row.get("unique_to")),
                "warbands": [],
            }
        )
    return converted


class ImportedItems:
    """One seeder run's reading of the import: its items and shared rules, and the settings, types and groups their
    slugs name (one query each)."""

    def __init__(self, out: Path = IMPORT_OUT) -> None:
        self.items = read_out("items.json", out)
        self.shared = read_out("item-rules.json", out)
        self.settings = dict(CampaignType.objects.values_list("slug", "id"))
        self.types = dict(WarbandType.objects.filter(campaign__isnull=True).values_list("slug", "id"))
        self.groups = dict(WarbandGroup.objects.values_list("slug", "id"))
        self.rule_ids = dict(ItemRule.objects.filter(campaign__isnull=True).values_list("slug", "id"))

    def seed_rules(self) -> int:
        """Upsert the book's shared rules by slug; how many."""
        for row in self.shared:
            fields = {"name": clean(row["name"]), "summary": clean(row.get("summary")), "text": clean(row.get("text"))}
            rule, _ = ItemRule.objects.update_or_create(slug=row["slug"], campaign=None, defaults=fields)
            self.rule_ids[rule.slug] = rule.pk
        return len(self.shared)

    def animals(self) -> dict[str, dict[str, Any]]:
        """The import's animals by lower-case name, for the bestiary's items."""
        return {entry["name"].strip().lower(): entry for entry in self.items if entry["type"] == ANIMAL}

    def setting(self, slug: str) -> int:
        if slug not in self.settings:
            raise CommandError(f"Setting '{slug}' isn't seeded: run seed_settings first.")
        return self.settings[slug]

    def fields(self, entry: Mapping[str, Any]) -> dict[str, Any]:
        """An item's columns from its import entry (the setting always set)."""
        statblock = entry.get("statblock") or []
        return {
            **{field: clean(entry.get(field)) for field in FIELDS},
            "type": entry["type"],
            "range": clean(entry.get("range")) or None,
            "strength": clean(entry.get("strength")) or None,
            "save_value": clean(entry.get("save")) or None,
            "statblock": json.dumps(statblock, ensure_ascii=False) if statblock else None,
            "tags": list(entry.get("tags") or []),
            "campaign_type_id": self.setting(entry["setting"]),
            "archived_at": None,  # back in the import: back in the lists
        }

    def _line(self, line: Mapping[str, Any], item: str) -> dict[str, Any]:
        if "type" in line:
            if line["type"] not in self.types:
                raise CommandError(f"{item}: warband type '{line['type']}' isn't seeded: run seed_warband_types first.")
            return {"warband_type_id": self.types[line["type"]], "excluded": bool(line.get("excluded"))}
        if line.get("group") not in self.groups:
            raise CommandError(
                f"{item}: warband group '{line.get('group')}' isn't seeded: run seed_warband_types first."
            )
        return {"warband_group_id": self.groups[line["group"]], "excluded": bool(line.get("excluded"))}

    def rows(self, entry: Mapping[str, Any]) -> list[dict[str, Any]]:
        """The entry's price rows, their warband slugs as ids."""
        keys = ("label", "cost", "dice", "dice_multiplier", "cost_note", "rarity", "for_everyone", "note")
        return [
            {
                **{key: row.get(key) for key in keys},
                "label": clean(row.get("label")),
                "cost_note": clean(row.get("cost_note")),
                "note": clean(row.get("note")),
                "warbands": [self._line(line, entry["name"]) for line in row.get("warbands", [])],
            }
            for row in entry.get("availabilities", [])
        ]

    def rules(self, entry: Mapping[str, Any]) -> list[dict[str, Any]]:
        """The entry's rules in order: a shared rule by slug (its own wording where it differs), or its own rule."""
        found = []
        for link in entry.get("rules", []):
            slug = link.get("rule")
            if slug and slug not in self.rule_ids:
                raise CommandError(f"{entry['name']}: shared rule '{slug}' isn't in item-rules.json.")
            found.append(
                {
                    "rule_id": self.rule_ids[slug] if slug else None,
                    "name": "" if slug else clean(link.get("name")),
                    "summary": clean(link.get("summary")),
                    "text": clean(link.get("text")),
                    "table": list(link.get("tables") or []),
                }
            )
        return found

    def write_links(self, item: Item, entry: Mapping[str, Any]) -> None:
        """The item's rules and price rows become the entry's."""
        replace_rules(item, self.rules(entry))
        replace_availabilities(item, self.rows(entry))

    def apply(self, item: Item, entry: Mapping[str, Any], *, keep: Iterable[str] = ()) -> None:
        """Write the entry onto a book item: its columns (but `keep`), rules and price rows."""
        fields = {key: value for key, value in self.fields(entry).items() if key not in set(keep)}
        Item.objects.filter(pk=item.pk).update(**fields)
        self.write_links(item, entry)
