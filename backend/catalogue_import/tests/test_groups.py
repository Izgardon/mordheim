from types import SimpleNamespace

from django.test import SimpleTestCase

from catalogue_import.groups import build_groups, collapse
from catalogue_import.tests.world import warband, world
from catalogue_import.warbands import Resolver, build_warband_types, extra_rows

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
        groups, _questions, _settled = build_groups(types, sources(), resolver)
        humans = next(group for group in groups if group["slug"] == "humans")
        self.assertEqual(humans["members"], ["witch-hunters", "sisters-of-sigmar", "reiklanders"])

    def test_sides_take_the_types_most_lists_name_and_ask_about_the_rest(self) -> None:
        types, resolver, _groups, _ctx = world()
        groups, questions, _settled = build_groups(types, sources(), resolver)
        good = next(group for group in groups if group["slug"] == "good")
        self.assertEqual(good["members"], ["reiklanders"])
        self.assertTrue(any("Witch Hunters (1/3)" in q and "Lizardmen (1/3)" in q for q in questions["good"]))

    def test_overrides_add_and_remove_members(self) -> None:
        types, resolver, _groups, _ctx = world()
        change = {"add": {"good": ["lizardmen"]}, "remove": {"humans": ["reiklanders"]}}
        groups, _questions, _settled = build_groups(types, sources(group_members=change), resolver)
        by_slug = {group["slug"]: group["members"] for group in groups}
        self.assertEqual(by_slug["good"], ["lizardmen", "reiklanders"])
        self.assertNotIn("reiklanders", by_slug["humans"])

    def test_overrides_settle_questions_and_keep_types_where_they_are(self) -> None:
        types, resolver, _groups, _ctx = world()
        change = {
            "add": {"good": ["lizardmen"]},
            "keep_out": {"good": ["witch-hunters"], "humans": ["sisters-of-sigmar"]},
            "keep_in": {"humans": ["reiklanders"], "nobody": ["skaven"]},
        }
        groups, questions, settled = build_groups(types, sources(group_members=change), resolver)
        by_slug = {group["slug"]: group for group in groups}
        self.assertEqual(questions["good"], [])
        self.assertEqual(settled["good"], {"add": ["lizardmen"], "keep_out": ["witch-hunters"]})
        self.assertEqual(settled["humans"], {"keep_in": ["reiklanders"], "keep_out": ["sisters-of-sigmar"]})
        self.assertEqual(by_slug["good"]["members"], ["lizardmen", "reiklanders"])
        self.assertEqual(by_slug["humans"]["members"], ["witch-hunters", "reiklanders"])
        self.assertTrue(by_slug["humans"]["basis"].endswith("adjusted in overrides.json"))
        self.assertFalse(by_slug["skaven"]["basis"].endswith("adjusted in overrides.json"))


class ResolverTests(SimpleTestCase):
    def test_extra_types_from_overrides_resolve_by_name(self) -> None:
        extra = [{"name": "Albion Commandos", "race": "Human", "setting": "mutiny-in-marienburg"}]
        types = build_warband_types([warband("Skaven", "Skaven"), *extra_rows(extra)])
        commandos = types[1]
        self.assertEqual(
            (commandos["slug"], commandos["setting"], commandos["setting_assumed"]),
            ("albion-commandos", "mutiny-in-marienburg", False),
        )
        self.assertEqual((commandos["link_url"], commandos["broheim_grade"]), ("", None))
        self.assertEqual(Resolver(types).resolve("Albion Commandos", "items"), ["albion-commandos"])

    def test_shared_names_get_their_source_code_and_odd_names_are_logged(self) -> None:
        rows = [warband("Night Goblins", "Night Goblin", "MIC"), warband("Night Goblins", "Night Goblin", "WEB")]
        types = build_warband_types(rows)
        self.assertEqual([row["slug"] for row in types], ["night-goblins-mic", "night-goblins-web"])
        resolver = Resolver(types)
        self.assertEqual(resolver.resolve("Night Goblins (web)", "items"), ["night-goblins-web"])
        self.assertEqual(resolver.resolve("Nobody Knows", "items"), [])
        self.assertEqual(set(resolver.uses), {"Night Goblins (web)", "Nobody Knows"})

    def test_an_override_keeping_the_built_mapping_reads_as_settled(self) -> None:
        rows = [warband("Night Goblins", "Night Goblin", "MIC"), warband("Night Goblins", "Night Goblin", "WEB")]
        types = build_warband_types([*rows, warband("Skaven", "Skaven")])
        resolver = Resolver(types, {"Night Goblins": ["night-goblins-mic"], "Night Goblins web": ["skaven"]})
        self.assertEqual(resolver.resolve("Night Goblins", "items"), ["night-goblins-mic"])
        resolver.resolve("Night Goblins web", "items")
        self.assertTrue(resolver.uses["Night Goblins"].how.startswith("settled in overrides.json: two types share"))
        self.assertEqual(resolver.uses["Night Goblins web"].how, "overrides.json")
