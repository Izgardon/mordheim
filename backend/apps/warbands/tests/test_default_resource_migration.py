"""The default resource's data migration (warbands/0013): each existing warband's Wyrdstone-like resource, by the
spellings fees use, becomes its default, named as its campaign's setting names it; a warband without one gets a new
default at 0; nothing else changes, and running it again changes nothing."""

from importlib import import_module
from typing import Any

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.campaigns.models import Campaign, CampaignSettings
from apps.warbands.models import Warband, WarbandResource

mark_default_resources = import_module("apps.warbands.migrations.0013_mark_default_resources").mark_default_resources


class MarkDefaultResourcesTests(TestCase):
    def setUp(self) -> None:
        self.campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        CampaignSettings.objects.create(campaign=self.campaign)
        renamed = Campaign.objects.create(name="Warp", join_code="WARPED")
        CampaignSettings.objects.create(campaign=renamed, default_resource_name="Warpstone")
        bare = Campaign.objects.create(name="Bare", join_code="BARE01")  # no settings row: Wyrdstone
        self.warbands = {
            name: Warband.objects.create(campaign=campaign, user=self.user(name), name=name)
            for name, campaign in (
                ("Shards", self.campaign),
                ("Both", self.campaign),
                ("Nothing", self.campaign),
                ("Done", self.campaign),
                ("Warp", renamed),
                ("Bare", bare),
            )
        }
        for warband, name, amount in (
            ("Shards", "Treasure", 2),
            ("Shards", "Wyrdstone  Shards", 5),
            ("Both", "Shards", 1),
            ("Both", "wyrdstone", 4),
            ("Nothing", "Treasure", 3),
            ("Warp", "Shard", 6),
            ("Bare", "wyrdstones", 7),
        ):
            WarbandResource.objects.create(warband=self.warbands[warband], name=name, amount=amount)
        WarbandResource.objects.create(warband=self.warbands["Done"], name="Shards", amount=1)
        WarbandResource.objects.create(warband=self.warbands["Done"], name="Gold", amount=2, is_default=True)

    def user(self, name: str) -> Any:
        email = f"{name.lower()}@example.com"
        return get_user_model().objects.create_user(username=email, email=email)

    def rows(self, name: str) -> list[tuple[str, int, bool]]:
        rows = WarbandResource.objects.filter(warband=self.warbands[name]).order_by("id")
        return list(rows.values_list("name", "amount", "is_default"))

    def test_each_warband_gets_its_default_resource(self):
        mark_default_resources(django_apps, None)

        self.assertEqual(self.rows("Shards"), [("Treasure", 2, False), ("Wyrdstone", 5, True)])
        self.assertEqual(self.rows("Both"), [("Shards", 1, False), ("Wyrdstone", 4, True)])  # its name first
        self.assertEqual(self.rows("Nothing"), [("Treasure", 3, False), ("Wyrdstone", 0, True)])
        self.assertEqual(self.rows("Done"), [("Shards", 1, False), ("Gold", 2, True)])  # it had one
        self.assertEqual(self.rows("Warp"), [("Warpstone", 6, True)])  # the campaign's name
        self.assertEqual(self.rows("Bare"), [("Wyrdstone", 7, True)])

    def test_running_it_again_changes_nothing(self):
        mark_default_resources(django_apps, None)
        before = {name: self.rows(name) for name in self.warbands}

        mark_default_resources(django_apps, None)

        self.assertEqual({name: self.rows(name) for name in self.warbands}, before)
