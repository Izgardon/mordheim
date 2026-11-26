"""`campaigns/<id>/plots/`: the plots a campaign plays with, and its preset's, given when Plots is switched on."""

from typing import Any

from apps.campaign_presets.models import CampaignPreset
from apps.campaigns.models import Campaign, CampaignCampaignType, CampaignType
from apps.core.catalogue.kinds import PLOTS
from apps.core.catalogue.versions import editable
from apps.plots.models import CampaignPlot, Plot
from apps.warbands.tests.roster_support import RosterTestCase

from .test_plots_catalogue import book_plot


class CampaignPlotsTests(RosterTestCase):
    mordheim_plot: Plot
    marienburg: CampaignType
    marienburg_plot: Plot

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.mordheim_plot = book_plot("The Shards")  # no setting: in play everywhere
        cls.marienburg = CampaignType.objects.create(slug="mutiny", name="Mutiny in Marienburg", grade="2b")
        cls.marienburg_plot = book_plot("Drowning the Witch", campaign_type=cls.marienburg)

    def url(self, campaign_id: int | None = None) -> str:
        return f"/api/campaigns/{campaign_id or self.campaign.id}/plots/"

    def read(self, user: Any = None) -> Any:
        self.client.force_authenticate(user=user or self.player)
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def switch_plots_on(self) -> Any:
        self.client.force_authenticate(user=self.campaign_owner)
        response = self.client.patch(
            f"/api/campaigns/{self.campaign.id}/", {"enable_campaign_points": True}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def pick(self, user: Any, plot_ids: list[int]) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.put(self.url(), {"plot_ids": plot_ids}, format="json")

    def test_a_campaign_that_has_picked_nothing_plays_with_nothing(self):
        self.assertEqual(self.read(), [])

    def test_switching_plots_on_without_a_preset_gives_none_whatever_is_ticked(self):
        CampaignCampaignType.objects.create(campaign=self.campaign, campaign_type=self.marienburg)

        self.switch_plots_on()

        self.assertEqual(self.read(), [])

    def test_switching_plots_on_gives_the_presets_plots(self):
        preset = CampaignPreset.objects.create(slug="mutiny", name="Mutiny in Marienburg")
        preset.settings.set([self.marienburg])
        Campaign.objects.filter(pk=self.campaign.pk).update(preset=preset)

        self.switch_plots_on()

        body = self.read()
        self.assertEqual([plot["name"] for plot in body], ["Drowning the Witch"])  # The Shards has no setting
        self.assertEqual([line["text"] for line in body[0]["scoring"]][0], "Playing a scenario.")
        self.assertEqual([rung["points"] for rung in body[0]["achievements"]], [5, 10, 15, 20, 25, 35, 40])
        self.assertFalse(body[0]["in_play"])  # Marienburg isn't ticked: content is the owner's

    def test_switching_it_on_again_leaves_the_list_the_campaign_picked(self):
        self.switch_plots_on()
        self.pick(self.campaign_owner, [self.marienburg_plot.pk])
        self.client.force_authenticate(user=self.campaign_owner)
        self.client.patch(f"/api/campaigns/{self.campaign.id}/", {"enable_campaign_points": False}, format="json")

        self.switch_plots_on()

        self.assertEqual([plot["name"] for plot in self.read()], ["Drowning the Witch"])

    def test_the_owner_picks_a_plot_whose_setting_is_not_in_play_and_it_is_warned_about_not_refused(self):
        response = self.pick(self.campaign_owner, [self.marienburg_plot.pk])

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([(plot["name"], plot["in_play"]) for plot in response.json()], [("Drowning the Witch", False)])
        self.assertEqual([plot["name"] for plot in self.read()], ["Drowning the Witch"])

    def test_picking_none_is_picking_none(self):
        self.switch_plots_on()

        self.assertEqual(self.pick(self.campaign_owner, []).json(), [])
        self.assertEqual(self.read(), [])  # no fall back to the settings in play

    def test_a_picked_book_plot_the_campaign_has_a_version_of_reads_as_the_version(self):
        self.pick(self.campaign_owner, [self.mordheim_plot.pk])
        version = editable(PLOTS, self.mordheim_plot, self.campaign.id)
        version.name = "The Shards (ours)"
        version.save(update_fields=["name"])

        body = self.read()

        self.assertEqual([(plot["id"], plot["name"]) for plot in body], [(version.pk, "The Shards (ours)")])

    def test_a_campaigns_own_plot_deleted_leaves_the_list(self):
        own = Plot.objects.create(campaign=self.campaign, name="Ours")
        self.pick(self.campaign_owner, [own.pk, self.mordheim_plot.pk])

        own.delete()

        self.assertEqual([plot["name"] for plot in self.read()], ["The Shards"])

    def test_another_campaigns_plot_is_refused(self):
        elsewhere = Campaign.objects.create(name="Elsewhere two", join_code="ELSE02")
        theirs = Plot.objects.create(campaign=elsewhere, name="Theirs")

        response = self.pick(self.campaign_owner, [theirs.pk])

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(CampaignPlot.objects.filter(campaign=self.campaign).exists())

    def test_it_stays_at_five_queries_whatever_the_plots_hold(self):
        self.pick(self.campaign_owner, [self.mordheim_plot.pk, self.marienburg_plot.pk])
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(5):  # the caller's access, the picks, the plots, their scoring lines, their ladders
            self.assertEqual(len(self.client.get(self.url()).json()), 2)
        book_plot("One more")
        self.pick(self.campaign_owner, list(Plot.objects.values_list("id", flat=True)))
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(5):
            self.assertEqual(len(self.client.get(self.url()).json()), 3)

    def test_a_player_may_not_pick_them_and_an_outsider_sees_nothing(self):
        self.assertEqual(self.pick(self.player, []).status_code, 403)
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.get(self.url()).status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.get(self.url()).status_code, 401)
