"""A campaign's scenarios and plots are its preset's alone (William, 26 Nov 2026: "They should both be built and
affected by purely the preset. The settings are just there for content."): built at creation, swapped when the preset
changes (keeping a scenario a battle names, a plot a warband follows and what was added by hand), and the plots given
when campaign points come on later."""

from decimal import Decimal
from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import Battle
from apps.campaign_presets.models import CampaignPreset
from apps.campaign_presets.services.preset_lists import swap_lists
from apps.campaigns.models import Campaign, CampaignType
from apps.core.catalogue.kinds import SCENARIOS
from apps.core.catalogue.versions import editable
from apps.plots.models import CampaignPlot, Plot
from apps.plots.tests.test_plots_catalogue import book_plot
from apps.scenarios.models import CampaignScenario, Scenario, SettingScenario
from apps.scenarios.tests.scenario_support import ScenarioTestCase
from apps.warbands.models import Warband

RULEBOOK = {
    "skirmish": 6.0,
    "occupy": 5.0,
    "breakthrough": 5.0,
    "wyrdstone-hunt": 4.0,
    "surprise-attack": 4.0,
    "hidden-treasure": 3.0,
    "chance-encounter": 3.0,
    "street-fight": 2.0,
    "defend-the-find": 2.0,
}


def book_scenario(slug: str) -> Scenario:
    return Scenario.objects.get(campaign=None, slug=slug)


