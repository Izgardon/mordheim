"""A preset's warband rules (William, 23 Nov 2026): a published campaign's rule for one race's warbands, or one
warband type's, is copied into a warband's own rules when it is raised in a campaign playing that preset, after its
template's, whether or not its type has a template; Add missing rules brings the missing ones to a warband raised
before, and the template endpoint counts them."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaign_presets.models import CampaignPreset, CampaignPresetWarbandRule
from apps.campaigns.models import Campaign
from apps.core.testing import book_warband_type
from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.warband_templates.tests.support import make_template
from apps.warbands.models import Warband, WarbandGroup, WarbandRule, WarbandType


class PresetWarbandRuleTests(CatalogueTestCase):
    karak_azgal: CampaignPreset
    mordheim: CampaignPreset
    dwarfs: WarbandType
    rangers: WarbandType
    skaven: WarbandType
    witch_hunters: WarbandType

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.dwarfs = book_warband_type("Dwarf Treasure Hunters")
        cls.rangers = book_warband_type("Dwarf Rangers")  # a Dwarf type no template serves
        cls.skaven = book_warband_type("Skaven")
        cls.witch_hunters = book_warband_type("Witch Hunters")
        dwarf_group = WarbandGroup.objects.create(slug="dwarfs", name="Dwarfs", kind="race")
        dwarf_group.members.set([cls.dwarfs, cls.rangers])
        skaven_group = WarbandGroup.objects.create(slug="skaven", name="Skaven", kind="race")
        skaven_group.members.set([cls.skaven])
        make_template("Dwarf Treasure Hunters", item=cls.book_axe, race=cls.human, warband_type=cls.dwarfs)
        cls.mordheim = CampaignPreset.objects.create(slug="mordheim", name="Mordheim")
        cls.karak_azgal = CampaignPreset.objects.create(slug="karak-azgal", name="Karak Azgal")
        drunks = cls.karak_azgal.warband_rules.create(order=0, title="Dwarf drunks", text="Up to two Drunks.")
        drunks.warband_groups.set([dwarf_group])
        tunnels = cls.karak_azgal.warband_rules.create(order=1, title="Skaven tunnel team", text="Gutter Runners.")
        tunnels.warband_groups.set([skaven_group])
        horses = cls.karak_azgal.warband_rules.create(order=2, title="Riding and War Horses", text="No Warhounds.")
        horses.warband_types.set([cls.witch_hunters])

    def play(self, preset: CampaignPreset | None) -> None:
        Campaign.objects.filter(pk=self.campaign.pk).update(preset=preset)

    def raise_one(self, warband_type: WarbandType, **body: Any) -> Warband:
        sent = {"name": "Raised", "warband_type_id": warband_type.id, "campaign_id": self.campaign.id}
        response = self.post_as(self.owner, "/api/warbands/", {**sent, "template_variant": "reikland", **body})
        self.assertEqual(response.status_code, 201, response.data)
        return Warband.objects.get(id=response.data["id"])

    def titles(self, warband: Warband) -> list[str]:
        return list(warband.rules.order_by("id").values_list("title", flat=True))

    # raising

    def test_a_dwarf_warband_gets_its_races_rule_after_its_templates(self) -> None:
        self.play(self.karak_azgal)
        warband = self.raise_one(self.dwarfs)
        self.assertEqual(self.titles(warband), ["Hard Bargains", "Marksmen", "Dwarf drunks"])
        self.assertEqual(warband.rules.get(title="Dwarf drunks").description, "Up to two Drunks.")

    def test_a_type_no_template_serves_still_gets_them(self) -> None:
        self.play(self.karak_azgal)
        self.assertEqual(self.titles(self.raise_one(self.rangers)), ["Dwarf drunks"])

    def test_a_skaven_warband_gets_its_own_and_not_the_dwarfs(self) -> None:
        self.play(self.karak_azgal)
        self.assertEqual(self.titles(self.raise_one(self.skaven)), ["Skaven tunnel team"])

    def test_a_rule_for_a_type_reaches_that_type(self) -> None:
        self.play(self.karak_azgal)
        self.assertEqual(self.titles(self.raise_one(self.witch_hunters)), ["Riding and War Horses"])

    def test_a_dwarf_warband_in_another_campaign_or_none_gets_none(self) -> None:
        for preset in (self.mordheim, None):
            self.play(preset)
            warband = self.raise_one(self.rangers)
            self.assertEqual(self.titles(warband), [], preset)
            warband.delete()

    def test_a_type_it_only_counts_as_brings_none(self) -> None:
        # the types it counts as never pick its template, nor bring its race's rules (resolve.py)
        self.play(self.karak_azgal)
        warband = self.raise_one(self.mercenaries, counts_as_ids=[self.rangers.id])
        self.assertNotIn("Dwarf drunks", self.titles(warband))

    def test_the_copy_is_the_players_to_edit_and_delete(self) -> None:
        self.play(self.karak_azgal)
        self.warband.delete()  # the player raises his own
        sent = {"name": "Mine", "warband_type_id": self.rangers.id, "campaign_id": self.campaign.id}
        created = self.post_as(self.player, "/api/warbands/", sent)
        self.assertEqual(created.status_code, 201, created.data)
        rule = WarbandRule.objects.get(warband_id=created.data["id"], title="Dwarf drunks")
        base = f"/api/warbands/{created.data['id']}/rules/{rule.id}/"
        self.assertEqual(self.patch_as(self.player, base, {"description": "House rule."}).status_code, 200)
        self.assertEqual(self.delete_as(self.player, base).status_code, 204)
        self.assertTrue(CampaignPresetWarbandRule.objects.filter(title="Dwarf drunks").exists())

    # Add missing rules, for a warband raised before

    def adopt(self, warband_type: WarbandType) -> None:
        Warband.objects.filter(pk=self.warband.pk).update(warband_type=warband_type, template_variant="reikland")

    def add(self) -> list[str]:
        response = self.post_as(self.player, f"/api/warbands/{self.warband.id}/rules/from-template/")
        self.assertEqual(response.status_code, 200, response.data)
        return [rule["title"] for rule in response.json()]

    def missing(self) -> int:
        response = self.get_as(self.player, f"/api/warbands/{self.warband.id}/template/")
        self.assertEqual(response.status_code, 200, response.data)
        return int(response.json()["missing_rules"])

    def test_a_warband_raised_before_gets_the_missing_ones_once(self) -> None:
        self.adopt(self.dwarfs)
        WarbandRule.objects.create(warband=self.warband, title="marksmen", description="Ours.")
        self.play(self.karak_azgal)
        self.assertEqual(self.missing(), 2)  # Hard Bargains and Dwarf drunks
        self.assertEqual(self.add(), ["marksmen", "Hard Bargains", "Dwarf drunks"])
        self.assertEqual(self.missing(), 0)
        self.assertEqual(self.add(), ["marksmen", "Hard Bargains", "Dwarf drunks"])

    def test_a_type_with_no_template_is_offered_them_too(self) -> None:
        self.adopt(self.rangers)
        self.play(self.karak_azgal)
        self.assertEqual(self.missing(), 1)
        self.assertEqual(self.add(), ["Dwarf drunks"])
        self.assertEqual(self.missing(), 0)

    def test_a_rule_of_the_templates_title_is_counted_and_added_once(self) -> None:
        self.adopt(self.dwarfs)
        self.karak_azgal.warband_rules.filter(title="Dwarf drunks").update(title="Hard Bargains")
        self.play(self.karak_azgal)
        self.assertEqual(self.missing(), 2)  # the template's Hard Bargains and Marksmen
        self.assertEqual(self.add(), ["Hard Bargains", "Marksmen"])

    def test_without_a_preset_nothing_is_missing(self) -> None:
        self.adopt(self.rangers)
        self.assertEqual(self.missing(), 0)
        self.assertEqual(self.add(), [])

    def test_the_template_endpoint_reads_in_the_same_queries_however_many_rules_the_preset_holds(self) -> None:
        self.adopt(self.rangers)
        self.play(self.karak_azgal)

        def count() -> int:
            self.client.force_authenticate(user=self.player)
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.client.get(f"/api/warbands/{self.warband.id}/template/").status_code, 200)
            return len(captured)

        few = count()
        group = WarbandGroup.objects.get(slug="dwarfs")
        for number in range(3):
            self.karak_azgal.warband_rules.create(order=10 + number, title=f"Extra {number}").warband_groups.add(group)
        # the warband and membership, list prices, the template, the warband's rule titles, the preset's rules for it
        self.assertEqual((few, count()), (6, 6))
        self.assertEqual(self.missing(), 4)
