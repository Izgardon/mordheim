from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.items import ItemLog, mordheimer_items
from catalogue_import.mim import MimReader
from catalogue_import.pipeline import add_notes, build, same_name_clusters, seed_changes
from catalogue_import.sources import OUT
from catalogue_import.tests.world import world
from catalogue_import.warbands import Resolver


class BuildTests(SimpleTestCase):
    first: ClassVar[dict[str, str]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.first = build()

    def test_two_runs_write_the_same_bytes(self) -> None:
        self.assertEqual(build(), self.first)

    def test_the_committed_files_are_up_to_date(self) -> None:
        for name, content in self.first.items():
            with self.subTest(name=name):
                written = (OUT / name).read_text(encoding="utf-8").replace("\r\n", "\n")
                self.assertEqual(written, content, f"out/{name} is stale: run build.py")

    def test_same_names_match_across_case_punctuation_and_slashes(self) -> None:
        items = [{"name": "Wolfcloak"}, {"name": "Wolf Cloak/Norse Furs"}, {"name": "Sword"}]
        self.assertEqual(same_name_clusters(items), [[0, 1]])

    def test_a_whole_name_is_not_split_at_its_slash(self) -> None:
        items = [{"name": "Crossbow"}, {"name": "Harpoon Gun/Crossbow"}]
        self.assertEqual(same_name_clusters(items), [[0, 1]])
        self.assertEqual(same_name_clusters(items, ["Harpoon Gun/Crossbow"]), [])

    def test_dropped_items_are_left_out_and_logged_apart_from_the_seed_list(self) -> None:
        _types, _resolver, _groups, ctx = world()
        source = [{"name": name, "availability": 8, "cost": {"cost": 5}} for name in ("Sword", "Swivel Gun")]
        log = ItemLog()
        items = mordheimer_items(source, [], ["Swivel Gun"], {}, ctx, log)
        self.assertEqual([item["name"] for item in items], ["Sword"])
        self.assertEqual(log.dropped, ["Swivel Gun"])
        self.assertEqual(seed_changes(["Sword", "Swivel Gun", "Ladders"], items, log.dropped), ([], ["Ladders"]))

    def test_a_mim_restriction_follows_a_warband_alias_and_item_notes_are_added(self) -> None:
        types, _resolver, groups, _ctx = world()
        reader = MimReader(Resolver(types, {"Stromfels Reavers": ["skaven"]}), groups)
        self.assertEqual(reader.warbands("Stromfels Reavers only"), [{"type": "skaven", "excluded": False}])
        items: list[dict[str, Any]] = [{"name": "Heart", "availabilities": [{"note": ""}, {"note": "Rare 10"}]}]
        add_notes(items, {"Heart": "Priest only"})
        self.assertEqual([row["note"] for row in items[0]["availabilities"]], ["Priest only", "Rare 10; Priest only"])
