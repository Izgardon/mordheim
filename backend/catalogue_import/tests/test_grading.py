from django.test import SimpleTestCase

from catalogue_import.common import GRADE_RANK, majority
from catalogue_import.grading import Evidence, build_settings, content_setting


class MajorityGradeTests(SimpleTestCase):
    def test_the_most_common_grade_wins(self) -> None:
        self.assertEqual(majority(["1b", "3", "1b", "3", "1b"], GRADE_RANK), "1b")

    def test_a_tie_goes_to_the_lower_grade(self) -> None:
        self.assertEqual(majority(["3", "1b"], GRADE_RANK), "1b")

    def test_nothing_graded_gives_none(self) -> None:
        self.assertIsNone(majority([], GRADE_RANK))


class SettingTests(SimpleTestCase):
    def test_mordheim_content_lands_in_its_grade_part(self) -> None:
        self.assertEqual(content_setting(None, "core"), "mordheim")
        self.assertEqual(content_setting("mordheim", "1c"), "mordheim-1c")
        self.assertEqual(content_setting("", "2b"), "mordheim-2a")
        self.assertEqual(content_setting(None, "3"), "grade-3")
        self.assertEqual(content_setting("khemri", "3"), "khemri")

    def test_a_mixed_setting_takes_its_majority_and_counts_every_kind(self) -> None:
        evidence = Evidence()
        for grade in ("3",) * 8 + ("1b",) * 2:
            evidence.add("khemri", "warbands", grade, "w")
        for _ in range(12):
            evidence.add("khemri", "items", "1b", "i")
        evidence.add("mutiny-in-marienburg", "items", "2c", "odd")
        rows = {row["slug"]: row for row in build_settings(evidence, {})}
        self.assertEqual(rows["khemri"]["grade"], "1b")
        self.assertEqual(rows["khemri"]["counts"]["items"], 12)
        self.assertEqual(rows["mordheim"]["grade"], "1a")
        self.assertTrue(rows["mordheim"]["always_on"])
        self.assertEqual(evidence.odd_grades, [("mutiny-in-marienburg", "odd", "2c")])

    def test_overrides_set_a_grade(self) -> None:
        evidence = Evidence()
        evidence.add("lustria", "warbands", "1b", "w")
        rows = {row["slug"]: row for row in build_settings(evidence, {"lustria": "2a"})}
        self.assertEqual((rows["lustria"]["grade"], rows["lustria"]["grade_basis"]), ("2a", "set in overrides.json"))
