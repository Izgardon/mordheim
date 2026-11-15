"""What counts as a re-roll of the exploration dice (William, 12 Nov 2026).

A re-roll is a die whose value changed, not a die that went away: a player who over-counted his heroes and corrects
three dice to two has re-rolled nothing. Only the dice the saved roll and the new one have in common are compared,
so a shorter list and a longer one both pass unless a shared die shows a different value.
"""

from django.test import SimpleTestCase

from apps.battles.services.exploration import EXPLORATION_REROLLED, keep_exploration
from apps.exploration.chart import empty_chart


class ExplorationRerollTests(SimpleTestCase):
    def codes(self, before: list[int], after: list[int]) -> list[str]:
        stored = {"dice_values": before, "previous_rolls": []}
        _kept, warnings = keep_exploration(stored, {"dice_values": after}, empty_chart())
        return [warning["code"] for warning in warnings]

    def test_the_same_dice_again_are_not_a_re_roll(self):
        self.assertEqual(self.codes([2, 3, 4], [2, 3, 4]), [])

    def test_a_die_added_after_the_saved_ones_is_not_a_re_roll(self):
        self.assertEqual(self.codes([2, 3], [2, 3, 4]), [])

    def test_a_die_taken_away_is_not_a_re_roll(self):
        # he typed three dice, counted his heroes again and corrected it to two: nothing was re-rolled
        self.assertEqual(self.codes([2, 3, 4], [2, 3]), [])

    def test_a_die_whose_value_changed_is_a_re_roll_and_is_logged(self):
        kept, warnings = keep_exploration({"dice_values": [2, 3]}, {"dice_values": [2, 5]}, empty_chart())

        self.assertEqual([warning["code"] for warning in warnings], [EXPLORATION_REROLLED])
        self.assertEqual(warnings[0]["message"], "Exploration was re-rolled (it was 2, 3); the re-roll is logged.")
        self.assertEqual(kept["previous_rolls"], [[2, 3]])

    def test_a_shorter_roll_with_a_changed_die_is_still_a_re_roll(self):
        self.assertEqual(self.codes([2, 3, 4], [6]), [EXPLORATION_REROLLED])
