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

    def test_a_mixed_setting_takes_its_majority_and_counts_every_kind(self) -> None:
        evidence = Evidence()
        for grade in ("2b",) * 4 + ("1b",) * 6:
            evidence.add("lustria", "warbands", grade, "w")
        for _ in range(12):
            evidence.add("lustria", "items", "1b", "i")
        evidence.add("mutiny-in-marienburg", "items", "2c", "odd")
        rows = {row["slug"]: row for row in build_settings(evidence, {})}
        self.assertEqual(rows["lustria"]["grade"], "1b")
        self.assertEqual(rows["lustria"]["counts"]["items"], 12)
        self.assertEqual(rows["mordheim"]["grade"], "1a")
        self.assertTrue(rows["mordheim"]["always_on"])
        self.assertEqual(evidence.odd_grades, [("mutiny-in-marienburg", "odd", "2c")])

    def test_overrides_set_a_grade(self) -> None:
        evidence = Evidence()
        evidence.add("lustria", "warbands", "1b", "w")
        rows = {row["slug"]: row for row in build_settings(evidence, {"lustria": "2a"})}
        self.assertEqual((rows["lustria"]["grade"], rows["lustria"]["grade_basis"]), ("2a", "set in overrides.json"))


class SplitSettingTests(SimpleTestCase):
    """A setting split by grade, as Mordheim is. Khemri is the second (William, 11 Nov 2026: "Lets just add a
    Khemri 3 setting like we do for mordheim?"): its seven grade 3 warbands, and everything they bring, would
    otherwise ride into play on the majority's 1b."""

    def test_khemris_grade_3_content_lands_in_khemri_3(self) -> None:
        self.assertEqual(content_setting("khemri", "3"), "khemri-3")
        self.assertEqual(content_setting("khemri", "1b"), "khemri")
        self.assertEqual(content_setting("khemri", None), "khemri")

    def test_a_setting_that_is_not_split_keeps_every_grade(self) -> None:
        self.assertEqual(content_setting("lustria", "3"), "lustria")
        self.assertEqual(content_setting("border-town-burning", "1b"), "border-town-burning")

    def test_each_half_carries_its_grade_in_its_name_and_sits_beside_the_other(self) -> None:
        evidence = Evidence()
        evidence.add("khemri", "warbands", "1b", "Tomb Guardians")
        evidence.add("khemri-3", "warbands", "3", "Hobgoblins")
        rows = {row["slug"]: row for row in build_settings(evidence, {})}
        self.assertEqual(
            [(rows[slug]["name"], rows[slug]["grade"], rows[slug]["grade_basis"]) for slug in ("khemri", "khemri-3")],
            [("Khemri 1b", "1b", "Khemri split by grade"), ("Khemri 3", "3", "Khemri split by grade")],
        )
        self.assertEqual(rows["khemri-3"]["sort_order"], rows["khemri"]["sort_order"] + 1)

    def test_a_split_half_exists_even_with_nothing_in_it(self) -> None:
        rows = {row["slug"]: row for row in build_settings(Evidence(), {})}
        self.assertEqual(rows["khemri-3"]["counts"], {kind: 0 for kind in rows["khemri-3"]["counts"]})


class EmptySettingTests(SimpleTestCase):
    """A supplement we hold nothing graded of yet (Albion): its row is stated, so a campaign can tick it and its
    exploration chart can be seeded."""

    def test_albion_is_built_at_its_stated_grade_with_every_count_zero(self) -> None:
        evidence = Evidence()
        evidence.add("sealed-city", "warbands", "2b", "w")  # the 2b supplement it follows
        evidence.add("athel-loren", "warbands", "3", "w")  # and the grade 3 setting it comes before
        rows = {row["slug"]: row for row in build_settings(evidence, {})}
        albion = rows["albion"]
        self.assertEqual((albion["name"], albion["grade"]), ("Albion", "2b"))
        self.assertEqual(albion["grade_basis"], "stated here: nothing graded in it yet")
        self.assertEqual(albion["counts"], {kind: 0 for kind in albion["counts"]})
        self.assertFalse(albion["always_on"])
        self.assertEqual(albion["sort_order"], rows["sealed-city"]["sort_order"] + 1)
        self.assertEqual(albion["sort_order"], rows["athel-loren"]["sort_order"] - 1)

    def test_content_graded_into_it_takes_the_majority_rule_over(self) -> None:
        evidence = Evidence()
        for grade in ("1c",) * 3:
            evidence.add("albion", "warbands", grade, "w")
        rows = {row["slug"]: row for row in build_settings(evidence, {})}
        self.assertEqual(rows["albion"]["grade"], "1c")
        self.assertEqual(rows["albion"]["grade_basis"], "majority of 3 graded entries")
