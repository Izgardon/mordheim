from django.test import SimpleTestCase

from catalogue_import.prices import mim_cost, mordheimer_cost, parse_dice, parse_rarity


class DiceTests(SimpleTestCase):
    def test_dice_and_multipliers(self) -> None:
        self.assertEqual(parse_dice("+2D6 gc"), (2, None))
        self.assertEqual(parse_dice("+D6 gc"), (1, None))
        self.assertEqual(parse_dice("+D6x25 gc"), (1, 25))
        self.assertEqual(parse_dice("+ 4D6"), (4, None))

    def test_wording_that_is_not_dice(self) -> None:
        self.assertIsNone(parse_dice("1/3 of the boat price"))
        self.assertIsNone(parse_dice("per pair"))


class CostTests(SimpleTestCase):
    def test_base_plus_dice(self) -> None:
        self.assertEqual(
            mordheimer_cost({"cost": 25, "numD6": 2}),
            {"cost": 25, "dice": 2, "dice_multiplier": None, "cost_note": ""},
        )

    def test_d6_times_a_number(self) -> None:
        self.assertEqual(mordheimer_cost({"cost": 200, "d6TimesNum": 25})["dice"], 1)
        self.assertEqual(mordheimer_cost({"cost": 200, "d6TimesNum": 25})["dice_multiplier"], 25)

    def test_odd_wording_goes_to_the_cost_note(self) -> None:
        self.assertEqual(mordheimer_cost({"costPrefix": "1st free/", "cost": 2})["cost_note"], "1st free")
        self.assertEqual(mordheimer_cost({"cost": 20, "costSuffix": "per pair"})["cost_note"], "per pair")
        gromril = mordheimer_cost({"costMod": "4 x Price"})
        self.assertEqual((gromril["cost"], gromril["cost_note"]), (None, "4 x Price"))

    def test_no_cost_at_all(self) -> None:
        self.assertEqual(mordheimer_cost(None), {"cost": None, "dice": None, "dice_multiplier": None, "cost_note": ""})

    def test_mim_variable_cost(self) -> None:
        self.assertEqual(mim_cost(25, "+D6x10 gc"), {"cost": 25, "dice": 1, "dice_multiplier": 10, "cost_note": ""})
        self.assertEqual(mim_cost(0, "1/3 of the boat price")["cost_note"], "1/3 of the boat price")


class RarityTests(SimpleTestCase):
    def test_zero_is_common(self) -> None:
        self.assertEqual(parse_rarity(0), (None, ""))
        self.assertEqual(parse_rarity(9), (9, ""))
        self.assertEqual(parse_rarity("8"), (8, ""))

    def test_odd_values_say_so(self) -> None:
        self.assertEqual(parse_rarity("Common?"), (None, "Rarity in the source: Common?"))
        self.assertEqual(parse_rarity(""), (None, "No rarity in the source"))
