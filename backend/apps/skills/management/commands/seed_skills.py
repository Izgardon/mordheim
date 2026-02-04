import csv
import io
import json
from pathlib import Path
from urllib.request import urlopen

from django.core.management.base import BaseCommand, CommandError

from apps.campaigns.models import CampaignType
from apps.skills.models import Skill, SkillCampaignType

DEFAULT_JSON_PATH = Path("apps/skills/data/skills.json")
FALLBACK_JSON_PATHS = [DEFAULT_JSON_PATH]
DEFAULT_CSV_PATH = Path("csvs/skills.csv")
FALLBACK_CSV_PATHS = [DEFAULT_CSV_PATH, Path("apps/skills/data/skills.csv")]
DEFAULT_URL = "https://docs.google.com/spreadsheets/d/1wkTJiWW36RU3DIIsjMt_ROR5HTO31RHY-n4YjjlnAa4/export?format=csv&gid=1087642481"

HEADER_ALIASES = {
    "name": ["name", "skill", "skill name", "skill_name"],
    "type": ["type", "skill type", "skill_type", "category", "group"],
    "description": ["description", "desc", "details", "effect", "rules"],
}


def _normalize(value):
    return str(value or "").strip()


def _normalize_skill_type(value):
    cleaned = _normalize(value)
    if not cleaned:
        return cleaned
    if cleaned.lower().endswith("skills"):
        cleaned = cleaned[: -len("skills")].rstrip()
        if cleaned.endswith("'") or cleaned.endswith("’"):
            cleaned = cleaned[:-1].rstrip()
    return cleaned


def _resolve_field(field_map, aliases):
    for alias in aliases:
        if alias in field_map:
            return field_map[alias]
    return None


def _resolve_default_json_path():
    for path in FALLBACK_JSON_PATHS:
        if path.exists():
            return path
    return None


def _resolve_default_csv_path():
    for path in FALLBACK_CSV_PATHS:
        if path.exists():
            return path

    csv_dir = Path("csvs")
    if csv_dir.exists():
        candidates = sorted(
            csv_dir.glob("*.csv"),
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        )
        if candidates:
            return candidates[0]

    return None


def _get_entry_value(entry, aliases):
    if not isinstance(entry, dict):
        return None
    key_map = {str(key).strip().lower(): key for key in entry.keys()}
    for alias in aliases:
        key = key_map.get(alias)
        if key is not None:
            return entry.get(key)
    return None


