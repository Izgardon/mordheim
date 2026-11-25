"""A campaign's list of scenarios (William, 24 Nov 2026): Mordheim 1a's sixteen from its creation, a ticked setting's
added and an unticked one's kept, read by every member in a fixed number of queries, and added to, weighted and
taken from by `manage_scenarios` holders only (owners and admins), never in an archived campaign."""

from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone

from apps.campaigns.models import Campaign, CampaignType
from apps.scenarios.models import CampaignScenario, Scenario, SettingScenario

from .scenario_support import ScenarioTestCase

MORDHEIMS = {
    "skirmish": 6.0,
    "occupy": 5.0,
    "breakthrough": 5.0,
    "wyrdstone-hunt": 4.0,
    "surprise-attack": 4.0,
    "hidden-treasure": 3.0,
    "chance-encounter": 3.0,
    "street-fight": 2.0,
    "defend-the-find": 2.0,
    "treasure-hunt-tc5": 9.0,
    "ambush-tc5": 9.0,
    "street-brawl-tc5": 6.0,
    "wizards-mansion-tc5": 3.0,
    "pool-tc5": 3.0,
    "monster-hunt-tc5": 2.0,
    "lost-prince-tc5": 2.0,
}


class CampaignListTests(ScenarioTestCase):
    def test_a_new_campaign_starts_with_mordheims_sixteen_at_their_weights(self) -> None:
        self.assertEqual(self.listed(), MORDHEIMS)

    def test_every_member_reads_the_list_whole_and_an_outsider_gets_404(self) -> None:
        response = self.get_as(self.rival, self.url("scenarios/"))
        first = response.json()[0]
        self.assertEqual(set(first), {"id", "weight", "scenario"})
        self.assertEqual(first["scenario"]["name"], "Ambush!")  # by name
        self.assertTrue(first["scenario"]["sections"])
        self.assertEqual(self.get_as(self.outsider, self.url("scenarios/")).status_code, 404)

    def test_the_list_reads_in_two_queries_whatever_its_length(self) -> None:
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(2):  # the caller's access, the rows with their scenarios
            self.client.get(self.url("scenarios/"))
        CampaignScenario.objects.bulk_create(
            [CampaignScenario(campaign=self.campaign, scenario=s) for s in Scenario.objects.filter(campaign=None)],
            ignore_conflicts=True,
        )
        with self.assertNumQueries(2):
            response = self.client.get(self.url("scenarios/"))
        self.assertEqual(len(response.json()), Scenario.objects.filter(campaign=None).count())

    def test_ticking_a_setting_adds_its_scenarios_and_unticking_removes_none(self) -> None:
        khemri = CampaignType.objects.create(slug="khemri", name="Khemri 1b", grade="1b")
        SettingScenario.objects.create(setting=khemri, scenario=self.book("the-mummy"), weight=Decimal("1.5"))
        SettingScenario.objects.create(setting=khemri, scenario=self.book("skirmish"), weight=Decimal(1))

        ticked = self.patch_as(self.owner, self.url(), {"setting_ids": [khemri.id]})
        self.assertEqual(ticked.status_code, 200, ticked.data)
        self.assertEqual(self.listed(), {**MORDHEIMS, "the-mummy": 1.5})  # Skirmish keeps its weight

        self.patch_as(self.owner, self.url(), {"setting_ids": []})
        self.assertEqual(self.listed(), {**MORDHEIMS, "the-mummy": 1.5})

    def test_a_setting_still_ticked_adds_nothing_back(self) -> None:
        self.row("skirmish").delete()
        self.patch_as(self.owner, self.url(), {"setting_ids": [self.mordheim.id]})
        self.assertNotIn("skirmish", self.listed())


