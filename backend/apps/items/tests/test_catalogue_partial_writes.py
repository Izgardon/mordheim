"""A PATCH's nested rows are whole rows: an availability, an equipment line or a restriction link takes the same
defaults in an edit as in a create (DRF skips nested defaults in a partial write). A weapon's strength and range
take theirs only where nothing is stored."""

from apps.bestiary.models import BestiaryEntryItem, HiredSwordProfileRestriction

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, CatalogueTestCase, make_entry


class PartialWriteDefaultsTests(CatalogueTestCase):
    def test_renaming_a_weapon_keeps_its_strength_and_range(self):
        # BUG-151: an edit that didn't resend strength or range reset them to "As user" and "Close combat"
        flail = make_entry(ITEMS, "Flail", campaign=self.campaign, strength="+1", range="Close combat")
        sling = make_entry(ITEMS, "Sling", campaign=self.campaign, strength="3", range='18"')

        renamed = self.patch_as(self.owner, ITEMS.detail_url(flail.id), {"name": "Morning Star"})
        described = self.patch_as(self.owner, ITEMS.detail_url(sling.id), {"description": "Stones."})

        self.assertEqual((renamed.status_code, renamed.data["strength"], renamed.data["range"]), (200, "+1", "Close combat"))  # fmt: skip
        self.assertEqual((described.data["strength"], described.data["range"]), ("3", '18"'))

    def test_a_weapon_edit_fills_only_what_is_blank_or_empty(self):
        # BUG-151: the defaults still fill a strength or range sent blank, and a weapon that has none stored
        armour = make_entry(ITEMS, "Spiked shield", campaign=self.campaign, type="Armour", subtype="Shield")
        flail = make_entry(ITEMS, "Flail", campaign=self.campaign, strength="+1", range="Close combat")

        retyped = self.patch_as(self.owner, ITEMS.detail_url(armour.id), {"type": "Weapon"})
        blanked = self.patch_as(self.owner, ITEMS.detail_url(flail.id), {"strength": ""})

        self.assertEqual((retyped.data["strength"], retyped.data["range"]), ("As user", "Close combat"))
        self.assertEqual((blanked.data["strength"], blanked.data["range"]), ("As user", "Close combat"))

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