class Command(BaseCommand):
    help = "Seed skills from a CSV export or JSON data file."

    def add_arguments(self, parser):
        parser.add_argument("--csv", dest="csv_path", help="Path to a CSV file.")
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")
        parser.add_argument("--url", dest="url", help="URL to a CSV export.")
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing skills before importing.",
        )

    def handle(self, *args, **options):
        csv_path = options.get("csv_path")
        json_path = options.get("json_path")
        url = options.get("url")
        truncate = options.get("truncate")

        if truncate:
            SkillCampaignType.objects.all().delete()
            Skill.objects.all().delete()

        campaign_types = list(CampaignType.objects.all())

        if json_path:
            entries = self._load_json_entries(json_path)
            created, updated, skipped = self._seed_from_entries(entries, campaign_types)
            self._report(created, updated, skipped)
            return

        if url or csv_path:
            raw_data = self._load_csv_data(csv_path, url)
            created, updated, skipped = self._seed_from_csv(raw_data, campaign_types)
            self._report(created, updated, skipped)
            return

        entries = self._load_json_entries(None, allow_missing=True)
        if entries is not None:
            created, updated, skipped = self._seed_from_entries(entries, campaign_types)
            self._report(created, updated, skipped)
            return

        raw_data = self._load_csv_data(None, None)
        created, updated, skipped = self._seed_from_csv(raw_data, campaign_types)
        self._report(created, updated, skipped)

    def _seed_from_entries(self, entries, campaign_types):
        created = 0
        updated = 0
        skipped = 0

        for entry in entries:
            raw_name = _normalize(_get_entry_value(entry, HEADER_ALIASES["name"]))
            raw_description = _normalize(
                _get_entry_value(entry, HEADER_ALIASES["description"])
            )
            raw_type = _normalize_skill_type(
                _get_entry_value(entry, HEADER_ALIASES["type"])
            )

            if not raw_name or not raw_type:
                skipped += 1
                continue

            skill, was_created = Skill.objects.update_or_create(
                name=raw_name,
                type=raw_type,
                defaults={"description": raw_description},
            )

            if campaign_types:
                SkillCampaignType.objects.bulk_create(
                    [
                        SkillCampaignType(campaign_type=ct, skill=skill)
                        for ct in campaign_types
                    ],
                    ignore_conflicts=True,
                )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated, skipped

    def _seed_from_csv(self, raw_data, campaign_types):
        reader = csv.DictReader(io.StringIO(raw_data))

        if not reader.fieldnames:
            raise CommandError("CSV file is missing a header row.")

        header_map = {
            str(name).strip().lower(): name
            for name in reader.fieldnames
            if name
        }

        name_field = _resolve_field(header_map, HEADER_ALIASES["name"])
        type_field = _resolve_field(header_map, HEADER_ALIASES["type"])
        description_field = _resolve_field(header_map, HEADER_ALIASES["description"])

        if not name_field or not description_field:
            headers = reader.fieldnames
            if headers:
                if not name_field:
                    name_field = headers[0]
                if not description_field and len(headers) > 1:
                    description_field = headers[1]
                if not type_field and len(headers) > 2:
                    type_field = headers[2]

        if not name_field:
            raise CommandError("Unable to detect the skill name column.")

        current_type = ""
        created = 0
        updated = 0
        skipped = 0

        for row in reader:
            raw_name = _normalize(row.get(name_field))
            raw_description = _normalize(row.get(description_field))
            raw_type = _normalize_skill_type(row.get(type_field)) if type_field else ""

            if not raw_name and not raw_description and raw_type:
                current_type = raw_type
                continue

            if not raw_type:
                raw_type = current_type

            if not raw_name or not raw_type:
                skipped += 1
                continue

            skill, was_created = Skill.objects.update_or_create(
                name=raw_name,
                type=raw_type,
                defaults={"description": raw_description},
            )

            if campaign_types:
                SkillCampaignType.objects.bulk_create(
                    [
                        SkillCampaignType(campaign_type=ct, skill=skill)
                        for ct in campaign_types
                    ],
                    ignore_conflicts=True,
                )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated, skipped

    def _report(self, created, updated, skipped):
        self.stdout.write(
            self.style.SUCCESS(
                f"Skills import complete. Created: {created}, Updated: {updated}, Skipped: {skipped}"
            )
        )

    def _load_json_entries(self, json_path, allow_missing=False):
        if json_path:
            path = Path(json_path)
            if not path.exists():
                raise CommandError(f"JSON file not found at {path}")
        else:
            path = _resolve_default_json_path()
            if not path:
                if allow_missing:
                    return None
                raise CommandError(
                    "JSON file not found. Provide --json or place data at apps/skills/data/skills.json."
                )

        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Unable to parse JSON: {exc}") from exc

        if not isinstance(data, list):
            raise CommandError("JSON data should be a list of skill objects.")

        return data

    def _load_csv_data(self, csv_path, url):
        if url:
            try:
                with urlopen(url) as response:
                    return response.read().decode("utf-8-sig")
            except Exception as exc:
                raise CommandError(f"Unable to download CSV: {exc}") from exc

        if csv_path:
            path = Path(csv_path)
        else:
            path = _resolve_default_csv_path()

        if not path or not path.exists():
            raise CommandError(
                "CSV file not found. Provide --csv or --url, or place a CSV in csvs/ or apps/skills/data/skills.csv."
            )

        return path.read_text(encoding="utf-8-sig")
