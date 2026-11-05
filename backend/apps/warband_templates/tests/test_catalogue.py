"""Warband templates through the catalogue framework (apps/core/catalogue): a campaign's version copies every child
row with its links between them, Revert takes it back, a book template is removed for one campaign, a campaign's own
is deleted, and the items, races and specials a template holds count as used."""

from django.db import transaction

from apps.core.catalogue import archive, merge, versions
from apps.core.catalogue.kinds import ITEMS, RACES, SPECIALS, WARBAND_TEMPLATES
from apps.core.catalogue.usage import count_usage
from apps.core.models import CatalogueRemoval, RevertedVersion
from apps.items.models import Item
from apps.items.tests.catalogue_support import ITEMS as ITEM_KIND
from apps.items.tests.catalogue_support import RACES as RACE_KIND
from apps.items.tests.catalogue_support import CatalogueTestCase, make_entry
from apps.races.models import Race
from apps.warband_templates.models import TemplateFighter, TemplateFighterList, TemplateListItem, WarbandTemplate
from apps.warbands.models import WarbandType

from .support import Made, make_template


class TemplateVersionTests(CatalogueTestCase):
    made: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)

    def edit(self) -> WarbandTemplate:
        with transaction.atomic():
            version: WarbandTemplate = versions.editable(WARBAND_TEMPLATES, self.made.template, self.campaign.id)
        return version

    def test_a_campaigns_version_copies_every_child_row_and_its_fighters_buy_from_the_copied_list(self):
        version = self.edit()
        self.assertEqual((version.campaign_id, version.replaces_id), (self.campaign.id, self.made.template.id))
        [kit] = version.lists.all()
        self.assertNotEqual(kit.pk, self.made.kit.pk)
        bought_from = TemplateFighterList.objects.filter(fighter__template=version).values_list("equipment_list_id")
        self.assertEqual({row[0] for row in bought_from}, {kit.pk})
        self.assertEqual([(line.item_id, line.shown_as) for line in kit.lines.all()], [(self.book_axe.id, "Hatchet")])
        [link] = version.type_links.all()
        self.assertEqual(
            (link.campaign_id, link.warband_type_id, link.variant), (self.campaign.id, self.mercenaries.id, "reikland")
        )
        self.assertEqual(
            [(rule.title, rule.variant) for rule in version.rules.all()],
            [
                ("Hard Bargains", ""),
                ("Marksmen", "reikland"),
            ],
        )
        captain = version.fighters.get(key="captain")
        self.assertEqual((captain.race_id, captain.special_links.get().special_id), (self.human.id, self.made.rule.id))
        self.assertEqual(version.upgrades.get().special_id, self.made.mutation.id)
        book_lists = TemplateFighterList.objects.filter(fighter__template=self.made.template)
        self.assertEqual({row.equipment_list_id for row in book_lists}, {self.made.kit.pk})

    def test_a_version_lists_the_campaigns_version_of_an_item(self):
        with transaction.atomic():
            axe = versions.editable(ITEMS, self.book_axe, self.campaign.id)
        version = self.edit()
        self.assertEqual(version.lists.get().lines.get().item_id, axe.id)
        self.assertEqual(self.made.line.item_id, self.book_axe.id)

    def test_revert_deletes_the_version_and_its_rows_and_the_book_keeps_its_own(self):
        version = self.edit()
        with transaction.atomic():
            book = versions.revert(WARBAND_TEMPLATES, version, self.campaign.id)
        self.assertEqual(book.pk, self.made.template.pk)
        self.assertFalse(WarbandTemplate.objects.filter(pk=version.pk).exists())
        self.assertFalse(TemplateFighter.objects.filter(template_id=version.pk).exists())
        self.assertEqual(self.made.template.fighters.count(), 2)
        reverted = RevertedVersion.objects.filter(campaign=self.campaign, kind="warband_templates")
        self.assertEqual(list(reverted.values_list("version_id", "book_id")), [(version.pk, self.made.template.pk)])

    def test_a_book_template_is_removed_for_one_campaign_and_restored(self):
        def shown() -> bool:
            listed = merge.campaign_list(WARBAND_TEMPLATES, WarbandTemplate.objects.all(), self.campaign.id)
            return listed.filter(pk=self.made.template.pk).exists()

        body = archive.delete_entry(WARBAND_TEMPLATES, self.made.template, self.campaign.id, self.owner)
        assert body is not None
        self.assertEqual(body["outcome"], "removed")
        self.assertTrue(CatalogueRemoval.objects.filter(campaign=self.campaign, kind="warband_templates").exists())
        self.assertFalse(shown())
        elsewhere = merge.campaign_list(WARBAND_TEMPLATES, WarbandTemplate.objects.all(), self.elsewhere.id)
        self.assertTrue(elsewhere.filter(pk=self.made.template.pk).exists())
        archive.restore(WARBAND_TEMPLATES, self.made.template, self.campaign.id)
        self.assertTrue(shown())

    def test_a_campaigns_own_template_is_deleted_with_its_rows(self):
        watch = WarbandType.objects.create(name="Night Watch", slug="night-watch", campaign=self.campaign)
        own = make_template(
            "Night Watch", item=self.book_axe, race=self.human, warband_type=watch, campaign=self.campaign
        )
        body = archive.delete_entry(WARBAND_TEMPLATES, own.template, self.campaign.id, self.owner)
        self.assertIsNone(body)
        self.assertFalse(WarbandTemplate.objects.filter(pk=own.template.pk).exists())
        self.assertFalse(TemplateListItem.objects.filter(pk=own.line.pk).exists())


class TemplateUsageTests(CatalogueTestCase):
    lantern: Item
    watchman: Race
    book: Made
    own: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.lantern = make_entry(ITEM_KIND, "Lantern", campaign=cls.campaign)
        cls.watchman = make_entry(RACE_KIND, "Watchman", campaign=cls.campaign)
        cls.book = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.own = make_template(
            "Night Watch", item=cls.lantern, race=cls.watchman, warband_type=cls.mercenaries, campaign=cls.campaign
        )

    def test_a_campaigns_template_holds_its_items_races_and_specials(self):
        for kind, entry_id in (
            (ITEMS, self.lantern.pk),
            (RACES, self.watchman.pk),
            (SPECIALS, self.own.rule.pk),
            (SPECIALS, self.own.mutation.pk),
        ):
            with self.subTest(kind=kind.key, entry=entry_id):
                self.assertEqual(count_usage(kind, entry_id, self.campaign.id)["warband_templates"], 1)

    def test_a_book_template_counts_in_no_campaign(self):
        self.assertEqual(count_usage(ITEMS, self.book_axe.pk, self.campaign.id)["warband_templates"], 0)

    def test_an_item_a_template_lists_is_archived_not_deleted(self):
        body = archive.delete_entry(ITEMS, self.lantern, self.campaign.id, self.owner)
        assert body is not None
        self.assertEqual((body["outcome"], body["usage"]["warband_templates"]), ("archived", 1))
        self.assertTrue(Item.objects.filter(pk=self.lantern.pk, archived_at__isnull=False).exists())

    def test_an_items_version_takes_the_campaigns_template_lines_and_leaves_the_books(self):
        self.own.line.item = self.book_axe
        self.own.line.save()
        with transaction.atomic():
            axe = versions.editable(ITEMS, self.book_axe, self.campaign.id)
        self.own.line.refresh_from_db()
        self.book.line.refresh_from_db()
        self.assertEqual((self.own.line.item_id, self.book.line.item_id), (axe.id, self.book_axe.id))
