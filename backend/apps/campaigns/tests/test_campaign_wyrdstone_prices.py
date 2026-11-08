"""The wyrdstone sell prices, a campaign setting (William, 7 Nov 2026: "basically there is a table of sell prices for
number of shards depending on size of warband"): the book's table until Settings changes it, read by every member
(the sell form prices a sale of the default resource from it), written whole by those who edit settings, and set
back to the book's by Reset (the page sends the book's table)."""

from typing import Any

from apps.campaigns.models import CampaignSettings
from apps.warbands.utils.wyrdstone_prices import BOOK_WYRDSTONE_PRICES

from .campaign_support import CampaignTestCase

BOOK = [list(row) for row in BOOK_WYRDSTONE_PRICES]


def edited() -> list[list[int]]:
    table = [list(row) for row in BOOK]
    table[2][2] = 70  # 3 shards, 7-9 warriors: the book's 65
    table[7][5] = 0  # 8+ shards, 16+ warriors: given away
    return table


class WyrdstonePricesTests(CampaignTestCase):
    def stored(self) -> Any:
        return CampaignSettings.objects.get(campaign=self.campaign).wyrdstone_prices

    def test_a_campaign_starts_with_the_books_table_and_every_member_reads_it(self):
        self.assertEqual(BOOK[0], [45, 40, 35, 30, 30, 25])
        self.assertEqual(BOOK[7], [155, 140, 130, 120, 110, 100])
        for user in (self.owner, self.admin, self.player):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.get_as(user, self.url()).data["wyrdstone_prices"], BOOK)
        self.assertEqual(self.stored(), BOOK)

    def test_the_owner_edits_the_table_and_reset_puts_the_books_back(self):
        response = self.patch_as(self.owner, self.url(), {"wyrdstone_prices": edited()})

        self.assertEqual((response.status_code, response.data["wyrdstone_prices"]), (200, edited()))
        self.assertEqual(self.stored(), edited())
        self.assertEqual(self.get_as(self.player, self.url()).data["wyrdstone_prices"], edited())

        reset = self.patch_as(self.owner, self.url(), {"wyrdstone_prices": BOOK})

        self.assertEqual((reset.status_code, self.stored()), (200, BOOK))

    def test_only_those_who_edit_settings_change_it(self):
        for user, expected in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.patch_as(user, self.url(), {"wyrdstone_prices": edited()}).status_code, expected)
        self.assertEqual(self.stored(), BOOK)

    def test_a_table_of_any_other_shape_or_with_a_bad_price_is_refused(self):
        short_row = [list(row) for row in BOOK]
        short_row[3] = short_row[3][:5]
        negative = [list(row) for row in BOOK]
        negative[0][0] = -5
        invalid: list[Any] = [
            BOOK[:7],  # no 8+ row
            [*BOOK, BOOK[7]],  # a ninth row
            short_row,
            negative,
            [[*row[:5], "lots"] for row in BOOK],
            [[*row[:5], 2**31] for row in BOOK],  # past the ledger's 32-bit ceiling
            [],
            "45, 40",
        ]
        for table in invalid:
            with self.subTest(table=table):
                response = self.patch_as(self.owner, self.url(), {"wyrdstone_prices": table})
                self.assertEqual((response.status_code, list(response.data)), (400, ["wyrdstone_prices"]))
        self.assertEqual(self.stored(), BOOK)
