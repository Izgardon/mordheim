"""Picking the published campaign you play (William, 17 Nov 2026): the preset list, what a preset dictates at
creation and when it is changed, where a campaign departs from it, and its rules offered rather than copied."""

from typing import Any

from apps.campaign_presets.models import (
    CampaignPreset,
    CampaignPresetChart,
    CampaignPresetChartRow,
    CampaignPresetRule,
)
from apps.campaigns.in_play import preset_ids
from apps.campaigns.models import Campaign, CampaignChart, CampaignRule, CampaignSettings, CampaignType
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.exploration.models import ExplorationChart

MARIENBURG = "Mutiny in Marienburg"
RULES = [("Campaign points", "Mark one box for every Campaign Point."), ("Cargo", "Crates of Marienburg.")]
# a standalone chart, and a table hanging off one of its results: only the first is a chart of the campaign's own
CHARTS = ["Seaside Situations", "Booty"]


class CampaignPresetTests(CampaignTestCase):
    setting: CampaignType
    chart: ExplorationChart
    marienburg: CampaignPreset
    mordheim: CampaignPreset

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.setting = CampaignType.objects.create(slug="mutiny-in-marienburg", name=MARIENBURG, grade="2b")
        cls.chart = ExplorationChart.objects.create(slug="mutiny-in-marienburg", name="Wasteland Exploration")
        cls.mordheim = CampaignPreset.objects.create(slug="mordheim", name="Mordheim", sort_order=1)
        cls.marienburg = CampaignPreset.objects.create(
            slug="mutiny-in-marienburg",
            name=MARIENBURG,
            sort_order=12,
            exploration_chart=cls.chart,
            enable_locations=True,
            enable_encampments=True,
            enable_campaign_points=True,
            enable_blood_pacts=True,
            max_heroes=6,
            hero_death_roll="d66",
        )
        cls.marienburg.settings.set([cls.setting])
        CampaignPresetRule.objects.bulk_create(
            CampaignPresetRule(preset=cls.marienburg, order=place, title=title, text=text)
            for place, (title, text) in enumerate(RULES)
        )
        for place, title in enumerate(CHARTS):
            chart = CampaignPresetChart.objects.create(preset=cls.marienburg, order=place, title=title, dice="D66")
            row = CampaignPresetChartRow.objects.create(chart=chart, order=0, result="11", name="Rats", text="")
            if title == "Seaside Situations":  # the sub-table its result sends the player to
                table = CampaignPresetChart.objects.create(preset=cls.marienburg, row=row, title="Sewer hazards")
                CampaignPresetChartRow.objects.create(chart=table, order=0, result="1", name="Gas", text="")

    # helpers

    def create(self, **body: Any) -> dict[str, Any]:
        response = self.post_as(self.owner, "/api/campaigns/", {"name": "Ashes", "max_players": 4, **body})
        self.assertEqual(response.status_code, 201, response.data)
        created: dict[str, Any] = response.data
        return created

    def settings_of(self, campaign_id: int) -> CampaignSettings:
        return CampaignSettings.objects.get(campaign_id=campaign_id)

    def rules_of(self, campaign_id: int) -> list[str]:
        return [rule.title for rule in CampaignRule.objects.filter(campaign_id=campaign_id).order_by("order", "id")]

    def charts_of(self, campaign_id: int) -> list[str]:
        """The campaign's own charts: a table belonging to a rule or a result is not one."""
        rows = CampaignChart.objects.filter(campaign_id=campaign_id, rule__isnull=True, row__isnull=True)
        return [chart.title for chart in rows.order_by("order", "id")]

    def preset_payload(self, campaign_id: int, user: Any = None) -> dict[str, Any]:
        response = self.get_as(user or self.owner, f"/api/campaigns/{campaign_id}/preset/")
        self.assertEqual(response.status_code, 200, response.data)
        payload: dict[str, Any] = response.data
        return payload

    # the list

    def test_the_preset_list_holds_each_published_campaign_with_what_it_dictates(self) -> None:
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(2):
            rows = self.client.get("/api/campaign-presets/").data
        self.assertEqual([row["slug"] for row in rows], ["mordheim", "mutiny-in-marienburg"])
        self.assertEqual((rows[0]["sets"], rows[0]["setting_ids"], rows[0]["rule_count"]), ([], [], 0))
        marienburg = rows[1]
        self.assertEqual(marienburg["setting_names"], [MARIENBURG])
        self.assertEqual(marienburg["rule_count"], 2)
        self.assertEqual(marienburg["sets"][5]["departure"], f"{MARIENBURG} sets Most heroes: 6.")
        self.assertEqual(
            [(line["field"], line["text"]) for line in marienburg["sets"]],
            [
                ("exploration_chart_id", "Wasteland Exploration"),
                ("enable_locations", "on"),
                ("enable_encampments", "on"),
                ("enable_campaign_points", "on"),
                ("enable_blood_pacts", "on"),
                ("max_heroes", "6"),
                ("hero_death_roll", "D66"),
            ],
        )

    def test_the_preset_list_takes_a_login(self) -> None:
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/campaign-presets/").status_code, 401)

    # creation

    def test_creating_with_a_preset_applies_what_it_dictates_and_copies_its_rules(self) -> None:
        created = self.create(preset_id=self.marienburg.pk)
        self.assertEqual(created["preset_id"], self.marienburg.pk)
        settings = self.settings_of(created["id"])
        self.assertEqual(
            (
                settings.enable_locations,
                settings.enable_encampments,
                settings.enable_campaign_points,
                settings.enable_blood_pacts,
                settings.max_heroes,
                settings.hero_death_roll,
                settings.exploration_chart_id,
            ),
            (True, True, True, True, 6, "d66", self.chart.pk),
        )
        self.assertEqual(self.rules_of(created["id"]), [title for title, _text in RULES])

    def test_creating_with_a_preset_copies_its_charts_too(self) -> None:
        """William, 20 Nov 2026: a Marienburg campaign "has no charts, it has the rest of the rules". Creation
        copied the rules and stopped there, so the charts only arrived if someone later asked for the preset's
        rules again."""
        created = self.create(preset_id=self.marienburg.pk)

        self.assertEqual(self.charts_of(created["id"]), CHARTS)

    def test_creating_with_a_preset_copies_a_table_hanging_off_a_result(self) -> None:
        created = self.create(preset_id=self.marienburg.pk)

        table = CampaignChart.objects.select_related("row__chart").get(campaign_id=created["id"], row__isnull=False)
        row = table.row
        assert row is not None  # row__isnull=False, but mypy reads the field as nullable
        self.assertEqual((table.title, row.chart.title, row.result), ("Sewer hazards", "Seaside Situations", "11"))

    def test_creating_without_a_preset_copies_no_charts(self) -> None:
        created = self.create()

        self.assertEqual(self.charts_of(created["id"]), [])

    def test_creating_with_a_preset_ticks_its_settings_on_top_of_the_grade_preset(self) -> None:
        created = self.create(preset_id=self.marienburg.pk)
        self.assertEqual(set(created["setting_ids"]), {*preset_ids("1c"), self.setting.pk})

    def test_a_creator_who_departs_from_the_preset_keeps_what_he_sent(self) -> None:
        created = self.create(preset_id=self.marienburg.pk, enable_locations=False)
        settings = self.settings_of(created["id"])
        self.assertEqual((settings.enable_locations, settings.enable_encampments), (False, True))

    def test_a_campaign_with_no_preset_is_unchanged(self) -> None:
        created = self.create()
        self.assertIsNone(created["preset_id"])
        settings = self.settings_of(created["id"])
        self.assertEqual((settings.enable_locations, settings.max_heroes, settings.hero_death_roll), (False, 6, "d66"))
        self.assertEqual(self.rules_of(created["id"]), [])

    def test_a_preset_that_dictates_nothing_leaves_every_setting_alone(self) -> None:
        created = self.create(preset_id=self.mordheim.pk)
        settings = self.settings_of(created["id"])
        self.assertEqual(created["preset_id"], self.mordheim.pk)
        self.assertEqual((settings.enable_locations, settings.enable_campaign_points), (False, False))
        self.assertEqual(sorted(created["setting_ids"]), sorted(preset_ids("1c")))

    def test_an_unknown_preset_is_refused(self) -> None:
        response = self.post_as(self.owner, "/api/campaigns/", {"name": "Odd", "preset_id": 999999})
        self.assertEqual(response.status_code, 400)

    # changing it

    def test_the_owner_changes_the_preset_at_any_time_and_its_settings_are_applied(self) -> None:
        response = self.patch_as(self.owner, self.url(), {"preset_id": self.marienburg.pk})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["preset_id"], self.marienburg.pk)
        settings = self.settings_of(self.campaign.pk)
        self.assertEqual((settings.enable_locations, settings.max_heroes), (True, 6))
        self.assertIn(self.setting.pk, response.data["setting_ids"])

    def test_changing_the_preset_offers_its_rules_rather_than_copying_them(self) -> None:
        self.patch_as(self.owner, self.url(), {"preset_id": self.marienburg.pk})
        self.assertEqual(self.rules_of(self.campaign.pk), [])
        self.assertEqual(self.preset_payload(self.campaign.pk)["rules"], [title for title, _text in RULES])

    def test_changing_the_preset_never_unticks_the_settings_the_campaign_already_had(self) -> None:
        before = set(self.get_as(self.owner, self.url()).data["setting_ids"])
        after = set(self.patch_as(self.owner, self.url(), {"preset_id": self.marienburg.pk}).data["setting_ids"])
        self.assertEqual(after, before | {self.setting.pk})

    def test_what_the_same_patch_sends_wins_over_the_preset(self) -> None:
        body = {"preset_id": self.marienburg.pk, "max_heroes": 4}
        self.patch_as(self.owner, self.url(), body)
        self.assertEqual(self.settings_of(self.campaign.pk).max_heroes, 4)

    def test_only_the_owner_changes_the_preset(self) -> None:
        for user in (self.admin, self.player):
            response = self.patch_as(user, self.url(), {"preset_id": self.marienburg.pk})
            self.assertEqual(response.status_code, 403, response.data)
        self.assertIsNone(Campaign.objects.get(pk=self.campaign.pk).preset_id)

    def test_the_preset_can_be_cleared(self) -> None:
        self.patch_as(self.owner, self.url(), {"preset_id": self.marienburg.pk})
        response = self.patch_as(self.owner, self.url(), {"preset_id": None})
        self.assertIsNone(response.data["preset_id"])
        self.assertEqual(self.preset_payload(self.campaign.pk)["sets"], [])

    # what it dictates, and departing from it

    def test_the_payload_names_the_preset_what_it_sets_and_nothing_departed_from(self) -> None:
        campaign_id = self.create(preset_id=self.marienburg.pk)["id"]
        # the reader's access, the preset, its settings, its rules and their own tables with those tables'
        # results, its charts with their results, then the titles the campaign already holds of each: a fixed
        # count, whatever the preset or the campaign holds
        with self.assertNumQueries(9):
            data = self.preset_payload(campaign_id)
        self.assertEqual((data["preset_id"], data["preset_name"]), (self.marienburg.pk, MARIENBURG))
        self.assertEqual((data["departures"], data["rule_count"]), ([], 2))
        self.assertEqual(len(data["sets"]), 7)

    def test_departing_from_a_dictated_setting_warns_and_is_allowed(self) -> None:
        campaign_id = self.create(preset_id=self.marienburg.pk)["id"]
        patched = self.patch_as(self.owner, f"/api/campaigns/{campaign_id}/", {"max_heroes": 8})
        self.assertEqual(patched.status_code, 200, patched.data)
        departures = self.preset_payload(campaign_id)["departures"]
        self.assertEqual(
            [(line["field"], line["message"]) for line in departures],
            [("max_heroes", f"{MARIENBURG} sets Most heroes: 6.")],
        )

    def test_a_campaign_with_no_preset_departs_from_nothing(self) -> None:
        data = self.preset_payload(self.campaign.pk)
        self.assertEqual((data["preset_id"], data["sets"], data["departures"], data["rules"]), (None, [], [], []))

    def test_every_member_reads_the_preset_and_an_outsider_does_not(self) -> None:
        self.assertEqual(self.preset_payload(self.campaign.pk, self.player)["preset_id"], None)
        self.assertEqual(self.get_as(self.outsider, self.url("preset/")).status_code, 404)

    # its rules

    def test_adding_the_presets_rules_copies_the_ones_the_campaign_lacks_and_never_twice(self) -> None:
        self.patch_as(self.owner, self.url(), {"preset_id": self.marienburg.pk})
        CampaignRule.objects.create(campaign=self.campaign, title="Cargo", body="Ours.", order=0)
        response = self.post_as(self.owner, self.url("preset/rules/"))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["title"] for row in response.data["rules"]], ["Cargo", "Campaign points"])
        self.assertEqual(CampaignRule.objects.filter(campaign=self.campaign, title="Cargo").count(), 1)
        again = self.post_as(self.owner, self.url("preset/rules/"))
        self.assertEqual([row["title"] for row in again.data["rules"]], ["Cargo", "Campaign points"])

    def test_adding_the_rules_of_no_preset_does_nothing(self) -> None:
        response = self.post_as(self.owner, self.url("preset/rules/"))
        self.assertEqual((response.status_code, response.data), (200, {"rules": [], "charts": []}))

    def test_only_the_owner_and_admins_add_the_presets_rules(self) -> None:
        self.patch_as(self.owner, self.url(), {"preset_id": self.marienburg.pk})
        self.assertEqual(self.post_as(self.player, self.url("preset/rules/")).status_code, 403)
        self.assertEqual(self.post_as(self.admin, self.url("preset/rules/")).status_code, 200)

    def test_an_archived_campaign_takes_neither_a_preset_change_nor_its_rules(self) -> None:
        self.patch_as(self.owner, self.url(), {"preset_id": self.marienburg.pk})
        self.post_as(self.owner, self.url("archive/"))
        refused = self.patch_as(self.owner, self.url(), {"preset_id": self.mordheim.pk})
        self.assertEqual((refused.status_code, refused.data["code"]), (403, "campaign_archived"))
        rules = self.post_as(self.owner, self.url("preset/rules/"))
        self.assertEqual((rules.status_code, rules.data["code"]), (403, "campaign_archived"))
        self.assertEqual(self.get_as(self.owner, self.url("preset/")).status_code, 200)
