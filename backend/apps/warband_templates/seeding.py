"""The book's warband templates from the catalogue import (`out/warband-templates.json`, read in place): each upserted
by slug with its child rows written afresh, its fighters' own rules as specials typed by the template ("Warband -
Mercenaries", owner kind warband), or the book's special they are: our Large, Wizard and Priest, and the shared ones
(Fear, Stupidity, the mutations: special/shared.py), which the import names by name and type with no text.

Settings, warband types, races, items, skills and specials are found in the book (seed_settings, seed_warband_types,
seed_races, seed_items, seed_bestiary and seed_spells_and_special run first); a name the database lacks stops the
run. A book template the import drops is archived, and so is a template's own special no template holds any more.
"""

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from django.core.management.base import CommandError
from django.utils import timezone

from apps.campaigns.models import CampaignType
from apps.core.seeding import IMPORT_OUT
from apps.items.models import Item
from apps.races.models import Race
from apps.skills.models import Skill
from apps.special.categories import book_category
from apps.special.kinds import WARBAND, book_kind
from apps.special.models import Special
from apps.warbands.models import WarbandType
from apps.warbands.utils.stats import MAX_STAT, Stat, read_stat

from .models import (
    TemplateFighter,
    TemplateFighterList,
    TemplateFighterSpecial,
    TemplateList,
    TemplateListItem,
    TemplateRule,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)

TEMPLATE_FIELDS = ("name", "source", "link_url", "starting_gold", "max_models", "variants")
FIGHTER_FIELDS = (
    "kind",
    "name",
    "plural",
    "cost",
    "starting_xp",
    "min_count",
    "max_count",
    "group_min",
    "group_max",
    "skill_types",
    "spell_types",
    "gains_xp",
    "promotable",
    "is_leader",
    "caster",
    "large",
    "fixed_kit",
)
LINE_FIELDS = ("shown_as", "cost", "cost_note", "first_free", "brace_cost", "who", "warband_max", "note", "variant")
UPGRADE_FIELDS = ("group", "cost", "cost_note", "note", "who", "max_per_fighter", "later_double", "at_recruit")


