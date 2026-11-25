"""A henchmen group's `is_animal` (William, 24 Nov 2026: "If a henchman is an animal can we give them an animal icon
in their unit card"): the server's call, read by the card for its paw print. An animal carries the Animal rule (the
shared special, William, 25 Nov 2026, or an owner's own copy of it kept apart: "Animals (Slavehound)"), or was
recruited from a creature."""

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

    def test_an_owners_copy_kept_apart_counts_and_a_rule_about_animals_does_not(self):
        hounds = make_unit(HENCHMEN, self.warband, name="Slavehounds")
        kept = Special.objects.create(name="Animals (Slavehound)", type="Warband - Druchii")
        getattr(hounds, HENCHMEN.specials).create(special=kept)
        herders = make_unit(HENCHMEN, self.warband, name="Herders")
        handler = Special.objects.create(name="Animal Handler", type="Skill")
        getattr(herders, HENCHMEN.specials).create(special=handler)

        self.assertTrue(self.read(hounds))
        self.assertFalse(self.read(herders))
