"""overrides.json "single_use_items": the items a battle uses up (William, 26 Nov 2026)."""

import json

from django.test import SimpleTestCase

from catalogue_import.single_use import set_single_use
from catalogue_import.sources import OUT

NOT_SURE = ("Bolas", "Wyrdstone Pendulum", "Lucky Charm")  # William: "none of the not sure items"


class SetSingleUseTests(SimpleTestCase):
    def test_every_variant_of_a_listed_item_is_marked_and_the_rest_are_left_alone(self) -> None:
        items = [{"name": "Garlic"}, {"name": "Garlic", "variant": "Bulb"}, {"name": "Sword"}]

        set_single_use(items, ["Garlic"])

        self.assertEqual([item.get("single_use") for item in items], [True, True, None])

    def test_a_name_that_is_no_item_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "no item Garlik"):
            set_single_use([{"name": "Garlic"}], ["Garlik"])


class ImportOutputTests(SimpleTestCase):
    def test_the_import_marks_williams_list_and_none_of_the_not_sure_items(self) -> None:
        overrides = json.loads((OUT.parent / "overrides.json").read_text())
        items = json.loads((OUT / "items.json").read_text())
        marked = {item["name"] for item in items if item.get("single_use")}

        self.assertLessEqual(set(overrides["single_use_items"]), marked)
        self.assertEqual(len(overrides["single_use_items"]), 30)
        self.assertFalse(marked & set(NOT_SURE))
