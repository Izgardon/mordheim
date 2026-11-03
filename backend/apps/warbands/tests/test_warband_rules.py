"""A warband's own rules (William, 3 Nov 2026): title and description entries that members read and the warband's
editors add, edit and delete; the sheet carries them."""

from django.utils import timezone

from apps.campaigns.models import Campaign
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.warbands.models import WarbandRule


class WarbandRuleTests(CampaignTestCase):
    def rules_url(self, rule: WarbandRule | None = None) -> str:
        return f"/api/warbands/{self.warband.id}/rules/" + (f"{rule.id}/" if rule else "")

    def titles(self) -> list[str]:
        return list(WarbandRule.objects.filter(warband=self.warband).values_list("title", flat=True))

    def test_the_owner_adds_a_rule_trimmed_and_it_lists_in_the_order_added(self):
        first = self.post_as(self.player, self.rules_url(), {"title": "  Burn the witch ", "description": " Hate. "})
        second = self.post_as(self.player, self.rules_url(), {"title": "Wyrdstone hunters"})

        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json(), {"id": first.json()["id"], "title": "Burn the witch", "description": "Hate."})
        self.assertEqual(second.json()["description"], "")
        listed = self.get_as(self.rival, self.rules_url()).json()  # any member reads them
        self.assertEqual([rule["title"] for rule in listed], ["Burn the witch", "Wyrdstone hunters"])

    def test_a_rule_needs_a_title_and_its_text_has_a_limit(self):
        blank = self.post_as(self.player, self.rules_url(), {"title": "   ", "description": "Text"})
        long = self.post_as(self.player, self.rules_url(), {"title": "Long", "description": "x" * 8001})

        self.assertEqual((blank.status_code, long.status_code), (400, 400))
        self.assertEqual(self.titles(), [])

    def test_the_owner_edits_either_field_and_deletes_it(self):
        rule = WarbandRule.objects.create(warband=self.warband, title="Hatred", description="Old")

        retitled = self.patch_as(self.player, self.rules_url(rule), {"title": "Hate"})
        rewritten = self.patch_as(self.player, self.rules_url(rule), {"description": "New"})
        deleted = self.delete_as(self.player, self.rules_url(rule))

        self.assertEqual(retitled.json(), {"id": rule.id, "title": "Hate", "description": "Old"})
        self.assertEqual(rewritten.json(), {"id": rule.id, "title": "Hate", "description": "New"})
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.titles(), [])

    def test_the_campaign_s_admins_edit_them_and_other_players_only_read(self):
        rule = WarbandRule.objects.create(warband=self.warband, title="Hatred")

        by_owner = self.post_as(self.owner, self.rules_url(), {"title": "Fear"})
        by_admin = self.patch_as(self.admin, self.rules_url(rule), {"title": "Hate"})
        by_rival = self.post_as(self.rival, self.rules_url(), {"title": "Mine"})
        rival_edit = self.patch_as(self.rival, self.rules_url(rule), {"title": "Mine"})
        rival_delete = self.delete_as(self.rival, self.rules_url(rule))
        outsider = self.get_as(self.outsider, self.rules_url())

        self.assertEqual((by_owner.status_code, by_admin.status_code), (201, 200))
        self.assertEqual((by_rival.status_code, rival_edit.status_code, rival_delete.status_code), (403, 403, 403))
        self.assertEqual(outsider.status_code, 404)
        self.assertEqual(self.titles(), ["Hate", "Fear"])

    def test_a_rule_of_another_warband_is_not_found(self):
        theirs = WarbandRule.objects.create(warband=self.rival_warband, title="Swarm")
        url = f"/api/warbands/{self.warband.id}/rules/{theirs.id}/"

        edited = self.patch_as(self.player, url, {"title": "Mine"})
        deleted = self.delete_as(self.player, url)

        self.assertEqual((edited.status_code, deleted.status_code), (404, 404))
        self.assertEqual(WarbandRule.objects.get(id=theirs.id).title, "Swarm")

    def test_an_archived_campaign_s_rules_are_read_only(self):
        rule = WarbandRule.objects.create(warband=self.warband, title="Hatred")
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())

        added = self.post_as(self.player, self.rules_url(), {"title": "Fear"})
        deleted = self.delete_as(self.player, self.rules_url(rule))

        self.assertEqual((added.status_code, deleted.status_code), (403, 403))
        self.assertEqual(self.get_as(self.player, self.rules_url()).status_code, 200)
        self.assertEqual(self.titles(), ["Hatred"])

    def test_the_sheet_carries_the_rules(self):
        WarbandRule.objects.create(warband=self.warband, title="Hatred", description="Hates Skaven.")

        sheet = self.get_as(self.rival, f"/api/warbands/{self.warband.id}/sheet/").json()

        self.assertEqual(sheet["rules"], self.get_as(self.rival, self.rules_url()).json())
        self.assertEqual(
            [(rule["title"], rule["description"]) for rule in sheet["rules"]], [("Hatred", "Hates Skaven.")]
        )
