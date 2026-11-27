"""William's answers of 27 Nov 2026 to the items audit's decisions, as the committed `out/` holds them."""

from catalogue_import.tests.review_support import ReviewCase


class PriceTests(ReviewCase):
    """Question 16 ("Just do B ignore book")."""

    def test_the_double_barrelled_pistols_brace_is_twice_the_single(self) -> None:
        brace = [row for row in self.items["Double-barrelled Pistol"]["availabilities"] if row["label"] == "Brace"]
        self.assertEqual([(row["cost"], row["dice"]) for row in brace], [(50, 2)])

    def test_the_channel_rats_compass_takes_the_pirates_dice(self) -> None:
        self.assertEqual(self.rows("Compass", "channel-rats"), [(45, 2, 9, "")])
