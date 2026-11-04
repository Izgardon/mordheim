"""Skill groups (phase 1a): the groups list and detail (order, who learns, skills as the campaign's current entries,
query budgets), a group's writes and versions, a skill's groups written through the skill, and the name a unit's
skill access stores (skills/access.py)."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.items.tests.catalogue_support import SKILL_GROUPS, SKILLS, CatalogueTestCase, make_entry
from apps.skills.access import access_names, came_through, current_groups, unit_groups
from apps.skills.models import Skill, SkillGroup, SkillGroupSkill
from apps.warbands.models import WarbandType


def holding(group: SkillGroup, *skills: Skill) -> SkillGroup:
    SkillGroupSkill.objects.bulk_create([SkillGroupSkill(group=group, skill=skill) for skill in skills])
    return group


class SkillGroupTestCase(CatalogueTestCase):
    """The book's Combat (catalogue_support) holds Sprint; a book Speed group holds Sprint and Dodge, and a special
    group Skaven names its warband type."""

    sprint: Skill
    dodge: Skill
    speed: SkillGroup
    skaven: SkillGroup
    skaven_type: WarbandType

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.sprint = Skill.objects.get(name="Sprint", campaign__isnull=True)
        cls.dodge = Skill.objects.create(name="Dodge")
        holding(cls.combat, cls.sprint)
        cls.speed = holding(SkillGroup.objects.create(name="Speed"), cls.sprint, cls.dodge)
        cls.skaven_type = WarbandType.objects.create(name="Skaven", slug="skaven")
        cls.skaven = holding(SkillGroup.objects.create(name="Skaven", for_everyone=False), cls.infiltration[2])
        cls.skaven.warband_links.create(warband_type=cls.skaven_type)

    def rows(self, campaign: Any = None) -> dict[str, dict[str, Any]]:
        response = self.get_as(self.player, SKILL_GROUPS.list_url(campaign or self.campaign))
        self.assertEqual(response.status_code, 200, response.data)
        return {row["name"]: row for row in response.json()}


class SkillGroupReadTests(SkillGroupTestCase):
    def test_the_list_puts_the_core_groups_first_then_the_rest_by_name(self):
        make_entry(SKILL_GROUPS, "Animal")
        make_entry(SKILL_GROUPS, "Amazons", campaign=self.campaign)

        self.assertEqual(list(self.rows()), ["Combat", "Speed", "Amazons", "Animal", "Skaven"])

    def test_a_group_says_who_learns_from_it_and_its_skills_as_the_campaigns_current_entries(self):
        version = Skill.objects.create(name="Sprint", campaign=self.campaign, replaces=self.sprint)

        rows = self.rows()

        self.assertEqual(rows["Speed"]["skill_ids"], [self.dodge.id, version.id])  # by name; the version stands in
        self.assertEqual(rows["Combat"]["skill_ids"], [version.id])
        skaven = rows["Skaven"]
        self.assertEqual((skaven["for_everyone"], [line["name"] for line in skaven["warbands"]]), (False, ["Skaven"]))
        self.assertEqual(skaven["access_name"], "Skaven")
        book = self.get_as(self.player, SKILL_GROUPS.list_url()).json()
        self.assertEqual(next(row for row in book if row["name"] == "Speed")["skill_ids"], [self.dodge.id, self.sprint.id])  # fmt: skip

    def test_the_list_and_detail_cost_the_same_whatever_the_groups_and_skills(self):
        def count(url: str) -> int:
            self.client.force_authenticate(user=self.player)
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.client.get(url).status_code, 200)
            return len(captured)

        before = count(SKILL_GROUPS.list_url(self.campaign))
        for index in range(3):
            skills = [Skill.objects.create(name=f"Trick {index}.{n}") for n in range(2)]
            group = holding(make_entry(SKILL_GROUPS, f"Tricks {index}", campaign=self.campaign), *skills)
            group.warband_links.create(warband_type=self.skaven_type)

        self.assertEqual(count(SKILL_GROUPS.list_url(self.campaign)), before)
        self.assertEqual(before, 4)  # the caller's access, the groups, their lines, their skills
        self.assertEqual(count(SKILL_GROUPS.detail_url(self.speed.id)), 3)  # the group, its lines, its skills


class SkillGroupWriteTests(SkillGroupTestCase):
    def test_a_campaign_group_is_created_with_who_learns_and_its_skills(self):
        body = {
            "campaign_id": self.campaign.id,
            "name": "Rat Tricks",
            "for_everyone": False,
            "warbands": [{"warband_type_id": self.skaven_type.id}],
            "large_only": True,
            "learn_note": "Vampire only",
            "skill_ids": [self.dodge.id, self.dodge.id, self.sprint.id],
        }
        made = self.post_as(self.player, SKILL_GROUPS.list_url(), body)

        self.assertEqual(made.status_code, 201, made.data)
        data = made.json()
        self.assertEqual((data["large_only"], data["learn_note"], data["for_everyone"]), (True, "Vampire only", False))
        self.assertEqual(data["skill_ids"], [self.dodge.id, self.sprint.id])
        self.assertEqual([line["warband_type_id"] for line in data["warbands"]], [self.skaven_type.id])
        taken = self.post_as(self.player, SKILL_GROUPS.list_url(), {**body, "name": "combat"})
        self.assertEqual((taken.status_code, taken.json()["code"]), (400, "name_taken"))

    def test_a_book_groups_first_edit_is_the_campaigns_version_with_its_skills_and_lines(self):
        edited = self.patch_as(
            self.player, SKILL_GROUPS.detail_url(self.skaven.id), {"campaign_id": self.campaign.id, "name": "Rats"}
        )

        self.assertEqual(edited.status_code, 200, edited.data)
        version = SkillGroup.objects.get(campaign=self.campaign, replaces=self.skaven)
        self.assertEqual((edited.json()["id"], edited.json()["name"]), (version.id, "Rats"))
        self.assertEqual(edited.json()["access_name"], "Skaven")  # a unit's access still names it by the book's name
        self.assertEqual(edited.json()["skill_ids"], [self.infiltration[2].id])
        self.assertEqual(list(version.warband_links.values_list("warband_type_id", flat=True)), [self.skaven_type.id])
        self.assertEqual(SkillGroup.objects.get(pk=self.skaven.pk).name, "Skaven")
        self.assertNotIn("Skaven", self.rows())  # the version stands in for it
        self.assertIn("Rats", self.rows())

    def test_a_skill_joining_a_book_group_makes_the_campaigns_version_of_the_group(self):
        made = self.post_as(
            self.player,
            SKILLS.list_url(),
            {"campaign_id": self.campaign.id, "name": "Feint", "description": "Fakes.", "group_ids": [self.combat.id]},
        )

        self.assertEqual(made.status_code, 201, made.data)
        feint = made.json()["id"]
        rows = self.rows()
        self.assertEqual(rows["Combat"]["replaces"], self.combat.id)
        self.assertEqual(rows["Combat"]["skill_ids"], [feint, self.sprint.id])
        self.assertFalse(self.combat.skill_links.filter(skill_id=feint).exists())  # the book keeps its own

    def test_a_skills_edit_moves_it_between_groups_and_its_version_stands_in_for_it(self):
        edited = self.patch_as(
            self.player,
            SKILLS.detail_url(self.sprint.id),
            {"campaign_id": self.campaign.id, "description": "Runs.", "group_ids": [self.speed.id, self.skaven.id]},
        )

        self.assertEqual(edited.status_code, 200, edited.data)
        version = edited.json()["id"]
        rows = self.rows()
        self.assertEqual(rows["Combat"]["skill_ids"], [])  # left: the campaign's Combat without it
        self.assertEqual(rows["Speed"]["skill_ids"], [self.dodge.id, version])  # kept: the book's, read through it
        self.assertEqual(rows["Skaven"]["skill_ids"], [self.infiltration[2].id, version])
        self.assertEqual(self.combat.skill_links.count(), 1)  # the book's Combat keeps Sprint

    def test_a_campaign_groups_link_follows_the_skills_version_and_its_revert(self):
        group = holding(make_entry(SKILL_GROUPS, "House", campaign=self.campaign), self.dodge)
        version = self.patch_as(
            self.player, SKILLS.detail_url(self.dodge.id), {"campaign_id": self.campaign.id, "description": "Ducks."}
        ).json()["id"]

        self.assertEqual(list(group.skill_links.values_list("skill_id", flat=True)), [version])
        reverted = self.post_as(self.player, f"{SKILLS.detail_url(version)}revert/")
        self.assertEqual(reverted.status_code, 200, reverted.data)
        self.assertEqual(list(group.skill_links.values_list("skill_id", flat=True)), [self.dodge.id])


class SkillAccessTests(SkillGroupTestCase):
    def test_a_name_stands_for_the_book_group_then_the_campaigns_version_of_it(self):
        version = make_entry(SKILL_GROUPS, "Close Combat", campaign=self.campaign, replaces=self.combat)
        holding(version, self.sprint)
        own = holding(make_entry(SKILL_GROUPS, "House", campaign=self.campaign), self.sprint)

        groups = current_groups(self.campaign.id)

        self.assertEqual(unit_groups(groups, ["combat", "House", "Gone"]), [version, own])
        self.assertEqual(came_through(groups, self.sprint.id, ["House"]), own)  # the first of his holding it
        self.assertEqual(came_through(groups, self.sprint.id, ["Skaven"]), version)  # else its first group
        self.assertIsNone(came_through(groups, self.infiltration[0].id, []))

    def test_an_access_list_is_names_in_either_form(self):
        self.assertEqual(access_names(["Combat", "Skaven"]), ["Combat", "Skaven"])
        self.assertEqual(access_names({"C": True, "Sh": False, "Spc": True, "Skaven": True}), ["Combat", "Skaven"])
        self.assertEqual(access_names(None), [])