def read_templates(out: Path = IMPORT_OUT) -> list[dict[str, Any]]:
    try:
        data = json.loads((out / "warband-templates.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise CommandError(f"Unable to read the catalogue import's warband-templates.json: {exc}") from exc
    if not isinstance(data, list):
        raise CommandError("The catalogue import's warband-templates.json should hold a list.")
    return data


def stats_of(values: Mapping[str, Any], label: str) -> dict[str, Any]:
    """The nine characteristics as units hold them: each number, and what is written beside it (`written_stats`). A
    number above a unit's 10 (the Tilean Hunting Hawk's M12) is kept as written, with no number to sum."""
    stats: dict[str, Any] = {}
    written: dict[str, str] = {}
    for field, value in values.items():
        try:
            stat = Stat(None, str(value)) if str(value).isdigit() and int(value) > MAX_STAT else read_stat(value)
        except ValueError as exc:
            raise CommandError(f"{label}: {field} {value!r}: {exc}") from exc
        stats[field] = stat.number
        if stat.written:
            written[field] = stat.written
    return {**stats, "written_stats": written}


class BookRows:
    """One run's reading of the book: settings, warband types, races, items and the specials it reuses, each in one
    query, with a template's own specials upserted as they come."""

    def __init__(self) -> None:
        book = {"campaign__isnull": True}
        self.settings = dict(CampaignType.objects.values_list("slug", "id"))
        self.types = dict(WarbandType.objects.filter(**book).values_list("slug", "id"))
        self.races = {race.name: race.pk for race in Race.objects.filter(**book)}
        self.items = {
            (item.name, item.variant): item.pk for item in Item.objects.filter(**book, archived_at__isnull=True)
        }
        self.specials = {(row.name, row.type): row.pk for row in Special.objects.filter(**book)}
        self.skills = dict(Skill.objects.filter(**book).values_list("name", "id"))
        self.seen_specials: set[int] = set()

    @staticmethod
    def _found(table: Mapping[Any, int], key: Any, what: str, owner: str) -> int:
        if key not in table:
            raise CommandError(f"{owner}: {what} {key!r} isn't seeded.")
        return table[key]

    def setting(self, slug: str, owner: str) -> int:
        return self._found(self.settings, slug, "setting", owner)

    def warband_type(self, slug: str, owner: str) -> int:
        return self._found(self.types, slug, "warband type", owner)

    def race(self, name: str | None, owner: str) -> int | None:
        return None if name is None else self._found(self.races, name, "race", owner)

    def item(self, ref: Mapping[str, str], owner: str) -> int:
        return self._found(self.items, (ref["name"], ref.get("variant", "")), "item", owner)

    def variant_changes(self, changes: Mapping[str, Any], owner: str) -> dict[str, Any]:
        """A fighter's `variant_changes` as stored: the skills a variant gives him, named in the import, linked to the
        book's skill of that name (`{"id", "name"}`)."""
        stored: dict[str, Any] = {}
        for variant, change in changes.items():
            skills = change.get("skills")
            linked = [{"id": self._found(self.skills, name, "skill", owner), "name": name} for name in skills or []]
            stored[variant] = {**change, "skills": linked} if skills else dict(change)
        return stored

    def special(self, entry: Mapping[str, str], owner: str, group: str = "") -> int:
        """A template's own special (upserted with its text, its category by the upgrade `group` it is bought from
        too) or a book one it reuses (Large, Wizard, Priest)."""
        key = (entry["name"], entry["type"])
        if "description" not in entry:
            found = self._found(self.specials, key, "special", owner)
        else:
            fields = {
                "description": entry["description"],
                "kind": book_kind(entry["name"]),
                "category": book_category(entry["name"], entry["type"], group),
                "owner_kind": WARBAND,
                "archived_at": None,
            }
            special, _ = Special.objects.update_or_create(name=key[0], type=key[1], campaign=None, defaults=fields)
            found = self.specials[key] = special.pk
        self.seen_specials.add(found)
        return found


def write_template(entry: Mapping[str, Any], book: BookRows) -> WarbandTemplate:
    """Upsert the book's template of the entry's slug, and write its child rows afresh."""
    name = entry["name"]
    setting = book.setting(entry["setting"], name)
    fields = {field: entry.get(field) for field in TEMPLATE_FIELDS}
    template, _ = WarbandTemplate.objects.update_or_create(
        slug=entry["slug"], campaign=None, defaults={**fields, "campaign_type_id": setting, "archived_at": None}
    )
    for children in (template.type_links, template.rules, template.lists, template.fighters, template.upgrades):
        children.all().delete()
    WarbandTemplateType.objects.bulk_create(
        WarbandTemplateType(
            template=template, warband_type_id=book.warband_type(row["type"], name), variant=row["variant"]
        )
        for row in entry["types"]
    )
    TemplateRule.objects.bulk_create(
        TemplateRule(
            template=template,
            position=n,
            title=rule["title"],
            description=rule["description"],
            variant=rule["variant"],
            warband_type_id=book.warband_type(rule["type"], name) if rule.get("type") else None,
        )
        for n, rule in enumerate(entry["rules"])
    )
    lists = write_lists(template, entry["lists"], book)
    write_fighters(template, entry["fighters"], lists, book)
    TemplateUpgrade.objects.bulk_create(
        TemplateUpgrade(
            template=template,
            position=n,
            special_id=book.special(row["special"], name, row["group"]),
            **{field: row[field] for field in UPGRADE_FIELDS},
        )
        for n, row in enumerate(entry["upgrades"])
    )
    return template


def write_lists(template: WarbandTemplate, entries: list[dict[str, Any]], book: BookRows) -> dict[str, int]:
    """The template's lists and their lines; each list's id by its key."""
    lists = TemplateList.objects.bulk_create(
        TemplateList(template=template, key=row["key"], position=n, name=row["name"], note=row["note"])
        for n, row in enumerate(entries)
    )
    owner = template.name
    TemplateListItem.objects.bulk_create(
        TemplateListItem(
            equipment_list=made,
            position=n,
            item_id=book.item(line["item"], f"{owner}, {row['name']}"),
            **{field: line[field] for field in LINE_FIELDS},
        )
        for made, row in zip(lists, entries, strict=True)
        for n, line in enumerate(row["lines"])
    )
    return {row.key: row.pk for row in lists}


def write_fighters(
    template: WarbandTemplate, entries: list[dict[str, Any]], lists: dict[str, int], book: BookRows
) -> None:
    """The template's fighters, the lists each buys from and his rules."""
    owner = template.name
    fighters = TemplateFighter.objects.bulk_create(
        TemplateFighter(
            template=template,
            key=row["key"],
            position=n,
            race_id=book.race(row["race"], f"{owner}, {row['name']}"),
            **{field: row[field] for field in FIGHTER_FIELDS},
            variant_changes=book.variant_changes(row["variant_changes"], f"{owner}, {row['name']}"),
            **stats_of(row["stats"], f"{owner}, {row['name']}"),
        )
        for n, row in enumerate(entries)
    )
    TemplateFighterList.objects.bulk_create(
        TemplateFighterList(fighter=fighter, equipment_list_id=lists[key])
        for fighter, row in zip(fighters, entries, strict=True)
        for key in row["lists"]
    )
    TemplateFighterSpecial.objects.bulk_create(
        TemplateFighterSpecial(fighter=fighter, position=n, special_id=book.special(special, owner))
        for fighter, row in zip(fighters, entries, strict=True)
        for n, special in enumerate(row["specials"])
    )


def archive_dropped(seen: list[int], book: BookRows) -> tuple[int, int]:
    """Archive the book templates the import no longer lists, and the templates' own specials none holds now."""
    now = timezone.now()
    templates = (
        WarbandTemplate.objects.filter(campaign__isnull=True, archived_at__isnull=True)
        .exclude(pk__in=seen)
        .update(archived_at=now)
    )
    specials = (
        Special.objects.filter(campaign__isnull=True, owner_kind=WARBAND, archived_at__isnull=True)
        .exclude(pk__in=book.seen_specials)
        .update(archived_at=now)
    )
    return templates, specials
