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

        # the reader's access, the charts, their results, and the tables hanging off those results
        with self.assertNumQueries(4):
            self.get_as(self.player, self.charts_url())
        for index in range(3, 9):
            self.add({**WEATHER, "title": f"Chart {index}"})
        with self.assertNumQueries(4):
            self.assertEqual(len(self.listed()), 9)


class RuleOwnedTableTests(CampaignTestCase):
    """A chart may belong to a rule (William, 20 Nov 2026: "charts should only really be used for clear reference
    charts"). It then shows with its rule and is left out of the Charts list."""

    TABLE = {"dice": "D6", "note": "Add 1 at night.", "rows": [{"result": "1-2", "name": "Fog", "text": "It hides."}]}

    def rule_url(self, suffix: str = "") -> str:
        return self.url(f"campaign-rules/{suffix}")

    def charts_url(self, suffix: str = "") -> str:
        return self.url(f"campaign-charts/{suffix}")

    def add_rule(self, **body):
        return self.post_as(self.admin, self.rule_url(), {"title": "Weather", **body})

    def test_a_rule_is_written_and_read_with_its_own_table(self):
        created = self.add_rule(kind="battle", chart=self.TABLE).json()

        self.assertEqual(created["chart"]["dice"], "D6")
        self.assertEqual([(row["result"], row["name"]) for row in created["chart"]["rows"]], [("1-2", "Fog")])
        read = self.get_as(self.player, self.rule_url()).json()[0]
        self.assertEqual(read["chart"]["note"], "Add 1 at night.")

    def test_a_rule_without_one_reads_null(self):
        self.add_rule()

        self.assertIsNone(self.get_as(self.player, self.rule_url()).json()[0]["chart"])

    def test_a_rules_table_is_left_out_of_the_charts_list(self):
        self.add_rule(chart=self.TABLE)
        self.post_as(self.admin, self.charts_url(), WEATHER)

        listed = self.get_as(self.player, self.charts_url()).json()

        self.assertEqual([chart["title"] for chart in listed], ["Spring weather"])

    def test_a_patch_replaces_the_table_and_null_takes_it_away(self):
        rule_id = self.add_rule(chart=self.TABLE).json()["id"]

        swapped = self.patch_as(
            self.owner,
            self.rule_url(f"{rule_id}/"),
            {"chart": {**self.TABLE, "rows": [{"result": "6", "name": "Hail", "text": ""}]}},
        ).json()
        self.assertEqual([row["result"] for row in swapped["chart"]["rows"]], ["6"])

        gone = self.patch_as(self.owner, self.rule_url(f"{rule_id}/"), {"chart": None}).json()
        self.assertIsNone(gone["chart"])
        self.assertFalse(CampaignChart.objects.filter(campaign=self.campaign).exists())

    def test_a_patch_that_sends_no_table_leaves_it_alone(self):
        rule_id = self.add_rule(chart=self.TABLE).json()["id"]

        patched = self.patch_as(self.owner, self.rule_url(f"{rule_id}/"), {"title": "Weather above"}).json()

        self.assertEqual(patched["title"], "Weather above")
        self.assertEqual(len(patched["chart"]["rows"]), 1)

    def test_deleting_the_rule_takes_its_table_with_it(self):
        rule_id = self.add_rule(chart=self.TABLE).json()["id"]

        self.delete_as(self.owner, self.rule_url(f"{rule_id}/"))

        self.assertFalse(CampaignChart.objects.filter(campaign=self.campaign).exists())
        self.assertFalse(CampaignChartRow.objects.exists())

    def test_a_table_needs_a_result(self):
        self.assertEqual(self.add_rule(chart={**self.TABLE, "rows": []}).status_code, 400)

    def test_reading_the_rules_costs_the_same_however_many_carry_tables(self):
        for index in range(3):
            self.add_rule(title=f"Rule {index}", chart=self.TABLE)
        self.get_as(self.player, self.rule_url())  # the access row, warmed

        with self.assertNumQueries(4):  # the reader's access, the rules, their tables, the tables' results
            self.get_as(self.player, self.rule_url())


class ResultOwnedTableTests(CampaignTestCase):
    """A chart may belong to one *result* of another chart (William, 20 Nov 2026): a random occurrence is a
    trigger, one big table, and sub-tables hanging off single results. Border Town Burning's Curious bloom is a
    table under result 31 of Perilous phenomenon, so it shows inside that result and is not a chart of its own."""

    def charts_url(self, suffix: str = "") -> str:
        return self.url(f"campaign-charts/{suffix}")

    def add_chart(self, **body):
        return self.post_as(self.admin, self.charts_url(), {**WEATHER, **body})

    def hang_a_table_off(self, row: CampaignChartRow, title: str = "Curious bloom") -> CampaignChart:
        """The table the book hangs off that one result, as the seeder writes it."""
        table = CampaignChart.objects.create(campaign=self.campaign, row=row, title=title, dice="D6")
        CampaignChartRow.objects.create(chart=table, result="1", name="Nothing", text="The bloom is spent.")
        return table

    def first_row(self) -> CampaignChartRow:
        chart = CampaignChart.objects.get(campaign=self.campaign, title="Spring weather")
        return chart.rows.all()[0]

    def test_a_result_carries_its_own_table(self):
        self.add_chart()
        self.hang_a_table_off(self.first_row())

        listed = self.get_as(self.player, self.charts_url()).json()

        self.assertEqual([chart["title"] for chart in listed], ["Spring weather"])
        table = listed[0]["rows"][0]["chart"]
        self.assertEqual((table["dice"], [row["name"] for row in table["rows"]]), ("D6", ["Nothing"]))

    def test_a_result_without_one_reads_null(self):
        self.add_chart()

        listed = self.get_as(self.player, self.charts_url()).json()

        self.assertIsNone(listed[0]["rows"][0]["chart"])

    def test_a_results_table_is_left_out_of_the_charts_list(self):
        self.add_chart()
        self.hang_a_table_off(self.first_row())
        self.add_chart(title="Summer weather")

        listed = self.get_as(self.player, self.charts_url()).json()

        self.assertEqual([chart["title"] for chart in listed], ["Spring weather", "Summer weather"])

    def test_deleting_the_chart_takes_its_results_tables_with_it(self):
        chart_id = self.add_chart().json()["id"]
        self.hang_a_table_off(self.first_row())

        self.delete_as(self.owner, self.charts_url(f"{chart_id}/"))

        self.assertFalse(CampaignChart.objects.filter(campaign=self.campaign).exists())
        self.assertFalse(CampaignChartRow.objects.exists())

    def test_reading_costs_the_same_however_many_results_carry_tables(self):
        self.add_chart()
        for row in CampaignChart.objects.get(campaign=self.campaign, title="Spring weather").rows.all():
            self.hang_a_table_off(row, title=f"Table {row.result}")
        self.get_as(self.player, self.charts_url())  # the access row, warmed

        # the reader's access, the charts, their results, those results' tables, and the tables' own results. One
        # more than a list with no such table, where Django skips the last level for want of anything to read.
        with self.assertNumQueries(5):
            self.get_as(self.player, self.charts_url())

        self.add_chart(title="Summer weather")
        for row in CampaignChart.objects.get(campaign=self.campaign, title="Summer weather").rows.all():
            self.hang_a_table_off(row, title=f"Summer table {row.result}")
        with self.assertNumQueries(5):
            self.assertEqual(len(self.get_as(self.player, self.charts_url()).json()), 2)
