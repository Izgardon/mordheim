"""Seed the book's spells and specials from JSON (`apps/spells/data/spells.json`, `apps/special/data/special.json`).

Rows are matched by name and type in the book only (BUG-17); the run is all or nothing; there is no --truncate
(BUG-16: it deleted campaign rows and every copy of them). A lore keeps the first spell on each roll: a later one on
a taken roll is saved with none, and the run says so (spells/rolls.py).
"""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.catalogue.cache import bump
from apps.core.seeding import read_json_list, upsert_global
from apps.special.kinds import book_kind
from apps.special.models import Special
from apps.spells.models import Spell
from apps.spells.rolls import first_on_each_roll

SPELLS_JSON_PATH = Path("apps/spells/data/spells.json")
SPECIAL_JSON_PATH = Path("apps/special/data/special.json")


class Command(BaseCommand):
    help = "Seed spells and special from JSON data files."

    def handle(self, *args, **options):
        """Upsert the book's spells and specials, all or nothing (BUG-17)."""
        with transaction.atomic():
            spells_created, spells_updated = self._seed(Spell, SPELLS_JSON_PATH, "Spells", ("description", "dc"))
            special_created, special_updated = self._seed(Special, SPECIAL_JSON_PATH, "Special", ("description",))
            bump(None)  # every cached catalogue list shows the book (PERF-13)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete. "
                f"Spells - Created: {spells_created}, Updated: {spells_updated}. "
                f"Special - Created: {special_created}, Updated: {special_updated}."
            )
        )

    def _seed(
        self, model: type[Spell] | type[Special], path: Path, label: str, texts: tuple[str, ...]
    ) -> tuple[int, int]:
        """Upsert each named, typed row of the file: its stripped texts, a spell's roll and a special's kind."""
        if not path.exists():
            self.stdout.write(self.style.WARNING(f"{label} JSON not found at {path}"))
            return 0, 0
        created = updated = 0
        entries = read_json_list(path)
        if model is Spell:
            entries, cleared = first_on_each_roll(entries)
            for line in cleared:
                self.stdout.write(self.style.WARNING(line))
        for entry in entries:
            name, entry_type = entry.get("name", "").strip(), entry.get("type", "").strip()
            if not name or not entry_type:
                continue
            defaults = {field: entry.get(field, "").strip() for field in texts}
            if model is Spell:
                defaults["roll"] = entry.get("roll")
            else:  # Boons & Banes (special/kinds.py)
                defaults["kind"] = book_kind(name)
            _, was_created = upsert_global(model, {"name": name, "type": entry_type}, defaults)
            if was_created:
                created += 1
            else:
                updated += 1
        return created, updated
