"""Settings on the catalogue (grading phase 1, from CAT-NEW-04's schema): every catalogue table but the bestiary takes
a nullable `campaign_type`, its setting; a campaign ticks the settings in play (`campaign_campaign_type`). A list read
for a campaign says whether each row is in play: its setting ticked or always on, or none (custom, or Mordheim's by
default). The rest stays listed, with `in_play` false, never hidden. A version keeps its book entry's setting."""

from django.db import IntegrityError, transaction
from django.db.models import RestrictedError

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.in_play import set_settings
from apps.campaigns.models import CampaignCampaignType, CampaignType
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.items.models import Item, ItemRule
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, KINDS, SKILLS, CatalogueTestCase, make_entry

TYPED = (Item, Skill, Spell, Special, Race, Restriction, HiredSword, DramatisPersona)


class CatalogueSettingSchemaTests(CatalogueTestCase):
    def test_eight_catalogue_tables_take_a_nullable_setting_and_the_bestiary_none(self):
        for model in TYPED:
            with self.subTest(model=model.__name__):
                field = model._meta.get_field("campaign_type")
                self.assertTrue(field.null)
                self.assertIs(field.related_model, CampaignType)
        for untyped in (BestiaryEntry, ItemRule):
            with self.subTest(model=untyped.__name__):
                self.assertNotIn("campaign_type", [field.name for field in untyped._meta.get_fields()])

    def test_a_campaign_ticks_each_setting_once(self):
        khemri = CampaignType.objects.create(slug="khemri", name="Khemri", grade="1b")
        self.campaign.campaign_types.add(khemri)

        with self.assertRaises(IntegrityError), transaction.atomic():
            CampaignCampaignType.objects.create(campaign=self.campaign, campaign_type=khemri)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CampaignType.objects.create(slug="khemri", name="Again")
        self.assertEqual(list(khemri.campaigns.all()), [self.campaign])

    def test_a_setting_in_use_cannot_be_deleted_but_its_campaign_can(self):
        khemri = CampaignType.objects.create(slug="khemri", name="Khemri", grade="1b")
        self.campaign.campaign_types.add(khemri)
        tagged = make_entry(ITEMS, "Scorpion Ring", campaign_type=khemri)

        with self.assertRaises(RestrictedError), transaction.atomic():
            khemri.delete()
        tagged.delete()
        self.campaign.delete()

        self.assertFalse(CampaignCampaignType.objects.exists())
        self.assertTrue(CampaignType.objects.filter(id=khemri.id).exists())


class InPlayListTests(CatalogueTestCase):
    """The shared campaign ticks Khemri; Lustria is in no campaign; Mordheim is always on."""

    def setUp(self) -> None:
        super().setUp()
        self.mordheim = CampaignType.objects.create(slug="mordheim", name="Mordheim", always_on=True)
        self.khemri = CampaignType.objects.create(slug="khemri", name="Khemri", grade="1b")
        self.lustria = CampaignType.objects.create(slug="lustria", name="Lustria", grade="1b")
        set_settings(self.campaign, [self.khemri.id])

    def rows(self, kind, campaign=None) -> dict[str, dict]:
        return {row["name"]: row for row in self.get_as(self.player, kind.list_url(campaign)).json()}

    def test_a_campaign_list_says_whether_each_row_is_in_play_and_hides_none(self):
        make_entry(SKILLS, "Desert Lore", campaign_type=self.khemri)
        make_entry(SKILLS, "Jungle Lore", campaign_type=self.lustria)
        make_entry(SKILLS, "Sprint", campaign_type=self.mordheim)
        make_entry(SKILLS, "Ungraded")
        make_entry(SKILLS, "Our Trick", campaign=self.campaign)
        rows = self.rows(SKILLS, self.campaign)
        flags = {
            name: rows[name]["in_play"] for name in ("Desert Lore", "Jungle Lore", "Sprint", "Ungraded", "Our Trick")
        }
        self.assertEqual(
            flags, {"Desert Lore": True, "Jungle Lore": False, "Sprint": True, "Ungraded": True, "Our Trick": True}
        )
        self.assertEqual(rows["Jungle Lore"]["setting_id"], self.lustria.id)
        self.assertIsNone(self.rows(SKILLS)["Jungle Lore"]["in_play"])  # the book's own list knows no campaign

    def test_every_kind_says_it_and_the_bestiary_is_always_in_play(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                rows = self.get_as(self.player, kind.list_url(self.campaign)).json()
                self.assertTrue(rows)
                self.assertTrue(all("in_play" in row for row in rows))
                if kind is BESTIARY:
                    self.assertEqual({row["in_play"] for row in rows}, {True})
                    self.assertNotIn("setting_id", rows[0])

    def test_unticking_a_setting_moves_its_rows_out_of_play_at_once(self):
        make_entry(HIRED_SWORDS, "Tomb Robber", campaign_type=self.khemri)
        self.assertTrue(self.rows(HIRED_SWORDS, self.campaign)["Tomb Robber"]["in_play"])
        changed = self.patch_as(self.owner, self.url(), {"setting_ids": [self.lustria.id]})
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertFalse(self.rows(HIRED_SWORDS, self.campaign)["Tomb Robber"]["in_play"])

    def test_a_version_keeps_its_book_entrys_setting(self):
        book = make_entry(SKILLS, "Jungle Lore", campaign_type=self.lustria)
        edited = self.patch_as(
            self.player, SKILLS.detail_url(book.id), {"campaign_id": self.campaign.id, "description": "Ours"}
        )
        self.assertEqual(edited.status_code, 200, edited.data)
        version = Skill.objects.get(campaign=self.campaign, replaces=book)
        self.assertEqual(version.campaign_type_id, self.lustria.id)
        self.assertFalse(self.rows(SKILLS, self.campaign)["Jungle Lore"]["in_play"])

    def test_the_list_query_count_is_unchanged_by_the_rule(self):
        for index in range(3):
            make_entry(SKILLS, f"Lore {index}", campaign_type=self.lustria)
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(2):  # the caller's access, then the rows with in_play
            self.client.get(SKILLS.list_url(self.campaign))
