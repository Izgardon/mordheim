"""Raising a warband from its type's template (the templates plan, phase 2): the campaign's gold plus the template's
difference from 500, the template's most warriors, the type's preset variant or the one picked, and its rules for that
variant copied in order; a type without a template raises as before. Settings changes the variant, and a new type
brings its own."""

from typing import Any

from apps.campaigns.models import CampaignSettings
from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.warbands.models import LedgerAction, Warband, WarbandTrade, WarbandType

from .support import Made, make_template


class RaisingTests(CatalogueTestCase):
    made: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template(
            "Merchant Caravans", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries, max_models=12
        )
        cls.made.template.starting_gold = 600
        cls.made.template.save()

    def raise_one(self, **body: Any) -> Any:
        sent = {"name": "The Gilded Wagon", "warband_type_id": self.mercenaries.id, "campaign_id": self.campaign.id}
        return self.post_as(self.owner, "/api/warbands/", {**sent, **body})

    def raised(self, response: Any) -> Warband:
        self.assertEqual(response.status_code, 201, response.data)
        return Warband.objects.get(id=response.data["id"])

    def test_a_warband_is_raised_with_the_templates_gold_size_variant_and_rules(self) -> None:
        CampaignSettings.objects.filter(campaign=self.campaign).update(starting_gold=450)
        response = self.raise_one(template_variant="middenheim")  # the type presets Reikland
        warband = self.raised(response)
        self.assertEqual((warband.gold, warband.max_units, warband.template_variant), (550, 12, "reikland"))
        self.assertEqual(response.data["template_variant"], "reikland")
        rows = WarbandTrade.objects.filter(warband=warband)
        self.assertEqual(list(rows.values_list("action", "price")), [(LedgerAction.STARTING_GOLD, 550)])
        self.assertEqual(list(warband.rules.values_list("title", flat=True)), ["Hard Bargains", "Marksmen"])

    def test_a_type_that_presets_no_variant_takes_the_one_picked(self) -> None:
        self.made.template.type_links.update(variant="")
        bad = self.raise_one(template_variant="atlantis")
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.data["template_variant"], ["Not one of this warband type's variants."])
        none = self.raise_one()  # William, 5 Nov: a type that presets none needs one picked
        self.assertEqual(
            (none.status_code, none.data["template_variant"]), (400, ["Pick one of this warband type's variants."])
        )
        warband = self.raised(self.raise_one(template_variant="middenheim"))
        self.assertEqual(warband.template_variant, "middenheim")
        self.assertEqual(list(warband.rules.values_list("title", flat=True)), ["Hard Bargains"])

    def test_a_variants_gold_and_size_and_its_types_rules_are_what_it_is_raised_with(self) -> None:
        template = self.made.template
        template.starting_gold = 500
        template.variants = [
            {"key": "reikland", "name": "Reikland"},
            {"key": "middenheim", "name": "Middenheim", "starting_gold": 600, "max_models": 9},
        ]
        template.save()
        template.type_links.update(variant="")
        ostermarkers = WarbandType.objects.create(name="Ostermarkers", slug="ostermarkers")
        template.rules.create(position=5, title="Our own", warband_type=self.mercenaries)
        template.rules.create(position=6, title="Wardogs", warband_type=ostermarkers)
        warband = self.raised(self.raise_one(template_variant="middenheim"))
        self.assertEqual((warband.gold, warband.max_units), (600, 9))
        self.assertEqual(list(warband.rules.values_list("title", flat=True)), ["Hard Bargains", "Our own"])

    def test_a_type_without_a_template_raises_as_before(self) -> None:
        self.made.template.type_links.all().delete()
        warband = self.raised(self.raise_one(template_variant="middenheim", max_units=9))
        self.assertEqual((warband.gold, warband.max_units, warband.template_variant), (500, 9, ""))
        self.assertFalse(warband.rules.exists())

    def test_settings_change_the_variant_and_a_new_type_brings_its_own(self) -> None:
        url = f"/api/warbands/{self.warband.id}/"
        self.assertEqual(self.patch_as(self.player, url, {"template_variant": "middenheim"}).status_code, 200)
        self.warband.refresh_from_db()
        self.assertEqual(self.warband.template_variant, "middenheim")
        refused = self.patch_as(self.player, url, {"template_variant": "atlantis"})
        self.assertEqual(refused.status_code, 400)
        skaven = WarbandType.objects.create(name="Skaven", slug="skaven")
        self.assertEqual(self.patch_as(self.player, url, {"warband_type_id": skaven.id}).status_code, 200)
        self.warband.refresh_from_db()
        self.assertEqual(self.warband.template_variant, "")
        moved = self.patch_as(self.player, url, {"warband_type_id": self.mercenaries.id})
        self.assertEqual(moved.data["template_variant"], "reikland")
