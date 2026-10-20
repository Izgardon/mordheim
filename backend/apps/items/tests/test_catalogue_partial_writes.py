"""A PATCH's nested rows are whole rows: an availability, an equipment line or a restriction link takes the same
defaults in an edit as in a create (DRF skips nested defaults in a partial write)."""

from apps.bestiary.models import BestiaryEntryItem, HiredSwordProfileRestriction

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, CatalogueTestCase, make_entry


class PartialWriteDefaultsTests(CatalogueTestCase):
    def test_an_edited_availability_without_a_rarity_or_restrictions_takes_the_defaults(self):
        item = make_entry(ITEMS, "Flail", campaign=self.campaign, cost=15)

        response = self.patch_as(self.owner, ITEMS.detail_url(item.id), {"availabilities": [{"cost": 5}, {}]})

        self.assertEqual(response.status_code, 200, response.data)
        rows = [(row["cost"], row["rarity"], row["restrictions"]) for row in response.data["availabilities"]]
        self.assertEqual(rows, [(0, 2, []), (5, 2, [])])

    def test_edited_equipment_without_a_quantity_carries_one(self):
        entry = make_entry(BESTIARY, "Mule", campaign=self.campaign)

        response = self.patch_as(self.owner, BESTIARY.detail_url(entry.id), {"item_entries": [{"item_id": self.book_axe.id}, self.book_sword.id]})  # fmt: skip

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(list(BestiaryEntryItem.objects.filter(bestiary_entry=entry).values_list("quantity", flat=True)), [1, 1])  # fmt: skip

    def test_an_edited_restriction_given_as_a_bare_id_has_no_note(self):
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign)

        response = self.patch_as(self.owner, HIRED_SWORDS.detail_url(profile.id), {"restriction_ids": [self.mercenaries.id]})  # fmt: skip

        self.assertEqual(response.status_code, 200, response.data)
        links = HiredSwordProfileRestriction.objects.filter(hired_sword_profile=profile)
        self.assertEqual(list(links.values_list("restriction_id", "additional_note")), [(self.mercenaries.id, "")])
