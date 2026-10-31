"""Seed the settings (`CampaignType`) from the catalogue import's `out/settings.json` (grading phase 1).

Each row is upserted by slug with its name, grade, sort order and whether it is always on; a setting the file no
longer lists is left alone (warband types and catalogue rows may still point at it). The run is all or nothing and
retires every cached catalogue list, whose rows say whether they are in play.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.campaigns.models import GRADES, CampaignType
from apps.core.catalogue.cache import bump
from apps.core.seeding import IMPORT_OUT, clean, read_json_list

SETTINGS_JSON = IMPORT_OUT / "settings.json"


def setting_defaults(row: dict[str, Any]) -> dict[str, Any]:
    """A settings.json row as CampaignType's columns; a grade outside 1a to 3 stops the run."""
    grade = clean(row.get("grade"))
    if grade not in GRADES:
        raise CommandError(f"Setting {row.get('slug')!r}: grade {grade!r} is not one of {', '.join(GRADES)}.")
    return {
        "name": clean(row.get("name")),
        "grade": grade,
        "sort_order": int(row.get("sort_order") or 0),
        "always_on": bool(row.get("always_on")),
    }


def seed_settings(rows: list[dict[str, Any]]) -> tuple[int, int]:
    """Upsert the rows by slug; how many were created and updated."""
    created = updated = 0
    for row in rows:
        slug = clean(row.get("slug"))
        if not slug:
            raise CommandError("A setting has no slug.")
        _, was_created = CampaignType.objects.update_or_create(slug=slug, defaults=setting_defaults(row))
        created, updated = created + was_created, updated + (not was_created)
    return created, updated


class Command(BaseCommand):
    help = "Seed the settings (Mordheim, Khemri, Lustria …) and their grades from the catalogue import."

    def handle(self, *args, **options):
        rows = read_json_list(SETTINGS_JSON, "settings")
        with transaction.atomic():
            created, updated = seed_settings(rows)
            bump(None)  # every list's rows say whether they are in play (PERF-13)
        self.stdout.write(self.style.SUCCESS(f"Settings import complete. Created: {created}, updated: {updated}."))
