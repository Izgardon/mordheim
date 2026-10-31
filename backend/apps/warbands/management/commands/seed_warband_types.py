"""Seed the book's warband types and warband groups from the catalogue import (`out/warband-types.json` and
`out/warband-groups.json`, grading phase 1). Run after `seed_settings`: each type names its setting by slug.

Types are upserted by slug in the book (campaigns' own types are never read or written); a book type the file no
longer lists is archived, so warbands raised as it keep it, and one listed again comes back. Groups are upserted by
slug and their members become the file's. The run is all or nothing and retires every cached catalogue list.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.campaigns.models import CampaignType
from apps.core.catalogue.cache import bump
from apps.core.seeding import IMPORT_OUT, clean, read_json_list
from apps.warbands.models import WarbandGroup, WarbandType

TYPES_JSON = IMPORT_OUT / "warband-types.json"
GROUPS_JSON = IMPORT_OUT / "warband-groups.json"


def type_defaults(row: dict[str, Any], settings: dict[str, int]) -> dict[str, Any]:
    """A warband-types.json row as WarbandType's columns; an unknown setting stops the run."""
    setting = clean(row.get("setting"))
    if setting not in settings:
        raise CommandError(f"Warband type {row.get('slug')!r}: setting {setting!r} isn't seeded (run seed_settings).")
    return {
        "name": clean(row.get("name")),
        "campaign_type_id": settings[setting],
        "race": clean(row.get("race")),
        "source": clean(row.get("source")),
        "source_code": clean(row.get("source_code")),
        "link_url": clean(row.get("link_url")),
        "broheim_grade": clean(row.get("broheim_grade")),
        "mordheimer_grade": clean(row.get("mordheimer_grade")),
        "archived_at": None,
    }


def seed_types(rows: list[dict[str, Any]]) -> dict[str, WarbandType]:
    """Upsert the book's types by slug and archive the ones the file dropped; slug -> type."""
    settings = dict(CampaignType.objects.values_list("slug", "id"))
    seeded = {}
    for row in rows:
        slug = clean(row.get("slug"))
        if not slug:
            raise CommandError(f"Warband type {row.get('name')!r} has no slug.")
        seeded[slug], _ = WarbandType.objects.update_or_create(
            campaign=None, slug=slug, defaults=type_defaults(row, settings)
        )
    dropped = WarbandType.objects.filter(campaign__isnull=True, archived_at__isnull=True).exclude(slug__in=seeded)
    dropped.update(archived_at=timezone.now())
    return seeded


def seed_groups(rows: list[dict[str, Any]], types: dict[str, WarbandType]) -> int:
    """Upsert the groups by slug, in the file's order, each holding exactly the file's members."""
    for order, row in enumerate(rows, start=1):
        slug = clean(row.get("slug"))
        missing = [member for member in row.get("members", []) if member not in types]
        if not slug or missing:
            raise CommandError(f"Warband group {row.get('name')!r}: no slug, or unknown members {missing}.")
        group, _ = WarbandGroup.objects.update_or_create(
            slug=slug, defaults={"name": clean(row.get("name")), "kind": clean(row.get("kind")), "sort_order": order}
        )
        group.members.set([types[member] for member in row.get("members", [])])
    return len(rows)


class Command(BaseCommand):
    help = "Seed the book's warband types and warband groups from the catalogue import."

    def handle(self, *args, **options):
        type_rows = read_json_list(TYPES_JSON, "warband types")
        group_rows = read_json_list(GROUPS_JSON, "warband groups")
        with transaction.atomic():
            types = seed_types(type_rows)
            groups = seed_groups(group_rows, types)
            bump(None)  # the warband type lists show the book
        self.stdout.write(self.style.SUCCESS(f"Warband types: {len(types)}, groups: {groups}."))
