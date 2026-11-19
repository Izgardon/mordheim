"""The campaign's charts (William, 19 Nov 2026): the dice tables a player looks up, each a title, a line on when it
is rolled, its dice and a row per result. Every member reads them in their order; only the owner and admins add,
edit, reorder and delete them, as the campaign's rules are theirs, and an archived campaign's are read only.

A chart is written whole: a POST or a PATCH that sends `rows` replaces every result the chart holds, in the order
sent, because a row means nothing apart from its chart.
"""

from django.utils import timezone

from apps.campaigns.models import CampaignChart, CampaignChartRow

from .campaign_support import CampaignTestCase

WEATHER = {
    "title": "Spring weather",
    "description": "Roll before deployment.",
    "dice": "D6",
    "note": "Add 1 in the marsh.",
    "rows": [
        {"result": "1-2", "name": "Clear", "text": "Nothing changes."},
        {"result": "3-6", "name": "Rain", "text": "Missile weapons suffer -1 to hit."},
    ],
}


class CampaignChartTests(CampaignTestCase):
    def charts_url(self, suffix: str = "") -> str:
        return self.url(f"campaign-charts/{suffix}")

    def add(self, payload: dict | None = None, user=None):
        return self.post_as(user or self.admin, self.charts_url(), payload or WEATHER)

    def listed(self, user=None) -> list[dict]:
        rows: list[dict] = self.get_as(user or self.player, self.charts_url()).json()
        return rows

    def test_a_chart_holds_its_results_in_the_order_they_were_sent(self):
        response = self.add()

        self.assertEqual(response.status_code, 201)
        chart = response.json()
        self.assertEqual(
            (chart["title"], chart["dice"], chart["note"], chart["order"], chart["campaign_id"]),
            ("Spring weather", "D6", "Add 1 in the marsh.", 0, self.campaign.id),
        )
        self.assertEqual([(row["result"], row["name"]) for row in chart["rows"]], [("1-2", "Clear"), ("3-6", "Rain")])

    def test_every_member_reads_them_in_their_order_and_an_outsider_reads_nothing(self):
        self.add({**WEATHER, "title": "Added first"})
        self.add({**WEATHER, "title": "Added second"})
        CampaignChart.objects.create(campaign=self.elsewhere, title="Not ours")

        for user in (self.player, self.rival, self.admin, self.owner):
            with self.subTest(user=user.first_name):
                self.assertEqual([chart["title"] for chart in self.listed(user)], ["Added first", "Added second"])
        self.assertEqual(self.get_as(self.outsider, self.charts_url()).status_code, 404)

    def test_a_player_cannot_write_one(self):
        response = self.add(user=self.player)

        self.assertEqual(response.status_code, 403)
        self.assertFalse(CampaignChart.objects.filter(campaign=self.campaign).exists())

    def test_a_patch_that_sends_rows_replaces_every_result(self):
        chart_id = self.add().json()["id"]

        response = self.patch_as(
            self.owner,
            self.charts_url(f"{chart_id}/"),
            {"title": "Autumn weather", "rows": [{"result": "1", "name": "Fog", "text": ""}]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], "Autumn weather")
        self.assertEqual([(row["result"], row["name"]) for row in response.json()["rows"]], [("1", "Fog")])
        self.assertEqual(CampaignChartRow.objects.filter(chart_id=chart_id).count(), 1)

    def test_a_patch_that_sends_no_rows_leaves_them_alone(self):
        chart_id = self.add().json()["id"]

        response = self.patch_as(self.owner, self.charts_url(f"{chart_id}/"), {"note": "No modifiers."})

        self.assertEqual((response.status_code, response.json()["note"]), (200, "No modifiers."))
        self.assertEqual(len(response.json()["rows"]), 2)

    def test_deleting_a_chart_takes_its_results_with_it(self):
        chart_id = self.add().json()["id"]

        response = self.delete_as(self.owner, self.charts_url(f"{chart_id}/"))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(CampaignChartRow.objects.filter(chart_id=chart_id).exists())

    def test_a_chart_rolls_only_a_die_we_hold(self):
        response = self.add({**WEATHER, "dice": "D7"})

        self.assertEqual(response.status_code, 400)

    def test_a_chart_may_roll_nothing_of_its_own(self):
        response = self.add({"title": "Battle locations", "dice": "", "rows": [{"result": "—", "name": "The docks"}]})

        self.assertEqual((response.status_code, response.json()["dice"]), (201, ""))

    def test_reordering_names_every_chart_once(self):
        first = self.add({**WEATHER, "title": "First"}).json()["id"]
        second = self.add({**WEATHER, "title": "Second"}).json()["id"]

        response = self.put_as(self.owner, self.charts_url("order/"), {"ids": [second, first]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([chart["title"] for chart in response.json()], ["Second", "First"])
        refused = self.put_as(self.owner, self.charts_url("order/"), {"ids": [second]})
        self.assertEqual((refused.status_code, refused.json()["code"]), (400, "campaign_charts_order"))

    def test_an_archived_campaign_s_are_read_only(self):
        chart_id = self.add().json()["id"]
        self.campaign.archived_at = timezone.now()
        self.campaign.save(update_fields=["archived_at"])

        response = self.patch_as(self.owner, self.charts_url(f"{chart_id}/"), {"title": "Mine"})

        self.assertEqual((response.status_code, response.json()["code"]), (403, "campaign_archived"))
        self.assertEqual([chart["title"] for chart in self.listed()], ["Spring weather"])

    def test_reading_the_charts_costs_the_same_however_many_there_are(self):
        for index in range(3):
            self.add({**WEATHER, "title": f"Chart {index}"})
        self.get_as(self.player, self.charts_url())  # the access rows, warmed

        with self.assertNumQueries(3):  # the reader's access, the charts, their results
            self.get_as(self.player, self.charts_url())
        for index in range(3, 9):
            self.add({**WEATHER, "title": f"Chart {index}"})
        with self.assertNumQueries(3):
            self.assertEqual(len(self.listed()), 9)
