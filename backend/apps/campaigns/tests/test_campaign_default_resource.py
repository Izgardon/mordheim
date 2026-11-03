"""The campaign's default resource name (William, 3 Nov 2026): a setting ("Wyrdstone" at first) that only those who
edit the campaign's settings change; a rename renames every warband's default resource in one transaction.

A warband that already has another resource of the new name has it merged into the default (its amount added, its
row gone, an open post-battle draft that named it now naming the default) and the answer warns, naming the warbands.
"""

from apps.battles.models import Battle, BattleParticipant
from apps.warbands.models import Warband, WarbandResource

from .campaign_support import CampaignTestCase


class DefaultResourceNameTests(CampaignTestCase):
    def rename(self, name: str, user=None):
        return self.patch_as(user or self.owner, self.url(), {"default_resource_name": name})

    def rows(self, warband: Warband) -> list[tuple[str, int, bool]]:
        return list(WarbandResource.objects.filter(warband=warband).values_list("name", "amount", "is_default"))

    def test_the_campaign_reads_wyrdstone_at_first(self):
        self.assertEqual(self.get_as(self.player, self.url()).json()["default_resource_name"], "Wyrdstone")

    def test_a_rename_renames_every_warband_s_default_resource(self):
        WarbandResource.objects.filter(warband=self.warband, is_default=True).update(amount=4)
        elsewhere = Warband.objects.create(campaign=self.elsewhere, user=self.outsider, name="Strangers")
        theirs = WarbandResource.objects.create(warband=elsewhere, name="Wyrdstone", is_default=True)

        response = self.rename("  Warpstone ")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["default_resource_name"], "Warpstone")
        self.assertNotIn("warnings", response.json())
        self.assertEqual(self.rows(self.warband), [("Warpstone", 4, True)])
        self.assertEqual(self.rows(self.rival_warband), [("Warpstone", 0, True)])
        theirs.refresh_from_db()
        self.assertEqual(theirs.name, "Wyrdstone")  # another campaign's

    def test_only_those_who_edit_the_settings_rename_it_and_never_to_nothing(self):
        refused = self.rename("Warpstone", user=self.player)
        blank = self.rename("   ")

        self.assertEqual((refused.status_code, blank.status_code), (403, 400))
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 0, True)])

    def test_another_resource_of_the_new_name_is_merged_into_the_default_with_a_warning(self):
        WarbandResource.objects.filter(warband=self.rival_warband, is_default=True).update(amount=3)
        clash = WarbandResource.objects.create(warband=self.rival_warband, name="warpstone", amount=5)
        WarbandResource.objects.create(warband=self.rival_warband, name="Treasure", amount=1)
        default = WarbandResource.objects.get(warband=self.rival_warband, is_default=True)
        battle = Battle.objects.create(campaign=self.campaign, created_by_user=self.rival, scenario="Street Fight")
        upkeep = {"entries": {"hireling:1": {"resources": [{"resource": "Wyrdstone", "amount": 1, "resource_id": clash.id}]}}}  # fmt: skip
        draft = {"exploration": {"dice_values": [6], "resource_id": clash.id}, "upkeep": upkeep}
        participant = BattleParticipant.objects.create(
            battle=battle, user=self.rival, warband=self.rival_warband, postbattle_json=draft
        )

        response = self.rename("Warpstone")

        self.assertEqual(response.status_code, 200)
        message = "Rats already had Warpstone: merged into the default resource."
        warning = {"code": "default_resource_merged", "message": message, "warbands": [self.rival_warband.id]}
        self.assertEqual(response.json()["warnings"], [warning])
        self.assertEqual(self.rows(self.rival_warband), [("Warpstone", 8, True), ("Treasure", 1, False)])
        self.assertEqual(self.rows(self.warband), [("Warpstone", 0, True)])
        participant.refresh_from_db()
        stored = participant.postbattle_json
        self.assertEqual(stored["exploration"]["resource_id"], default.id)
        self.assertEqual(stored["upkeep"]["entries"]["hireling:1"]["resources"][0]["resource_id"], default.id)

    def test_a_change_of_case_renames_without_merging(self):
        response = self.rename("WYRDSTONE")

        self.assertNotIn("warnings", response.json())
        self.assertEqual(self.rows(self.warband), [("WYRDSTONE", 0, True)])
