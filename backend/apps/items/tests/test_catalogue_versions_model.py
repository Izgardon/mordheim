"""The data model of versions, archiving and removals (pass 5 PR C; decisions 1, 2 and 5, CAT-NEW-03, CAT-NEW-05).

Every entry table (items, skills, spells, specials, races, bestiary entries) gains `replaces` (a campaign's version of
a book entry, RESTRICT), `archived_at`/`archived_by` and `updated_at`/`updated_by`. A campaign holds one version per
book entry, and only a campaign's row is a version. A book entry deleted for one campaign is a `CatalogueRemoval`;
a reverted version leaves a `RevertedVersion`. Deleting a campaign takes all of them; a book entry a campaign has
a version of can't be deleted.
"""

from django.db import IntegrityError, transaction
from django.db.models import RestrictedError

from apps.campaigns.models import Campaign
from apps.core.models import ENTRY_TABLES, CatalogueRemoval, RevertedVersion
from apps.items.models import Item

from .catalogue_support import BESTIARY, ITEMS, KINDS, RACES, SKILLS, SPECIALS, SPELLS, CatalogueTestCase, make_entry

ENTRY_KINDS = (ITEMS, SKILLS, SPELLS, SPECIALS, RACES, BESTIARY)  # a hired sword's version is its entry's


class VersionColumnTests(CatalogueTestCase):
    def test_every_entry_table_carries_the_version_archive_and_badge_columns(self):
        for kind in ENTRY_KINDS:
            with self.subTest(kind=kind.key):
                names = {field.name for field in kind.model._meta.get_fields()}
                self.assertLessEqual({"replaces", "archived_at", "archived_by", "updated_at", "updated_by"}, names)
        self.assertFalse(hasattr(Item, "source_item"))  # renamed: a house rule's clone is a version

    def test_a_campaign_holds_one_version_of_a_book_entry(self):
        for kind in ENTRY_KINDS:
            with self.subTest(kind=kind.key):
                book = make_entry(kind, f"Book {kind.key}")
                make_entry(kind, f"Mine {kind.key}", campaign=self.campaign, replaces=book)
                make_entry(kind, f"Theirs {kind.key}", campaign=self.elsewhere, replaces=book)  # another campaign
                with self.assertRaises(IntegrityError), transaction.atomic():
                    make_entry(kind, f"Again {kind.key}", campaign=self.campaign, replaces=book)

    def test_only_a_campaign_row_is_a_version(self):
        for kind in ENTRY_KINDS:
            with self.subTest(kind=kind.key):
                book = make_entry(kind, f"Book {kind.key}")
                with self.assertRaises(IntegrityError), transaction.atomic():
                    make_entry(kind, f"Loose {kind.key}", replaces=book)

    def test_a_book_entry_with_a_version_cannot_be_deleted_but_the_campaign_can(self):
        book = make_entry(ITEMS, "Flail")
        version = make_entry(ITEMS, "Flail", campaign=self.elsewhere, replaces=book)

        with self.assertRaises(RestrictedError), transaction.atomic():
            book.delete()
        Campaign.objects.filter(id=self.elsewhere.id).delete()

        self.assertFalse(Item.objects.filter(id=version.id).exists())
        self.assertTrue(Item.objects.filter(id=book.id).exists())


class CampaignRecordTests(CatalogueTestCase):
    def test_a_book_entry_is_removed_once_per_campaign_and_goes_with_its_campaign(self):
        CatalogueRemoval.objects.create(campaign=self.campaign, kind="items", entry_id=self.book_axe.id)
        CatalogueRemoval.objects.create(campaign=self.elsewhere, kind="items", entry_id=self.book_axe.id)
        CatalogueRemoval.objects.create(campaign=self.campaign, kind="skills", entry_id=self.book_axe.id)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CatalogueRemoval.objects.create(campaign=self.campaign, kind="items", entry_id=self.book_axe.id)

        Campaign.objects.filter(id=self.elsewhere.id).delete()

        self.assertEqual(CatalogueRemoval.objects.filter(entry_id=self.book_axe.id).count(), 2)

    def test_a_reverted_version_is_recorded_once_and_goes_with_its_campaign(self):
        RevertedVersion.objects.create(campaign=self.elsewhere, kind="items", version_id=9001, book_id=self.book_axe.id)
        with self.assertRaises(IntegrityError), transaction.atomic():
            RevertedVersion.objects.create(campaign=self.campaign, kind="items", version_id=9001, book_id=1)

        Campaign.objects.filter(id=self.elsewhere.id).delete()

        self.assertFalse(RevertedVersion.objects.exists())

    def test_the_record_kinds_are_the_entry_tables(self):
        kinds = {key for key, _label in ENTRY_TABLES}  # the choices of both records' `kind`
        self.assertEqual(kinds, {kind.key for kind in KINDS} - {"hired_swords"})
