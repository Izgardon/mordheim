"""Campaign types, schema only (CAT-NEW-04, decision "New"): the `campaign_type` table, the
`campaign_campaign_type` pivot and a nullable `campaign_type` on eight catalogue tables (not the bestiary). No rows,
no tagging and no filtering yet; the seeders leave the column null (`seed_all` twice: the seeding tests).
"""

from django.db import IntegrityError, transaction
from django.db.models import RestrictedError

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import CampaignCampaignType, CampaignType
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.items.models import Item, ItemProperty
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

from .catalogue_support import BESTIARY, ITEMS, KINDS, CatalogueTestCase, make_entry

TYPED = (Item, Skill, Spell, Special, Race, Restriction, HiredSword, DramatisPersona)


class CampaignTypeSchemaTests(CatalogueTestCase):
    def test_a_fresh_database_has_no_campaign_types(self):
        self.assertEqual((CampaignType.objects.count(), CampaignCampaignType.objects.count()), (0, 0))

    def test_eight_catalogue_tables_take_a_nullable_campaign_type_and_the_bestiary_none(self):
        for model in TYPED:
            with self.subTest(model=model.__name__):
                field = model._meta.get_field("campaign_type")
                self.assertTrue(field.null)
                self.assertIs(field.related_model, CampaignType)
                self.assertFalse(model.objects.exclude(campaign_type=None).exists())
        for untyped in (BestiaryEntry, ItemProperty):
            with self.subTest(model=untyped.__name__):
                self.assertNotIn("campaign_type", [field.name for field in untyped._meta.get_fields()])

    def test_a_campaign_takes_each_type_once(self):
        marienburg = CampaignType.objects.create(slug="marienburg", name="Marienburg")
        self.campaign.campaign_types.add(marienburg)

        with self.assertRaises(IntegrityError), transaction.atomic():
            CampaignCampaignType.objects.create(campaign=self.campaign, campaign_type=marienburg)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CampaignType.objects.create(slug="marienburg", name="Again")
        self.assertEqual(list(marienburg.campaigns.all()), [self.campaign])

    def test_a_type_in_use_cannot_be_deleted_but_its_campaign_can(self):
        marienburg = CampaignType.objects.create(slug="marienburg", name="Marienburg")
        self.campaign.campaign_types.add(marienburg)
        tagged = make_entry(ITEMS, "Marienburg pike", campaign_type=marienburg)

        with self.assertRaises(RestrictedError), transaction.atomic():
            marienburg.delete()
        tagged.delete()
        self.campaign.delete()

        self.assertFalse(CampaignCampaignType.objects.exists())
        self.assertTrue(CampaignType.objects.filter(id=marienburg.id).exists())

    def test_the_lists_show_each_entry_untyped(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                rows = self.get_as(self.player, kind.list_url(self.campaign)).json()
                self.assertTrue(rows)
                if kind is BESTIARY:  # the bestiary takes no type
                    self.assertNotIn("campaign_type_id", rows[0])
                    continue
                self.assertEqual({row["campaign_type_id"] for row in rows}, {None})
        restrictions = self.get_as(self.player, f"/api/restrictions/?campaign_id={self.campaign.id}").json()
        self.assertEqual({row["campaign_type"] for row in restrictions}, {None})
