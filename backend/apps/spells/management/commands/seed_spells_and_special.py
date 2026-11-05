"""Seed the book's spells and specials from JSON (`apps/spells/data/spells.json`, `apps/special/data/special.json`),
and the specials the serious injury tables grant by name, typed "Injury", with the book's rule text (the catalogue
import's `out/serious-injuries.json`).

Rows are matched by name and type in the book only (BUG-17); the run is all or nothing; there is no --truncate
(BUG-16: it deleted campaign rows and every copy of them). A lore keeps the first spell on each roll: a later one on
a taken roll is saved with none, and the run says so (spells/rolls.py).
"""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.battles.services.injuries import granted_specials
from apps.core.catalogue.cache import bump
from apps.core.seeding import IMPORT_OUT, read_json_list, upsert_global
from apps.special.kinds import BANE, GENERAL, INJURY, book_kind
from apps.special.models import Special
from apps.spells.models import Spell
from apps.spells.rolls import first_on_each_roll

SPELLS_JSON_PATH = Path("apps/spells/data/spells.json")
SPECIAL_JSON_PATH = Path("apps/special/data/special.json")
SERIOUS_INJURIES_PATH = IMPORT_OUT / "serious-injuries.json"


class Command(BaseCommand):
    help = "Seed spells and special from JSON data files."

    def handle(self, *args, **options):
        """Upsert the book's spells and specials, all or nothing (BUG-17)."""
        with transaction.atomic():
            spells_created, spells_updated = self._seed(Spell, SPELLS_JSON_PATH, "Spells", ("description", "dc"))
            special_created, special_updated = self._seed(Special, SPECIAL_JSON_PATH, "Special", ("description",))
            injury_created, injury_updated = self._seed_injury_specials()
            bump(None)  # every cached catalogue list shows the book (PERF-13)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete. "
                f"Spells - Created: {spells_created}, Updated: {spells_updated}. "
                f"Special - Created: {special_created}, Updated: {special_updated}. "
                f"Injury specials - Created: {injury_created}, Updated: {injury_updated}."
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

    def _seed_injury_specials(self) -> tuple[int, int]:
        """Each special the injury tables grant by name as the book's general "Injury" special, its kind the book's
        classification (a bane unless it says otherwise) and its text the book's result of that name. A name the
        book's table lacks is left to the campaign's own special (injuries.py: injury_special), with a warning."""
        texts = {row["name"].casefold(): row["text"] for row in read_json_list(SERIOUS_INJURIES_PATH)}
        created = updated = 0
        for name in granted_specials():
            text = texts.get(name.casefold())
            if text is None:
                self.stdout.write(self.style.WARNING(f"Injury special '{name}' isn't in the book's serious injuries"))
                continue
            defaults = {"description": text, "kind": book_kind(name, BANE), "owner_kind": GENERAL}
            _, was_created = upsert_global(Special, {"name": name, "type": INJURY}, defaults)
            if was_created:
                created += 1
            else:
                updated += 1
        return created, updated
