import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection

from apps.campaigns.models import CampaignType
from apps.restrictions.models import Restriction, RestrictionCampaignType

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
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing restrictions before importing.",
        )

    def handle(self, *args, **options):
        json_path = options.get("json_path")
        truncate = options.get("truncate")

        if truncate:
            RestrictionCampaignType.objects.all().delete()
            Restriction.objects.all().delete()

        path = Path(json_path) if json_path else DEFAULT_JSON_PATH
        if not path.exists():
            raise CommandError(f"JSON file not found: {path}")

        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Unable to parse JSON ({path}): {exc}") from exc

        if not isinstance(data, list):
            raise CommandError(f"JSON data should be a list: {path}")

        campaign_types = list(CampaignType.objects.all())

        created = 0
        updated = 0
        for entry in data:
            restriction_type = entry.get("type", "Warband").strip()
            restriction_text = entry.get("restriction", "").strip()

            if not restriction_text:
                continue

            restriction, was_created = Restriction.objects.update_or_create(
                restriction=restriction_text,
                campaign__isnull=True,
                defaults={"type": restriction_type},
            )
            if was_created:
                created += 1
            else:
                updated += 1

            if campaign_types:
                RestrictionCampaignType.objects.bulk_create(
                    [
                        RestrictionCampaignType(
                            campaign_type=ct, restriction=restriction
                        )
                        for ct in campaign_types
                    ],
                    ignore_conflicts=True,
                )

        _reset_sequence(Restriction)
        self.stdout.write(
            self.style.SUCCESS(
                f"Restrictions import complete. Created: {created}, Updated: {updated}"
            )
        )
