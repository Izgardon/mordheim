"""A group raised from a template's animal (William, 25 Nov 2026: one Animal rule) holds the shared Animal special as
its fighter does, so its card shows the paw (`is_animal`)."""

from typing import Any

from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.special.models import Special
from apps.warband_templates.models import TemplateFighterSpecial
from apps.warbands.models import HenchmenGroup

from .support import Made, make_template


class AnimalHireTests(CatalogueTestCase):
    made: Made
    animal: Any

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.animal = Special.objects.create(name="Animal", type="Animal", description="Animals never gain experience")
        TemplateFighterSpecial.objects.create(fighter=cls.made.warriors, special=cls.animal)

    def test_a_group_raised_from_an_animal_holds_the_shared_rule_and_is_an_animal(self) -> None:
        body = {"create": [{"fighter_key": "warriors", "name": "Hounds", "henchmen": [{"name": "Rex"}]}]}
        response = self.post_as(self.player, f"/api/warbands/{self.warband.id}/henchmen-groups/batch/", body)
        self.assertEqual(response.status_code, 200, response.data)

        group = HenchmenGroup.objects.get(warband=self.warband, name="Hounds")
        self.assertEqual(list(group.henchmen_group_specials.values_list("special_id", flat=True)), [self.animal.id])
        read = self.get_as(self.player, f"/api/warbands/{self.warband.id}/henchmen-groups/{group.id}/").json()
        self.assertTrue(read["is_animal"])
