"""A henchmen group's `is_animal` (William, 24 Nov 2026: "If a henchman is an animal can we give them an animal icon
in their unit card"): the server's call, read by the card for its paw print. An animal carries the Animal rule (the
general special or a warband's own of that name), or was recruited from a creature."""

from apps.special.models import Special

from .roster_support import HENCHMEN, RosterTestCase, make_unit


class HenchmenIsAnimalTests(RosterTestCase):
    def read(self, group) -> bool:
        response = self.client.get(f"/api/warbands/{self.warband.id}/{HENCHMEN.segment}/{group.id}/")
        self.assertEqual(response.status_code, 200)
        return bool(response.data["is_animal"])

    def test_a_group_carrying_the_animal_rule_is_an_animal(self):
        animal = Special.objects.create(name="Animal", type="Animal")
        hounds = make_unit(HENCHMEN, self.warband, name="Wolfhounds")
        getattr(hounds, HENCHMEN.specials).create(special=animal)

        self.assertTrue(self.read(hounds))

    def test_a_warbands_own_animal_rule_counts_too(self):
        own = Special.objects.create(name="Animal", type="Warband - Kislevites")
        bears = make_unit(HENCHMEN, self.warband, name="Bears")
        getattr(bears, HENCHMEN.specials).create(special=own)

        self.assertTrue(self.read(bears))

    def test_any_other_group_is_not(self):
        swordsmen = make_unit(HENCHMEN, self.warband, name="Swordsmen")
        getattr(swordsmen, HENCHMEN.specials).create(special=self.specials[0])

        self.assertFalse(self.read(swordsmen))
