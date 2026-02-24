import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.spells.models import Spell
from apps.special.models import Special

SPELLS_JSON_PATH = Path("apps/spells/data/spells.json")
SPECIAL_JSON_PATH = Path("apps/special/data/special.json")


class Command(BaseCommand):
    help = "Seed spells and special from JSON data files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing spells and special before seeding.",
        )

    def handle(self, *args, **options):
        truncate = options.get("truncate")

        if truncate:
            Spell.objects.all().delete()
            Special.objects.all().delete()

        spells_created, spells_updated = self._seed_spells()
        special_created, special_updated = self._seed_special()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete. "
                f"Spells - Created: {spells_created}, Updated: {spells_updated}. "
                f"Special - Created: {special_created}, Updated: {special_updated}."
            )
        )

    def _seed_spells(self):
        if not SPELLS_JSON_PATH.exists():
            self.stdout.write(self.style.WARNING(f"Spells JSON not found at {SPELLS_JSON_PATH}"))
            return 0, 0

        data = json.loads(SPELLS_JSON_PATH.read_text(encoding="utf-8-sig"))
        created = 0
        updated = 0

        for entry in data:
            name = entry.get("name", "").strip()
            spell_type = entry.get("type", "").strip()
            description = entry.get("description", "").strip()
            dc = entry.get("dc", "").strip()
            roll = entry.get("roll")

            if not name or not spell_type:
                continue

            _, was_created = Spell.objects.update_or_create(
                name=name,
                type=spell_type,
                defaults={"description": description, "dc": dc, "roll": roll},
            )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated

    def _seed_special(self):
        if not SPECIAL_JSON_PATH.exists():
            self.stdout.write(self.style.WARNING(f"Special JSON not found at {SPECIAL_JSON_PATH}"))
            return 0, 0

        data = json.loads(SPECIAL_JSON_PATH.read_text(encoding="utf-8-sig"))
        created = 0
        updated = 0

        for entry in data:
            name = entry.get("name", "").strip()
            special_type = entry.get("type", "").strip()
            description = entry.get("description", "").strip()

            if not name or not special_type:
                continue

            _, was_created = Special.objects.update_or_create(
                name=name,
                type=special_type,
                defaults={"description": description},
            )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated
