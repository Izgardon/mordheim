"""Grading phase 1: the book's warband types and groups, seeded from the catalogue import (seed_warband_types)."""

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.campaigns.in_play import with_in_play
from apps.campaigns.models import Campaign, CampaignType
from apps.warbands.management.commands.seed_warband_types import seed_types
from apps.warbands.models import WarbandGroup, WarbandType


def seed() -> None:
    call_command("seed_settings", stdout=StringIO())
    call_command("seed_warband_types", stdout=StringIO())


class SeedWarbandTypesTests(TestCase):
    def test_the_import_seeds_160_types_in_their_settings_and_20_groups(self) -> None:
        seed()
        # 161 until the Albion Commandos went: a phantom type the importer made from "Caber (Albion Commandos
        # only)" in the Marienburg weapons list (William, 12 Nov 2026)
        self.assertEqual(WarbandType.objects.filter(campaign__isnull=True).count(), 160)
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
        self.assertEqual(WarbandType.objects.count(), 160)

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

    def test_karak_eight_peaks_is_no_setting_and_its_three_warbands_are_retired(self) -> None:
        # William, 11 Nov 2026, of its three warband PDFs, scans with no text layer: "skip and remove the setting
        # from options". Each type is dropped from the import and archived rather than left without a setting,
        # which would count as Mordheim's and put it in play in a plain Mordheim campaign (campaigns/in_play.py).
        retired = ["clan-angrund", "crooked-moon", "slave-uprising"]
        seed()
        self.assertFalse(CampaignType.objects.filter(slug="karak-eight-peaks").exists())
        self.assertFalse(WarbandType.objects.filter(slug__in=retired).exists())
        mordheim = CampaignType.objects.get(slug="mordheim")
        for slug in retired:  # as a database seeded before the removal holds them
            WarbandType.objects.create(name=slug, slug=slug, campaign_type=mordheim)

        seed()

        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        live = with_in_play(WarbandType.objects.filter(campaign__isnull=True, archived_at__isnull=True), campaign.pk)
        self.assertEqual([row.slug for row in live.filter(slug__in=retired)], [])
        self.assertEqual(WarbandType.objects.filter(slug__in=retired, archived_at__isnull=False).count(), 3)
        orphan = WarbandType.objects.create(name="Orphan", slug="orphan")  # one left without a setting reads in play
        read = with_in_play(WarbandType.objects.filter(pk=orphan.pk), campaign.pk).get()
        self.assertTrue(getattr(read, "in_play"))  # noqa: B009

    def test_a_type_in_an_unseeded_setting_stops_the_run(self) -> None:
        with self.assertRaisesMessage(CommandError, "setting 'khemri' isn't seeded"):
            seed_types([{"slug": "tomb-guardians", "name": "Tomb Guardians", "setting": "khemri"}])
