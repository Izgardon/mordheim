"""Boons & Banes: every special is a boon, a bane or a trait (special/kinds.py).

The book's are classified by name in data/special-kinds.json and the seeders set them; the specials the injury tables
grant are banes unless the classification says otherwise; a custom special picks its own, a trait when it doesn't.
"""

import json
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.battles.services.injuries import injury_special
from apps.core.book_lookups import BookLookups
from apps.special.kinds import BANE, BOON, KIND_CHOICES, KINDS_PATH, TRAIT, book_kind
from apps.special.models import Special
from apps.warbands.models import HeroSpecial
from apps.warbands.tests.roster_support import HERO, RosterTestCase, make_unit, unit_url


class SpecialKindTests(TestCase):
    def test_every_classified_special_has_a_kind(self):
        with KINDS_PATH.open(encoding="utf-8") as handle:
            data = json.load(handle)
        self.assertGreater(len(data), 250)
        self.assertEqual(set(data.values()) - set(dict(KIND_CHOICES)), set())

    def test_the_classification_reads_names_loosely_and_falls_back(self):
        self.assertEqual(book_kind(" fear "), BOON)
        self.assertEqual(book_kind("Stupidity"), BANE)
        self.assertEqual(book_kind("Large"), TRAIT)
        self.assertEqual(book_kind("Not in the book"), TRAIT)
        self.assertEqual(book_kind("Not in the book", BANE), BANE)

    def test_seeding_the_book_sets_each_kind(self):
        call_command("seed_spells_and_special", stdout=StringIO())
        kinds = dict(Special.objects.filter(campaign=None, name__in=("Fear", "Stupidity", "Large")).values_list("name", "kind"))  # fmt: skip
        self.assertEqual(kinds, {"Fear": BOON, "Stupidity": BANE, "Large": TRAIT})  # the shared two among them

    def test_a_hired_swords_own_special_takes_its_kind(self):
        lookups = BookLookups("Hired Sword")
        own = lookups.special({"name": "Hard to Kill", "description": "Hard to kill."}, "Ogre Bodyguard")
        assert own is not None
        self.assertEqual((own.type, own.kind), ("Hired Sword - Ogre Bodyguard", BOON))
        stale = Special.objects.create(name="Bicker", type="Animal")  # seeded before it had a kind: a trait
        found = BookLookups().special("Bicker", "Gnoblar")
        assert found is not None
        stale.refresh_from_db()
        self.assertEqual((found.id, stale.kind), (stale.id, BANE))


class InjuryAndCustomKindTests(RosterTestCase):
    def test_an_injury_special_is_a_bane_unless_the_book_says_otherwise(self):
        self.assertEqual(injury_special("Old Battle Wound", self.campaign.id).kind, BANE)
        self.assertEqual(injury_special("Hardened", self.campaign.id).kind, BOON)
        self.assertEqual(injury_special("A New Scar", self.campaign.id).kind, BANE)

    def test_a_custom_special_picks_its_kind_and_is_a_trait_otherwise(self):
        self.client.force_authenticate(user=self.campaign_owner)
        body = {"campaign_id": self.campaign.id, "name": "Cursed Blood", "type": "House rule"}
        picked = self.client.post("/api/special/", {**body, "kind": "bane"}, format="json")
        self.assertEqual(picked.status_code, 201, picked.data)
        self.assertEqual(picked.json()["kind"], BANE)
        plain = self.client.post("/api/special/", {**body, "name": "Banner"}, format="json")
        self.assertEqual(plain.json()["kind"], TRAIT)
        wrong = self.client.post("/api/special/", {**body, "name": "Odd", "kind": "curse"}, format="json")
        self.assertEqual(wrong.status_code, 400)

    def test_a_units_specials_carry_their_kind(self):
        hero = make_unit(HERO, self.warband)
        HeroSpecial.objects.create(hero=hero, special=Special.objects.create(name="Animosity", type="Orc", kind=BANE))
        listed = self.client.get(unit_url(HERO, self.warband.id)).json()[0]["specials"]
        detail = self.client.get(unit_url(HERO, self.warband.id, hero.id)).json()["specials"]
        self.assertEqual([entry["kind"] for entry in (*listed, *detail)], [BANE, BANE])
