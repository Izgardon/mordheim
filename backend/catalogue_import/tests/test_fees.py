"""Hire fees and upkeep read into structured fees (the fees and skill lists step): every shape mordheimer writes them
in, and what the report says of each."""

from django.test import SimpleTestCase

from catalogue_import.fees import describe, fee, read_fee

SIGMUND = (
    "70 gold crowns to hire, Sigmund Sprandle may also be hired in the payment of one body part. If you wish to do this"
    " then a chosen Hero suffers one Severe Arm Wound and may only use one single handed weapon from now on."
)


def hire(value: object) -> dict:
    return read_fee(value, upkeep=False).fee


def upkeep(value: object) -> dict:
    return read_fee(value, upkeep=True).fee


class ReadFeeTests(SimpleTestCase):
    def test_a_plain_number_is_gold(self) -> None:
        self.assertEqual(hire("25"), fee("gold", 25))
        self.assertEqual(hire(40), fee("gold", 40))
        self.assertEqual(hire("30 gc"), fee("gold", 30))
        self.assertTrue(read_fee("25", upkeep=False).plain)
        self.assertFalse(read_fee("30 gc", upkeep=False).plain)

    def test_gold_and_dice(self) -> None:
        # Ninja: 70 + 3D6
        self.assertEqual(hire("70 +3D6"), fee("gold", 70, dice=3, dice_multiplier=None))
        self.assertEqual(hire("D6x10"), fee("gold", None, dice=1, dice_multiplier=10))

    def test_resources_alone_or_beside_gold(self) -> None:
        self.assertEqual(upkeep("1 wyrdstone"), fee("gold", resources=[{"resource": "Wyrdstone", "amount": 1}]))
        self.assertEqual(hire("2 treasures"), fee("gold", resources=[{"resource": "Treasure", "amount": 2}]))
        self.assertEqual(upkeep("1 piece of Wyrdstone"), fee("gold", resources=[{"resource": "Wyrdstone", "amount": 1}]))  # fmt: skip
        self.assertEqual(
            hire("90 gc and 5 campaign points"),
            fee("gold", 90, resources=[{"resource": "Campaign points", "amount": 5}]),
        )
        self.assertEqual(upkeep("2 campaign points"), fee("gold", resources=[{"resource": "Campaign points", "amount": 2}]))  # fmt: skip

    def test_a_footnote_keeps_the_gold_and_the_text_as_its_note(self) -> None:
        self.assertEqual(upkeep("15 gc*"), fee("gold", 15, note="15 gc*"))

    def test_hero_takes_a_heroes_place_and_na_is_his_rules_or_no_upkeep(self) -> None:
        self.assertEqual(hire("Hero")["kind"], "replaces_hero")
        self.assertEqual(hire("Hero")["gold"], None)
        self.assertEqual(hire("n/a")["kind"], "special")
        self.assertEqual(upkeep("n/a"), fee("none"))
        self.assertEqual(hire("See special rules.")["kind"], "special")

    def test_words_after_a_fee_that_reads_are_its_note(self) -> None:
        read = hire(SIGMUND)
        self.assertEqual((read["kind"], read["gold"]), ("gold", 70))
        self.assertTrue(read["note"].startswith("Sigmund Sprandle may also be hired in the payment of one body part."))

    def test_nothing_is_blank_and_words_alone_are_special_and_listed(self) -> None:
        self.assertEqual(read_fee("", upkeep=True), read_fee(None, upkeep=True))
        self.assertEqual(upkeep(""), fee())
        unread = read_fee("A favour from the Count", upkeep=False)
        self.assertEqual((unread.fee["kind"], unread.fee["note"], unread.unread), ("special", "A favour from the Count", True))  # fmt: skip

    def test_the_report_says_how_each_was_read(self) -> None:
        self.assertEqual(describe(read_fee("70 +3D6", upkeep=False)), "70 gc + 3D6")
        self.assertEqual(describe(read_fee("90 gc and 5 campaign points", upkeep=False)), "90 gc + 5 Campaign points")
        self.assertEqual(describe(read_fee("15 gc*", upkeep=True)), "15 gc; note: 15 gc*")
        self.assertEqual(describe(read_fee("n/a", upkeep=True)), "none")
        self.assertEqual(describe(read_fee("Hero", upkeep=False)), "takes a hero's place")
        self.assertEqual(describe(read_fee("", upkeep=True)), "- (no gold given)")
        self.assertEqual(describe(read_fee("n/a", upkeep=False)), "special (see the rules)")
