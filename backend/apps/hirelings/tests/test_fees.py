"""Structured hire fees and upkeep (the fees and skill lists step): their shape, the gold they charge and the
warband counters that pay their resources."""

from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.hirelings.fees import clean_fee, fee_payload, fee_text, gold_due, make_fee, match_counter, names_of


def counters(*names: str) -> list[SimpleNamespace]:
    return [SimpleNamespace(id=index, name=name) for index, name in enumerate(names, start=1)]


class FeeTests(SimpleTestCase):
    def test_a_fee_charges_its_gold_and_the_roll_times_its_multiplier(self):
        self.assertEqual(gold_due(make_fee(gold=70, dice=3)), 70)
        self.assertEqual(gold_due(make_fee(gold=70, dice=3), 11), 81)
        self.assertEqual(gold_due(make_fee(gold=200, dice=1, dice_multiplier=25), 4), 300)
        self.assertEqual(gold_due(make_fee(resources=[("Treasure", 2)])), 0)
        for kind in ("replaces_hero", "special", "none"):
            with self.subTest(kind=kind):
                self.assertEqual(gold_due(make_fee(kind, 50)), 0)

    def test_a_resource_is_paid_by_a_counter_of_any_of_its_names(self):
        self.assertEqual(match_counter("Wyrdstone", counters("Gold", "Wyrdstone Shards")).name, "Wyrdstone Shards")
        self.assertEqual(match_counter("Wyrdstone", counters("shards")).name, "shards")
        self.assertEqual(match_counter("Treasure", counters("Treasures")).name, "Treasures")
        self.assertEqual(match_counter("Campaign points", counters("CP")).name, "CP")
        self.assertEqual(match_counter("Gromril", counters("gromril ")).name, "gromril ")
        self.assertIsNone(match_counter("Treasure", counters("Wyrdstone")))
        self.assertIn("wyrdstone shards", names_of("wyrdstone"))

    def test_wyrdstone_is_paid_by_the_default_resource_whatever_the_campaign_calls_it(self):
        mine = [
            SimpleNamespace(id=1, name="Wyrdstone shards", is_default=False),
            SimpleNamespace(id=2, name="Warpstone", is_default=True),
            SimpleNamespace(id=3, name="Treasures", is_default=False),
        ]
        self.assertEqual(match_counter("Wyrdstone", mine).name, "Warpstone")
        self.assertEqual(match_counter("Shards", mine).name, "Warpstone")
        self.assertEqual(match_counter("Treasure", mine).name, "Treasures")  # the rest still by name
        payload = fee_payload(make_fee(resources=[("Wyrdstone", 1), ("Treasure", 2)]))
        self.assertEqual([line["default_resource"] for line in payload["resources"]], [True, False])

    def test_a_written_fee_is_checked_and_stored_whole(self):
        self.assertEqual(clean_fee({"gold": 20}), make_fee(gold=20))
        cleaned = clean_fee({"kind": "gold", "resources": [{"resource": " Treasure ", "amount": 2}], "note": " * "})
        self.assertEqual(cleaned, make_fee(resources=[("Treasure", 2)], note="*"))
        for bad in ({"kind": "free"}, {"gold": -1}, {"dice_multiplier": 2}, "70 gc", {"resources": [{"amount": 1}]}):
            with self.subTest(fee=bad), self.assertRaises(ValueError):
                clean_fee(bad)

    def test_a_payload_names_what_pays_each_resource_and_fills_in_an_old_fee(self):
        payload = fee_payload(make_fee(resources=[("Wyrdstone", 1)]))
        self.assertEqual(payload["resources"][0]["names"][:2], ["wyrdstone", "wyrdstones"])
        self.assertEqual(fee_payload({"gold": 5}), {**make_fee(gold=5), "resources": []})

    def test_a_fee_in_words(self):
        self.assertEqual(fee_text(make_fee(gold=90, resources=[("Campaign points", 5)])), "90 gc + 5 Campaign points")
        self.assertEqual(fee_text(make_fee(gold=70, dice=3)), "70 gc + 3D6")
        self.assertEqual(fee_text(make_fee("replaces_hero")), "Takes a hero's place")
