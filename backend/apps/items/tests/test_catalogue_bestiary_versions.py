"""Bestiary entries and hired swords edit, revert, archive and restore by the catalogue's rules (pass 5 PR C;
decision 6, CAT-NEW-01).

A hired sword's version is a copied entry with a copied profile: it keeps its grade, race, costs, restrictions and
links (links to entries the campaign has versions of point at those), whether it is edited through
`hired-swords/` or through its entry in `bestiary/`. Revert takes both; removing it hides it from both lists.
"""

from typing import Any

from apps.bestiary.models import BestiaryEntry, BestiaryEntrySkill, HiredSwordProfile, HiredSwordProfileRestriction

from .catalogue_support import BESTIARY, HIRED_SWORDS, SKILLS, CatalogueKind, CatalogueTestCase, make_entry


class HiredSwordVersionTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        HiredSwordProfile.objects.filter(id=self.ogre.id).update(grade="1a", race="Ogre", upkeep_cost=15)
        HiredSwordProfileRestriction.objects.create(hired_sword_profile=self.ogre, restriction=self.mercenaries)
        BestiaryEntrySkill.objects.create(bestiary_entry=self.ogre.bestiary_entry, skill=self.infiltration[0])
        BestiaryEntrySkill.objects.create(bestiary_entry=self.ogre.bestiary_entry, skill=self.infiltration[1])
        self.sneak = make_entry(SKILLS, "Sneak", campaign=self.campaign, type="Dark Elf", replaces=self.infiltration[0])

    def edit(self, kind: CatalogueKind, entry_id: int, body: dict[str, Any]) -> dict[str, Any]:
        response = self.patch_as(self.player, kind.detail_url(entry_id), {"campaign_id": self.campaign.id, **body})
        self.assertEqual(response.status_code, 200, response.data)
        return dict(response.json())

    def test_a_hired_swords_version_keeps_its_grade_race_restrictions_and_links(self):
        body = self.edit(HIRED_SWORDS, self.ogre.id, {"hire_cost": 95})

        version = HiredSwordProfile.objects.get(id=body["id"])
        self.assertEqual((version.grade, version.race, version.hire_cost, version.upkeep_cost), ("1a", "Ogre", 95, 15))
        self.assertEqual(
            list(version.restriction_links.values_list("restriction_id", flat=True)), [self.mercenaries.id]
        )
        skills = set(version.bestiary_entry.bestiary_entry_skills.values_list("skill_id", flat=True))
        self.assertEqual(skills, {self.sneak.id, self.infiltration[1].id})  # the campaign's version of a linked skill
        self.assertEqual(version.bestiary_entry.replaces_id, self.ogre.bestiary_entry_id)
        listed = [row["id"] for row in self.get_as(self.player, HIRED_SWORDS.list_url(self.campaign)).json()]
        self.assertEqual((version.id in listed, self.ogre.id in listed), (True, False))

    def test_editing_its_entry_through_the_bestiary_makes_the_same_version(self):
        entry = self.edit(BESTIARY, self.ogre.bestiary_entry_id, {"description": "Hungry."})
        again = self.edit(HIRED_SWORDS, self.ogre.id, {"hire_cost": 90})

        version = BestiaryEntry.objects.get(id=entry["id"])
        self.assertEqual((again["id"], again["hire_cost"]), (version.hired_sword_profile.id, 90))
        self.assertEqual(version.hired_sword_profile.grade, "1a")
        self.assertEqual(BestiaryEntry.objects.filter(replaces=self.ogre.bestiary_entry).count(), 1)

    def test_reverting_through_either_route_takes_the_entry_and_its_profile(self):
        for kind in (BESTIARY, HIRED_SWORDS):
            with self.subTest(route=kind.key):
                body = self.edit(HIRED_SWORDS, self.ogre.id, {"hire_cost": 95})
                version = HiredSwordProfile.objects.get(id=body["id"])
                target = version.bestiary_entry_id if kind is BESTIARY else version.id

                reverted = self.post_as(self.player, f"{kind.detail_url(target)}revert/")

                self.assertEqual(reverted.status_code, 200, reverted.data)
                self.assertFalse(HiredSwordProfile.objects.filter(id=version.id).exists())
                self.assertFalse(BestiaryEntry.objects.filter(id=version.bestiary_entry_id).exists())

    def test_a_removed_hired_sword_restores_to_both_lists(self):
        url = f"{HIRED_SWORDS.detail_url(self.ogre.id)}?campaign_id={self.campaign.id}"
        self.assertEqual(self.delete_as(self.owner, url).json()["outcome"], "removed")

        restored = self.post_as(self.player, f"{BESTIARY.detail_url(self.ogre.bestiary_entry_id)}restore/", {"campaign_id": self.campaign.id})  # fmt: skip

        self.assertEqual(restored.status_code, 200)
        self.assertIn(self.ogre.id, [row["id"] for row in self.get_as(self.player, HIRED_SWORDS.list_url(self.campaign)).json()])  # fmt: skip
        self.assertIn(self.ogre.bestiary_entry_id, [row["id"] for row in self.get_as(self.player, BESTIARY.list_url(self.campaign)).json()])  # fmt: skip
