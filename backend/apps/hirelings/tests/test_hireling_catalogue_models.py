"""The hireling catalogue's tables (bestiary rewrite step 2): hired swords and dramatis personae stand alone.

Both carry the catalogue columns (versions, archive, badges), the same stat block and costs, and the same five links:
skills, specials, spells, items with a quantity, restrictions with a note. A dramatis persona adds `stays` and
`payment_note`. One entry per name in the book and in each campaign, one version of a book entry per campaign. A
link holds its skill, special, spell or item with RESTRICT and goes with its hired sword or dramatis persona.
"""

from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import RestrictedError
from django.test import TestCase

from apps.campaigns.models import Campaign
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.items.models import Item
from apps.items.tests.catalogue_support import ITEMS, RACES, SKILLS, CatalogueTestCase, make_entry
from apps.restrictions.models import Restriction
from apps.skills.models import Skill

STATS = {"movement": 4, "weapon_skill": 3, "ballistic_skill": 3, "strength": 3, "toughness": 3, "wounds": 1}
LINKS = {"skill_links", "special_links", "spell_links", "item_links", "restriction_links"}
CATALOGUE_COLUMNS = {"campaign", "campaign_type", "replaces", "archived_at", "archived_by", "updated_at", "updated_by"}
HIRELING_CATALOGUES: tuple[Any, ...] = (HiredSword, DramatisPersona)


class HirelingCatalogueModelTests(TestCase):
    campaign: Campaign
    sword: Item
    skill: Skill

    @classmethod
    def setUpTestData(cls) -> None:
        cls.campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        cls.sword = Item.objects.create(name="Sword", type="Weapon")
        cls.skill = Skill.objects.create(name="Sprint", type="Speed")

    def test_both_tables_carry_the_catalogue_columns_the_profile_and_the_same_links(self):
        profile = {"name", "description", "armour_save", "large", "caster", "race", "race_label", "hire_cost"}
        profile |= {"hire_cost_expression", "upkeep_cost", "upkeep_cost_expression", "rating", "grade"}
        profile |= {"available_skill_types", *STATS}
        for model in HIRELING_CATALOGUES:
            with self.subTest(model=model.__name__):
                names = {field.name for field in model._meta.get_fields()}
                self.assertLessEqual(CATALOGUE_COLUMNS | profile | LINKS, names)
        self.assertLessEqual({"stays", "payment_note"}, {field.name for field in DramatisPersona._meta.get_fields()})
        self.assertFalse({"stays", "payment_note"} & {field.name for field in HiredSword._meta.get_fields()})
        self.assertEqual(
            (DramatisPersona._meta.db_table, HiredSword._meta.db_table), ("dramatis_persona", "hired_sword")
        )

    def test_one_entry_per_name_in_the_book_and_in_a_campaign(self):
        for model in HIRELING_CATALOGUES:
            with self.subTest(model=model.__name__):
                model.objects.create(name="Ogre", **STATS)
                model.objects.create(name="Ogre", campaign=self.campaign, **STATS)  # a campaign's own may share it
                for campaign in (None, self.campaign):
                    with self.assertRaises(IntegrityError), transaction.atomic():
                        model.objects.create(name="Ogre", campaign=campaign, **STATS)

    def test_a_campaign_holds_one_version_of_a_book_entry_and_only_a_campaign_row_is_one(self):
        for model in HIRELING_CATALOGUES:
            with self.subTest(model=model.__name__):
                book = model.objects.create(name="Elf Ranger", **STATS)
                model.objects.create(name="Elf Ranger", campaign=self.campaign, replaces=book, **STATS)
                with self.assertRaises(IntegrityError), transaction.atomic():
                    model.objects.create(name="Elf Ranger II", campaign=self.campaign, replaces=book, **STATS)
                with self.assertRaises(IntegrityError), transaction.atomic():
                    model.objects.create(name="Loose", replaces=book, **STATS)

    def test_a_kit_lists_each_item_once_with_its_quantity(self):
        ogre = HiredSword.objects.create(name="Ogre Bodyguard", **STATS)
        ogre.item_links.create(item=self.sword, quantity=2)

        self.assertEqual(list(ogre.item_links.values_list("item_id", "quantity")), [(self.sword.id, 2)])
        with self.assertRaises(IntegrityError), transaction.atomic():
            ogre.item_links.create(item=self.sword)

    def test_a_linked_entry_cannot_be_deleted_and_the_links_go_with_their_hireling(self):
        mercenaries = Restriction.objects.create(restriction="Mercenaries")
        for model in HIRELING_CATALOGUES:
            with self.subTest(model=model.__name__):
                row = model.objects.create(name=f"Duellist {model.__name__}", **STATS)
                row.item_links.create(item=self.sword)
                row.skill_links.create(skill=self.skill)
                row.restriction_links.create(restriction=mercenaries, additional_note="only")
                for held in (self.sword, self.skill):
                    with self.assertRaises(RestrictedError), transaction.atomic():
                        held.delete()

                row_id = row.pk
                row.delete()

                for links in LINKS:
                    relation: Any = model._meta.get_field(links)
                    link_model, owner = relation.related_model, relation.field.name
                    self.assertFalse(link_model._default_manager.filter(**{f"{owner}_id": row_id}).exists())
        self.assertTrue(Item.objects.filter(id=self.sword.id).exists())

    def test_a_dramatis_persona_stays_for_good_unless_it_says_one_battle(self):
        persona = DramatisPersona.objects.create(name="Bertha Bestraufrung", **STATS)
        brief = DramatisPersona.objects.create(
            name="Aenur", **STATS, stays="one_battle", payment_note="25 gc or 1 shard"
        )

        self.assertEqual((persona.stays, persona.payment_note), ("always", ""))
        self.assertEqual((brief.stays, brief.payment_note), ("one_battle", "25 gc or 1 shard"))


