"""Hired swords and dramatis personae edit, revert, archive and restore by the catalogue's rules, as every other kind
does (pass 5 PR C's decisions 1, 2, 5 and 6; the bestiary rewrite step 2).

A book entry's first edit in a campaign makes the campaign's version: a copied row with copied links (links to
entries the campaign has versions of point at those) that keeps its grade, race, costs, formulas, kit quantities and
restrictions, and a dramatis persona's stays and payment note. Revert takes the version and its links; removing a book
entry hides it from the campaign's list until it is restored.
"""

from typing import Any

from apps.hirelings.models import DramatisPersona, HiredSword, HiredSwordSkill
from apps.items.tests.catalogue_support import (
    DRAMATIS_PERSONAE,
    HIRED_SWORDS,
    SKILLS,
    CatalogueKind,
    CatalogueTestCase,
    make_entry,
)


class HirelingVersionTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        HiredSword.objects.filter(id=self.ogre.id).update(
            grade="1a", race=self.human, race_label="Ogre", upkeep_cost=15, hire_cost_expression="80+D6"
        )
        self.ogre.restriction_links.create(restriction=self.mercenaries, additional_note="only")
        self.ogre.skill_links.create(skill=self.infiltration[0])
        self.ogre.skill_links.create(skill=self.infiltration[1])
        self.ogre.item_links.create(item=self.book_sword, quantity=2)
        self.sneak = make_entry(SKILLS, "Sneak", campaign=self.campaign, type="Dark Elf", replaces=self.infiltration[0])

    def edit(self, kind: CatalogueKind, entry_id: int, body: dict[str, Any]) -> dict[str, Any]:
        response = self.patch_as(self.player, kind.detail_url(entry_id), {"campaign_id": self.campaign.id, **body})
        self.assertEqual(response.status_code, 200, response.data)
        return dict(response.json())

    def ids(self, kind: CatalogueKind) -> list[int]:
        return [row["id"] for row in self.get_as(self.player, kind.list_url(self.campaign)).json()]

    def test_a_hired_swords_version_keeps_its_profile_kit_and_restrictions(self):
        body = self.edit(HIRED_SWORDS, self.ogre.id, {"hire_cost": 95})

        version = HiredSword.objects.get(id=body["id"])
        profile = (version.grade, version.race_id, version.race_label, version.hire_cost, version.upkeep_cost)
        self.assertEqual(profile, ("1a", self.human.id, "Ogre", 95, 15))
        self.assertEqual((version.replaces_id, version.hire_cost_expression), (self.ogre.id, "80+D6"))
        self.assertEqual(list(version.restriction_links.values_list("restriction_id", "additional_note")), [(self.mercenaries.id, "only")])  # fmt: skip
        skills = set(version.skill_links.values_list("skill_id", flat=True))
        self.assertEqual(skills, {self.sneak.id, self.infiltration[1].id})  # the campaign's version of a linked skill
        self.assertEqual(list(version.item_links.values_list("item_id", "quantity")), [(self.book_sword.id, 2)])
        self.assertEqual([link.skill_id for link in self.ogre.skill_links.all()], [s.id for s in self.infiltration[:2]])  # fmt: skip
        self.assertEqual((version.id in self.ids(HIRED_SWORDS), self.ogre.id in self.ids(HIRED_SWORDS)), (True, False))  # fmt: skip
        self.assertEqual((body["replaces"], body["book"]["changes"]), (self.ogre.id, {"hire_cost": 80}))

    def test_reverting_a_version_takes_it_and_its_links(self):
        version = self.edit(HIRED_SWORDS, self.ogre.id, {"hire_cost": 95})["id"]

        reverted = self.post_as(self.player, f"{HIRED_SWORDS.detail_url(version)}revert/")

        self.assertEqual((reverted.status_code, reverted.json()["id"]), (200, self.ogre.id))
        self.assertFalse(HiredSword.objects.filter(id=version).exists())
        self.assertFalse(HiredSwordSkill.objects.filter(hired_sword_id=version).exists())
        self.assertIn(self.ogre.id, self.ids(HIRED_SWORDS))

    def test_a_dramatis_personas_version_keeps_how_long_it_stays_and_what_it_is_paid(self):
        DramatisPersona.objects.filter(id=self.aenur.id).update(stays="one_battle", payment_note="25 gc or 1 shard")

        body = self.edit(DRAMATIS_PERSONAE, self.aenur.id, {"description": "A swordmaster."})

        self.assertEqual((body["stays"], body["payment_note"], body["replaces"]), ("one_battle", "25 gc or 1 shard", self.aenur.id))  # fmt: skip
        self.assertEqual(body["book"]["changes"], {"description": ""})
        self.assertNotIn(self.aenur.id, self.ids(DRAMATIS_PERSONAE))

    def test_a_removed_book_entry_leaves_the_campaigns_list_and_restores(self):
        for kind, entry in ((HIRED_SWORDS, self.ogre), (DRAMATIS_PERSONAE, self.aenur)):
            with self.subTest(kind=kind.key):
                url = f"{kind.detail_url(entry.id)}?campaign_id={self.campaign.id}"
                self.assertEqual(self.delete_as(self.owner, url).json()["outcome"], "removed")
                self.assertNotIn(entry.id, self.ids(kind))

                restored = self.post_as(self.player, f"{kind.detail_url(entry.id)}restore/", {"campaign_id": self.campaign.id})  # fmt: skip

                self.assertEqual(restored.status_code, 200)
                self.assertIn(entry.id, self.ids(kind))
