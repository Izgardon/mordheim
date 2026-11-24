"""Scenarios in the catalogue: a campaign's own written whole through the catalogue's write path, a book scenario's
first edit making the campaign's version with its list row and battles following it there and back, and a battle
started as one of the campaign's scenarios keeping it."""

from apps.battles.models import Battle
from apps.scenarios.models import CampaignScenario, Scenario

from .scenario_support import ScenarioTestCase

OWN = {
    "name": "Bridge of Sighs",
    "players": "multiplayer",
    "source": "House",
    "summary": "Hold the bridge.",
    "intro": "A bridge.",
    "sections": [
        {"title": "Terrain", "text": "A river."},
        {"title": "Special rules", "text": "Roll:\n\n{{table:1}}", "tables": [{"columns": ["D6"], "rows": [["1"]]}]},
    ],
}


class CatalogueTests(ScenarioTestCase):
    def test_a_campaigns_own_scenario_is_written_whole_and_added_to_the_list(self) -> None:
        created = self.post_as(
            self.player, "/api/scenarios/", {**OWN, "campaign_id": self.campaign.id}
        )  # edit_catalogue
        self.assertEqual(created.status_code, 201, created.data)
        body = created.json()
        self.assertEqual((body["campaign_id"], body["players"]), (self.campaign.id, "multiplayer"))
        self.assertEqual(body["sections"][0], {"title": "Terrain", "text": "A river.", "tables": []})

        listed = self.get_as(self.player, f"/api/scenarios/?campaign_id={self.campaign.id}").json()
        self.assertEqual(len(listed), 71)
        self.assertTrue(all(row["in_play"] for row in listed))  # no setting: never hidden

        taken = self.post_as(self.owner, "/api/scenarios/", {**OWN, "campaign_id": self.campaign.id})
        self.assertEqual(taken.json()["code"], "name_taken")

    def test_a_section_needs_its_title_and_players_one_of_the_two(self) -> None:
        bad = {**OWN, "name": "Bad", "sections": [{"text": "no title"}], "campaign_id": self.campaign.id}
        self.assertEqual(self.post_as(self.owner, "/api/scenarios/", bad).status_code, 400)
        worse = {**OWN, "name": "Worse", "players": "solo", "campaign_id": self.campaign.id}
        self.assertEqual(self.post_as(self.owner, "/api/scenarios/", worse).status_code, 400)

    def test_a_versions_first_edit_takes_the_list_row_and_battles_and_revert_brings_them_back(self) -> None:
        book = self.book("skirmish")
        battle = Battle.objects.create(
            campaign=self.campaign, created_by_user=self.owner, scenario="Skirmish", scenario_ref=book
        )
        edited = self.patch_as(
            self.owner, f"/api/scenarios/{book.id}/", {"summary": "Ours.", "campaign_id": self.campaign.id}
        )
        version = Scenario.objects.get(pk=edited.json()["id"])

        self.assertEqual(version.replaces_id, book.id)
        self.assertEqual(self.row("skirmish").scenario_id, version.id)  # the version keeps the book's slug
        self.assertEqual(Battle.objects.get(pk=battle.pk).scenario_ref_id, version.id)
        other = CampaignScenario.objects.get(campaign=self.elsewhere, scenario__slug="skirmish")
        self.assertEqual(other.scenario_id, book.id)  # another campaign keeps the book's

        self.post_as(self.owner, f"/api/scenarios/{version.id}/revert/", {"campaign_id": self.campaign.id})
        self.assertEqual(CampaignScenario.objects.get(campaign=self.campaign, scenario__slug="skirmish").scenario_id, book.id)  # fmt: skip
        self.assertEqual(Battle.objects.get(pk=battle.pk).scenario_ref_id, book.id)


class BattleTests(ScenarioTestCase):
    def test_a_battle_started_as_a_listed_scenario_keeps_it_and_its_name(self) -> None:
        skirmish = self.book("skirmish")
        body = {"participant_user_ids": [self.rival.id], "scenario": "Skirmish", "scenario_id": skirmish.id}
        created = self.post_as(self.player, self.url("battles/"), body)

        self.assertEqual(created.status_code, 201, created.data)
        battle = created.json()["battle"]
        self.assertEqual((battle["scenario"], battle["scenario_id"]), ("Skirmish", skirmish.id))

    def test_a_typed_name_needs_no_scenario_and_an_unknown_one_is_refused(self) -> None:
        typed = self.post_as(self.player, self.url("battles/"), {"participant_user_ids": [self.rival.id], "scenario": "Bridge"})  # fmt: skip
        self.assertEqual(typed.json()["battle"]["scenario_id"], None)
        Battle.objects.all().delete()
        theirs = Scenario.objects.create(campaign=self.elsewhere, name="Theirs")
        body = {"participant_user_ids": [self.rival.id], "scenario": "X", "scenario_id": theirs.id}
        self.assertEqual(self.post_as(self.player, self.url("battles/"), body).status_code, 400)

    def test_a_reported_result_keeps_its_scenario_too(self) -> None:
        body = {
            "participant_user_ids": [self.rival.id],
            "scenario_id": self.book("occupy").id,
            "battle_date": "2026-11-01",
            "winner_warband_ids": [self.warband.id],
        }
        reported = self.post_as(self.player, self.url("battles/report-result/"), body)
        self.assertEqual(reported.status_code, 201, reported.data)
        self.assertEqual(Battle.objects.get().scenario, "Occupy")  # named from the scenario when none was typed
