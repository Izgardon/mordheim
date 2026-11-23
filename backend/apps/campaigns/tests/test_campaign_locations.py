"""A campaign's location groups and locations (William, 23 Nov 2026): the tree every member reads, written by
`manage_locations` holders, a location whole with its own tables and the campaign tables it points to."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import (
    CampaignChart,
    CampaignChartRow,
    CampaignLocation,
    CampaignLocationGroup,
)

from .campaign_support import CampaignTestCase

TABLE = {
    "title": "Altar of the Horned Rat",
    "dice": "D6",
    "rows": [
        {"result": "1-2", "name": "Unworthy!", "text": "-1 Toughness next battle."},
        {
            "result": "3-6",
            "name": "Blessed",
            "chart": {"dice": "D3", "rows": [{"result": "1", "text": "+1 Strength."}]},
        },
    ],
}
LIST_QUERIES = 8  # access, groups, locations, own tables, their results, results' tables and rows, links


class LocationTestCase(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enable_features()

    def add_group(self, user: Any = None, **body: Any) -> Any:
        return self.post_as(user or self.owner, self.url("location-groups/"), {"name": "The Undercity", **body})

    def add_location(self, group: int, user: Any = None, **body: Any) -> Any:
        sent = {"group_id": group, "name": "Altar of the Horned Rat", **body}
        return self.post_as(user or self.owner, self.url("locations/"), sent)

    def tree(self, user: Any = None) -> list[dict[str, Any]]:
        response = self.get_as(user or self.player, self.url("location-groups/"))
        self.assertEqual(response.status_code, 200)
        rows: list[dict[str, Any]] = response.json()
        return rows

    def chart(self, title: str = "Forest Hazards", **fields: Any) -> CampaignChart:
        chart = CampaignChart.objects.create(campaign=self.campaign, title=title, dice="D6", **fields)
        CampaignChartRow.objects.create(chart=chart, result="1", text="A bog.")
        return chart


class LocationTreeTests(LocationTestCase):
    def test_a_location_is_written_whole_and_read_in_its_group(self):
        hazards = self.chart()
        group = self.add_group(description="Under the streets.", restrictions="Skaven only.").json()
        body = {
            "rules": "Pay 10 gc. Roll a D6.",
            "min_heroes": 1,
            "max_heroes": "all",
            "takes_trading_action": True,
            "tables": [TABLE],
            "chart_ids": [hazards.id],
        }

        created = self.add_location(group["id"], **body)

        self.assertEqual(created.status_code, 201, created.content)
        [listed] = self.tree()
        self.assertEqual(
            {key: listed[key] for key in ("name", "description", "restrictions")},
            {"name": "The Undercity", "description": "Under the streets.", "restrictions": "Skaven only."},
        )
        [place] = listed["locations"]
        self.assertEqual(place, created.json())
        self.assertEqual(
            (place["min_heroes"], place["max_heroes"], place["heroes_text"], place["takes_trading_action"]),
            (1, "all", "1 to all heroes", True),
        )
        self.assertEqual(place["charts"], [{"id": hazards.id, "title": "Forest Hazards"}])
        [table] = place["tables"]
        self.assertEqual((table["title"], table["dice"]), ("Altar of the Horned Rat", "D6"))
        self.assertEqual([row["name"] for row in table["rows"]], ["Unworthy!", "Blessed"])
        self.assertEqual(table["rows"][1]["chart"]["rows"][0]["text"], "+1 Strength.")

    def test_its_own_tables_stay_out_of_the_campaigns_tables_list(self):
        self.chart()
        group = self.add_group().json()
        self.add_location(group["id"], tables=[TABLE])

        listed = self.get_as(self.player, self.url("campaign-charts/")).json()

        self.assertEqual([chart["title"] for chart in listed], ["Forest Hazards"])

    def test_the_list_reads_in_a_fixed_number_of_queries(self):
        group = self.add_group().json()
        self.add_location(group["id"], tables=[TABLE], chart_ids=[self.chart().id])
        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as few:
            self.client.get(self.url("location-groups/"))
        for index in range(4):
            more = self.add_group(name=f"Group {index}").json()
            self.add_location(more["id"], name=f"Place {index}", tables=[TABLE, TABLE], chart_ids=[])
        self.client.force_authenticate(user=self.player)

        with self.assertNumQueries(LIST_QUERIES):
            self.client.get(self.url("location-groups/"))
        self.assertEqual(len(few), LIST_QUERIES)

    def test_groups_and_locations_list_in_their_order(self):
        first = self.add_group(name="Marketplace").json()
        second = self.add_group(name="Da Camp").json()
        self.add_location(first["id"], name="Gunsmith")
        self.add_location(first["id"], name="Armourer")

        tree = self.tree()

        self.assertEqual([group["id"] for group in tree], [first["id"], second["id"]])
        self.assertEqual([place["name"] for place in tree[0]["locations"]], ["Gunsmith", "Armourer"])


class LocationWriteTests(LocationTestCase):
    def test_a_patch_replaces_tables_and_links_only_when_sent(self):
        group = self.add_group().json()
        place = self.add_location(group["id"], tables=[TABLE], chart_ids=[self.chart().id]).json()
        url = self.url(f"locations/{place['id']}/")

        renamed = self.patch_as(self.owner, url, {"name": "The Altar"}).json()
        self.assertEqual((renamed["name"], len(renamed["tables"]), len(renamed["charts"])), ("The Altar", 1, 1))

        cleared = self.patch_as(self.owner, url, {"tables": [], "chart_ids": []}).json()
        self.assertEqual((cleared["tables"], cleared["charts"]), ([], []))
        self.assertFalse(CampaignChart.objects.filter(location_id=place["id"]).exists())

    def test_a_location_moves_to_another_group_last(self):
        first, second = self.add_group().json(), self.add_group(name="Marketplace").json()
        self.add_location(second["id"], name="Gunsmith")
        place = self.add_location(first["id"]).json()

        moved = self.patch_as(self.owner, self.url(f"locations/{place['id']}/"), {"group_id": second["id"]}).json()

        self.assertEqual((moved["group_id"], moved["order"]), (second["id"], 1))
        self.assertEqual([p["name"] for p in self.tree()[1]["locations"]], ["Gunsmith", "Altar of the Horned Rat"])

    def test_malformed_writes_are_refused(self):
        group = self.add_group().json()
        elsewhere = CampaignLocationGroup.objects.create(campaign=self.elsewhere, name="Theirs")
        foreign = CampaignChart.objects.create(campaign=self.elsewhere, title="Theirs")
        cases: dict[str, dict[str, Any]] = {
            "min above max": {"min_heroes": 3, "max_heroes": 2},
            "all below a number": {"min_heroes": "all", "max_heroes": 2},
            "no heroes": {"min_heroes": 0},
            "not a count": {"max_heroes": "lots"},
            "another campaign's group": {"group_id": elsewhere.id},
            "another campaign's table": {"chart_ids": [foreign.id]},
            "a table of no results": {"tables": [{"title": "Empty", "rows": []}]},
            "a die we lack": {"tables": [{**TABLE, "dice": "D8"}]},
        }
        for case, body in cases.items():
            with self.subTest(case):
                self.assertEqual(self.add_location(group["id"], **body).status_code, 400)
        self.assertFalse(CampaignLocation.objects.exists())

    def test_a_location_points_only_to_tables_a_player_looks_up(self):
        group = self.add_group().json()
        place = self.add_location(group["id"], tables=[TABLE]).json()
        own = CampaignChart.objects.get(location_id=place["id"])

        response = self.patch_as(self.owner, self.url(f"locations/{place['id']}/"), {"chart_ids": [own.id]})

        self.assertEqual((response.status_code, response.json()["code"]), (400, "location_chart_unknown"))

    def test_removing_a_group_takes_its_locations_off_the_list(self):
        group = self.add_group().json()
        place = self.add_location(group["id"]).json()

        self.assertEqual(self.delete_as(self.admin, self.url(f"location-groups/{group['id']}/")).status_code, 204)

        self.assertEqual(self.tree(), [])
        self.assertEqual(CampaignLocation.objects.get(id=place["id"]).removed_by_id, self.admin.id)
        self.assertEqual(
            self.patch_as(self.owner, self.url(f"locations/{place['id']}/"), {"name": "X"}).status_code, 404
        )
        self.assertEqual(self.patch_as(self.owner, self.url(f"location-groups/{group['id']}/"), {}).status_code, 404)

    def test_removing_a_location_is_soft(self):
        group = self.add_group().json()
        place = self.add_location(group["id"]).json()

        self.assertEqual(self.delete_as(self.owner, self.url(f"locations/{place['id']}/")).status_code, 204)

        self.assertEqual(self.tree()[0]["locations"], [])
        self.assertIsNotNone(CampaignLocation.objects.get(id=place["id"]).removed_at)


class LocationAccessTests(LocationTestCase):
    def test_writes_need_manage_locations(self):
        self.assertEqual(self.add_group(self.player).status_code, 403)
        group = self.add_group().json()
        self.assertEqual(self.add_location(group["id"], self.player).status_code, 403)

        self.grant(self.player, "manage_locations")

        self.assertEqual(self.add_location(group["id"], self.player).status_code, 201)
        renamed = self.patch_as(self.player, self.url(f"location-groups/{group['id']}/"), {"name": "Sewers"})
        self.assertEqual(renamed.json()["name"], "Sewers")

    def test_every_route_answers_404_while_the_page_is_off_or_to_outsiders(self):
        group = self.add_group().json()
        place = self.add_location(group["id"]).json()
        self.assertEqual(self.get_as(self.outsider, self.url("location-groups/")).status_code, 404)
        self.enable_features(locations=False)

        self.assertEqual(self.get_as(self.owner, self.url("location-groups/")).status_code, 404)
        self.assertEqual(self.add_group().status_code, 404)
        self.assertEqual(self.add_location(group["id"]).status_code, 404)
        self.assertEqual(self.delete_as(self.owner, self.url(f"locations/{place['id']}/")).status_code, 404)
