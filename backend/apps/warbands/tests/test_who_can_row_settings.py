"""A price row of another book's setting (William, 27 Nov 2026, the items audit's question 1: B): a Mutiny in Marienburg
row counts only where Mutiny in Marienburg is in play, every setting being in play in a workshop; elsewhere the item
reads as its own rows make it (`services/who_can.py`)."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import WORKSHOP, Campaign, CampaignType
from apps.items.models import Item, ItemAvailability
from apps.warbands.services.offers import who_can

from .test_who_can import WhoCanTestCase


class MarienburgRowTests(WhoCanTestCase):
    marienburg: CampaignType

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.marienburg = CampaignType.objects.create(
            slug="mutiny-in-marienburg", name="Mutiny in Marienburg", grade="2b"
        )

    def with_marienburg_row(self, item: Item, cost: int = 300) -> ItemAvailability:
        row = ItemAvailability.objects.create(
            item=item, cost=cost, label="Mutiny in Marienburg", for_everyone=True, campaign_type=self.marienburg
        )
        return row

    def offer(self, item: Item) -> dict[str, Any]:
        found: dict[str, Any] = self.offers()[item.id]
        return found

    def test_a_marienburg_row_opens_nothing_where_marienburg_is_not_in_play(self) -> None:
        rifle = self.item("Ostlander Double-barrelled Hunting Rifle", {"cost": 300, "types": [self.reiklanders]})
        marienburg = self.with_marienburg_row(rifle)

        offer = self.offer(rifle)

        self.assertEqual((offer["can_buy"], offer["reason"]), (False, "Not available for Skaven of Clan Pestilens."))
        self.assertNotIn(marienburg.id, offer["options"])
        self.assertNotEqual(offer["availability_id"], marienburg.id)

    def test_with_marienburg_ticked_its_row_opens_the_item_to_everyone(self) -> None:
        rifle = self.item("Ostlander Double-barrelled Hunting Rifle", {"cost": 300, "types": [self.reiklanders]})
        marienburg = self.with_marienburg_row(rifle)
        self.campaign.campaign_types.add(self.marienburg)

        offer = self.offer(rifle)

        self.assertEqual((offer["can_buy"], offer["availability_id"], offer["options"]), (True, marienburg.id, [marienburg.id]))  # fmt: skip

    def test_the_book_rows_exclusion_holds_again_outside_marienburg(self) -> None:
        rifle = self.item("Hunting Rifle", {"cost": 200, "everyone": True, "not_types": [self.pestilens]})
        self.with_marienburg_row(rifle, 200)

        self.assertEqual(self.offer(rifle)["reason"], "Not available for Skaven of Clan Pestilens.")
        self.campaign.campaign_types.add(self.marienburg)
        self.assertTrue(self.offer(rifle)["can_buy"])

    def test_every_setting_is_in_play_in_a_workshop(self) -> None:
        rifle = self.item("Ostlander Double-barrelled Hunting Rifle", {"cost": 300, "types": [self.reiklanders]})
        marienburg = self.with_marienburg_row(rifle)
        Campaign.objects.filter(pk=self.campaign.pk).update(kind=WORKSHOP, workshop_owner=self.player)

        offer = next(row for row in who_can(self.warband)["items"] if row["item_id"] == rifle.id)

        self.assertEqual((offer["can_buy"], offer["availability_id"]), (True, marienburg.id))

    def test_reading_the_rows_settings_costs_no_query_more(self) -> None:
        def count() -> int:
            with CaptureQueriesContext(connection) as captured:
                self.who_can()
            return len(captured)

        self.item("Short Sword", {"everyone": True})
        before = count()
        for index in range(3):
            self.with_marienburg_row(self.item(f"Rifle {index}", {"types": [self.reiklanders]}))

        self.assertEqual(count(), before)

    def test_a_price_row_says_its_setting_and_an_edit_keeps_it(self) -> None:
        rifle = self.item("Hunting Rifle", {"cost": 200, "everyone": True}, campaign=self.campaign)
        self.with_marienburg_row(rifle, 200)
        self.client.force_authenticate(user=self.campaign_owner)
        url = f"/api/items/{rifle.id}/?campaign_id={self.campaign.id}"
        rows = self.client.get(url).json()["availabilities"]
        self.assertEqual([row["setting_id"] for row in rows], [None, self.marienburg.id])

        sent = [{key: row[key] for key in ("label", "cost", "rarity", "for_everyone", "setting_id")} for row in rows]
        response = self.client.patch(url, {"availabilities": sent}, format="json")

        self.assertEqual(response.status_code, 200, response.content)
        kept = ItemAvailability.objects.filter(item=rifle).order_by("id").values_list("campaign_type_id", flat=True)
        self.assertEqual(list(kept), [None, self.marienburg.id])
