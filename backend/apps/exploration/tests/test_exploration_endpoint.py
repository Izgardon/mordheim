"""`GET campaigns/<id>/exploration/`: the chart a campaign explores by, whole and in a fixed number of queries."""

from typing import Any

from apps.campaigns.models import Campaign
from apps.core.catalogue.cache import bump
from apps.exploration.models import ExplorationChart, ExplorationPlace
from apps.warbands.tests.roster_support import RosterTestCase


class CampaignExplorationTests(RosterTestCase):
    def url(self, campaign_id: int | None = None) -> str:
        return f"/api/campaigns/{campaign_id or self.campaign.id}/exploration/"

    def read(self, user: Any = None) -> Any:
        self.client.force_authenticate(user=user or self.player)
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def test_it_serves_the_book_chart_with_its_income_table_and_its_places(self):
        body = self.read()

        self.assertEqual(body["id"], self.exploration_chart.pk)
        self.assertEqual(body["name"], "Exploration")
        self.assertEqual(body["dice"], {"per_hero": 1, "for_win": 1, "max": 10, "max_chosen": 6})
        self.assertEqual(body["income"][0], {"max_total": 5, "amount": 1})
        self.assertEqual(body["income"][-1], {"max_total": None, "amount": 7})
        self.assertEqual([row["count"] for row in body["multiples"]], [2, 3, 4, 5, 6])
        self.assertEqual([row["label"] for row in body["multiples"]][:2], ["Doubles", "Triples"])
        well = self.exploration_chart.places.get(count=2, face=1)
        self.assertEqual(body["multiples"][0]["places"][0], {"id": well.pk, "face": 1, "name": "Well", "rules": well.rules})  # fmt: skip
        self.assertTrue(body["in_play"])  # Mordheim is always on

    def test_a_campaign_reads_the_chart_it_picked(self):
        own = ExplorationChart.objects.create(campaign=self.campaign, name="Albion", income=[], income_note="See below")
        ExplorationPlace.objects.create(chart=own, count=2, face=1, name="Camping Site", rules="Rest.")
        self.campaign_settings.exploration_chart = own
        self.campaign_settings.save()
        bump(self.campaign.id, "exploration_charts")

        body = self.read()

        self.assertEqual((body["id"], body["name"]), (own.pk, "Albion"))
        self.assertEqual((body["income"], body["income_note"]), ([], "See below"))  # it pays no shards
        self.assertEqual(body["multiples"], [{"count": 2, "label": "Doubles", "places": [{"id": own.places.get().pk, "face": 1, "name": "Camping Site", "rules": "Rest."}]}])  # fmt: skip

    def test_it_stays_at_three_queries_whatever_the_chart_holds(self):
        # the caller's access (its settings say which chart), the chart and its places: never per place
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(3):
            self.client.get(self.url())
        self.exploration_chart.places.all().delete()
        bump(None)  # the body cached above is retired
        with self.assertNumQueries(3):
            body = self.client.get(self.url()).json()
        self.assertEqual(body["multiples"], [])

    def test_only_a_member_reads_it(self):
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.get(self.url()).status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.get(self.url()).status_code, 401)


class PickTheChartTests(RosterTestCase):
    """Settings → Exploration: the campaign picks the chart its post-game explores by."""

    def patch(self, user: Any, chart_id: int | None) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.patch(
            f"/api/campaigns/{self.campaign.id}/", {"exploration_chart_id": chart_id}, format="json"
        )

    def read_chart_id(self) -> int | None:
        self.client.force_authenticate(user=self.player)
        body: dict[str, Any] = self.client.get(f"/api/campaigns/{self.campaign.id}/exploration/").json()
        chart_id: int | None = body["id"]
        return chart_id

    def test_the_owner_picks_a_chart_and_the_endpoint_follows_it(self):
        own = ExplorationChart.objects.create(campaign=self.campaign, name="Albion")

        response = self.patch(self.campaign_owner, own.pk)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json()["exploration_chart_id"], own.pk)
        self.assertEqual(self.read_chart_id(), own.pk)

    def test_clearing_it_goes_back_to_the_book_chart(self):
        own = ExplorationChart.objects.create(campaign=self.campaign, name="Albion")
        self.patch(self.campaign_owner, own.pk)

        self.assertEqual(self.patch(self.campaign_owner, None).status_code, 200)
        self.assertEqual(self.read_chart_id(), self.exploration_chart.pk)

    def test_another_campaigns_chart_is_refused(self):
        elsewhere = Campaign.objects.create(name="Elsewhere two", join_code="ELSE02")
        theirs = ExplorationChart.objects.create(campaign=elsewhere, name="Theirs")

        response = self.patch(self.campaign_owner, theirs.pk)

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(self.read_chart_id(), self.exploration_chart.pk)

    def test_a_player_may_not_pick_one(self):
        self.assertEqual(self.patch(self.player, None).status_code, 403)
