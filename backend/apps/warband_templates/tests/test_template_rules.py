"""Add the template's rules (`POST warbands/<id>/rules/from-template/`): the rules of the warband's template for its
variant and type whose title it lacks are copied in order, the rest left alone, nothing removed; the warband's editors
only; and the template endpoint then counts none missing."""

from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.warbands.models import WarbandRule, WarbandType

from .support import Made, make_template


class AddTemplateRulesTests(CatalogueTestCase):
    made: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.made.template.rules.create(position=2, title="Our drill", warband_type=cls.mercenaries)
        ostermarkers = WarbandType.objects.create(name="Ostermarkers", slug="ostermarkers")
        cls.made.template.rules.create(position=3, title="Wardogs", warband_type=ostermarkers)

    def route(self, suffix: str) -> str:
        return f"/api/warbands/{self.warband.id}/{suffix}"

    def test_the_missing_ones_are_copied_in_order_and_the_rest_left_alone(self) -> None:
        WarbandRule.objects.create(warband=self.warband, title="hard bargains", description="Ours.")
        WarbandRule.objects.create(warband=self.warband, title="House drill")
        response = self.post_as(self.player, self.route("rules/from-template/"))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [(rule["title"], rule["description"]) for rule in response.json()],
            [("hard bargains", "Ours."), ("House drill", ""), ("Marksmen", ""), ("Our drill", "")],
        )
        self.assertEqual(self.get_as(self.player, self.route("template/")).json()["template"]["missing_rules"], 0)
        again = self.post_as(self.player, self.route("rules/from-template/"))
        self.assertEqual(len(again.json()), 4)

    def test_only_its_editors_add_them_and_a_warband_without_a_template_adds_none(self) -> None:
        self.assertEqual(self.post_as(self.rival, self.route("rules/from-template/")).status_code, 403)
        self.made.template.type_links.all().delete()
        response = self.post_as(self.player, self.route("rules/from-template/"))
        self.assertEqual((response.status_code, response.json()), (200, []))
