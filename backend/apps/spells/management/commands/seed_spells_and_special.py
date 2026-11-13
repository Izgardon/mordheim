"""Seed the book's spells and specials from JSON (`apps/spells/data/spells.json`, `apps/special/data/special.json`),
the specials the serious injury tables grant by name, typed "Injury", with the book's rule text (the catalogue
import's `out/serious-injuries.json`), and the shared specials (Fear, Stupidity, the mutations: the import's
`out/shared-specials.json`, special/shared.py), archiving the copies of them seeded before.

Rows are matched by name and type in the book only (BUG-17); the run is all or nothing; there is no --truncate
(BUG-16: it deleted campaign rows and every copy of them). A lore keeps the first spell on each roll: a later one on
a taken roll is saved with none, and the run says so (spells/rolls.py).
"""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.battles.services.injuries import granted_specials
from apps.campaigns.models import CampaignType
from apps.core.book_lookups import lookup_key
from apps.core.catalogue.cache import bump
from apps.core.seeding import IMPORT_OUT, read_json_list, upsert_global
from apps.special.categories import book_category
from apps.special.kinds import BANE, GENERAL, INJURY, book_kind
from apps.special.models import Special
from apps.special.prebattle import SPECIAL, mark_book_rolls
from apps.special.shared import read_shared
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
            shared_created, shared_updated, copies = self._seed_shared_specials()
            mark_book_rolls(Special, SPECIAL)  # their pre-battle rolls (special/prebattle.py)
            bump(None)  # every cached catalogue list shows the book (PERF-13)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete. "
                f"Spells - Created: {spells_created}, Updated: {spells_updated}. "
                f"Special - Created: {special_created}, Updated: {special_updated}. "
                f"Injury specials - Created: {injury_created}, Updated: {injury_updated}. "
                f"Shared specials - Created: {shared_created}, Updated: {shared_updated}, copies archived: {copies}."
            )
        )

    def _seed(
        self, model: type[Spell] | type[Special], path: Path, label: str, texts: tuple[str, ...]
    ) -> tuple[int, int]:
        """Upsert each named, typed row of the file: its stripped texts, a spell's roll, a special's kind and
        category, and either's setting (none: Mordheim's; Border Town Burning's beasts' rules are that setting's,
        the Hobgoblin Magic lore Khemri 3's)."""
        if not path.exists():
            self.stdout.write(self.style.WARNING(f"{label} JSON not found at {path}"))
            return 0, 0
        created = updated = 0
        entries = read_json_list(path)
        settings = dict(CampaignType.objects.values_list("slug", "id"))
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
                defaults["campaign_type_id"] = settings.get(entry.get("setting") or "")
            else:  # Boons & Banes (special/kinds.py) and its icon (special/categories.py)
                defaults["campaign_type_id"] = settings.get(entry.get("setting") or "")
                defaults["kind"] = book_kind(name)
                defaults["category"] = book_category(name, entry_type)
            _, was_created = upsert_global(model, {"name": name, "type": entry_type}, defaults)
            if was_created:
                created += 1
            else:
                updated += 1
        return created, updated

    def _seed_injury_specials(self) -> tuple[int, int]:
        """Each special the injury tables grant by name as the book's general "Injury" special, its kind the book's
        classification (a bane unless it says otherwise), its category injury and its text the book's result of that
        name. A name the book's table lacks is left to the campaign's own special (injuries.py: injury_special), with
        a warning."""
        texts = {row["name"].casefold(): row["text"] for row in read_json_list(SERIOUS_INJURIES_PATH)}
        created = updated = 0
        for name in granted_specials():
            text = texts.get(name.casefold())
            if text is None:
                self.stdout.write(self.style.WARNING(f"Injury special '{name}' isn't in the book's serious injuries"))
                continue
            defaults = {
                "description": text,
                "kind": book_kind(name, BANE),
                "category": book_category(name, INJURY),
                "owner_kind": GENERAL,
            }
            _, was_created = upsert_global(Special, {"name": name, "type": INJURY}, defaults)
            if was_created:
                created += 1
            else:
                updated += 1
        return created, updated

    def _seed_shared_specials(self) -> tuple[int, int, int]:
        """Each shared special as the book's general special of its name and type, with its wording, its price (a
        mutation's, where a list sells it), its setting (none: Mordheim's; one not seeded yet reads as none), its kind
        and its category the book's classification; then every other unarchived book special of a shared name or
        alias, or of a rule kept apart under a name of its own (a mount's Fear, a fighter's Cause Fear, the
        Nightmare's Immune to Psychology (Mount) seeded before), is archived, since its owners link the shared one or
        their own now. An injury table's special is never one of those copies: the shared Trait Hardened and the
        injury of that name are two rules, and the injury's row stays the injury's (William, 13 Nov 2026)."""
        data = read_shared()
        entries = data["specials"]
        settings = dict(CampaignType.objects.values_list("slug", "id"))
        created = updated = 0
        shared: list[int] = []
        for entry in entries:
            name, entry_type = entry["name"], entry["type"]
            defaults = {
                "description": entry["description"],
                "cost": entry.get("cost"),
                "campaign_type_id": settings.get(entry.get("setting") or ""),
                "kind": book_kind(name),
                "category": book_category(name, entry_type),
                "owner_kind": GENERAL,
                "archived_at": None,
            }
            row, was_created = upsert_global(Special, {"name": name, "type": entry_type}, defaults)
            shared.append(row.pk)
            if was_created:
                created += 1
            else:
                updated += 1
        names = {lookup_key(name) for entry in entries for name in (entry["name"], *entry["aliases"])}
        names |= {lookup_key(line["rule"]) for line in data["apart"]}
        live = (
            Special.objects.filter(campaign__isnull=True, archived_at__isnull=True)
            .exclude(pk__in=shared)
            .exclude(type=INJURY)  # the injury tables' own rows of a shared name (Hardened) are not copies of it
        )
        copies = [row.pk for row in live.only("pk", "name") if lookup_key(row.name) in names]
        archived = Special.objects.filter(pk__in=copies).update(archived_at=timezone.now())
        return created, updated, archived
