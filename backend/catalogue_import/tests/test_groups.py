from types import SimpleNamespace

from django.test import SimpleTestCase

from catalogue_import.groups import build_groups, collapse
from catalogue_import.tests.world import warband, world
from catalogue_import.warbands import Resolver, build_warband_types

GROUPS = [
    {"slug": "solo", "members": ["skaven"]},
    {"slug": "sigmarite", "members": ["witch-hunters", "sisters-of-sigmar"]},
]
HIRED = [
    {
        "name": "Priest",
        "permissiontext": "Any good aligned warband may hire him.",
        "permittedWarbands": ["Reiklanders", "Witch Hunters"],
    },
    {"name": "Bard", "permissiontext": "Any good warband.", "permittedWarbands": ["Reiklanders", "Lizardmen"]},
    {"name": "Knight", "permissiontext": "Any non-evil warband.", "permittedWarbands": ["Reiklanders"]},
]


def sources(**overrides: object) -> SimpleNamespace:
    return SimpleNamespace(hired_swords=HIRED, personae=[], items=[], overrides=overrides)


class CollapseTests(SimpleTestCase):
    def test_a_list_equal_to_a_group_becomes_the_group(self) -> None:
        self.assertEqual(collapse(["sisters-of-sigmar", "witch-hunters"], GROUPS), [{"group": "sigmarite"}])

    def test_a_subset_or_superset_stays_as_types(self) -> None:
        self.assertEqual(collapse(["witch-hunters"], GROUPS), [{"type": "witch-hunters"}])
        self.assertEqual(
            collapse(["witch-hunters", "sisters-of-sigmar", "skaven"], GROUPS),
            [{"type": "witch-hunters"}, {"type": "sisters-of-sigmar"}, {"type": "skaven"}],
        )

    def test_a_one_type_group_is_never_used(self) -> None:
        self.assertEqual(collapse(["skaven"], GROUPS), [{"type": "skaven"}])


class BuildGroupTests(SimpleTestCase):
    def test_races_come_from_the_race_field(self) -> None:
        types, resolver, _groups, _ctx = world()
        groups, _questions = build_groups(types, sources(), resolver)
        humans = next(group for group in groups if group["slug"] == "humans")
        self.assertEqual(humans["members"], ["witch-hunters", "sisters-of-sigmar", "reiklanders"])

    def test_sides_take_the_types_most_lists_name_and_ask_about_the_rest(self) -> None:
        types, resolver, _groups, _ctx = world()
        groups, questions = build_groups(types, sources(), resolver)
        good = next(group for group in groups if group["slug"] == "good")
        self.assertEqual(good["members"], ["reiklanders"])
        self.assertTrue(any("Witch Hunters (1/3)" in q and "Lizardmen (1/3)" in q for q in questions["good"]))

    def test_overrides_add_and_remove_members(self) -> None:
        types, resolver, _groups, _ctx = world()
        change = {"add": {"good": ["lizardmen"]}, "remove": {"humans": ["reiklanders"]}}
        groups, _questions = build_groups(types, sources(group_members=change), resolver)
        by_slug = {group["slug"]: group["members"] for group in groups}
        self.assertEqual(by_slug["good"], ["lizardmen", "reiklanders"])
        self.assertNotIn("reiklanders", by_slug["humans"])


class ResolverTests(SimpleTestCase):
    def test_shared_names_get_their_source_code_and_odd_names_are_logged(self) -> None:
        rows = [warband("Night Goblins", "Night Goblin", "MIC"), warband("Night Goblins", "Night Goblin", "WEB")]
        types = build_warband_types(rows)
        self.assertEqual([row["slug"] for row in types], ["night-goblins-mic", "night-goblins-web"])
        resolver = Resolver(types)
        self.assertEqual(resolver.resolve("Night Goblins (web)", "items"), ["night-goblins-web"])
        self.assertEqual(resolver.resolve("Nobody Knows", "items"), [])
        self.assertEqual(set(resolver.uses), {"Night Goblins (web)", "Nobody Knows"})
