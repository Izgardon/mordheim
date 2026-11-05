"""Whose rule a special is (special/kinds.py): a hired sword's or a dramatis persona's own rule, which their seeders
create under "Hired Sword - <name>" or "Dramatis Persona - <name>" when the book lacks it, or a general one. The
Boons & Banes pickers leave the unit-specific ones out (a warband template fighter's too); their own cards and
reference rows keep them.
"""

from django.test import TestCase

from apps.core.book_lookups import BookLookups
from apps.special.kinds import DRAMATIS_PERSONA, GENERAL, HIRED_SWORD, WARBAND, owner_kind_of
from apps.special.models import Special
from apps.warbands.tests.roster_support import RosterTestCase


class OwnerKindTests(TestCase):
    def test_the_type_a_seeder_gives_says_whose_rule_it_is(self):
        self.assertEqual(owner_kind_of("Hired Sword - Dark Mage"), HIRED_SWORD)
        self.assertEqual(owner_kind_of("Dramatis Persona - Bertha Bestraufrung"), DRAMATIS_PERSONA)
        self.assertEqual(owner_kind_of("Warband - Mercenaries"), WARBAND)
        self.assertEqual(owner_kind_of("Animal"), GENERAL)
        self.assertEqual(owner_kind_of("Hired Sword"), GENERAL)
        self.assertEqual(owner_kind_of("Skaven - Clan Eshin"), GENERAL)

    def test_a_hired_swords_and_a_personas_own_specials_are_theirs(self):
        sword = BookLookups("Hired Sword").special({"name": "Hard to Kill", "description": "Tough."}, "Ogre")
        persona = BookLookups("Dramatis Persona").special("Witch Sense", "Bertha")
        assert sword is not None and persona is not None
        self.assertEqual((sword.type, sword.owner_kind), ("Hired Sword - Ogre", HIRED_SWORD))
        self.assertEqual((persona.type, persona.owner_kind), ("Dramatis Persona - Bertha", DRAMATIS_PERSONA))

    def test_a_book_special_found_by_name_stays_general_and_a_stale_row_is_corrected(self):
        skin = Special.objects.create(name="Thick Skinned", type="Animal")
        stale = Special.objects.create(name="Bodyguard", type="Hired Sword - Ogre")  # seeded before the field
        lookups = BookLookups("Hired Sword")
        found, mine = lookups.special("Thick Skinned", "Ogre"), lookups.special("Bodyguard", "Ogre")
        assert found is not None and mine is not None
        skin.refresh_from_db()
        stale.refresh_from_db()
        self.assertEqual((found.id, skin.owner_kind), (skin.id, GENERAL))
        self.assertEqual((mine.id, stale.owner_kind), (stale.id, HIRED_SWORD))

    def test_a_warband_template_fighters_rule_stays_the_templates(self):
        theirs = Special.objects.create(name="Leader", type="Warband - Mercenaries", owner_kind=WARBAND)
        sword = BookLookups("Hired Sword").special({"name": "Leader", "description": "Leads."}, "Ogre")
        assert sword is not None
        self.assertNotEqual(sword.id, theirs.id)
        self.assertEqual((sword.type, sword.owner_kind), ("Hired Sword - Ogre", HIRED_SWORD))


class OwnerKindPayloadTests(RosterTestCase):
    def test_the_catalogue_rows_carry_whose_rule_it_is(self):
        Special.objects.create(name="Spy", type="Hired Sword - Freelance Knight", owner_kind=HIRED_SWORD)
        rows = self.client.get(f"/api/special/?campaign_id={self.campaign.id}").json()
        owners = {row["name"]: row["owner_kind"] for row in rows}
        self.assertEqual((owners["Spy"], owners["Large"]), (HIRED_SWORD, GENERAL))

    def test_a_custom_special_is_general_whatever_it_sends(self):
        self.client.force_authenticate(user=self.campaign_owner)
        body = {"campaign_id": self.campaign.id, "name": "Banner", "type": "House rule", "owner_kind": HIRED_SWORD}
        created = self.client.post("/api/special/", body, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.json()["owner_kind"], GENERAL)
