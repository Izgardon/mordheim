"""The list's own name for an item on the warband sheet (`item_names`, the templates plan, question 12): by fighter key
and item id, read from the warband's template whenever the sheet is read, only where his lists name the item one
other way, and in one query."""

from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.warband_templates.models import TemplateList, TemplateListItem
from apps.warband_templates.services.item_names import template_item_names
from apps.warbands.models import Hero

from .support import Made, make_template


class ItemNamesTests(CatalogueTestCase):
    made: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)

    def test_each_fighter_reads_the_name_his_lists_give_an_item(self) -> None:
        with self.assertNumQueries(1):
            names = template_item_names(self.warband)
        axe = str(self.book_axe.id)
        self.assertEqual(names, {"captain": {axe: "Hatchet"}, "warriors": {axe: "Hatchet"}})

    def test_a_fighter_whose_lists_name_an_item_two_ways_reads_neither(self) -> None:
        other = TemplateList.objects.create(template=self.made.template, key="more", name="More")
        TemplateListItem.objects.create(equipment_list=other, item=self.book_axe, shown_as="Chopper")
        TemplateListItem.objects.create(equipment_list=other, item=self.book_sword, shown_as="Scimitar")
        self.made.captain.list_links.create(equipment_list=other)
        names = template_item_names(self.warband)
        self.assertEqual(names["captain"], {str(self.book_sword.id): "Scimitar"})
        self.assertEqual(names["warriors"], {str(self.book_axe.id): "Hatchet"})

    def test_the_sheet_carries_them_and_a_warband_without_a_template_reads_none(self) -> None:
        Hero.objects.create(warband=self.warband, name="Ulrich", fighter_key="captain")
        sheet = self.get_as(self.player, f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(sheet["item_names"]["captain"], {str(self.book_axe.id): "Hatchet"})
        self.assertEqual(sheet["heroes"][0]["fighter_key"], "captain")
        self.made.template.type_links.all().delete()
        self.assertEqual(template_item_names(self.warband), {})