class HirelingCatalogueHolderTests(CatalogueTestCase):
    """The links hold catalogue entries like units' copies do: usage counts them, a delete archives what they hold,
    and a campaign's version of a book entry takes over the campaign's links (Revert gives them back)."""

    def test_an_item_in_a_kit_is_archived_and_its_usage_counts_the_kits(self):
        charm = make_entry(ITEMS, "Charm", campaign=self.campaign)
        HiredSword.objects.create(name="Duellist", campaign=self.campaign, **STATS).item_links.create(item=charm)
        persona = DramatisPersona.objects.create(name="Aenur", campaign=self.campaign, **STATS)
        persona.item_links.create(item=charm, quantity=2)

        response = self.delete_as(self.owner, ITEMS.detail_url(charm.id))

        usage = {"units": 0, "warbands": 0, "stashes": 0, "bestiary_entries": 0}
        expected = {"outcome": "archived", "usage": {**usage, "hired_swords": 1, "dramatis_personae": 1}}
        self.assertEqual((response.status_code, response.json()), (200, expected))
        self.assertEqual(persona.item_links.get().item_id, charm.id)

    def test_a_race_a_hired_sword_has_is_archived(self):
        skink = make_entry(RACES, "Skink", campaign=self.campaign)
        HiredSword.objects.create(name="Hunter", campaign=self.campaign, race=skink, **STATS)

        response = self.delete_as(self.owner, RACES.detail_url(skink.id))

        self.assertEqual((response.json()["outcome"], response.json()["usage"]["hired_swords"]), ("archived", 1))

    def test_a_book_skills_first_edit_takes_the_campaigns_links_and_revert_gives_them_back(self):
        book = self.infiltration[0]
        mine = HiredSword.objects.create(name="Duellist", campaign=self.campaign, **STATS)
        mine.skill_links.create(skill=book)
        in_the_book = HiredSword.objects.create(name="Scout", **STATS)
        in_the_book.skill_links.create(skill=book)

        edited = self.patch_as(self.player, SKILLS.detail_url(book.id), {"campaign_id": self.campaign.id, "description": "Hidden."})  # fmt: skip
        moved = mine.skill_links.get().skill_id
        reverted = self.post_as(self.player, f"{SKILLS.detail_url(edited.data['id'])}revert/")

        self.assertEqual((edited.status_code, reverted.status_code), (200, 200))
        self.assertEqual((moved, in_the_book.skill_links.get().skill_id), (edited.data["id"], book.id))
        self.assertEqual(mine.skill_links.get().skill_id, book.id)

    def test_a_kit_line_meeting_another_on_a_revert_adds_its_quantity(self):
        mine = HiredSword.objects.create(name="Duellist", campaign=self.campaign, **STATS)
        mine.item_links.create(item=self.book_sword, quantity=1)
        edited = self.patch_as(self.player, ITEMS.detail_url(self.book_sword.id), {"campaign_id": self.campaign.id, "description": "Sharp."})  # fmt: skip
        mine.item_links.create(
            item=self.book_sword, quantity=2
        )  # the book's sword beside the version (written by hand)

        reverted = self.post_as(self.player, f"{ITEMS.detail_url(edited.data['id'])}revert/")

        self.assertEqual(reverted.status_code, 200)
        self.assertEqual(list(mine.item_links.values_list("item_id", "quantity")), [(self.book_sword.id, 3)])
