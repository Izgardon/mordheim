"""Grading phase 1: the book's warband types and groups, seeded from the catalogue import (seed_warband_types)."""

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.campaigns.models import Campaign
from apps.warbands.management.commands.seed_warband_types import seed_types
from apps.warbands.models import WarbandGroup, WarbandType


def seed() -> None:
    call_command("seed_settings", stdout=StringIO())
    call_command("seed_warband_types", stdout=StringIO())


class SeedWarbandTypesTests(TestCase):
    def test_the_import_seeds_164_types_in_their_settings_and_20_groups(self) -> None:
        seed()
        self.assertEqual(WarbandType.objects.filter(campaign__isnull=True).count(), 164)
        self.assertFalse(WarbandType.objects.filter(campaign_type__isnull=True).exists())
        skaven_type = WarbandType.objects.select_related("campaign_type").get(slug="skaven")
        self.assertEqual(skaven_type.campaign_type and skaven_type.campaign_type.slug, "mordheim")
        self.assertTrue(skaven_type.link_url.startswith("https://"))
        lizardmen = WarbandType.objects.filter(name="Lizardmen").order_by("source_code")
        self.assertEqual([row.source_code for row in lizardmen], ["LUS", "TC11"])
        self.assertEqual(WarbandGroup.objects.count(), 20)
        skaven = WarbandGroup.objects.get(slug="skaven")
        self.assertEqual(skaven.kind, "race")
        self.assertIn("skaven", set(skaven.members.values_list("slug", flat=True)))
        self.assertEqual(
            set(WarbandGroup.objects.filter(members__slug="reiklanders").values_list("slug", flat=True)),
            {"humans", "mercenaries", "good"},
        )

    def test_seeding_twice_updates_in_place_and_resets_members(self) -> None:
        seed()
        WarbandType.objects.filter(slug="reiklanders").update(name="Reik", link_url="")
        WarbandGroup.objects.get(slug="skaven").members.clear()
        seed()
        reiklanders = WarbandType.objects.get(slug="reiklanders")
        self.assertEqual(reiklanders.name, "Reiklanders")
        self.assertNotEqual(reiklanders.link_url, "")
        self.assertEqual(WarbandGroup.objects.get(slug="skaven").members.count(), 13)
        self.assertEqual(WarbandType.objects.count(), 164)

    def test_a_type_the_import_dropped_is_archived_and_campaign_types_are_left_alone(self) -> None:
        seed()
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        old = WarbandType.objects.create(name="Old Warband", slug="old-warband")
        own = WarbandType.objects.create(name="Our Own", slug="our-own", campaign=campaign)
        seed()
        old.refresh_from_db()
        own.refresh_from_db()
        self.assertIsNotNone(old.archived_at)
        self.assertIsNone(own.archived_at)

    def test_a_type_in_an_unseeded_setting_stops_the_run(self) -> None:
        with self.assertRaisesMessage(CommandError, "setting 'khemri' isn't seeded"):
            seed_types([{"slug": "tomb-guardians", "name": "Tomb Guardians", "setting": "khemri"}])
