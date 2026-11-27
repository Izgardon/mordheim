"""William's answers of 27 Nov 2026 to the items audit's decisions, as the committed `out/` holds them."""

from catalogue_import.tests.review_support import ReviewCase


class PriceTests(ReviewCase):
    """Question 16 ("Just do B ignore book")."""

    def test_the_double_barrelled_pistols_brace_is_twice_the_single(self) -> None:
        brace = [row for row in self.items["Double-barrelled Pistol"]["availabilities"] if row["label"] == "Brace"]
        self.assertEqual([(row["cost"], row["dice"]) for row in brace], [(50, 2)])

    def test_the_channel_rats_compass_takes_the_pirates_dice(self) -> None:
        self.assertEqual(self.rows("Compass", "channel-rats"), [(45, 2, 9, "")])


class BombTests(ReviewCase):
    """Question 14 (A): every bomb is Miscellaneous, as the Fire and Smoke Bombs are, so none shows a weapon line and
    each says its range and Strength in its rules."""

    BOMBS = ("Acid Bomb", "Bait Bomb", "Stink Bomb", "Fire Bomb", "Smoke Bomb")

    def test_every_bomb_is_miscellaneous_with_no_weapon_line(self) -> None:
        for name in self.BOMBS:
            with self.subTest(item=name):
                item = self.items[name]
                self.assertEqual(
                    (item["type"], item["subtype"], item["range"], item["strength"]), ("Miscellaneous", "", "", "")
                )

    def test_the_innocents_bombs_say_their_range_and_strength_in_their_rules(self) -> None:
        for name in ("Acid Bomb", "Bait Bomb", "Stink Bomb"):
            with self.subTest(item=name):
                text = " ".join(rule["text"] for rule in self.items[name]["rules"])
                self.assertIn("a range of twice the thrower's Strength in inches", text)
        self.assertIn("D3 Strength 5 hits with no armour save", self.items["Acid Bomb"]["rules"][0]["text"])
        self.assertIn('within 1", friend or foe, takes one Strength 4 hit', self.items["Acid Bomb"]["rules"][0]["text"])
