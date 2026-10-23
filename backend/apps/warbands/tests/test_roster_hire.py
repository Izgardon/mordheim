"""Hiring moves to the server: `POST warbands/<id>/hirelings/hire/` (the bestiary rewrite step 2).

The body names a catalogue entry (`source`: hired_sword or dramatis_persona, `id`) and optionally a name. The server
copies the campaign's current entry onto the warband, minus its description: stats, save, large, caster, race,
rating, skill types, both costs with their formulas, skills, specials and spells (as the campaign's current entries),
and the kit as one item row per copy with no cost. It records the HIRE ledger row when the fee is a number, applies
the hired-sword cap to hired swords only, and answers the hireling detail with `warnings`. A dramatis persona also
takes the Hero injury table, no level-ups, how long it stays and what it is paid in; it sits outside the cap, and
hiring one the warband already has warns (one of each). The browser's copy dropped the Ogre's second sword and every
formula; this one keeps them, in the same number of queries whatever the kit.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import Campaign
from apps.core.models import CatalogueRemoval
from apps.hirelings.models import MAX_KIT_QUANTITY, DramatisPersona, HiredSword
from apps.items.models import Item
from apps.skills.models import Skill
from apps.warbands.models import Hireling

from .roster_support import HIRELING, RosterTestCase, log_rows, make_unit, trade_rows, unit_url

STATS = {"movement": 6, "weapon_skill": 3, "ballistic_skill": 2, "strength": 4, "toughness": 4, "wounds": 3}
STATS |= {"initiative": 3, "attacks": 2, "leadership": 7}
PROFILE = {"armour_save": 5, "large": True, "hire_cost": 80, "hire_cost_expression": "80+D6", "upkeep_cost": 30}
PROFILE |= {"rating": 25, "available_skill_types": ["Combat", "Strength"], "description": "Big and hungry."}


class HireTestCase(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ogre = HiredSword.objects.create(name="Ogre Bodyguard", race=self.race, race_label="Ogre", **STATS, **PROFILE)  # fmt: skip
        self.ogre.skill_links.create(skill=self.skills[0])
        self.ogre.special_links.create(special=self.specials[0])
        self.ogre.item_links.create(item=self.sword, quantity=2)
        self.ogre.item_links.create(item=self.axe)

    def hire(self, source: str = "hired_sword", entry_id: int | None = None, **body: Any) -> Any:
        payload = {"source": source, "id": entry_id or self.ogre.id, **body}
        return self.client.post(unit_url(HIRELING, self.warband.id, suffix="hire/"), payload, format="json")


class HireCopyTests(HireTestCase):
    def test_a_hired_sword_is_copied_with_its_kit_and_formulas_minus_its_fluff(self):
        response = self.hire()

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        copied = {key: body[key] for key in ("name", "unit_type", "kind", "injury_table", "stays", "no_level_ups")}
        self.assertEqual(copied, {"name": "Ogre Bodyguard", "unit_type": "Ogre Bodyguard", "kind": "hired_sword", "injury_table": "henchman", "stays": "always", "no_level_ups": False})  # fmt: skip
        costs = (body["price"], body["hire_cost_expression"], body["upkeep_price"], body["upkeep_cost_expression"])
        self.assertEqual(costs, (80, "80+D6", 30, ""))
        self.assertEqual({key: body[key] for key in STATS}, STATS)
        self.assertEqual((body["armour_save"], body["large"], body["rating"], body["race_id"]), (5, True, 25, self.race.id))  # fmt: skip
        self.assertEqual(body["available_skills"], ["Combat", "Strength"])
        self.assertEqual([skill["id"] for skill in body["skills"]], [self.skills[0].id])
        self.assertIn(self.specials[0].id, [special["id"] for special in body["specials"]])
        self.assertIn(self.large.id, [special["id"] for special in body["specials"]])  # the Large trait, as units have
        self.assertEqual(sorted((item["name"], item["cost"]) for item in body["items"]), [("Axe", None), ("Sword", None), ("Sword", None)])  # fmt: skip
        self.assertIn(body["deeds"], (None, ""))  # the description is fluff: never copied
        self.assertEqual(body["warnings"], [])

    def test_the_hire_is_recorded_in_the_ledger_and_the_log(self):
        self.hire(name="Grukk")

        self.assertEqual([row[:3] for row in trade_rows(self.warband)], [("Hire", "Grukk the Ogre Bodyguard", -80)])
        self.assertEqual([(row[0], row[1], row[2]["name"]) for row in log_rows(self.warband)], [("personnel", "new_hireling", "Grukk")])  # fmt: skip

    def test_a_fee_that_isnt_a_number_hires_for_nothing_and_keeps_its_formula(self):
        HiredSword.objects.filter(id=self.ogre.id).update(hire_cost=None, hire_cost_expression="2 Treasure", upkeep_cost=None, upkeep_cost_expression="1 piece of wyrdstone")  # fmt: skip

        body = self.hire().data

        self.assertEqual((body["price"], body["hire_cost_expression"]), (0, "2 Treasure"))
        self.assertEqual((body["upkeep_price"], body["upkeep_cost_expression"]), (0, "1 piece of wyrdstone"))
        self.assertEqual(trade_rows(self.warband), [])

    def test_the_campaigns_version_is_hired_with_the_campaigns_entries(self):
        skill = Skill.objects.create(name="Skill 0", type="Combat", campaign=self.campaign, replaces=self.skills[0])
        blade = Item.objects.create(name="Sword", type="Melee", campaign=self.campaign, replaces=self.sword)
        version = HiredSword.objects.create(name="Ogre Bodyguard", campaign=self.campaign, replaces=self.ogre, hire_cost=95, **STATS)  # fmt: skip
        version.skill_links.create(skill=self.skills[0])  # a link to a book skill the campaign has a version of
        version.item_links.create(item=self.sword)

        body = self.hire(entry_id=self.ogre.id).data  # a list read before the edit names the book entry

        self.assertEqual(body["price"], 95)
        self.assertEqual([entry["id"] for entry in body["skills"]], [skill.id])
        self.assertEqual([item["id"] for item in body["items"]], [blade.id])

    def test_a_dramatis_persona_copies_with_no_xp_the_hero_table_its_stay_and_payment(self):
        bertha = DramatisPersona.objects.create(name="Bertha", stays="one_battle", payment_note="a favour", hire_cost=25, **STATS)  # fmt: skip

        body = self.hire("dramatis_persona", bertha.id, name="Sister Bertha").data

        kept = {key: body[key] for key in ("name", "unit_type", "kind", "injury_table", "no_level_ups", "stays", "payment_note", "price")}  # fmt: skip
        self.assertEqual(kept, {"name": "Sister Bertha", "unit_type": "Bertha", "kind": "dramatis_persona", "injury_table": "hero", "no_level_ups": True, "stays": "one_battle", "payment_note": "a favour", "price": 25})  # fmt: skip


class HireRuleTests(HireTestCase):
    def test_the_cap_holds_for_hired_swords_and_a_dramatis_persona_sits_outside_it_one_of_each(self):
        self.campaign_settings.max_hired_swords = 1
        self.campaign_settings.save()
        make_unit(HIRELING, self.warband)
        bertha = DramatisPersona.objects.create(name="Bertha", **STATS)

        refused = self.hire()
        first = self.hire("dramatis_persona", bertha.id)
        again = self.hire("dramatis_persona", bertha.id)

        self.assertEqual((refused.status_code, refused.json()["code"]), (400, "hired_sword_cap_reached"))
        self.assertEqual((first.status_code, first.data["warnings"]), (201, []))
        self.assertEqual((again.status_code, [warning["code"] for warning in again.data["warnings"]]), (201, ["dramatis_persona_already_hired"]))  # fmt: skip
        self.assertEqual(Hireling.objects.filter(warband=self.warband, kind="dramatis_persona").count(), 2)

    def test_an_archived_or_removed_entry_is_hired_with_a_warning(self):
        CatalogueRemoval.objects.create(campaign=self.campaign, kind="hired_swords", entry_id=self.ogre.id)

        response = self.hire()

        self.assertEqual((response.status_code, [warning["code"] for warning in response.data["warnings"]]), (201, ["archived_entry"]))  # fmt: skip

    def test_another_campaigns_entry_or_an_unknown_one_is_not_found_and_a_bad_body_is_a_400(self):
        elsewhere = Campaign.objects.create(name="Elsewhere", join_code="ELSE99")
        theirs = HiredSword.objects.create(name="Their Ogre", campaign=elsewhere, **STATS)

        self.assertEqual(self.hire(entry_id=theirs.id).status_code, 404)
        self.assertEqual(self.hire(entry_id=999999).status_code, 404)
        bad = self.hire(source="bestiary")
        self.assertEqual(
            (bad.status_code, bad.json()["code"], list(bad.json()["fields"])), (400, "invalid", ["source"])
        )
        self.assertFalse(Hireling.objects.filter(warband=self.warband).exists())

    def test_only_those_who_may_edit_the_warband_hire(self):
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.hire().status_code, 403)
        self.client.force_authenticate(user=self.manager)
        self.assertEqual(self.hire().status_code, 201)

    def test_a_hire_costs_the_same_queries_whatever_the_kit(self):
        def count() -> int:
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.hire().status_code, 201)
            return len(captured)

        small = count()
        for index in range(5):
            self.ogre.item_links.create(item=Item.objects.create(name=f"Gear {index}", type="Melee"), quantity=3)
            self.ogre.skill_links.create(skill=Skill.objects.create(name=f"Trick {index}", type="Combat"))

        self.assertEqual(count(), small)
        # the warband and membership; the entry and its four kinds of link; the race, skills and specials mapped to
        # the campaign's current entries (one query each); the savepoint pair, the warband locked and the cap
        # counted; the trait specials, the unit and its skills and specials (the shared create path reads each
        # list's entries before its INSERT); the log, the ledger row and the gold; the kit's items mapped and its
        # rows written; then the detail (the unit, its items and their three prefetches). A dramatis persona adds
        # its one-of-each check.
        self.assertEqual(small, 30)


class HireKitBoundTests(HireTestCase):
    def test_a_kit_line_over_the_bound_hires_at_most_the_bound(self):
        # a row written before the bound (or by hand) can't flood the warband with item rows
        self.ogre.item_links.filter(item=self.axe).update(quantity=10_000)

        body = self.hire().data

        self.assertEqual(sum(1 for item in body["items"] if item["id"] == self.axe.id), MAX_KIT_QUANTITY)
