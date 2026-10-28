"""The catalogue seeders on the committed data (pass 5; BUG-17, BUG-51, BUG-54, CAT-TEST-12, -13).

`seed_all` runs `seed_races`, `seed_restrictions`, `seed_items`, `seed_skills`, `seed_spells_and_special`,
`seed_bestiary`, `seed_dramatis_personae`, then `seed_hired_swords`, each upserting the book by name (and type) in its
own transaction, and `seed_catalogue_if_empty` runs it on a wiped production database. It works on an empty database and again later, also once a campaign holds
an entry of a book entry's name and type (a custom override, a house-rule clone, and every version PR C's
copy-on-write makes): the seeders read and write the book only (BUG-17). Small, file-driven seeder cases are in
`test_catalogue_characterisation_seeders.py`.
"""

import re
from contextlib import redirect_stdout
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import Campaign, CampaignHouseRule, CampaignType
from apps.hirelings.models import DramatisPersona, HiredSword, HiredSwordItem, HiredSwordSkill
from apps.items.models import Item, ItemAvailability, ItemProperty
from apps.items.services import sync_half_price_armour_for_campaign
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

BOOK_MODELS = (Race, Restriction, Item, ItemProperty, Skill, Spell, Special, BestiaryEntry, HiredSword, DramatisPersona)


def seed_all() -> str:
    """Run seed_all and return everything it and its seeders printed (they write to sys.stdout)."""
    output = StringIO()
    with redirect_stdout(output):
        call_command("seed_all")
    return output.getvalue()


def counts() -> dict[str, int]:
    return {model.__name__: model.objects.count() for model in BOOK_MODELS}


