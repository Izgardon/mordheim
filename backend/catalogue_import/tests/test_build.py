import json
from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.items import ItemLog, mordheimer_items
from catalogue_import.mim import MimReader
from catalogue_import.pipeline import ItemDecisions, add_notes, build, same_name_clusters, seed_changes
from catalogue_import.rules import reword_shared, word_item_rules
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

    def test_item_decisions_name_real_items_and_types(self) -> None:
        types, _resolver, _groups, _ctx = world()
        items = [{"name": "Tome of Magic"}]
        good = {"item_exclusions": {"Tome of Magic": {"warbands": ["witch-hunters"], "why": "its note"}}}
        self.assertEqual(
            ItemDecisions(good, types, items).warbands("item_exclusions"),
            {"Tome of Magic": (["witch-hunters"], "its note")},
        )
        kept = ItemDecisions({"item_defaults_kept": {"Tome of Magic": "kept"}}, types, items)
        self.assertEqual(kept.kept("item_defaults_kept"), {"Tome of Magic": "kept"})
        no_type = {"item_warbands_add": {"Tome of Magic": {"warbands": ["witch-hunter"], "why": ""}}}
        with self.assertRaisesRegex(ValueError, "no warband type witch-hunter"):
            ItemDecisions(no_type, types, items).warbands("item_warbands_add")
        with self.assertRaisesRegex(ValueError, "no mordheimer item 'Tome'"):
            ItemDecisions({"item_defaults_kept": {"Tome": "kept"}}, types, items).kept("item_defaults_kept")

    def test_a_mim_restriction_follows_a_warband_alias_and_item_notes_are_added(self) -> None:
        types, _resolver, groups, _ctx = world()
        reader = MimReader(Resolver(types, {"Stromfels Reavers": ["skaven"]}), groups)
        self.assertEqual(reader.warbands("Stromfels Reavers only"), [{"type": "skaven", "excluded": False}])
        items: list[dict[str, Any]] = [{"name": "Heart", "availabilities": [{"note": ""}, {"note": "Rare 10"}]}]
        add_notes(items, {"Heart": "Priest only"})
        self.assertEqual([row["note"] for row in items[0]["availabilities"]], ["Priest only", "Rare 10; Priest only"])

    def test_a_shared_rule_takes_williams_wording_and_its_items_keep_only_their_own(self) -> None:
        # William, 11 Nov 2026: "people always get the +1 save from having a shield for 2 handed weapons, its not
        # specific to either and really should be mentioned within the 2-handed rule for every weapon that uses
        # that rule"
        shared = [{"slug": "two-handed", "summary": "Two hands", "text": "Requires two hands to wield"}]
        wordings: dict[str, Any] = {
            "two-handed": {"summary": "Both hands", "text": "No shield in close combat; +1 shooting save."}
        }
        reword_shared(shared, wordings)
        self.assertEqual((shared[0]["summary"], shared[0]["text"]), ("Both hands", wordings["two-handed"]["text"]))
        with self.assertRaisesRegex(ValueError, "no shared item rule 'parry'"):
            reword_shared(shared, {"parry": {"text": "Parries"}})
        items: list[dict[str, Any]] = [
            {"name": "Halberd", "rules": [{"rule": "two-handed", "text": "Its own wording."}]},
            {"name": "Boat Hook", "rules": [{"rule": "two-handed", "summary": "Drop", "text": "Its own wording."}]},
        ]
        wordings["two-handed"]["covers"] = ["Halberd"]
        wordings["two-handed"]["items"] = {"Boat Hook": {"text": "No other weapon at all."}}
        word_item_rules(items, wordings)
        self.assertEqual(items[0]["rules"], [{"rule": "two-handed"}])
        self.assertEqual(items[1]["rules"], [{"rule": "two-handed", "text": "No other weapon at all."}])
        with self.assertRaisesRegex(ValueError, "no item holds it: Flail"):
            word_item_rules(items, {"two-handed": {"covers": ["Flail"]}})

    def test_every_two_handed_weapon_gets_the_shields_shooting_save(self) -> None:
        rules = {row["slug"]: row for row in json.loads(self.first["item-rules.json"])}
        self.assertIn("+1 armour save bonus against shooting", rules["two-handed"]["text"])
        items = json.loads(self.first["items.json"])
        own = {
            item["name"]: rule
            for item in items
            for rule in item["rules"]
            if rule.get("rule") == "two-handed" and len(rule) > 1
        }
        # only the Boat Hook, which is stricter: no other weapon at all
        self.assertEqual(list(own), ["Boat Hook"])
        self.assertEqual(own["Boat Hook"]["text"], "A model using a Boat Hook may use no other weapon at all in close combat.")  # fmt: skip


class TemplateItemsBuildTests(SimpleTestCase):
    """What the warband templates change in the items and the hiring lists (William, 4 Nov 2026)."""

    items: ClassVar[dict[str, dict[str, Any]]]
    who_can: ClassVar[dict[str, Any]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        built = build()
        cls.items = {item["name"]: item for item in json.loads(built["items.json"])}
        cls.who_can = json.loads(built["who-can.json"])

    def test_the_swivel_gun_is_back_for_pirates_and_its_shots_are_single_use(self) -> None:
        [row] = self.items["Swivel Gun"]["availabilities"]
        self.assertEqual(
            ([line["type"] for line in row["warbands"]], row["note"]),
            (
                ["pirates"],
                "Gunners only; max one per warband",
            ),
        )
        shots = [name for name, item in self.items.items() if item.get("single_use")]
        self.assertEqual(
            sorted(shots), ["Swivel Gun - Ball Shot", "Swivel Gun - Chain Shot", "Swivel Gun - Grape Shot"]
        )

    def test_the_cavalcade_joins_the_nightmares_row_and_gets_its_own_misericordia(self) -> None:
        [row] = self.items["Nightmare"]["availabilities"]
        self.assertIn({"type": "cursed-cavalcade", "excluded": False}, row["warbands"])
        self.assertTrue(row["note"].endswith("Cursed Cavalcade: the Aristocrat only"))
        [dagger] = self.items["Misericordia (Cursed Cavalcade)"]["availabilities"]
        self.assertEqual((dagger["cost"], dagger["rarity"]), (5, 9))
        self.assertEqual(self.items["Misericordia"]["availabilities"][0]["cost"], 10)  # Lustrian Reavers' stays

    def test_merchant_caravans_hire_the_four_mercenaries_hire_that_they_missed(self) -> None:
        swords = {row["name"]: row for row in self.who_can["hired_swords"]}
        for name in ("Witch Hunter", "Halfling Knight", "Imperial Tactician", "Knight of the White Wolf"):
            with self.subTest(name=name):
                self.assertIn({"type": "merchant-caravans", "excluded": False}, swords[name]["warbands"])