class PresetListsTests(ScenarioTestCase):
    marienburg: CampaignType
    annual: CampaignType
    khemri: CampaignType
    sylvania: CampaignType
    mim: CampaignPreset
    khemri_preset: CampaignPreset
    sylvania_preset: CampaignPreset
    mordheim_preset: CampaignPreset

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.marienburg = CampaignType.objects.create(slug="mutiny-in-marienburg", name="Mutiny in Marienburg")
        cls.annual = CampaignType.objects.create(slug="marienburg-annual", name="Marienburg Annual")
        cls.khemri = CampaignType.objects.create(slug="khemri", name="Khemri 1b", grade="1b")
        cls.sylvania = CampaignType.objects.create(slug="sylvania", name="Sylvania")  # no scenarios of its own
        for setting, slug, weight in (
            (cls.marienburg, "the-mummy", "2"),
            (cls.marienburg, "skirmish", "1"),
            (cls.annual, "the-mummy", "3"),  # two settings add it: the higher weight
            (cls.khemri, "kidnapped", "1"),
        ):
            SettingScenario.objects.create(setting=setting, scenario=book_scenario(slug), weight=Decimal(weight))
        book_plot("Drowning the Witch", campaign_type=cls.marienburg)
        book_plot("The Annual Plot", campaign_type=cls.annual)
        book_plot("Tomb Robbers", campaign_type=cls.khemri)
        book_plot("The Shards")  # no setting: no preset's
        cls.mim = cls.preset("mutiny-annual", cls.marienburg, cls.annual)
        cls.khemri_preset = cls.preset("khemri", cls.khemri)
        CampaignPreset.objects.filter(pk=cls.khemri_preset.pk).update(enable_campaign_points=None)  # says nothing
        cls.sylvania_preset = cls.preset("sylvania", cls.sylvania)
        cls.mordheim_preset = cls.preset("mordheim")

    @classmethod
    def preset(cls, slug: str, *settings: CampaignType) -> CampaignPreset:
        preset = CampaignPreset.objects.create(slug=slug, name=slug.title(), enable_campaign_points=True)
        preset.settings.set(settings)
        return preset

    def make(self, preset: CampaignPreset, **body: Any) -> Campaign:
        everything = list(CampaignType.objects.values_list("id", flat=True))
        sent = {"name": "Ashes", "max_players": 4, "preset_id": preset.pk, "setting_ids": everything, **body}
        response = self.post_as(self.owner, "/api/campaigns/", sent)
        self.assertEqual(response.status_code, 201, response.data)
        return Campaign.objects.get(pk=response.data["id"])

    def scenarios(self, campaign: Campaign) -> dict[str, float]:
        rows = CampaignScenario.objects.filter(campaign=campaign).select_related("scenario")
        return {row.scenario.slug: float(row.weight) for row in rows}

    def plots(self, campaign: Campaign) -> list[str]:
        rows = CampaignPlot.objects.filter(campaign=campaign).select_related("plot")
        return sorted(row.plot.name for row in rows)

    def change(self, campaign: Campaign, preset: CampaignPreset | None) -> None:
        sent = {"preset_id": preset.pk if preset else None}
        response = self.patch_as(self.owner, f"/api/campaigns/{campaign.pk}/", sent)
        self.assertEqual(response.status_code, 200, response.data)

    def test_creation_with_every_setting_ticked_gets_only_the_presets_scenarios_and_plots(self) -> None:
        campaign = self.make(self.mim)

        self.assertEqual(self.scenarios(campaign), {"the-mummy": 3.0, "skirmish": 1.0})
        self.assertEqual(self.plots(campaign), ["Drowning the Witch", "The Annual Plot"])

    def test_no_preset_or_one_naming_no_settings_gets_the_rulebooks_nine_and_no_plots(self) -> None:
        for preset in (self.mordheim_preset, None):
            campaign = self.make(self.mordheim_preset, enable_campaign_points=True, preset_id=preset and preset.pk)

            self.assertEqual(self.scenarios(campaign), RULEBOOK)
            self.assertEqual(self.plots(campaign), [])

    def test_a_preset_whose_settings_add_no_scenarios_gets_the_rulebooks_nine(self) -> None:
        self.assertEqual(self.scenarios(self.make(self.sylvania_preset)), RULEBOOK)

    def test_ticking_and_unticking_settings_touch_neither_list(self) -> None:
        campaign = self.make(self.mim)

        for ticked in ([self.khemri.pk], [self.mordheim.pk]):
            response = self.patch_as(self.owner, f"/api/campaigns/{campaign.pk}/", {"setting_ids": ticked})
            self.assertEqual(response.status_code, 200, response.data)

        self.assertEqual(self.scenarios(campaign), {"the-mummy": 3.0, "skirmish": 1.0})
        self.assertEqual(self.plots(campaign), ["Drowning the Witch", "The Annual Plot"])

    def test_a_new_preset_swaps_them_keeping_what_a_battle_names_a_warband_follows_and_hand_added(self) -> None:
        campaign = self.make(self.mim)
        version = editable(SCENARIOS, self.book("the-mummy"), campaign.pk)  # the list's row follows it
        self.assertEqual(CampaignScenario.objects.get(campaign=campaign, scenario=version).weight, 3)
        CampaignScenario.objects.create(campaign=campaign, scenario=self.book("raid"), weight=Decimal("0.5"))
        Battle.objects.create(
            campaign=campaign, created_by_user=self.owner, scenario="Skirmish", scenario_ref=self.book("skirmish")
        )
        followed = Plot.objects.get(name="Drowning the Witch")
        Warband.objects.create(campaign=campaign, user=self.owner, name="Fishers", plot=followed)

        self.change(campaign, self.khemri_preset)

        self.assertEqual(self.scenarios(campaign), {"skirmish": 1.0, "raid": 0.5, "kidnapped": 1.0})
        self.assertEqual(self.plots(campaign), ["Drowning the Witch", "Tomb Robbers"])

        self.change(campaign, None)  # no preset: the rulebook's arrive, none already listed touched

        self.assertEqual(self.scenarios(campaign), {**RULEBOOK, "skirmish": 1.0, "raid": 0.5})
        self.assertEqual(self.plots(campaign), ["Drowning the Witch"])

    def test_campaign_points_switched_on_later_gives_the_presets_plots(self) -> None:
        campaign = self.make(self.khemri_preset)
        self.assertEqual(self.plots(campaign), [])

        response = self.patch_as(self.owner, f"/api/campaigns/{campaign.pk}/", {"enable_campaign_points": True})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.plots(campaign), ["Tomb Robbers"])

    def test_a_swap_reads_in_a_fixed_number_of_queries_whatever_the_lists_hold(self) -> None:
        def counted(campaign: Campaign) -> int:
            with CaptureQueriesContext(connection) as queries:
                swap_lists(campaign.pk, self.mim.pk, self.khemri_preset.pk)
            return len(queries)

        few = counted(self.make(self.mim))
        for slug in ("raid", "occupy", "breakthrough"):
            SettingScenario.objects.create(setting=self.marienburg, scenario=self.book(slug))
        book_plot("Another", campaign_type=self.annual)

        self.assertEqual(counted(self.make(self.mim)), few)
