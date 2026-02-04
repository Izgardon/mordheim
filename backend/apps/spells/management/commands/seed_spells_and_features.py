import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.campaigns.models import CampaignType
from apps.spells.models import Spell, SpellCampaignType
from apps.features.models import Feature, FeatureCampaignType

SPELLS_JSON_PATH = Path("apps/spells/data/spells.json")
FEATURES_JSON_PATH = Path("apps/features/data/features.json")


class Command(BaseCommand):
    help = "Seed spells and features from JSON data files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing spells and features before seeding.",
        )

    def handle(self, *args, **options):
        truncate = options.get("truncate")

        if truncate:
            SpellCampaignType.objects.all().delete()
            Spell.objects.all().delete()
            FeatureCampaignType.objects.all().delete()
            Feature.objects.all().delete()

        campaign_types = list(CampaignType.objects.all())

        spells_created, spells_updated = self._seed_spells(campaign_types)
        features_created, features_updated = self._seed_features(campaign_types)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete. "
                f"Spells - Created: {spells_created}, Updated: {spells_updated}. "
                f"Features - Created: {features_created}, Updated: {features_updated}."
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

    def _seed_features(self, campaign_types):
        if not FEATURES_JSON_PATH.exists():
            self.stdout.write(self.style.WARNING(f"Features JSON not found at {FEATURES_JSON_PATH}"))
            return 0, 0

        data = json.loads(FEATURES_JSON_PATH.read_text(encoding="utf-8-sig"))
        created = 0
        updated = 0

        for entry in data:
            name = entry.get("name", "").strip()
            feature_type = entry.get("type", "").strip()
            description = entry.get("description", "").strip()

            if not name or not feature_type:
                continue

            feature, was_created = Feature.objects.update_or_create(
                name=name,
                type=feature_type,
                defaults={"description": description},
            )

            if campaign_types:
                FeatureCampaignType.objects.bulk_create(
                    [
                        FeatureCampaignType(campaign_type=ct, feature=feature)
                        for ct in campaign_types
                    ],
                    ignore_conflicts=True,
                )

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated

