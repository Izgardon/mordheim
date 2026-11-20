"""A warband's plot and its campaign point total (apps/plots), and the rules they write.

A warband follows one plot of its campaign's, picked when it is raised and changed for nothing afterwards, and holds
a total the player types: nothing here adds to it or takes from it. From those two the server writes one kind of
rule and nothing else: a rule per rung reached, which comes and goes with the total (William, 20 Nov 2026: "only
earned plot points fall into there"). The plan itself is no rule — the sheet carries the plot whole, for the page's
Plot Details — and the player's own rules are never touched.
"""

from typing import Any

from django.utils import timezone

from apps.campaigns.models import Campaign, CampaignSettings
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.plots.models import CampaignPlot, Plot, PlotAchievement, PlotScoringLine
from apps.warbands.models import Warband, WarbandRule


def make_plot(name: str, campaign: Campaign | None = None, rungs: tuple[int, ...] = (5, 10, 40)) -> Plot:
    """A plot with three scoring lines (a flat gain, a die and a loss) and a rung per number given."""
    plot = Plot.objects.create(
        name=name, campaign=campaign, slug="" if campaign else name.lower().replace(" ", "-"), who_text="Anyone."
    )
    PlotScoringLine.objects.create(plot=plot, position=1, points=1, text="Playing a scenario.")
    PlotScoringLine.objects.create(plot=plot, position=2, points=None, dice="D3", text="A Chaos leader goes down.")
    PlotScoringLine.objects.create(plot=plot, position=3, points=-1, text="A lawman killed by the warband.")
    PlotAchievement.objects.bulk_create(
        [
            PlotAchievement(plot=plot, points=points, name=f"Rung {points}", text=f"What {points} gives.")
            for points in rungs
        ]
    )
    return plot


class WarbandPlotTests(CampaignTestCase):
    plot: Plot
    other: Plot

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        CampaignSettings.objects.filter(campaign=cls.campaign).update(enable_campaign_points=True)
        cls.plot = make_plot("Drowning the Witch")
        cls.other = make_plot("The Shards")
        CampaignPlot.objects.bulk_create(
            [CampaignPlot(campaign=cls.campaign, plot=cls.plot), CampaignPlot(campaign=cls.campaign, plot=cls.other)]
        )

    def warband_url(self, warband: Warband | None = None) -> str:
        return f"/api/warbands/{(warband or self.warband).id}/"

    def follow(self, **body: Any) -> Any:
        return self.patch_as(self.player, self.warband_url(), body)

    def rules(self, warband: Warband | None = None) -> list[tuple[str, int | None]]:
        """Every rule's title with the rung it mirrors (None: the player's own, or the plot's own rule)."""
        rows = WarbandRule.objects.filter(warband=warband or self.warband).order_by("id")
        return [(row.title, row.plot_achievement.points if row.plot_achievement else None) for row in rows]

    def derived(self) -> list[WarbandRule]:
        return list(WarbandRule.objects.filter(warband=self.warband, from_plot__isnull=False).order_by("id"))

    # Picking one

    def test_a_warband_is_raised_following_a_plot_and_the_plan_itself_is_no_rule(self):
        body = {"name": "Hunters", "warband_type_id": self.warband.warband_type_id, "campaign_id": self.campaign.id}
        response = self.post_as(self.outsider_in_campaign(), "/api/warbands/", {**body, "plot_id": self.plot.id})

        self.assertEqual(response.status_code, 201, response.data)
        raised = Warband.objects.get(id=response.data["id"])
        self.assertEqual((response.data["plot_id"], response.data["campaign_points"]), (self.plot.id, 0))
        self.assertEqual(self.rules(raised), [])  # nothing reached at 0, and no rule for the plan

    def test_the_plot_changes_for_nothing_and_its_rules_are_replaced(self):
        self.follow(plot_id=self.plot.id, campaign_points=12)

        changed = self.follow(plot_id=self.other.id)

        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(self.rules(), [("5 CP: Rung 5", 5), ("10 CP: Rung 10", 10)])
        self.assertEqual({rule.from_plot_id for rule in self.derived()}, {self.other.id})
        self.assertEqual(Warband.objects.get(id=self.warband.id).campaign_points, 12)  # the total is the player's

    def test_following_none_again_takes_its_rules_with_it(self):
        self.follow(plot_id=self.plot.id, campaign_points=40)

        cleared = self.follow(plot_id=None)

        self.assertEqual((cleared.status_code, cleared.data["plot_id"]), (200, None))
        self.assertEqual(self.rules(), [])

    def test_a_plot_the_campaign_doesnt_play_with_is_refused(self):
        theirs = make_plot("Theirs", campaign=self.elsewhere)
        unplayed = make_plot("Unplayed")  # a book plot the campaign didn't pick

        refused = [self.follow(plot_id=plot.id) for plot in (theirs, unplayed)]

        self.assertEqual([response.status_code for response in refused], [400, 400])
        self.assertEqual(refused[0].json()["plot_id"], ["That isn't one of the plots this campaign plays with."])
        self.assertEqual(self.rules(), [])

    def test_the_campaigns_version_of_a_book_plot_is_what_a_warband_follows(self):
        version = Plot.objects.create(name="House Witch", campaign=self.campaign, replaces=self.plot)
        PlotAchievement.objects.create(plot=version, points=5, name="House rung", text="Ours.")

        book = self.follow(plot_id=self.plot.id)  # the book id it replaces is no longer what the campaign plays with
        house = self.follow(plot_id=version.id, campaign_points=5)

        self.assertEqual((book.status_code, house.status_code), (400, 200))
        self.assertEqual(self.rules(), [("5 CP: House rung", 5)])

    # The total

    def test_the_rungs_reached_come_and_go_with_the_total(self):
        self.follow(plot_id=self.plot.id)

        at_ten = self.follow(campaign_points=10)
        titles_at_ten = self.rules()
        back_to_six = self.follow(campaign_points=6)

        self.assertEqual((at_ten.status_code, back_to_six.status_code), (200, 200))
        self.assertEqual(titles_at_ten, [("5 CP: Rung 5", 5), ("10 CP: Rung 10", 10)])
        self.assertEqual(self.rules(), [("5 CP: Rung 5", 5)])

    def test_writing_the_same_total_again_changes_nothing(self):
        self.follow(plot_id=self.plot.id, campaign_points=10)
        before = [(rule.id, rule.title, rule.description) for rule in self.derived()]

        self.follow(campaign_points=10)

        self.assertEqual([(rule.id, rule.title, rule.description) for rule in self.derived()], before)

    def test_an_edit_to_a_rung_rule_is_rewritten_and_the_players_own_rules_are_left_alone(self):
        mine = WarbandRule.objects.create(warband=self.warband, title="Burn the witch", description="Hate.")
        self.follow(plot_id=self.plot.id, campaign_points=5)
        rung = WarbandRule.objects.get(warband=self.warband, plot_achievement__points=5)
        self.patch_as(self.player, f"/api/warbands/{self.warband.id}/rules/{rung.id}/", {"description": "Mine now"})

        self.follow(campaign_points=6)

        self.assertEqual(WarbandRule.objects.get(id=rung.id).description, "What 5 gives.")
        kept = WarbandRule.objects.get(id=mine.id)
        self.assertEqual((kept.title, kept.description, kept.from_plot_id), ("Burn the witch", "Hate.", None))

    # Who may, and what the page reads

    def test_only_the_warbands_editors_change_its_plot_and_an_archived_campaign_is_read_only(self):
        refused = [self.patch_as(user, self.warband_url(), {"plot_id": self.plot.id}) for user in (self.rival,)]
        by_admin = self.patch_as(self.admin, self.warband_url(), {"plot_id": self.plot.id})
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())
        archived = self.follow(campaign_points=5)

        self.assertEqual([response.status_code for response in refused], [403])
        self.assertEqual((by_admin.status_code, archived.status_code), (200, 403))
        self.assertEqual(archived.json()["code"], "campaign_archived")

    def test_the_sheet_carries_the_plot_whole_in_a_fixed_number_of_queries(self):
        self.follow(plot_id=self.plot.id, campaign_points=10)
        url = f"/api/warbands/{self.warband.id}/sheet/"
        self.client.force_authenticate(user=self.rival)
        with self.assertNumQueries(12):  # the plot, its scoring and its ladder: three, whatever it holds
            sheet = self.client.get(url).json()

        plot = sheet["plot"]
        self.assertEqual((plot["id"], plot["name"], plot["rungs"]), (self.plot.id, "Drowning the Witch", [5, 10, 40]))
        # Plot Details reads these; the server words every line, the page words none
        self.assertEqual(
            plot["scoring"],
            [
                {"shown": "+1", "text": "Playing a scenario."},
                {"shown": "D3", "text": "A Chaos leader goes down."},
                {"shown": "-1", "text": "A lawman killed by the warband."},
            ],
        )
        self.assertEqual(plot["achievements"][0], {"points": 5, "name": "Rung 5", "text": "What 5 gives."})
        self.assertEqual(sheet["warband"]["campaign_points"], 10)
        self.assertEqual([rule["title"] for rule in sheet["rules"]], ["5 CP: Rung 5", "10 CP: Rung 10"])

    def test_the_players_list_carries_each_warbands_campaign_points_for_the_standings(self):
        self.follow(campaign_points=7)

        self.client.force_authenticate(user=self.rival)
        with self.assertNumQueries(6):  # the campaign pages' budget: the list costs no more for it
            players = self.client.get(self.url("players/")).json()

        points = {row["warband"]["name"]: row["warband"]["campaign_points"] for row in players if row["warband"]}
        self.assertEqual(points, {self.warband.name: 7, self.rival_warband.name: 0})

    def test_a_warband_following_none_has_no_plot_on_its_sheet(self):
        sheet = self.get_as(self.player, f"/api/warbands/{self.warband.id}/sheet/").json()

        self.assertIsNone(sheet["plot"])
        self.assertEqual((sheet["warband"]["plot_id"], sheet["warband"]["campaign_points"]), (None, 0))

    def test_a_campaigns_own_plot_a_warband_follows_is_archived_not_deleted(self):
        own = make_plot("Ours", campaign=self.campaign)
        CampaignPlot.objects.create(campaign=self.campaign, plot=own)
        self.follow(plot_id=own.id, campaign_points=5)

        deleted = self.delete_as(self.owner, f"/api/plots/{own.id}/?campaign_id={self.campaign.id}")

        self.assertEqual(deleted.status_code, 200, deleted.data)
        self.assertEqual(deleted.json()["outcome"], "archived")
        self.assertEqual(deleted.json()["usage"]["warbands"], 1)
        self.assertIsNotNone(Plot.objects.get(id=own.id).archived_at)
        self.assertEqual(Warband.objects.get(id=self.warband.id).plot_id, own.id)  # it still follows it

    # Support

    def outsider_in_campaign(self) -> Any:
        """A member of the campaign with no warband yet (the owner), so one can be raised here."""
        return self.owner
