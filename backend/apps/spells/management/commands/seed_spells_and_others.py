import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.campaigns.models import CampaignType
from apps.spells.models import Spell, SpellCampaignType
from apps.others.models import Other, OtherCampaignType

SPELLS_JSON_PATH = Path("apps/spells/data/spells.json")
OTHERS_JSON_PATH = Path("apps/others/data/others.json")


class Command(BaseCommand):
    help = "Seed spells and others from JSON data files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing spells and others before seeding.",
        )

    def handle(self, *args, **options):
        truncate = options.get("truncate")

        if truncate:
            SpellCampaignType.objects.all().delete()
            Spell.objects.all().delete()
            OtherCampaignType.objects.all().delete()
            Other.objects.all().delete()

        campaign_types = list(CampaignType.objects.all())

        spells_created, spells_updated = self._seed_spells(campaign_types)
        others_created, others_updated = self._seed_others(campaign_types)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete. "
                f"Spells - Created: {spells_created}, Updated: {spells_updated}. "
                f"Others - Created: {others_created}, Updated: {others_updated}."
            )
        )

    def _seed_spells(self, campaign_types):
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

            if not name or not spell_type:
                continue

            spell, was_created = Spell.objects.update_or_create(
                name=name,
                type=spell_type,
                defaults={"description": description, "dc": dc},
            )

            if campaign_types:
                SpellCampaignType.objects.bulk_create(
                    [
                        SpellCampaignType(campaign_type=ct, spell=spell)
                        for ct in campaign_types
                    ],
                    ignore_conflicts=True,
                )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated

    def _seed_others(self, campaign_types):
        if not OTHERS_JSON_PATH.exists():
            self.stdout.write(self.style.WARNING(f"Others JSON not found at {OTHERS_JSON_PATH}"))
            return 0, 0

        data = json.loads(OTHERS_JSON_PATH.read_text(encoding="utf-8-sig"))
        created = 0
        updated = 0

        for entry in data:
            name = entry.get("name", "").strip()
            other_type = entry.get("type", "").strip()
            description = entry.get("description", "").strip()

            if not name or not other_type:
                continue

            other, was_created = Other.objects.update_or_create(
                name=name,
                type=other_type,
                defaults={"description": description},
            )

            if campaign_types:
                OtherCampaignType.objects.bulk_create(
                    [
                        OtherCampaignType(campaign_type=ct, other=other)
                        for ct in campaign_types
                    ],
                    ignore_conflicts=True,
                )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated
