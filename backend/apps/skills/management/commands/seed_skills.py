"""Seed the book's skills and skill groups (skill groups, phase 1a) from the catalogue import: `out/skills.json` (one
skill per name with its rules: our skills table with William's decisions applied, merged by name, and the new groups'
skills) and `out/skill-groups.json` (each group with who learns from it, whether it is a Large unit's, the note shown
when learning from it and its skills by name). Each skill's setting comes from `out/setting-assignments.json`.

Skills are upserted by name and groups by name; each seeded group's skills and who-can lines are written again. A
group's lines name warband types and groups, so they apply once seed_warband_types has run (seed_all runs it first);
before that every group is for everyone. `--json` seeds another skills file (and `--groups` another groups file; with
`--json` alone no group is touched). Campaign rows are never read or written (BUG-17); the run is all or nothing;
there is no --truncate (BUG-16: it deleted campaign skills and every copy of them).
"""

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.catalogue.cache import bump
from apps.core.seeding import IMPORT_OUT, AccessLines, SettingAssignments, clean, read_json_list, upsert_global
from apps.skills.models import Skill, SkillGroup, SkillGroupSkill, SkillGroupWarband
from apps.special.prebattle import SKILL, mark_book_rolls

DEFAULT_JSON_PATH = IMPORT_OUT / "skills.json"
DEFAULT_GROUPS_PATH = IMPORT_OUT / "skill-groups.json"


def _path(given: str | None, default: Path, what: str) -> Path:
    path = Path(given) if given else default
    if not path.exists():
        if given:
            raise CommandError(f"JSON file not found at {path}")
        raise CommandError(f"{what} not found. Provide --json or build the catalogue import ({path}).")
    return path


class Command(BaseCommand):
    help = "Seed skills and skill groups from the catalogue import's JSON."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a skills JSON file.")
        parser.add_argument("--groups", dest="groups_path", help="Path to a skill groups JSON file.")

    def handle(self, *args, **options):
        """Upsert the book's skills by name, then its groups, all or nothing (BUG-17)."""
        with transaction.atomic():
            skills = self._skills(_path(options.get("json_path"), DEFAULT_JSON_PATH, "Skills JSON"))
            groups_path = options.get("groups_path")
            if groups_path or not options.get("json_path"):
                self._groups(_path(groups_path, DEFAULT_GROUPS_PATH, "Skill groups JSON"), skills)
            mark_book_rolls(Skill, SKILL)  # their pre-battle rolls (special/prebattle.py)
            bump(None)  # every cached catalogue list shows the book (PERF-13)

    def _skills(self, path: Path) -> dict[str, Skill]:
        created = updated = skipped = 0
        settings = SettingAssignments("skills")  # each skill's setting, from the catalogue import
        for entry in read_json_list(path, "skill objects"):
            name = clean(entry.get("name")) if isinstance(entry, dict) else ""
            if not name:
                skipped += 1
                continue
            defaults = {"description": clean(entry.get("description")), "campaign_type_id": settings.of(name)}
            _skill, was_created = upsert_global(Skill, {"name": name}, defaults)
            created, updated = (created + 1, updated) if was_created else (created, updated + 1)
        self.stdout.write(
            self.style.SUCCESS(f"Skills import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}")
        )
        return {skill.name.strip().lower(): skill for skill in Skill.objects.filter(campaign__isnull=True)}

    def _groups(self, path: Path, skills: dict[str, Skill]) -> None:
        access = AccessLines()  # who learns from each, once the warband types are seeded
        entries = [entry for entry in read_json_list(path, "skill group objects") if clean(entry.get("name"))]
        names = [clean(entry["name"]) for entry in entries]
        book = SkillGroup.objects.filter(campaign__isnull=True, name__in=names)
        SkillGroupSkill.objects.filter(group__in=book).delete()  # the seeded groups' links, written again below
        SkillGroupWarband.objects.filter(group__in=book).delete()
        links: list[SkillGroupSkill] = []
        lines: list[SkillGroupWarband] = []
        created = 0
        for entry, name in zip(entries, names, strict=True):
            group, was_created = upsert_global(SkillGroup, {"name": name}, self._group_fields(entry, access))
            created += was_created
            links += [SkillGroupSkill(group=group, skill=self._skill(skills, skill, name)) for skill in entry.get("skills", [])]  # fmt: skip
            if access.ready:
                lines += [SkillGroupWarband(group=group, **line) for line in access.of(entry.get("warbands", []), name)]
        SkillGroupSkill.objects.bulk_create(links, ignore_conflicts=True)
        SkillGroupWarband.objects.bulk_create(lines)
        self.stdout.write(
            self.style.SUCCESS(
                f"Skill groups import complete. Created: {created}, Updated: {len(entries) - created}, Links: {len(links)}"
            )
        )

    @staticmethod
    def _group_fields(entry: dict[str, Any], access: AccessLines) -> dict[str, Any]:
        return {
            "for_everyone": bool(entry.get("for_everyone", True)) if access.ready else True,
            "large_only": bool(entry.get("large_only")),
            "learn_note": clean(entry.get("note")),
        }

    @staticmethod
    def _skill(skills: dict[str, Skill], name: Any, group: str) -> Skill:
        found = skills.get(clean(name).lower())
        if found is None:
            raise CommandError(f"Skill group '{group}': no book skill '{clean(name)}'.")
        return found
