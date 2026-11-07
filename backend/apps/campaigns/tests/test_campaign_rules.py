"""The campaign's own rules (William, 7 Nov 2026: "campaign wide rules that are not house rules, kind of like warband
rules ... admin only", "more flavourful rulings on how the campaign works"): each a title, a body and a place in the
list. Every member reads them in their order; only the owner and admins add, edit, reorder and delete them (a player
granted every code included), and an archived campaign's are read only."""

from django.utils import timezone

from apps.campaigns.constants import PERMISSION_CODES
from apps.campaigns.models import CampaignHouseRule, CampaignRule

from .campaign_support import CampaignTestCase


class CampaignRuleTests(CampaignTestCase):
    def rules_url(self, suffix: str = "") -> str:
        return self.url(f"campaign-rules/{suffix}")

    def add(self, title: str, body: str = "", user=None):
        return self.post_as(user or self.admin, self.rules_url(), {"title": title, "body": body})

    def listed(self, user=None) -> list[tuple[str, str, int]]:
        rows = self.get_as(user or self.player, self.rules_url()).json()
        return [(row["title"], row["body"], row["order"]) for row in rows]

    def test_a_rule_belongs_to_its_campaign_with_a_title_a_body_and_its_place(self):
        rule = CampaignRule.objects.create(campaign=self.campaign, title="Curfew", body="No one leaves.", order=2)

        self.assertEqual(
            (rule.title, rule.body, rule.order, rule.campaign_id), ("Curfew", "No one leaves.", 2, self.campaign.id)
        )
        self.assertEqual(list(self.campaign.campaign_rules.all()), [rule])
        self.assertFalse(CampaignHouseRule.objects.exists())  # not a house rule

    def test_every_member_reads_them_in_their_order(self):
        CampaignRule.objects.create(campaign=self.campaign, title="Curfew", order=1)
        CampaignRule.objects.create(campaign=self.campaign, title="The Comet", body="It fell.", order=0)
        CampaignRule.objects.create(campaign=self.elsewhere, title="Not ours")

        for user in (self.player, self.rival, self.admin, self.owner):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.listed(user), [("The Comet", "It fell.", 0), ("Curfew", "", 1)])
        self.assertEqual(self.get_as(self.outsider, self.rules_url()).status_code, 404)

    def test_the_owner_and_admins_add_them_each_after_the_last(self):
        first = self.add("  The Comet ", " It fell. ", user=self.owner)
        second = self.add("Curfew")

        self.assertEqual((first.status_code, second.status_code), (201, 201))
        self.assertEqual(first.json()["campaign_id"], self.campaign.id)
        self.assertEqual(self.listed(), [("The Comet", "It fell.", 0), ("Curfew", "", 1)])

    def test_a_title_is_needed(self):
        response = self.add("   ")

        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.json())

    def test_only_the_owner_and_admins_write_them(self):
        rule = CampaignRule.objects.create(campaign=self.campaign, title="Curfew")
        self.grant(self.player, *PERMISSION_CODES)  # manage_rules is the house rules'
        detail = self.rules_url(f"{rule.id}/")

        refused = [
            self.add("Mine", user=self.player).status_code,
            self.patch_as(self.player, detail, {"title": "Mine"}).status_code,
            self.put_as(self.player, self.rules_url("order/"), {"ids": [rule.id]}).status_code,
            self.delete_as(self.player, detail).status_code,
        ]

        self.assertEqual(refused, [403, 403, 403, 403])
        self.assertEqual(self.listed(), [("Curfew", "", 0)])

    def test_an_admin_edits_and_deletes_one(self):
        rule = CampaignRule.objects.create(campaign=self.campaign, title="Curfew", body="At dusk.")
        detail = self.rules_url(f"{rule.id}/")

        edited = self.patch_as(self.admin, detail, {"body": "At the bell."})
        renamed = self.patch_as(self.admin, detail, {"title": "The Bell"})

        self.assertEqual(
            (edited.status_code, edited.json()["title"], edited.json()["body"]), (200, "Curfew", "At the bell.")
        )
        self.assertEqual(renamed.json()["title"], "The Bell")
        self.assertEqual(self.delete_as(self.admin, detail).status_code, 204)
        self.assertEqual(self.listed(), [])
        self.assertEqual(self.delete_as(self.admin, detail).status_code, 404)

    def test_another_campaign_s_rule_is_not_found(self):
        theirs = CampaignRule.objects.create(campaign=self.elsewhere, title="Not ours")

        response = self.patch_as(self.admin, self.rules_url(f"{theirs.id}/"), {"title": "Ours"})

        self.assertEqual(response.status_code, 404)
        theirs.refresh_from_db()
        self.assertEqual(theirs.title, "Not ours")

    def test_a_reorder_names_every_rule_once(self):
        comet, curfew, market = (self.add(title).json()["id"] for title in ("The Comet", "Curfew", "Market"))

        moved = self.put_as(self.admin, self.rules_url("order/"), {"ids": [market, comet, curfew]})
        short = self.put_as(self.admin, self.rules_url("order/"), {"ids": [market, comet]})
        twice = self.put_as(self.admin, self.rules_url("order/"), {"ids": [market, comet, comet]})

        self.assertEqual(moved.status_code, 200)
        self.assertEqual([row["title"] for row in moved.json()], ["Market", "The Comet", "Curfew"])
        self.assertEqual((short.status_code, short.json()["code"]), (400, "campaign_rules_order"))
        self.assertEqual(twice.status_code, 400)
        self.assertEqual([title for title, _body, _order in self.listed()], ["Market", "The Comet", "Curfew"])

    def test_an_archived_campaign_s_are_read_only(self):
        rule = CampaignRule.objects.create(campaign=self.campaign, title="Curfew")
        self.campaign.archived_at = timezone.now()
        self.campaign.save(update_fields=["archived_at"])

        response = self.patch_as(self.owner, self.rules_url(f"{rule.id}/"), {"title": "Mine"})

        self.assertEqual((response.status_code, response.json()["code"]), (403, "campaign_archived"))
        self.assertEqual(self.listed(), [("Curfew", "", 0)])
