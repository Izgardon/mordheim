import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.campaigns.models import CampaignType
from apps.spells.models import Spell, SpellCampaignType
from apps.special.models import Special, SpecialCampaignType

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
            SpellCampaignType.objects.all().delete()
            Spell.objects.all().delete()
            SpecialCampaignType.objects.all().delete()
            Special.objects.all().delete()

        campaign_types = list(CampaignType.objects.all())

        spells_created, spells_updated = self._seed_spells(campaign_types)
        special_created, special_updated = self._seed_special(campaign_types)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete. "
                f"Spells - Created: {spells_created}, Updated: {spells_updated}. "
                f"Special - Created: {special_created}, Updated: {special_updated}."
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
            roll = entry.get("roll")

            if not name or not spell_type:
                continue

            spell, was_created = Spell.objects.update_or_create(
                name=name,
                type=spell_type,
                defaults={"description": description, "dc": dc, "roll": roll},
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

    def _seed_special(self, campaign_types):
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

            special, was_created = Special.objects.update_or_create(
                name=name,
                type=special_type,
                defaults={"description": description},
            )

            if campaign_types:
                SpecialCampaignType.objects.bulk_create(
                    [
                        SpecialCampaignType(campaign_type=ct, special=special)
                        for ct in campaign_types
                    ],
                    ignore_conflicts=True,
                )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated
