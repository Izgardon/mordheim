"""Henchmen loadouts' data migration (warbands/0006): a dev database's group copies become loadout rows, one per item
for each full set of copies, the copies left over go to the stash, and a short group's last members get gaps."""

from typing import Any

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = ("warbands", "0005_warband_drop_faction_restrictions")  # every other app at its latest: its models as now
AFTER = ("warbands", "0006_henchmen_loadouts")


class CopiesToLoadoutMigrationTests(TransactionTestCase):
    def migrate(self, warbands: tuple[str, str]) -> Any:
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        leaves = executor.loader.graph.leaf_nodes()
        targets = [warbands if app == "warbands" else (app, name) for app, name in leaves]
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self) -> None:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())  # leave the database as every other test expects it
        super().tearDown()

    def test_copies_become_rows_with_gaps_on_the_last_members_and_extra_copies_in_the_stash(self) -> None:
        old = self.migrate(BEFORE)
        user = old.get_model("auth", "User").objects.create(username="u@example.com", email="u@example.com")
        campaign = old.get_model("campaigns", "Campaign").objects.create(name="Shards", join_code="SHARDS")
        warband = old.get_model("warbands", "Warband").objects.create(campaign=campaign, user=user, name="Rats")
        item_model = old.get_model("items", "Item")
        sword, shield, horse = (item_model.objects.create(name=name, type="Melee") for name in ("Sword", "Shield", "Horse"))  # fmt: skip
        group_model, member_model = old.get_model("warbands", "HenchmenGroup"), old.get_model("warbands", "Henchman")
        row_model = old.get_model("warbands", "HenchmenGroupItem")
        group = group_model.objects.create(warband=warband, name="Clanrats")
        members = [member_model.objects.create(group=group, name=name) for name in ("A", "B", "C", "D")]
        member_model.objects.create(group=group, name="Dead", dead=True)
        copies = [(sword, 10)] * 9 + [(shield, 5)] * 2 + [(horse, 80)] * 4
        for item, cost in copies:
            row_model.objects.create(henchmen_group=group, item=item, cost=cost, companion=item == horse)
        gone = group_model.objects.create(warband=warband, name="Gone", dead=True)
        for _ in range(3):
            row_model.objects.create(henchmen_group=gone, item=sword, cost=10)

        new = self.migrate(AFTER)

        rows = new.get_model("warbands", "HenchmenGroupItem").objects.order_by("id")
        kept = [(row.henchmen_group_id, row.item_id, row.companion) for row in rows]
        self.assertEqual(
            kept,
            [(group.id, sword.id, False)] * 2
            + [(group.id, shield.id, False), (group.id, horse.id, True), (gone.id, sword.id, False)],  # fmt: skip
        )
        gaps = new.get_model("warbands", "HenchmanItemGap").objects.order_by("henchman_id")
        self.assertEqual([(gap.henchman_id, gap.group_item.item_id, gap.reason) for gap in gaps], [(members[2].id, shield.id, "short"), (members[3].id, shield.id, "short")])  # fmt: skip
        stash = new.get_model("warbands", "WarbandItem").objects.filter(warband_id=warband.id)
        self.assertEqual([(row.item_id, row.cost, row.quantity) for row in stash], [(sword.id, 10, 1)])  # 9 for 4
