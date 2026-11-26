"""overrides.json "item_splits": Club, Mace or Hammer as three items, and every warband list selling one of them
(William, 26 Nov 2026)."""

import json
from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.item_splits import as_printed, choose_items, printed_items, read_splits, split_rows
from catalogue_import.sources import OUT

ORIGINAL = "Club, Mace or Hammer"
NEW = ("Club", "Mace", "Hammer")


def _item(name: str, **fields: Any) -> dict[str, Any]:
    return {"name": name, "variant": "", "slug": "", "tags": [], "availabilities": [{"cost": 3}], **fields}


def _decision(**fields: Any) -> dict[str, Any]:
    return {
        ORIGINAL: {
            "items": {"Club": {"tags": ["club"]}, "Mace": {"tags": ["mace"]}, "Hammer": {"tags": ["hammer"]}},
            "default": "Mace",
            "templates": {"dwarfs": {"item": "Hammer", "why": "Dwarfs"}},
            "why": "William",
            **fields,
        }
    }


def _line(shown_as: str, cost: int = 3, name: str = ORIGINAL, **fields: Any) -> dict[str, Any]:
    return {"item": {"name": name, "variant": ""}, "shown_as": shown_as, "cost": cost, "cost_note": "", "who": {}, **fields}  # fmt: skip


def _template(slug: str, *lines: dict[str, Any]) -> dict[str, Any]:
    return {"slug": slug, "name": slug.title(), "lists": [{"key": "list", "lines": list(lines)}]}


class SplitItemsTests(SimpleTestCase):
    def test_each_new_item_is_the_original_under_its_own_name_and_tags_where_it_stood(self) -> None:
        rows = [_item("Axe"), _item(ORIGINAL, tags=["club", "mace", "hammer"], rules=[{"rule": "concussion"}])]
        splits = read_splits(rows, _decision())

        split = split_rows(rows, splits)

        self.assertEqual([row["name"] for row in split], ["Axe", *NEW])
        for row in split[1:]:
            with self.subTest(item=row["name"]):
                self.assertEqual((row["rules"], row["availabilities"]), ([{"rule": "concussion"}], [{"cost": 3}]))
                self.assertEqual(row["tags"], [row["name"].lower()])
        split[1]["availabilities"][0]["cost"] = 9  # a copy, not the original's rows
        self.assertEqual(split[2]["availabilities"], [{"cost": 3}])
        self.assertEqual([row["name"] for row in as_printed(split, splits)], ["Axe", ORIGINAL])

    def test_the_published_items_read_back_as_the_books_print_them_for_the_pdf_check(self) -> None:
        rows = [
            _item("Axe"),
            _item("Club", tags=["club"]),
            _item("Mace", tags=["mace"]),
            _item("Hammer", tags=["hammer"]),
        ]

        printed = printed_items(rows, _decision())

        self.assertEqual(
            [(row["name"], row["slug"]) for row in printed], [("Axe", ""), (ORIGINAL, "club-mace-or-hammer")]
        )
        self.assertEqual(printed[1]["tags"], ["club", "mace", "hammer"])

    def test_a_name_that_is_no_item_a_name_taken_or_a_choice_it_does_not_make_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "0 items named 'Club, Mace or Hammer'"):
            read_splits([_item("Axe")], _decision())
        with self.assertRaisesMessage(ValueError, "already an item Club"):
            read_splits([_item(ORIGINAL), _item("Club")], _decision())
        with self.assertRaisesMessage(ValueError, "chooses Flail"):
            read_splits([_item(ORIGINAL)], _decision(default="Flail"))

    def test_a_template_it_names_must_exist_and_sell_the_original(self) -> None:
        splits = read_splits([_item(ORIGINAL)], _decision())
        with self.assertRaisesMessage(ValueError, "no template dwarfs"):
            choose_items([_template("orcs", _line("Club"))], splits)
        with self.assertRaisesMessage(ValueError, "dwarfs sells no Club, Mace or Hammer"):
            choose_items([_template("dwarfs", _line("Axe", name="Axe"))], splits)


