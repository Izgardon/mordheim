"""Grading phase 1: the warband types a campaign picks from (the book's and its own, each in play or not), adding a
custom type, and raising or changing a warband with a type and what it counts as."""

from io import StringIO
from typing import Any

from django.core.management import call_command
from django.utils import timezone

from apps.campaigns.in_play import set_settings
from apps.campaigns.models import CampaignType
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.warbands.models import Warband, WarbandType


class WarbandTypesTestCase(CampaignTestCase):
    """The shared campaign ("Shards", Mordheim and Khemri ticked) with the import's settings, types and groups."""

    @classmethod
    def setUpTestData(cls) -> None:
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_warband_types", stdout=StringIO())
        super().setUpTestData()
        set_settings(cls.campaign, [CampaignType.objects.get(slug="khemri").id])

    def book(self, slug: str) -> WarbandType:
        return WarbandType.objects.get(campaign=None, slug=slug)

    def types_url(self, campaign: Any = None) -> str:
        return self.url("warband-types/", campaign)


class WarbandTypeListTests(WarbandTypesTestCase):
    def test_the_list_holds_the_book_and_the_campaigns_own_each_saying_if_it_is_in_play(self) -> None:
        WarbandType.objects.create(name="Gutter Kings", slug="gutter-kings", campaign=self.campaign)
        WarbandType.objects.create(name="Far Away", slug="far-away", campaign=self.elsewhere)
        WarbandType.objects.filter(slug="sartosan-pirates").update(archived_at=timezone.now())
        rows = {row["slug"]: row for row in self.get_as(self.player, self.types_url()).data}
        self.assertEqual(len(rows), 161)  # the 160 and the tests' Mercenaries, one archived, plus the campaign's own
        self.assertNotIn("far-away", rows)
        self.assertNotIn("sartosan-pirates", rows)
        self.assertEqual(rows["gutter-kings"]["campaign_id"], self.campaign.id)
        self.assertEqual((rows["gutter-kings"]["setting"], rows["gutter-kings"]["in_play"]), (None, True))
        self.assertEqual((rows["skaven"]["setting"]["slug"], rows["skaven"]["in_play"]), ("mordheim", True))
        self.assertTrue(rows["tomb-guardians"]["in_play"])  # Khemri is ticked
        self.assertEqual((rows["lizardmen-lus"]["setting"]["grade"], rows["lizardmen-lus"]["in_play"]), ("1b", False))
        self.assertIn("Skaven", rows["skaven"]["groups"])
        self.assertEqual(rows["reiklanders"]["source_code"], "MHR")

    def test_the_list_costs_two_queries(self) -> None:
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(2):  # the caller's access, then the list with settings, groups and in_play
            self.client.get(self.types_url())

    def test_outsiders_get_404(self) -> None:
        self.assertEqual(self.get_as(self.outsider, self.types_url()).status_code, 404)


class CustomWarbandTypeTests(WarbandTypesTestCase):
    def test_any_member_adds_a_type_the_others_can_pick(self) -> None:
        added = self.post_as(
            self.player, self.types_url(), {"name": " Gutter Kings ", "link_url": "https://x.example/"}
        )
        self.assertEqual(added.status_code, 201, added.data)
        self.assertEqual(
            (added.data["name"], added.data["slug"], added.data["in_play"]), ("Gutter Kings", "gutter-kings", True)
        )
        made = WarbandType.objects.get(pk=added.data["id"])
        self.assertEqual(
            (made.campaign_id, made.campaign_type_id, made.created_by_id), (self.campaign.id, None, self.player.id)
        )
        raised = self.post_as(
            self.admin, "/api/warbands/", {"name": "Kings", "campaign_id": self.campaign.id, "warband_type_id": made.id}
        )
        self.assertEqual(raised.status_code, 201, raised.data)

    def test_a_name_the_campaign_uses_is_refused_and_another_campaign_cant_pick_it(self) -> None:
        added = self.post_as(self.player, self.types_url(), {"name": "Gutter Kings"})
        again = self.post_as(self.rival, self.types_url(), {"name": "gutter kings"})
        self.assertEqual(again.status_code, 400)
        self.assertIn("name", again.data["fields"] if "fields" in again.data else again.data)
        body = {"name": "Far", "campaign_id": self.elsewhere.id, "warband_type_id": added.data["id"]}
        self.assertEqual(self.post_as(self.outsider, "/api/warbands/", body).status_code, 400)

    def test_an_archived_campaign_refuses_a_new_type(self) -> None:
        self.campaign.archived_at = timezone.now()
        self.campaign.save()
        self.assertEqual(self.post_as(self.player, self.types_url(), {"name": "Late"}).status_code, 403)


class WarbandTypeOnWarbandTests(WarbandTypesTestCase):
    def raise_as(self, user: Any, **body: Any) -> Any:
        return self.post_as(user, "/api/warbands/", {"name": "Crows", "campaign_id": self.campaign.id, **body})

    def test_raising_a_warband_needs_a_type_and_may_pick_one_out_of_play(self) -> None:
        self.assertEqual(self.raise_as(self.admin).status_code, 400)
        lizardmen = self.book("lizardmen-lus")  # Lustria isn't ticked: a warning in the picker, never a refusal
        raised = self.raise_as(
            self.admin,
            warband_type_id=lizardmen.id,
            counts_as_ids=[self.book("skaven").id],
            warband_link=lizardmen.link_url,
        )
        self.assertEqual(raised.status_code, 201, raised.data)
        self.assertEqual(raised.data["warband_type"]["name"], "Lizardmen")
        self.assertEqual(raised.data["warband_type"]["setting"]["slug"], "lustria")
        self.assertIn("Lizardmen", raised.data["warband_type"]["groups"])
        self.assertEqual([row["slug"] for row in raised.data["counts_as"]], ["skaven"])
        self.assertEqual(raised.data["warband_link"], lizardmen.link_url)
        self.assertNotIn("faction", raised.data)

    def test_the_owner_changes_the_type_and_what_it_counts_as(self) -> None:
        url = f"/api/warbands/{self.warband.id}/"
        changed = self.patch_as(
            self.player,
            url,
            {"warband_type_id": self.book("reiklanders").id, "counts_as_ids": [self.book("middenheimers").id]},
        )
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["warband_type"]["slug"], "reiklanders")
        self.assertEqual(sorted(changed.data["warband_type"]["groups"]), ["Good", "Humans", "Mercenaries"])
        cleared = self.patch_as(self.player, url, {"counts_as_ids": []})
        self.assertEqual((cleared.data["warband_type"]["slug"], cleared.data["counts_as"]), ("reiklanders", []))
        self.assertEqual(self.patch_as(self.player, url, {"warband_type_id": None}).status_code, 400)

    def test_another_campaigns_type_reads_as_unknown(self) -> None:
        far = WarbandType.objects.create(name="Far Away", slug="far-away", campaign=self.elsewhere)
        url = f"/api/warbands/{self.warband.id}/"
        self.assertEqual(self.patch_as(self.player, url, {"warband_type_id": far.id}).status_code, 400)
        refused = self.patch_as(self.player, url, {"counts_as_ids": [far.id]})
        self.assertEqual(refused.status_code, 400)
        self.assertFalse(Warband.objects.get(pk=self.warband.pk).counts_as.exists())
