"""Plots as a catalogue kind: the list, the detail, a campaign's version with its own lines, and custom plots."""

from typing import Any

from apps.campaigns.models import CampaignType
from apps.core.catalogue.kinds import PLOTS
from apps.core.catalogue.versions import editable
from apps.plots.models import Plot, PlotAchievement, PlotScoringLine
from apps.warbands.tests.roster_support import RosterTestCase


def book_plot(name: str = "Drowning the Witch", **changes: Any) -> Plot:
    plot = Plot.objects.create(name=name, slug=name.lower().replace(" ", "-"), who_text="Witch Hunters.", **changes)
    PlotScoringLine.objects.create(plot=plot, position=1, points=1, text="Playing a scenario.")
    PlotScoringLine.objects.create(plot=plot, position=2, points=None, dice="D3", text="A Chaos leader goes down.")
    PlotScoringLine.objects.create(plot=plot, position=3, points=-1, text="A lawman killed by the warband.")
    PlotAchievement.objects.bulk_create(
        [PlotAchievement(plot=plot, points=points, name=f"Rung {points}") for points in (5, 10, 15, 20, 25, 35, 40)]
    )
    return plot


class PlotCatalogueTests(RosterTestCase):
    plot: Plot

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.plot = book_plot()

    def test_the_list_and_the_detail_read_the_book_plot(self):
        self.client.force_authenticate(user=self.player)
        rows = self.client.get(f"/api/plots/?campaign_id={self.campaign.id}")
        self.assertEqual(rows.status_code, 200, rows.data)
        self.assertEqual([row["name"] for row in rows.json()], ["Drowning the Witch"])
        self.assertTrue(rows.json()[0]["in_play"])  # no setting: it counts as Mordheim's
        self.assertNotIn("scoring", rows.json()[0])  # a list row carries no lines

        detail = self.client.get(f"/api/plots/{self.plot.pk}/")
        self.assertEqual(detail.status_code, 200, detail.data)
        body = detail.json()
        self.assertEqual(body["who_text"], "Witch Hunters.")
        self.assertEqual(
            [(line["points"], line["dice"]) for line in body["scoring"]], [(1, ""), (None, "D3"), (-1, "")]
        )
        self.assertEqual([rung["points"] for rung in body["achievements"]], [5, 10, 15, 20, 25, 35, 40])

    def test_the_list_and_the_detail_stay_at_their_query_counts_whatever_the_plots_hold(self):
        book_plot("Gaze of the Gods")
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(2):  # the caller's access and the rows, whatever the plots hold
            self.client.get(f"/api/plots/?campaign_id={self.campaign.id}")
        with self.assertNumQueries(3):  # the plot, its scoring lines and its ladder
            self.client.get(f"/api/plots/{self.plot.pk}/")

    def test_a_campaigns_version_copies_the_lines_and_stands_in_for_the_book(self):
        version = editable(PLOTS, self.plot, self.campaign.id)

        self.assertEqual(version.replaces_id, self.plot.pk)
        self.assertEqual(version.scoring_lines.count(), 3)
        self.assertEqual(version.achievements.count(), 7)
        self.assertEqual([line.text for line in version.scoring_lines.all()][0], "Playing a scenario.")
        self.client.force_authenticate(user=self.player)
        rows = self.client.get(f"/api/plots/?campaign_id={self.campaign.id}").json()
        self.assertEqual([row["id"] for row in rows], [version.pk])

    def test_a_plot_of_a_setting_the_campaign_hasnt_ticked_is_not_in_play(self):
        marienburg = CampaignType.objects.create(slug="mutiny", name="Mutiny in Marienburg", grade="2b")
        other = book_plot("Gaze of the Gods", campaign_type=marienburg)

        self.client.force_authenticate(user=self.player)
        rows = self.client.get(f"/api/plots/?campaign_id={self.campaign.id}").json()

        self.assertEqual({row["name"]: row["in_play"] for row in rows}[other.name], False)


class CustomPlotTests(RosterTestCase):
    """Whoever holds `edit_catalogue` writes the campaign's own plots; the checks warn and never refuse."""

    def create(self, user: Any, **changes: Any) -> Any:
        body = {
            "campaign_id": self.campaign.id,
            "name": "The Lost Cargo",
            "who_text": "Any warband with a boat.",
            "scoring": [{"points": 2, "text": "A crate recovered."}, {"dice": "-D3", "text": "A crate lost."}],
            "achievements": [{"points": 5, "name": "Rumours"}, {"points": 40, "name": "The whole cargo"}],
            **changes,
        }
        self.client.force_authenticate(user=user)
        return self.client.post("/api/plots/", body, format="json")

    def test_the_owner_writes_a_plot_with_its_scoring_and_its_ladder(self):
        response = self.create(self.campaign_owner)

        self.assertEqual(response.status_code, 201, response.data)
        body = response.json()
        self.assertEqual(body["who_text"], "Any warband with a boat.")
        self.assertEqual([(line["points"], line["dice"]) for line in body["scoring"]], [(2, ""), (None, "-D3")])
        self.assertEqual([rung["points"] for rung in body["achievements"]], [5, 40])
        self.assertNotIn("warnings", body)  # nothing is missing
        plot = Plot.objects.get(pk=body["id"])
        self.assertEqual((plot.campaign_id, plot.replaces_id), (self.campaign.id, None))

    def test_a_ladder_without_the_win_an_empty_who_text_and_no_scoring_warn_rather_than_refuse(self):
        response = self.create(
            self.campaign_owner, who_text="", scoring=[], achievements=[{"points": 5, "name": "Rumours"}]
        )

        self.assertEqual(response.status_code, 201, response.data)
        warnings = response.json()["warnings"]
        self.assertEqual(len(warnings), 3, warnings)
        self.assertIn("no scoring lines", warnings[0])
        self.assertIn("40 campaign points", warnings[1])
        self.assertIn("who may follow", warnings[2])

    def test_an_edit_replaces_the_list_it_sends_and_leaves_the_other_alone(self):
        plot = Plot.objects.get(pk=self.create(self.campaign_owner).json()["id"])

        self.client.force_authenticate(user=self.campaign_owner)
        response = self.client.patch(
            f"/api/plots/{plot.pk}/",
            {"campaign_id": self.campaign.id, "scoring": [{"points": 1, "text": "A rumour heard."}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([line["text"] for line in response.json()["scoring"]], ["A rumour heard."])
        self.assertEqual([rung["points"] for rung in response.json()["achievements"]], [5, 40])

    def test_a_player_without_the_right_may_not_write_one(self):
        self.assertEqual(self.create(self.viewer).status_code, 403)

    def test_the_owner_deletes_the_campaigns_own_plot(self):
        plot = Plot.objects.get(pk=self.create(self.campaign_owner).json()["id"])

        self.client.force_authenticate(user=self.campaign_owner)
        response = self.client.delete(f"/api/plots/{plot.pk}/?campaign_id={self.campaign.id}")

        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(Plot.objects.filter(pk=plot.pk).exists())
