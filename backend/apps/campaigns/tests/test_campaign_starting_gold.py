"""Changing the starting gold once warbands exist (BUG-78, decision 6; CAMP-TEST-23, rewritten in PR A).

It used to rewrite each warband's oldest ledger row, whatever its action, one transaction per warband. Now the PATCH
says whether existing warbands follow (`adjust_existing_warbands`); when they do, each gets one Adjustment of new
minus old, in one INSERT and one balance UPDATE, and no row is rewritten.
"""

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import LedgerAction, Warband
from apps.warbands.services import ledger
from apps.warbands.tests.roster_support import clear_ledger, trade_rows

from .campaign_support import CampaignTestCase

STARTING = ("Starting gold", "Starting Gold", 500, None)
REQUIRED = "Say whether existing warbands get the difference in starting gold."


class StartingGoldTests(CampaignTestCase):
    """The rival's ledger starts with a purchase, not with its starting gold."""

    def setUp(self) -> None:
        super().setUp()
        clear_ledger(self.rival_warband)
        ledger.record(self.rival_warband, LedgerAction.BUY, -40, "Shield")
        ledger.record(self.rival_warband, LedgerAction.REWARD, 10, "Purse")

    def set_starting_gold(self, amount: int, **flag: bool):
        return self.patch_as(self.owner, self.url(), {"starting_gold": amount, **flag})

    def gold(self, warband: Warband) -> int:
        return Warband.objects.values_list("gold", flat=True).get(id=warband.id)

    def stored_starting_gold(self) -> int:
        return CampaignSettings.objects.get(campaign=self.campaign).starting_gold

    def test_a_change_must_say_whether_existing_warbands_follow(self):
        response = self.set_starting_gold(600)

        self.assertEqual(response.status_code, 400)
        expected = {"detail": REQUIRED, "code": "adjust_existing_warbands_required"}
        self.assertEqual(response.json(), {**expected, "fields": {"adjust_existing_warbands": [REQUIRED]}})
        self.assertEqual(self.stored_starting_gold(), 500)
        self.assertEqual(trade_rows(self.warband), [STARTING])

    def test_adjusting_adds_one_adjustment_per_warband_and_rewrites_nothing(self):
        response = self.set_starting_gold(600, adjust_existing_warbands=True)

        self.assertEqual((response.status_code, response.data["starting_gold"]), (200, 600))
        adjustment = ("Adjustment", "Starting gold changed from 500 to 600 gc", 100, None)
        self.assertEqual(trade_rows(self.warband), [STARTING, adjustment])
        self.assertEqual(self.gold(self.warband), 600)
        self.assertEqual(
            trade_rows(self.rival_warband), [("Buy", "Shield", -40, None), ("Reward", "Purse", 10, None), adjustment]
        )
        self.assertEqual(self.gold(self.rival_warband), 70)  # new minus old, whatever its first row says

    def test_lowering_it_adjusts_down(self):
        self.set_starting_gold(450, adjust_existing_warbands=True)

        self.assertEqual(
            trade_rows(self.warband)[-1], ("Adjustment", "Starting gold changed from 500 to 450 gc", -50, None)
        )
        self.assertEqual(self.gold(self.warband), 450)

    def test_not_adjusting_leaves_existing_warbands_and_new_ones_get_the_new_amount(self):
        response = self.set_starting_gold(450, adjust_existing_warbands=False)
        created = self.post_as(
            self.admin, "/api/warbands/", {"name": "Ravens", "faction": "Mercenaries", "campaign_id": self.campaign.id}
        )

        self.assertEqual((response.status_code, self.stored_starting_gold()), (200, 450))
        self.assertEqual(trade_rows(self.warband), [STARTING])
        self.assertEqual(self.gold(self.rival_warband), -30)
        self.assertEqual(
            trade_rows(Warband.objects.get(id=created.data["id"])), [("Starting gold", "Starting Gold", 450, None)]
        )

    def test_the_same_amount_needs_no_answer_and_writes_nothing(self):
        # BUG-78: saving the same amount used to rewrite every warband again
        for body in ({}, {"adjust_existing_warbands": True}):
            with self.subTest(**body):
                self.assertEqual(self.set_starting_gold(500, **body).status_code, 200)
        self.assertEqual(trade_rows(self.warband), [STARTING])
        self.assertEqual(self.gold(self.rival_warband), -30)

    def test_a_campaign_without_warbands_needs_no_answer(self):
        response = self.patch_as(self.outsider, self.url(campaign=self.elsewhere), {"starting_gold": 700})

        self.assertEqual((response.status_code, response.data["starting_gold"]), (200, 700))

    def test_adjustments_cost_the_same_for_any_number_of_warbands(self):
        # CAMP-TEST-23's budget: one INSERT and one balance UPDATE, in the PATCH's one transaction
        def adjust_queries(amount: int) -> list[str]:
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.set_starting_gold(amount, adjust_existing_warbands=True).status_code, 200)
            return [query["sql"] for query in captured]

        two = adjust_queries(600)
        self.post_as(
            self.admin, "/api/warbands/", {"name": "Ravens", "faction": "Merc", "campaign_id": self.campaign.id}
        )
        three = adjust_queries(700)

        self.assertEqual(len(three), len(two))
        self.assertEqual(sum(sql.startswith('INSERT INTO "warband_trades"') for sql in three), 1)
        self.assertEqual(sum(sql.startswith('UPDATE "warband" SET "gold"') for sql in three), 1)
        self.assertEqual(sum(sql.startswith("SAVEPOINT") for sql in three), 1)  # the PATCH's own (BUG-76)