class ManagingTests(ScenarioTestCase):
    def test_an_owner_adds_a_scenario_at_one_unless_a_weight_is_sent(self) -> None:
        added = self.post_as(self.owner, self.url("scenarios/"), {"scenario_id": self.book("kidnapped").id})
        self.assertEqual((added.status_code, added.json()["weight"]), (201, 1.0))
        again = {"scenario_id": self.book("raid").id, "weight": "0"}
        self.assertEqual(self.post_as(self.admin, self.url("scenarios/"), again).json()["weight"], 0.0)
        self.assertEqual((self.listed()["kidnapped"], self.listed()["raid"]), (1.0, 0.0))

    def test_a_player_needs_manage_scenarios_to_add_weight_or_remove(self) -> None:
        row = self.row("skirmish")
        body = {"scenario_id": self.book("kidnapped").id}
        self.assertEqual(self.post_as(self.player, self.url("scenarios/"), body).status_code, 403)
        self.assertEqual(self.patch_as(self.player, self.url(f"scenarios/{row.id}/"), {"weight": 2}).status_code, 403)
        self.assertEqual(self.delete_as(self.player, self.url(f"scenarios/{row.id}/")).status_code, 403)

        self.grant(self.player, "manage_scenarios")
        self.assertEqual(self.post_as(self.player, self.url("scenarios/"), body).status_code, 201)

    def test_the_campaign_reports_who_manages_scenarios(self) -> None:
        self.assertTrue(self.get_as(self.owner, self.url()).data["capabilities"]["manage_scenarios"])
        self.assertFalse(self.get_as(self.player, self.url()).data["capabilities"]["manage_scenarios"])

    def test_a_weight_is_a_number_at_or_above_zero(self) -> None:
        url = self.url(f"scenarios/{self.row('skirmish').id}/")
        self.assertEqual(self.patch_as(self.owner, url, {"weight": "1.5"}).json()["weight"], 1.5)
        self.assertEqual(self.patch_as(self.owner, url, {"weight": -1}).status_code, 400)
        self.assertEqual(self.patch_as(self.owner, url, {"weight": "lots"}).status_code, 400)
        self.assertEqual(self.listed()["skirmish"], 1.5)

    def test_removing_takes_it_off_the_list_and_leaves_the_catalogue(self) -> None:
        row = self.row("skirmish")
        self.assertEqual(self.delete_as(self.owner, self.url(f"scenarios/{row.id}/")).status_code, 204)
        self.assertNotIn("skirmish", self.listed())
        self.assertTrue(Scenario.objects.filter(pk=row.scenario_id).exists())
        self.assertEqual(self.delete_as(self.owner, self.url(f"scenarios/{row.id}/")).status_code, 404)

    def test_another_campaigns_row_or_scenario_is_not_found(self) -> None:
        theirs = CampaignScenario.objects.filter(campaign=self.elsewhere).first()
        assert theirs is not None
        self.assertEqual(self.patch_as(self.owner, self.url(f"scenarios/{theirs.id}/"), {"weight": 2}).status_code, 404)
        own = Scenario.objects.create(campaign=self.elsewhere, name="Their own")
        refused = self.post_as(self.owner, self.url("scenarios/"), {"scenario_id": own.id})
        self.assertEqual(refused.status_code, 400)

    def test_an_archived_campaign_is_read_only(self) -> None:
        Campaign.objects.filter(pk=self.campaign.pk).update(archived_at=timezone.now())
        row = self.row("skirmish")
        added = self.post_as(self.owner, self.url("scenarios/"), {"scenario_id": self.book("kidnapped").id})
        self.assertEqual((added.status_code, added.json()["code"]), (403, "campaign_archived"))
        self.assertEqual(self.patch_as(self.owner, self.url(f"scenarios/{row.id}/"), {"weight": 2}).status_code, 403)
        self.assertEqual(self.get_as(self.player, self.url("scenarios/")).status_code, 200)

    def test_a_write_announces_the_campaigns_scenarios(self) -> None:
        with patch("apps.core.catalogue.cache.send_catalogue_changed") as sent:
            self.post_as(self.owner, self.url("scenarios/"), {"scenario_id": self.book("kidnapped").id})
        sent.assert_called_once_with(self.campaign.id, "scenarios", None)
