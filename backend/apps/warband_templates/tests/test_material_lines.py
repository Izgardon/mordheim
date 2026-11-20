"""A template list line that names a weapon material (weapon materials, William 20 Nov 2026).

The Dwarf lists sell a gromril weapon at three times the price, the Elf lists ithilmar at twice it, the Chaos
Dwarfs obsidian at a flat 30 gc. The line carries the material and no item, and the server says which weapons on
that same list it may be made into, and what each comes to on the line's own terms.
"""

from typing import Any

from apps.items.tests.catalogue_support import ITEMS, CatalogueTestCase, make_entry
from apps.warband_templates.models import TemplateListItem
from apps.warband_templates.services.material_lines import Terms, line_terms

from .support import Made, make_template


class MaterialTermsTests(CatalogueTestCase):
    def test_a_line_prices_through_its_own_terms_where_it_states_them(self) -> None:
        flat = TemplateListItem(material="obsidian", cost=30)
        times = TemplateListItem(material="gromril", cost=None, cost_note="3 × price")
        plus = TemplateListItem(material="darksteel", cost=None, cost_note="+ 15 gc")
        silent = TemplateListItem(material="gromril", cost=None, cost_note="")

        self.assertEqual(line_terms(flat), Terms(flat=30))
        self.assertEqual(line_terms(times), Terms(multiplier=3))
        self.assertEqual(line_terms(plus), Terms(addition=15))
        self.assertEqual(line_terms(silent), Terms())

    def test_terms_price_a_weapon_and_fall_back_to_the_materials_own_shape(self) -> None:
        from apps.items.materials import GROMRIL

        self.assertEqual(Terms(flat=30).price(GROMRIL, 10), 30)
        self.assertEqual(Terms(multiplier=3).price(GROMRIL, 10), 30)
        self.assertEqual(Terms(addition=15).price(GROMRIL, 10), 25)
        self.assertEqual(Terms().price(GROMRIL, 10), 40)  # gromril's own four times the price
        self.assertIsNone(Terms().price(GROMRIL, None))


class MaterialLineEndpointTests(CatalogueTestCase):
    made: Made
    bow: Any
    line: TemplateListItem

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Dwarfs", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.bow = make_entry(ITEMS, "Crossbow", subtype="Ranged", cost=25)
        TemplateListItem.objects.create(equipment_list=cls.made.kit, item=cls.book_sword, cost=10)
        TemplateListItem.objects.create(equipment_list=cls.made.kit, item=cls.bow, cost=25)
        cls.line = TemplateListItem.objects.create(
            equipment_list=cls.made.kit, material="gromril", cost=None, cost_note="3 × price"
        )

    def read(self) -> dict[str, Any]:
        response = self.get_as(self.player, f"/api/warbands/{self.warband.id}/template/")
        self.assertEqual(response.status_code, 200, response.data)
        body: dict[str, Any] = response.json()
        return body

    def material_line(self, body: dict[str, Any]) -> dict[str, Any]:
        lines = body["template"]["lists"][0]["lines"]
        return next(line for line in lines if line["material"])

    def test_the_line_names_the_material_and_the_weapons_on_its_own_list(self) -> None:
        line = self.material_line(self.read())

        self.assertIsNone(line["item"])
        self.assertEqual((line["material"]["slug"], line["material"]["name"]), ("gromril", "Gromril"))
        self.assertEqual((line["material"]["rarity"], line["material"]["price_note"]), (11, "4 x Price"))
        # the melee weapons of its list, at three times their list price; the crossbow is shot, not swung
        self.assertEqual(
            [(choice["item"]["name"], choice["price"]) for choice in line["material"]["choices"]],
            [("Axe", 15), ("Sword", 30)],
        )

    def test_an_item_line_names_no_material(self) -> None:
        lines = self.read()["template"]["lists"][0]["lines"]

        self.assertEqual([line["material"] for line in lines if line["item"]], [None, None, None])

    def test_a_material_line_gives_nothing_free_and_counts_towards_nothing(self) -> None:
        TemplateListItem.objects.filter(pk=self.line.pk).update(first_free=True, warband_max=2)

        line = self.material_line(self.read())
        fighters = self.read()["template"]["fighters"]

        self.assertIsNone(line["held"])  # nothing is held of a material
        self.assertEqual([fighter["free_items"] for fighter in fighters], [[], []])
