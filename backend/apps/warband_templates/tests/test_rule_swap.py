"""A warband's rules follow a change of its variant or type in Settings (William, 25 Nov 2026: "Changing warband
subtype like for mercenaries doesn't change the warband rules"): the untouched copies of the old variant's or type's
rules (its template's and its preset's) go, the edited ones stay and are named, a plot's rule is never touched, and the
new ones arrive; the PATCH says so in the server's words, in the same queries however many rules there are."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaign_presets.models import CampaignPreset
from apps.campaigns.models import Campaign
from apps.core.testing import book_warband_type
from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.plots.models import Plot
from apps.warbands.models import Warband, WarbandGroup, WarbandRule, WarbandType

from .support import Made, make_template


class RuleSwapTests(CatalogueTestCase):
    made: Made
    skaven: WarbandType
    rangers: WarbandType
    preset: CampaignPreset

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        # Hard Bargains for every variant, Marksmen Reikland's; Discipline Reikland's too, Fury Middenheim's
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.made.template.rules.create(position=2, title="Discipline", description="Steady.", variant="reikland")
        cls.made.template.rules.create(position=3, title="Fury", description="Ulric.", variant="middenheim")
        cls.skaven = book_warband_type("Skaven")
        skaven = make_template("Skaven", item=cls.book_axe, race=cls.human, warband_type=cls.skaven)
        skaven.template.rules.all().delete()
        skaven.template.variants = []
        skaven.template.save()
        skaven.template.type_links.update(variant="")
        skaven.template.rules.create(position=0, title="Scurry", description="Run.")
        cls.rangers = book_warband_type("Dwarf Rangers")  # no template serves them
        city = WarbandGroup.objects.create(slug="city", name="City folk", kind="race")
        city.members.set([cls.mercenaries, cls.skaven])
        cls.preset = CampaignPreset.objects.create(slug="karak", name="Karak Azgal")
        cls.preset.warband_rules.create(order=0, title="Pay", text="Wages.").warband_types.set([cls.mercenaries])
        cls.preset.warband_rules.create(order=1, title="City", text="Streets.").warband_groups.set([city])
        cls.preset.warband_rules.create(order=2, title="Warpstone", text="Glow.").warband_types.set([cls.skaven])
        cls.preset.warband_rules.create(order=3, title="Beards", text="Long.").warband_types.set([cls.rangers])

    def raised(self, *rules: tuple[str, str], variant: str = "reikland") -> None:
        """The warband as raised: a Mercenary of the variant holding these rules, in order."""
        Warband.objects.filter(pk=self.warband.pk).update(warband_type=self.mercenaries, template_variant=variant)
        for title, text in rules:
            WarbandRule.objects.create(warband=self.warband, title=title, description=text)

    def patch(self, body: dict[str, Any]) -> Any:
        response = self.patch_as(self.player, f"/api/warbands/{self.warband.id}/", body)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def rules(self) -> list[tuple[str, str]]:
        return list(self.warband.rules.order_by("id").values_list("title", "description"))

    def test_a_new_variant_swaps_the_untouched_rules_and_keeps_the_edited_ones(self) -> None:
        self.raised(("Hard Bargains", "Haggle."), ("Marksmen", " "), ("Discipline", "Steady, house."), ("Ours", "x"))
        hard = self.warband.rules.get(title="Hard Bargains").pk
        answer = self.patch({"template_variant": "middenheim"})
        self.assertEqual(
            self.rules(),
            [("Hard Bargains", "Haggle."), ("Discipline", "Steady, house."), ("Ours", "x"), ("Fury", "Ulric.")],
        )
        self.assertEqual(self.warband.rules.get(title="Hard Bargains").pk, hard)  # given by both: left alone
        changed = answer["rules_changed"]
        self.assertEqual(changed["words"], ["Added 1 rule and removed 1.", "Kept your edited rule: Discipline."])
        self.assertEqual((changed["added"], changed["removed"], changed["kept"]), (1, 1, ["Discipline"]))
        self.assertEqual([(rule["title"], rule["description"]) for rule in changed["rules"]], self.rules())

    def test_a_rule_both_variants_give_that_the_player_deleted_stays_deleted(self) -> None:
        self.raised(("Marksmen", ""))
        self.patch({"template_variant": "middenheim"})
        self.assertEqual(self.rules(), [("Fury", "Ulric.")])

    def test_a_new_type_swaps_its_templates_and_its_presets_rules(self) -> None:
        Campaign.objects.filter(pk=self.campaign.pk).update(preset=self.preset)
        given = [("Hard Bargains", "Haggle."), ("Marksmen", ""), ("Discipline", "Steady."), ("Pay", "Wages.")]
        self.raised(*given, ("City", "Streets."))
        city = self.warband.rules.get(title="City").pk
        answer = self.patch({"warband_type_id": self.skaven.id})
        self.assertEqual(self.rules(), [("City", "Streets."), ("Scurry", "Run."), ("Warpstone", "Glow.")])
        self.assertEqual(self.warband.rules.get(title="City").pk, city)  # its group's, before and after
        self.assertEqual(answer["rules_changed"]["words"], ["Added 2 rules and removed 4."])
        self.assertEqual(answer["template_variant"], "")

    def test_a_type_with_no_template_either_side_swaps_only_the_presets(self) -> None:
        Campaign.objects.filter(pk=self.campaign.pk).update(preset=self.preset)
        Warband.objects.filter(pk=self.warband.pk).update(warband_type=self.rangers, template_variant="")
        WarbandRule.objects.create(warband=self.warband, title="Beards", description="Long.")
        dwarfs = book_warband_type("Dwarf Miners")  # no template either, but one of the city folk
        WarbandGroup.objects.get(slug="city").members.add(dwarfs)
        answer = self.patch({"warband_type_id": dwarfs.id})
        self.assertEqual(self.rules(), [("City", "Streets.")])
        self.assertEqual(answer["rules_changed"]["words"], ["Added 1 rule and removed 1."])

    def test_changing_neither_touches_no_rule(self) -> None:
        self.raised(("Marksmen", ""))
        self.assertIsNone(self.patch({"name": "The Gilded Wagon"})["rules_changed"])
        self.assertIsNone(self.patch({"template_variant": "reikland"})["rules_changed"])
        self.assertIsNone(self.patch({"warband_type_id": self.mercenaries.id})["rules_changed"])
        self.assertEqual(self.rules(), [("Marksmen", "")])

    def test_a_plots_rule_is_never_touched(self) -> None:
        plot = Plot.objects.create(name="Witch Hunt", slug="witch-hunt")
        self.raised(("Marksmen", ""))
        WarbandRule.objects.create(warband=self.warband, title="Marksmen", description="", from_plot=plot)
        answer = self.patch({"template_variant": "middenheim"})
        self.assertEqual(self.rules(), [("Marksmen", ""), ("Fury", "Ulric.")])
        self.assertEqual(self.warband.rules.get(title="Marksmen").from_plot_id, plot.pk)
        self.assertEqual(answer["rules_changed"]["words"], ["Added 1 rule and removed 1."])

    def test_the_patch_runs_in_the_same_queries_however_many_rules_there_are(self) -> None:
        Campaign.objects.filter(pk=self.campaign.pk).update(preset=self.preset)

        def count(rules: int) -> int:
            self.warband.rules.all().delete()
            self.raised(*[("Marksmen", "")] * rules, *[(f"Own {n}", "") for n in range(rules)], ("Pay", "Wages."))
            self.client.force_authenticate(user=self.player)
            with CaptureQueriesContext(connection) as captured:
                response = self.client.patch(
                    f"/api/warbands/{self.warband.id}/", {"warband_type_id": self.skaven.id}, format="json"
                )
            self.assertEqual(response.status_code, 200, response.data)
            return len(captured)

        # the swap reads each type's template and its rules, each type's preset rules and the warband's rules, then
        # one DELETE and one INSERT
        self.assertEqual((count(1), count(6)), (17, 17))