class ChooseItemsTests(SimpleTestCase):
    def _chosen(self, slug: str, *lines: dict[str, Any]) -> list[tuple[str, str, int]]:
        template = _template(slug, *lines)
        dwarfs = {"dwarfs": {"item": "Hammer", "why": "Dwarfs"}} if slug == "dwarfs" else {}
        choose_items([template], read_splits([_item(ORIGINAL)], _decision(templates=dwarfs)))
        return [(line["item"]["name"], line["shown_as"], line["cost"]) for line in template["lists"][0]["lines"]]

    def test_every_line_sells_the_one_choice_and_a_name_of_a_split_item_goes(self) -> None:
        lines = (_line("Hammer/Mace"), _line("Mace or hammer"), _line(""), _line("Axe", 5, name="Axe"))
        self.assertEqual(self._chosen("dwarfs", *lines), [("Hammer", "", 3), ("Axe", "Axe", 5)])

    def test_a_name_that_names_no_split_item_stays(self) -> None:
        self.assertEqual(self._chosen("mages", _line("Staff")), [("Mace", "Staff", 3)])
        self.assertEqual(self._chosen("mages", _line("Mace/Staff"), _line("Quarterstaff")), [("Mace", "", 3), ("Mace", "Quarterstaff", 3)])  # fmt: skip

    def test_two_lines_left_the_same_keep_the_one_printed_under_the_chosen_name_where_it_stood(self) -> None:
        # the Strigoi print Mace at 3 gc and Hammer at 5: a Mace list keeps the 3 gc line
        self.assertEqual(self._chosen("strigoi", _line("Hammer", 5), _line("Mace", 3)), [("Mace", "", 3)])
        self.assertEqual(self._chosen("dwarfs", _line("Hammer", 5), _line("Mace", 3)), [("Hammer", "", 5)])

    def test_lines_for_different_fighters_stay_apart(self) -> None:
        lines = (_line("Mace"), _line("Hammer", who={"heroes": True}))
        self.assertEqual(len(self._chosen("mercenaries", *lines)), 2)


class ImportOutputTests(SimpleTestCase):
    items: ClassVar[dict[str, dict[str, Any]]]
    templates: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.items = {item["name"]: item for item in json.loads((OUT / "items.json").read_text())}
        cls.templates = {row["slug"]: row for row in json.loads((OUT / "warband-templates.json").read_text())}

    def _sold(self, slug: str) -> set[str]:
        return {
            line["item"]["name"]
            for entry in self.templates[slug]["lists"]
            for line in entry["lines"]
            if line["item"]["name"] in NEW
        }

    def test_the_original_is_gone_and_three_items_share_its_price_and_rule(self) -> None:
        self.assertNotIn(ORIGINAL, self.items)
        for name in NEW:
            with self.subTest(item=name):
                item = self.items[name]
                self.assertEqual([rule["rule"] for rule in item["rules"]], ["concussion"])
                [row] = item["availabilities"]
                self.assertEqual((row["cost"], row["rarity"], row["for_everyone"]), (3, None, True))
                self.assertEqual((item["type"], item["subtype"], item["setting"]), ("Weapon", "Melee", "mordheim"))

    def test_each_warband_list_sells_one_of_the_three(self) -> None:
        self.assertNotIn(ORIGINAL, json.dumps(list(self.templates.values())))
        sold = {slug: self._sold(slug) for slug in self.templates}
        self.assertEqual(sum(1 for items in sold.values() if items), 134)
        self.assertEqual([slug for slug, items in sold.items() if len(items) > 1], [])
        for slug, item in (("orc-mob", "Club"), ("dwarf-treasure-hunters", "Hammer"), ("mercenaries", "Mace")):
            with self.subTest(template=slug):
                self.assertEqual(sold[slug], {item})
