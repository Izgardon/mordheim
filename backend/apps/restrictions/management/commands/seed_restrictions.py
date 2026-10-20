import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.restrictions.models import Restriction

DEFAULT_JSON_PATH = Path("apps/restrictions/data/restrictions.json")


def _reset_sequence(model):
    sequence_sql = connection.ops.sequence_reset_sql(no_style(), [model])
    if not sequence_sql:
        return
    with connection.cursor() as cursor:
        for sql in sequence_sql:
            cursor.execute(sql)


class Command(BaseCommand):
    help = "Seed restrictions from JSON data."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", help="Path to a JSON file.")

    def handle(self, *args, **options):
        """Upsert the book's restrictions by text and type, all or nothing; campaign rows are never read or written
        (BUG-17). There is no --truncate: it deleted campaign restrictions, their links and every campaign's item
        settings (BUG-16); a wipe replaces it."""
        with transaction.atomic():
            self._import(options)

    def _import(self, options):
        json_path = options.get("json_path")

        path = Path(json_path) if json_path else DEFAULT_JSON_PATH
        if not path.exists():
            raise CommandError(f"JSON file not found: {path}")

        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Unable to parse JSON ({path}): {exc}") from exc

        if not isinstance(data, list):
            raise CommandError(f"JSON data should be a list: {path}")

        created = 0
        updated = 0
        for entry in data:
            restriction_type = entry.get("type", "Warband").strip()
            restriction_text = entry.get("restriction", "").strip()

            if not restriction_text:
                continue

            _, was_created = Restriction.objects.get_or_create(
                restriction=restriction_text, type=restriction_type, campaign=None, campaign_type=None
            )
            if was_created:
                created += 1
            else:
                updated += 1

        _reset_sequence(Restriction)
        self.stdout.write(self.style.SUCCESS(f"Restrictions import complete. Created: {created}, Updated: {updated}"))
