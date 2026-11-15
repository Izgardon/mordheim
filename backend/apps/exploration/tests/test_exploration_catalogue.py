"""Exploration charts as a catalogue kind: the list, the detail and a campaign's version with its own places."""

from apps.campaigns.models import CampaignType
from apps.core.catalogue.kinds import EXPLORATION_CHARTS
from apps.core.catalogue.versions import editable
from apps.exploration.models import ExplorationChart
from apps.warbands.tests.roster_support import RosterTestCase


class ExplorationCatalogueTests(RosterTestCase):
    def test_the_list_and_the_detail_read_the_book_chart(self):
        self.client.force_authenticate(user=self.player)
        rows = self.client.get(f"/api/exploration-charts/?campaign_id={self.campaign.id}")
        self.assertEqual(rows.status_code, 200, rows.data)
        self.assertEqual([row["name"] for row in rows.json()], ["Exploration"])
        self.assertTrue(rows.json()[0]["in_play"])

        detail = self.client.get(f"/api/exploration-charts/{self.exploration_chart.pk}/")
        self.assertEqual(detail.status_code, 200, detail.data)
        body = detail.json()
        self.assertEqual(len(body["places"]), 30)
        self.assertEqual(body["places"][0], {"id": self.exploration_chart.places.get(count=2, face=1).pk, "count": 2, "face": 1, "label": "Doubles", "name": "Well", "rules": body["places"][0]["rules"]})  # fmt: skip

    def test_a_campaigns_version_copies_the_places_and_stands_in_for_the_book(self):
        version = editable(EXPLORATION_CHARTS, self.exploration_chart, self.campaign.id)

        self.assertNotEqual(version.pk, self.exploration_chart.pk)
        self.assertEqual(version.replaces_id, self.exploration_chart.pk)
        self.assertEqual(version.places.count(), 30)
        self.assertEqual(version.places.get(count=2, face=1).name, "Well")
        self.client.force_authenticate(user=self.player)
        rows = self.client.get(f"/api/exploration-charts/?campaign_id={self.campaign.id}").json()
        self.assertEqual([row["id"] for row in rows], [version.pk])  # the version replaces the book's row

    def test_a_chart_of_a_setting_the_campaign_hasnt_ticked_is_not_in_play(self):
        khemri = CampaignType.objects.create(slug="khemri", name="Khemri 1b", grade="1b")
        other = ExplorationChart.objects.create(name="Khemri exploration", campaign_type=khemri)

        self.client.force_authenticate(user=self.player)
        rows = self.client.get(f"/api/exploration-charts/?campaign_id={self.campaign.id}").json()

        self.assertEqual({row["name"]: row["in_play"] for row in rows}[other.name], False)
