"""Grading phase 1's data migration (warbands/0004): a dev database's warbands get types from their free-text
faction, by name where the book has one, else as a custom type in their campaign."""

from typing import Any

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [("warbands", "0003_warband_type_and_group"), ("campaigns", "0006_setting_grade_order_always_on")]
AFTER = [("warbands", "0005_warband_drop_faction_restrictions")]


class FactionMappingMigrationTests(TransactionTestCase):
    def migrate(self, targets: list[tuple[str, str]]) -> Any:
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self) -> None:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())  # leave the database as every other test expects it
        super().tearDown()

    def test_factions_map_to_book_types_by_name_the_rest_become_custom_types_and_campaigns_get_up_to_1c(self) -> None:
        old = self.migrate(BEFORE)
        user_model = old.get_model("auth", "User")
        Campaign = old.get_model("campaigns", "Campaign")
        Warband = old.get_model("warbands", "Warband")
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        other = Campaign.objects.create(name="Elsewhere", join_code="ELSEWH")
        factions = {"reik": " reiklanders", "liz": "Lizardmen", "own": "Homebrew Elves", "far": "Homebrew Elves"}
        for index, (name, faction) in enumerate(factions.items()):
            user = user_model.objects.create(username=f"user{index}@example.com", email=f"user{index}@example.com")
            Warband.objects.create(campaign=other if name == "far" else campaign, user=user, name=name, faction=faction)

        new = self.migrate(AFTER)
        Warband = new.get_model("warbands", "Warband")
        types = {row.name: row.warband_type for row in Warband.objects.select_related("warband_type__campaign_type")}
        self.assertEqual((types["reik"].slug, types["reik"].campaign_id), ("reiklanders", None))
        self.assertEqual(types["liz"].slug, "lizardmen-tc11")  # two book types share the name: the lower setting
        self.assertEqual(
            (types["own"].name, types["own"].campaign_id, types["own"].campaign_type_id),
            ("Homebrew Elves", campaign.id, None),
        )
        self.assertEqual(types["far"].campaign_id, other.id)  # one custom type per campaign
        self.assertNotEqual(types["far"].pk, types["own"].pk)
        settings = new.get_model("campaigns", "CampaignType").objects
        self.assertEqual(settings.count(), 19)
        ticked = new.get_model("campaigns", "CampaignCampaignType").objects.filter(campaign_id=campaign.id)
        expected = set(settings.filter(grade__in=("1a", "1b", "1c")).values_list("id", flat=True))
        self.assertEqual(set(ticked.values_list("campaign_type_id", flat=True)), expected)  # Up to 1c
