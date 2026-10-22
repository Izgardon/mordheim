"""Seeding the book's hired swords and dramatis personae from JSON (`apps/hirelings/data/`): seed_hired_swords and
seed_dramatis_personae read the same shape.

Each row is an object: `name`, `description` (fluff), the nine characteristics, `armour_save` ("4+" or null),
`large`, `caster`, `skills`, `specials`, `spells` and `equipment` (`{"item", "quantity", "item_type"?}` or an item's
name), and the hire terms in one object (`hired_sword`, or `dramatis_persona`): `hire_cost`, `hire_cost_expression`,
`upkeep_cost`, `upkeep_cost_expression`, `rating`, `grade`, `race`, `unique_to`, `available_skill_types` and
`available_special_skills`; a dramatis persona's adds `stays` ("always" or "one_battle") and `payment_note`.

Rows are upserted in the book by name (BUG-17). Links resolve against the book (`core/book_lookups.py`); a row's own
specials, spells and special skills the book lacks are created in it under "Hired Sword - <name>" ("Dramatis
Persona - <name>"), and the special skills' type joins the skill types the row may take. `race` is matched to the
book's race of that name; the text is kept as `race_label` either way. The run is all or nothing.
"""

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.book_lookups import BookLookups
from apps.core.catalogue.cache import bump
from apps.core.seeding import clean, parse_armour_save, parse_int, read_json_list, read_stats, upsert_global
from apps.races.models import Race
from apps.restrictions.book import BookRestrictions
from apps.restrictions.serializers import unique_restriction_notes

from .models import STAYS, DramatisPersona, HiredSword, HirelingProfile
from .writes import write_links

COSTS = ("hire_cost", "upkeep_cost", "rating")


def _no_extras(terms: dict[str, Any], label: str) -> dict[str, Any]:
    return {}


def _persona_terms(terms: dict[str, Any], label: str) -> dict[str, Any]:
    stays = clean(terms.get("stays")) or "always"
    if stays not in dict(STAYS):
        raise CommandError(f"{label}: stays is {stays!r}; use always or one_battle.")
    return {"stays": stays, "payment_note": clean(terms.get("payment_note"))}


@dataclass(frozen=True)
class SeedSpec:
    model: type[HirelingProfile]
    noun: str  # "Hired sword": messages
    path: Path  # the committed data
    terms: str  # the object holding a row's hire terms
    own_type: str  # what a row's own specials, spells and special skills are typed "<own_type> - <name>"
    extras: Callable[[dict[str, Any], str], dict[str, Any]] = _no_extras  # the kind's own hire terms


HIRED_SWORDS = SeedSpec(HiredSword, "Hired sword", Path("apps/hirelings/data/hired-swords.json"), "hired_sword", "Hired Sword")  # fmt: skip
DRAMATIS_PERSONAE = SeedSpec(
    DramatisPersona,
    "Dramatis persona",
    Path("apps/hirelings/data/dramatis-personae.json"),
    "dramatis_persona",
    "Dramatis Persona",
    _persona_terms,
)


class _Run:
    """One seeder run: the book's entries, restrictions and races it links rows to, and what it did."""

    def __init__(self, spec: SeedSpec) -> None:
        self.spec = spec
        self.lookups = BookLookups(spec.own_type)
        self.restrictions = BookRestrictions()
        book_races = Race.objects.filter(campaign__isnull=True, campaign_type__isnull=True)
        self.races = {race.name.strip().lower(): race for race in book_races}
        self.counts: Counter[str] = Counter()

    def seed(self, data: dict[str, Any]) -> None:
        name = clean(data.get("name"))
        if not name:
            return
        row, created = upsert_global(self.spec.model, {"name": name}, self.defaults(data, name))
        self.counts["created" if created else "updated"] += 1
        self.link(row, data)

    def defaults(self, data: dict[str, Any], name: str) -> dict[str, Any]:
        label = f"{self.spec.noun} '{name}'"
        terms = data.get(self.spec.terms) or {}
        skill_types = list(terms.get("available_skill_types") or [])
        own_type = self.lookups.own_type_of(name)
        if self.lookups.special_skills(terms.get("available_special_skills", []), name) and own_type not in skill_types:
            skill_types.append(own_type)
        race_label = clean(terms.get("race"))
        return {
            "description": data.get("description", ""),
            "armour_save": parse_armour_save(data.get("armour_save")),
            "large": bool(data.get("large", False)),
            "caster": data.get("caster") or "No",
            **read_stats(data, label),  # fail loudly (BUG-54)
            **{field: (parse_int(terms[field]) if terms.get(field) is not None else None) for field in COSTS},
            "hire_cost_expression": clean(terms.get("hire_cost_expression")),
            "upkeep_cost_expression": clean(terms.get("upkeep_cost_expression")),
            "grade": clean(terms.get("grade")),
            "race": self.races.get(race_label.lower()),
            "race_label": race_label,
            "available_skill_types": skill_types,
            **self.spec.extras(terms, label),
        }

    def link(self, row: HirelingProfile, data: dict[str, Any]) -> None:
        """The row's links become the data's: each kind in one INSERT, through the catalogue's link builder."""
        links = self.lookups.links(data, row.name)
        unique_to = clean((data.get(self.spec.terms) or {}).get("unique_to"))
        notes = [
            {"restriction_id": restriction.id, "additional_note": note}
            for restriction, note in (self.restrictions.resolve(unique_to) if unique_to else [])
        ]
        resolved = {
            "skill_ids": [skill.id for skill in links.skills],
            "special_ids": [special.id for special in links.specials],
            "spell_ids": [spell.id for spell in links.spells],
            "item_entries": [{"item_id": pk, "quantity": quantity} for pk, quantity in links.quantities.items()],
            "restriction_ids": unique_restriction_notes(notes),
        }
        write_links(row, resolved, replace=True)


def seed_profiles(spec: SeedSpec, paths: list[Path]) -> tuple[Counter[str], list[str]]:
    """Seed every file in one transaction; what was created and updated, and the warnings to print."""
    run = _Run(spec)
    with transaction.atomic():
        for path in paths:
            if not path.exists():
                run.lookups.warnings.append(f"  File not found: {path}")
                continue
            for data in read_json_list(path, f"{spec.noun.lower()} rows"):
                run.seed(data)
        bump(None)  # every cached catalogue list shows the book (PERF-13)
    return run.counts, run.lookups.warnings


class SeedCommand(BaseCommand):
    """seed_hired_swords and seed_dramatis_personae: the committed file, or the files `--json` names."""

    spec: SeedSpec

    def add_arguments(self, parser):
        parser.add_argument(
            "--json", dest="json_paths", action="append", help="A JSON file to seed from. May be given more than once."
        )

    def handle(self, *args, **options):
        paths = [Path(path) for path in options.get("json_paths") or [self.spec.path]]
        counts, warnings = seed_profiles(self.spec, paths)
        for warning in warnings:
            self.stdout.write(self.style.WARNING(warning))
        self.stdout.write(
            self.style.SUCCESS(
                f"{self.spec.noun} import complete. Created: {counts['created']}, updated: {counts['updated']}."
            )
        )