class SeedAllTests(TestCase):
    """`seed_all` once on an empty database (class data); each test may seed again inside its own transaction."""

    output: str
    seeded: dict[str, int]

    @classmethod
    def setUpTestData(cls) -> None:
        cls.output = seed_all()
        cls.seeded = counts()

    def unresolved(self, output: str) -> list[str]:
        return sorted(line.strip() for line in output.splitlines() if "not found for" in line)

    def test_an_empty_database_gets_the_whole_book_and_nothing_else(self):
        # CAT-TEST-12 (first half): the run gunicorn's seed_catalogue_if_empty starts on a wiped database
        self.assertIn("All seed commands completed successfully!", self.output)
        self.assertEqual(
            self.seeded,
            {
                "Race": 27,
                "Restriction": 133,
                "Item": 247,  # 216 + one Animal item per beast (the bestiary rewrite step 3)
                "ItemProperty": 240,
                "Skill": 255,
                "Spell": 189,  # 183 + the Dark Mage's six (BUG-54)
                "Special": 186,
                "BestiaryEntry": 31,  # 14 mounts, 6 pets, 11 creatures (17 from Mutiny in Marienburg); no hired swords
                "HiredSword": 72,
                "DramatisPersona": 0,  # until they are scraped
            },
        )
        for model in BOOK_MODELS:
            if hasattr(model, "campaign"):
                with self.subTest(model=model.__name__):
                    self.assertFalse(model.objects.filter(campaign__isnull=False).exists())
            if hasattr(model, "campaign_type"):  # CAT-NEW-04: the seeders leave the add-on column null
                with self.subTest(model=model.__name__, column="campaign_type"):
                    self.assertFalse(model._default_manager.filter(**{"campaign_type__isnull": False}).exists())
        self.assertFalse(CampaignType.objects.exists())

    def test_a_second_run_changes_no_book_row_but_rewrites_every_availability(self):
        items = set(Item.objects.values_list("id", "name", "type"))
        availabilities = set(ItemAvailability.objects.values_list("id", flat=True))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(re.findall(r"(?i)created:? ([1-9]\d*|skill|special|spell)", output), [])  # nothing new
        self.assertEqual(counts(), self.seeded)
        self.assertEqual(set(Item.objects.values_list("id", "name", "type")), items)
        # every availability is deleted and written again under a new id (CAT-BUG-08's id churn)
        self.assertEqual(set(ItemAvailability.objects.values_list("id", flat=True)) & availabilities, set())

    def test_skaven_and_clan_pestilens_keep_their_own_maximums(self):
        # the 2026-10-28 data audit: races.json held Clan Pestilens' maximums under the name "Skaven" too, and
        # seed_races upserts by name, so the Skaven race had M5 T5 instead of M6 T4
        self.assertIn("Races import complete. Created: 27, Updated: 0", self.output)
        skaven = {race.name: (race.movement, race.toughness) for race in Race.objects.filter(name__startswith="Skaven")}
        self.assertEqual(skaven, {"Skaven": (6, 4), "Skaven (Clan Pestilens)": (5, 5)})

    def test_both_pirates_lists_keep_their_own_sea_legs(self):
        # the 2026-10-28 data audit: skills.json held a second Pirates list (sourced "TBMF") under the same type, and
        # seed_skills upserts on name and type, so its Sea Legs, Cutlass Master and Swashbuckler overwrote Town Cryer
        # 9's (a fresh seed said "Updated: 3") and the Pirates' Sea Legs was the other list's rope-and-rigging rule
        self.assertIn("Skills import complete. Created: 231, Updated: 0", self.output)
        sea_legs = {skill.type: skill.description for skill in Skill.objects.filter(name="Sea Legs")}
        self.assertEqual(set(sea_legs), {"Pirates", "Pirates (TBMF)"})
        self.assertIn("If he Falls during a battle", sea_legs["Pirates"])
        self.assertIn("swings through rope and rigging", sea_legs["Pirates (TBMF)"])
        second = set(Skill.objects.filter(type="Pirates (TBMF)").values_list("name", flat=True))
        self.assertEqual(second, {"Captain Blood", "Sea Legs", "Cutlass Master", "Treasure Hunter", "Swashbuckler"})

    def test_the_seeded_bounty_hunter_detail_costs_9_queries(self):
        # PERF-46, CAT-TEST-08 (was pinned: 43 and 45, each of his 8 items read on its own; flipped in PR A)
        client = APIClient()
        client.force_authenticate(user=get_user_model().objects.create_user(username="reader@example.com"))
        hunter = HiredSword.objects.get(name="Bounty Hunter", campaign__isnull=True)
        with CaptureQueriesContext(connection) as captured:
            self.assertEqual(client.get(f"/api/hired-swords/{hunter.id}/").status_code, 200)
        self.assertEqual(len(captured), 9)  # constant whatever the equipment

    def test_every_seeded_link_resolves(self):
        # BUG-54, CAT-TEST-13 (was pinned: 16 links unresolved; flipped in PR A: prefixes stripped, apostrophes
        # straightened, aliases added, Animal items cached as they are written; the Giant Spider's S0 is set aside,
        # decision 8)
        self.assertEqual(self.unresolved(self.output), [])
        links = {
            ("Highwayman", "Riding/Draft Horse"),
            ("Roadwarden", "Riding/Draft Horse"),
            ("Freelancer", "Warhorse"),
            ("Hobgoblin Scout", "Giant Wolf"),
            ("Priest of Morr", "Double-handed weapon"),
        }
        equipped = set(HiredSwordItem.objects.values_list("hired_sword__name", "item__name"))
        self.assertLessEqual(links, equipped)
        ninja = set(HiredSwordSkill.objects.filter(hired_sword__name="Ninja").values_list("skill__name", flat=True))
        self.assertLessEqual({"Leap", "Lightning Reflexes"}, ninja)
        knight = HiredSwordSkill.objects.filter(hired_sword__name="Knight of the White Wolf").values_list("skill__name", flat=True)  # fmt: skip
        self.assertIn("Ride [Animal]", knight)

    def test_the_ogre_keeps_both_swords_and_the_formulas_are_kept_beside_the_costs(self):
        # the bestiary rewrite: the browser's hire copy dropped quantities and formulas; the catalogue keeps them
        ogre = HiredSword.objects.get(name="Ogre Bodyguard")
        ninja = HiredSword.objects.get(name="Ninja")
        rat_ogre = HiredSword.objects.get(name="Clan Skryre Rat Ogre")

        self.assertIn(("Sword", 2), set(ogre.item_links.values_list("item__name", "quantity")))
        self.assertEqual((ninja.hire_cost, ninja.hire_cost_expression), (70, "70+3D6"))
        self.assertEqual((rat_ogre.upkeep_cost, rat_ogre.upkeep_cost_expression), (None, "1 piece of Wyrdstone"))
        self.assertEqual((ogre.race.name if ogre.race else None, ogre.race_label), ("Ogre", "Ogre"))

    def test_the_dark_mage_knows_his_six_spells(self):
        # BUG-54, CAT-TEST-13: the "1 - " to "6 - " prefixes kept his spells from matching; they are his own spells,
        # written as book spells of his type with the roll from the prefix and the difficulty from the text
        spells = Spell.objects.filter(hired_sword_spells__hired_sword__name="Dark Mage").order_by("roll")

        self.assertEqual(
            [(spell.roll, spell.name, spell.dc, spell.type) for spell in spells],
            [
                (1, "Banishment", "8", "Hired Sword - Dark Mage"),
                (2, "Soul Render", "8", "Hired Sword - Dark Mage"),
                (3, "Shade Mount", "8", "Hired Sword - Dark Mage"),
                (4, "Jozun's Decay", "9", "Hired Sword - Dark Mage"),
                (5, "Cowel of Pain", "6", "Hired Sword - Dark Mage"),
                (6, "Doom & Dark", "7", "Hired Sword - Dark Mage"),
            ],
        )

    def _campaign_with_an_axe_and_half_price_armour(self) -> tuple[Campaign, Item]:
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        axe = Item.objects.create(name="Axe", type="Weapon", subtype="Melee", campaign=campaign)
        ItemAvailability.objects.create(item=axe, cost=25, rarity=2)
        sync_half_price_armour_for_campaign(campaign.id)
        return campaign, axe

    def test_reseeding_with_a_campaign_axe_and_half_price_armour_leaves_the_campaign_rows_alone(self):
        # BUG-17, CAT-TEST-12: the second run must update the book, keep the campaign's rows and add no duplicates
        campaign, axe = self._campaign_with_an_axe_and_half_price_armour()
        campaign_rows = set(Item.objects.filter(campaign=campaign).values_list("id", "name"))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(Item.objects.filter(campaign__isnull=True).count(), self.seeded["Item"])
        self.assertEqual(set(Item.objects.filter(campaign=campaign).values_list("id", "name")), campaign_rows)
        self.assertEqual(axe.availabilities.get().cost, 25)

    def test_a_reseed_rewrites_the_book_axe_beside_a_same_named_campaign_axe(self):
        # BUG-17 (was pinned: the Axe, the first item in standard-items.json, matched the book Axe and the campaign's,
        # so seed_items stopped before writing any item; flipped in PR A)
        campaign, axe = self._campaign_with_an_axe_and_half_price_armour()
        Item.objects.filter(campaign__isnull=True, name="Axe").update(description="stale")

        seed_all()

        self.assertNotEqual(Item.objects.get(name="Axe", campaign__isnull=True).description, "stale")
        self.assertEqual(Item.objects.get(id=axe.id).campaign_id, campaign.id)

    def test_a_reseed_rewrites_every_book_armour_and_leaves_the_clones(self):
        # BUG-17 (was pinned: every clone shared its book armour's name and type, so seed_items crashed on the first
        # armour with the items before it already rewritten; flipped in PR A: the book only, and atomic)
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        sync_half_price_armour_for_campaign(campaign.id)
        clones = set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id"))
        Item.objects.filter(campaign__isnull=True, name__in=["Axe", "Wyrdstone Pendulum"]).update(description="stale")

        seed_all()

        self.assertNotEqual(Item.objects.get(name="Axe").description, "stale")
        self.assertNotEqual(Item.objects.get(name="Wyrdstone Pendulum").description, "stale")
        self.assertEqual(set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id")), clones)

    def test_a_reseed_leaves_the_campaigns_versions_alone_and_a_rule_still_skips_a_hand_made_one(self):
        # CAT-TEST-12 with PR C's versions: a reseed rewrites the book and resyncs the half-price rule; the versions
        # keep their ids, books and prices, and the hand-made Heavy Armour version stays out of the rule
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        CampaignHouseRule.objects.create(campaign=campaign, title="Half price", effect_key="half_price_armour")
        book_axe = Item.objects.get(campaign__isnull=True, name="Axe")
        heavy = Item.objects.get(campaign__isnull=True, name="Heavy Armour")
        axe = Item.objects.create(name="Axe", type=book_axe.type, campaign=campaign, replaces=book_axe)
        ItemAvailability.objects.create(item=axe, cost=25, rarity=2)
        mine = Item.objects.create(name="Heavy Armour", type=heavy.type, subtype=heavy.subtype, campaign=campaign, replaces=heavy)  # fmt: skip
        sync_half_price_armour_for_campaign(campaign.id)
        versions = set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id", "generated_effect_key"))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id", "generated_effect_key")), versions)  # fmt: skip
        self.assertEqual(Item.objects.filter(replaces=heavy, campaign=campaign).get().id, mine.id)
        self.assertEqual(axe.availabilities.get().cost, 25)
