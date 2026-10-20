"""Seed the book's skills from JSON (`apps/skills/data/skills.json`, or --json).

Campaign rows are never read or written (BUG-17); the run is all or nothing; there is no --truncate (BUG-16: it
deleted campaign skills and every copy of them). The Google Sheets and CSV sources are gone (IMP-81): the JSON is
committed with the code.
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.seeding import clean, entry_value, read_json_list, upsert_global
from apps.skills.models import Skill

DEFAULT_JSON_PATH = Path("apps/skills/data/skills.json")

HEADER_ALIASES = {
    "name": ["name", "skill", "skill name", "skill_name"],
    "type": ["type", "skill type", "skill_type", "category", "group"],
    "description": ["description", "desc", "details", "effect", "rules"],
}


def _skill_type(value):
    cleaned = clean(value)
    if not cleaned:
        return cleaned
    if cleaned.lower().endswith("skills"):
        cleaned = cleaned[: -len("skills")].rstrip()
        if cleaned.endswith("'") or cleaned.endswith("’"):
            cleaned = cleaned[:-1].rstrip()
    return cleaned


class Command(BaseCommand):
    help = "Seed skills from a JSON data file."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")

    def handle(self, *args, **options):
        """Upsert the book's skills by name and type, all or nothing (BUG-17)."""
        with transaction.atomic():
            self._import(options)

    def _import(self, options):
        json_path = options.get("json_path")
        path = Path(json_path) if json_path else DEFAULT_JSON_PATH
        if not path.exists():
            if json_path:
                raise CommandError(f"JSON file not found at {path}")
            raise CommandError("JSON file not found. Provide --json or place data at apps/skills/data/skills.json.")

        created = updated = skipped = 0
        for entry in read_json_list(path, "skill objects"):
            name = clean(entry_value(entry, HEADER_ALIASES["name"]))
            skill_type = _skill_type(entry_value(entry, HEADER_ALIASES["type"]))
            if not name or not skill_type:
                skipped += 1
                continue
            description = clean(entry_value(entry, HEADER_ALIASES["description"]))
            _, was_created = upsert_global(Skill, {"name": name, "type": skill_type}, {"description": description})
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Skills import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}")
        )
